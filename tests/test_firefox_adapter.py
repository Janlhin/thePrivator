"""Tests for the Firefox restricted-engine adapter and its capability matrix."""

import sqlite3

import pytest

from theprivator_sidecar import engines, firefox
from theprivator_sidecar.cookies import CookieDTO
from theprivator_sidecar.protocol import SidecarError


def test_launch_args_carry_profile_dir_and_no_remote(tmp_path):
    executable = "firefox"
    profile_dir = tmp_path / "profile"

    args = firefox.build_firefox_launch_args(executable, profile_dir)

    assert args == [str(executable), "-profile", str(profile_dir), "-no-remote"]


def test_direct_proxy_yields_no_preferences():
    assert firefox.firefox_proxy_preferences({"proxyVersion": 1, "mode": "direct"}) == {}


def test_socks5_proxy_credentials_map_to_native_preferences_without_bridge():
    proxy = {
        "proxyVersion": 1,
        "mode": "fixedServer",
        "protocol": "socks5",
        "host": "127.0.0.1",
        "port": 1080,
        "credentials": {"username": "edge-user", "password": "edge-pass"},
    }

    preferences = firefox.firefox_proxy_preferences(proxy)

    assert preferences == {
        "network.proxy.type": 1,
        "network.proxy.socks": "127.0.0.1",
        "network.proxy.socks_port": 1080,
        "network.proxy.socks_username": "edge-user",
        "network.proxy.socks_password": "edge-pass",
    }
    # The Firefox path must not pull in the Chromium SOCKS5 relay bridge.
    assert not hasattr(firefox, "proxy_bridge")


def test_read_missing_cookie_database_returns_empty(tmp_path):
    assert firefox.read_cookies_sqlite(tmp_path / "cookies.sqlite") == []


def test_cookie_round_trip_through_cookies_sqlite(tmp_path):
    db_path = tmp_path / "cookies.sqlite"
    source = [
        CookieDTO(
            domain="example.com",
            host_only=False,
            path="/",
            name="session",
            value="abc",
            secure=True,
            http_only=True,
            expires_unix=1_800_000_000,
            same_site="lax",
            priority="medium",
        ),
        CookieDTO(
            domain=".shop.example",
            host_only=True,
            path="/cart",
            name="cart",
            value="1",
            secure=False,
            http_only=False,
            expires_unix=None,
            same_site="strict",
            priority="high",
        ),
    ]

    written = firefox.write_cookies_sqlite(db_path, source)
    assert written == 2

    restored = firefox.read_cookies_sqlite(db_path)

    assert [(cookie.name, cookie.domain, cookie.path, cookie.value) for cookie in restored] == [
        ("session", "example.com", "/", "abc"),
        ("cart", ".shop.example", "/cart", "1"),
    ]
    first, second = restored
    assert first.secure is True
    assert first.http_only is True
    assert first.expires_unix == pytest.approx(1_800_000_000)
    assert first.same_site == "lax"
    assert second.expires_unix is None
    assert second.same_site == "strict"


def test_firefox_matrix_marks_fingerprint_and_automation_unavailable():
    firefox_desc = engines.describe_engine(engines.ENGINE_FIREFOX)

    assert firefox_desc.fingerprint.available is False
    assert firefox_desc.automation.available is False
    assert firefox_desc.fingerprint.reason
    assert firefox_desc.automation.reason

    chromium_desc = engines.describe_engine(engines.ENGINE_CHROMIUM)
    assert chromium_desc.fingerprint.available is True
    assert chromium_desc.automation.available is True


def test_matrix_rows_expose_both_engines():
    rows = {row["engine"]: row for row in engines.capability_matrix_rows()}

    assert set(rows) == {"chromium", "firefox"}
    assert rows["firefox"]["fingerprint"]["available"] is False
    assert rows["firefox"]["automation"]["available"] is False
    assert rows["chromium"]["fingerprint"]["available"] is True


def test_unknown_engine_is_rejected():
    with pytest.raises(SidecarError):
        engines.describe_engine("safari")


def test_cookie_table_schema_is_created_on_write(tmp_path):
    db_path = tmp_path / "cookies.sqlite"
    firefox.write_cookies_sqlite(db_path, [])

    connection = sqlite3.connect(db_path)
    try:
        columns = {row[1] for row in connection.execute("PRAGMA table_info(cookies)").fetchall()}
    finally:
        connection.close()
    assert {"host", "name", "value", "path", "expiry", "isSecure"}.issubset(columns)
