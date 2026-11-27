"""Firefox engine adapter: launch arguments, native proxy preferences, cookie store.

Firefox is a restricted engine in this project. It exposes neither a
fingerprint-injection channel nor a CDP automation endpoint; that capability
split lives in :mod:`theprivator_sidecar.engines`, the single matrix source. The
sidecar never spawns the Chromium SOCKS5 relay for Firefox: authenticated
SOCKS5 credentials are carried natively through the profile's proxy preferences
instead of handed to a local bridge.
"""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path
from typing import Any, Mapping, Optional, Sequence, Union

from .cookies import CookieDTO
from .protocol import (
    PORTABILITY_COOKIE_DB_UNAVAILABLE,
    PORTABILITY_COOKIE_READ_FAILED,
    PORTABILITY_COOKIE_WRITE_FAILED,
    PROXY_INVALID,
    SidecarError,
)
from .proxy import DIRECT_PROXY_MODE, FIXED_SERVER_PROXY_MODE, normalize_proxy_config

COOKIE_DB_NAME = "cookies.sqlite"
_SQLITE_TIMEOUT_SECONDS = 0.25

# Mozilla cookies.sqlite schema. Only the columns ThePrivator round-trips are
# written; the rest keep the schema's own defaults.
_COOKIE_SCHEMA = """
CREATE TABLE IF NOT EXISTS cookies (
  id INTEGER PRIMARY KEY,
  origin TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  host TEXT NOT NULL,
  path TEXT NOT NULL,
  expiry REAL,
  isSecure INTEGER NOT NULL,
  isHttpOnly INTEGER NOT NULL,
  creationTime INTEGER,
  lastAccessed INTEGER,
  inBrowserElement INTEGER NOT NULL DEFAULT 0,
  sameSite INTEGER NOT NULL DEFAULT 0,
  rawSameSite INTEGER NOT NULL DEFAULT 0,
  schemeMap INTEGER NOT NULL DEFAULT 0,
  dbPath TEXT,
  version INTEGER,
  hostOnly INTEGER NOT NULL DEFAULT 0
)
"""

_SAMESITE_TO_FX = {"unspecified": 0, "no_restriction": 0, "lax": 1, "strict": 2}
_FX_TO_SAMESITE = {0: "unspecified", 1: "lax", 2: "strict"}


def build_firefox_launch_args(
    executable: Union[str, Path],
    profile_dir: Union[str, Path],
) -> list[str]:
    """Build the Firefox command line for one dedicated profile directory."""
    return [str(executable), "-profile", str(profile_dir), "-no-remote"]


def firefox_proxy_preferences(proxy: Any) -> dict[str, Any]:
    """Map a normalized proxy config onto Firefox native proxy preferences.

    No local SOCKS relay is started. When credentials are configured they are
    written into the profile preferences directly; the Chromium auth-helper
    extension and the SOCKS5 bridge are not part of the Firefox launch path.
    """
    normalized = normalize_proxy_config(proxy)
    if normalized["mode"] == DIRECT_PROXY_MODE:
        return {}
    if normalized["mode"] != FIXED_SERVER_PROXY_MODE:
        raise SidecarError(
            code=PROXY_INVALID,
            message="Firefox proxy preferences could not be prepared.",
        )

    protocol = normalized["protocol"]
    preferences: dict[str, Any] = {"network.proxy.type": 1}
    if protocol == "socks5":
        preferences["network.proxy.socks"] = normalized["host"]
        preferences["network.proxy.socks_port"] = normalized["port"]
    elif protocol in ("http", "https"):
        preferences["network.proxy.http"] = normalized["host"]
        preferences["network.proxy.http_port"] = normalized["port"]
    else:
        raise SidecarError(
            code=PROXY_INVALID,
            message="Unsupported proxy protocol for Firefox.",
        )

    credentials = normalized.get("credentials")
    if isinstance(credentials, Mapping):
        preferences["network.proxy.socks_username"] = credentials["username"]
        preferences["network.proxy.socks_password"] = credentials["password"]
    return preferences


def read_cookies_sqlite(db_path: Union[str, Path]) -> list[CookieDTO]:
    """Read a Firefox ``cookies.sqlite`` into the shared sidecar cookie DTO."""
    path = Path(db_path)
    if not path.is_file():
        return []
    try:
        connection = sqlite3.connect(
            f"file:{path}?mode=ro",
            uri=True,
            timeout=_SQLITE_TIMEOUT_SECONDS,
        )
        connection.row_factory = sqlite3.Row
    except sqlite3.Error as exc:
        raise SidecarError(
            code=PORTABILITY_COOKIE_DB_UNAVAILABLE,
            message="Cookie database is unavailable.",
        ) from exc

    cookies: list[CookieDTO] = []
    try:
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(cookies)").fetchall()}
        if not {"host", "name", "value", "path"}.issubset(columns):
            return []
        cursor = connection.execute(
            "SELECT host, name, value, path, expiry, isSecure, isHttpOnly, sameSite FROM cookies"
        )
        for row in cursor.fetchall():
            host, name, value, path, expiry, secure, http_only, same_site = row
            cookies.append(
                CookieDTO(
                    domain=str(host),
                    host_only=not str(host).startswith("."),
                    path=str(path),
                    name=str(name),
                    value=str(value),
                    secure=bool(secure),
                    http_only=bool(http_only),
                    expires_unix=None if expiry is None else float(expiry),
                    same_site=_FX_TO_SAMESITE.get(int(same_site), "unspecified"),
                    priority="medium",
                )
            )
    except sqlite3.Error as exc:
        raise SidecarError(
            code=PORTABILITY_COOKIE_READ_FAILED,
            message="Cookie database could not be read.",
        ) from exc
    finally:
        connection.close()
    return cookies


def write_cookies_sqlite(db_path: Union[str, Path], cookies: Sequence[CookieDTO]) -> int:
    """Replace a Firefox ``cookies.sqlite`` with the supplied cookie set."""
    path = Path(db_path)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise SidecarError(
            code=PORTABILITY_COOKIE_WRITE_FAILED,
            message="Cookie database could not be prepared.",
        ) from exc

    connection: Optional[sqlite3.Connection] = None
    now = int(time.time() * 1_000_000)
    try:
        connection = sqlite3.connect(path, timeout=_SQLITE_TIMEOUT_SECONDS)
        connection.execute("BEGIN IMMEDIATE")
        connection.execute(_COOKIE_SCHEMA)
        connection.execute("DELETE FROM cookies")
        insert_sql = (
            "INSERT INTO cookies "
            "(origin, name, value, host, path, expiry, isSecure, isHttpOnly, "
            "creationTime, lastAccessed, sameSite, hostOnly) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        for cookie in cookies:
            origin = f"https://{cookie.domain}"
            expiry: Optional[float] = None
            if cookie.expires_unix is not None:
                expiry = float(cookie.expires_unix)
            connection.execute(
                insert_sql,
                (
                    origin,
                    cookie.name,
                    cookie.value,
                    cookie.domain,
                    cookie.path,
                    expiry,
                    1 if cookie.secure else 0,
                    1 if cookie.http_only else 0,
                    now,
                    now,
                    _SAMESITE_TO_FX.get(cookie.same_site, 0),
                    1 if cookie.host_only else 0,
                ),
            )
        connection.commit()
        return len(cookies)
    except sqlite3.Error as exc:
        if connection is not None:
            try:
                connection.rollback()
            except sqlite3.Error:
                pass
        raise SidecarError(
            code=PORTABILITY_COOKIE_WRITE_FAILED,
            message="Cookie database could not be updated.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


__all__ = [
    "COOKIE_DB_NAME",
    "build_firefox_launch_args",
    "firefox_proxy_preferences",
    "read_cookies_sqlite",
    "write_cookies_sqlite",
]
