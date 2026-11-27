"""Engine descriptions and the single source of truth for the capability matrix.

Every browser engine ThePrivator can drive is described here: how its executable
is discovered, how its launch arguments are templated, where its cookies live,
and which injection/automation channels exist. The lifecycle code reads this
registry instead of carrying scattered ``if chrome`` branches; the UI and the
README capability table derive from the same rows and must stay aligned with
them.

Adding an engine means adding one description here plus its lifecycle adapter.
Do not branch on the engine id elsewhere: a capability the matrix marks
unavailable must surface as a disabled UI control, not as a switch that fails
at launch.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Optional, Sequence, Union

from .protocol import INVALID_REQUEST, SidecarError

# Engine identifiers persisted on profile records. ``safari`` is deliberately
# absent (see T-028): it has no equivalent of a selectable profile directory and
# cannot be driven from this project.
ENGINE_CHROMIUM = "chromium"
ENGINE_FIREFOX = "firefox"

# Existing records predate the field; they read back as Chromium.
DEFAULT_ENGINE = ENGINE_CHROMIUM

# Switch names owned by the Chromium template. The lifecycle code never spells
# these out itself; it asks the engine description for the arguments it owns.
CHROMIUM_PROFILE_DIR_SWITCH = "--user-data-dir="
CHROMIUM_REMOTE_DEBUGGING_SWITCH = "--remote-debugging-port="
CHROMIUM_LOAD_EXTENSION_PREFIX = "--load-extension="
CHROMIUM_DISABLE_EXTENSIONS_EXCEPT_PREFIX = "--disable-extensions-except="
CHROMIUM_REMOTE_ALLOW_ORIGINS_ARG = "--remote-allow-origins=*"

# Discovery environment variable overriding the executable path for an engine.
CHROMIUM_EXECUTABLE_ENV = "THEPRIVATOR_CHROMIUM_PATH"
FIREFOX_EXECUTABLE_ENV = "THEPRIVATOR_FIREFOX_PATH"

# Curated POSIX-relative cookie database candidates under a profile's user-data
# directory, checked in order.
CHROMIUM_COOKIE_CANDIDATES = (
    "Default/Network/Cookies",
    "Default/Cookies",
)
FIREFOX_COOKIE_CANDIDATES = ("cookies.sqlite",)


@dataclass(frozen=True)
class ChannelCapability:
    """Whether one injection or automation channel exists for an engine."""

    available: bool
    # Human-readable reason shown in the UI when the channel is unavailable.
    reason: str


@dataclass(frozen=True)
class CookieStorageDescription:
    """How a profile's cookie store is located and read or written."""

    # Schema family: ``chromium`` (Chrome/Edge/Brave SQLite row layout) or
    # ``firefox`` (mozilla cookies.sqlite layout).
    schema: str
    db_candidates: tuple[str, ...]


@dataclass(frozen=True)
class EngineDescription:
    """One drivable browser engine and every channel it exposes."""

    engine: str
    label: str

    # Executable discovery: an explicit env var wins, then the PATH probe names
    # in listed order.
    executable_env: str
    executable_names: tuple[str, ...]

    # Launch argument template. ``profile_dir_style`` says whether the profile
    # directory switch attaches its value with ``=`` or takes a separate argv
    # token. A ``None`` switch means the engine does not expose that channel at
    # all (for example Firefox has no DevTools port).
    profile_dir_switch: str
    profile_dir_style: str
    remote_debugging_switch: Optional[str]
    extension_switch_prefix: Optional[str]

    # Channels.
    fingerprint: ChannelCapability
    automation: ChannelCapability
    cookie_storage: CookieStorageDescription

    def profile_dir_arguments(self, user_data_dir: Union[str, Path]) -> list[str]:
        """Build the profile-directory argv entries for this engine."""
        if self.profile_dir_style == "separate":
            return [self.profile_dir_switch, str(user_data_dir)]
        return [f"{self.profile_dir_switch}{user_data_dir}"]


def _chromium_description() -> EngineDescription:
    return EngineDescription(
        engine=ENGINE_CHROMIUM,
        label="Chromium",
        executable_env=CHROMIUM_EXECUTABLE_ENV,
        executable_names=(
            "chromium-browser",
            "chromium",
            "google-chrome",
            "google-chrome-stable",
            "chrome",
        ),
        profile_dir_switch=CHROMIUM_PROFILE_DIR_SWITCH,
        profile_dir_style="attached",
        remote_debugging_switch=CHROMIUM_REMOTE_DEBUGGING_SWITCH,
        extension_switch_prefix=CHROMIUM_LOAD_EXTENSION_PREFIX,
        fingerprint=ChannelCapability(
            available=True,
            reason="",
        ),
        automation=ChannelCapability(
            available=True,
            reason="",
        ),
        cookie_storage=CookieStorageDescription(
            schema="chromium",
            db_candidates=CHROMIUM_COOKIE_CANDIDATES,
        ),
    )


def _firefox_description() -> EngineDescription:
    return EngineDescription(
        engine=ENGINE_FIREFOX,
        label="Firefox",
        executable_env=FIREFOX_EXECUTABLE_ENV,
        executable_names=("firefox",),
        profile_dir_switch="-profile",
        profile_dir_style="separate",
        remote_debugging_switch=None,
        extension_switch_prefix=None,
        fingerprint=ChannelCapability(
            available=False,
            reason="Firefox does not expose a channel for ThePrivator's fingerprint injection; identity surfaces stay on the real host values.",
        ),
        automation=ChannelCapability(
            available=False,
            reason="Firefox has no CDP endpoint, so internal automation and the identity audit are unavailable.",
        ),
        cookie_storage=CookieStorageDescription(
            schema="firefox",
            db_candidates=FIREFOX_COOKIE_CANDIDATES,
        ),
    )


_REGISTRY: dict[str, EngineDescription] = {
    description.engine: description
    for description in (_chromium_description(), _firefox_description())
}

# Field order used when the matrix is serialized for the UI, docs, or a parity
# check. Keep this list in lock-step with the README capability table.
CAPABILITY_FIELDS: tuple[str, ...] = (
    "executable",
    "launch",
    "cookies",
    "fingerprint",
    "automation",
)


def describe_engine(engine: str) -> EngineDescription:
    """Return the description for a known engine, rejecting unknown ids."""
    description = _REGISTRY.get(engine) if isinstance(engine, str) else None
    if description is None:
        raise SidecarError(
            code=INVALID_REQUEST,
            message="Unknown browser engine.",
        )
    return description


def normalize_engine(value: Any) -> str:
    """Coerce a record's engine value to a known engine id.

    A missing or ``None`` value reads back as :data:`DEFAULT_ENGINE`, which is
    the migration path for records written before the field existed. Any other
    non-string or unrecognized value is rejected rather than silently defaulted.
    """
    if value is None:
        return DEFAULT_ENGINE
    return describe_engine(value).engine


def known_engines() -> tuple[str, ...]:
    """Every registered engine id in registry order."""
    return tuple(_REGISTRY)


def capability_matrix() -> tuple[EngineDescription, ...]:
    """The registered descriptions in registry order."""
    return tuple(_REGISTRY.values())


def capability_matrix_rows() -> list[dict[str, Any]]:
    """Serialize the matrix as plain JSON-safe rows for the UI and docs."""
    rows: list[dict[str, Any]] = []
    for description in _REGISTRY.values():
        rows.append(
            {
                "engine": description.engine,
                "label": description.label,
                "executable": {
                    "env": description.executable_env,
                    "names": list(description.executable_names),
                },
                "launch": {
                    "profileDirSwitch": description.profile_dir_switch,
                    "profileDirStyle": description.profile_dir_style,
                    "remoteDebugging": description.remote_debugging_switch is not None,
                    "extensions": description.extension_switch_prefix is not None,
                },
                "cookies": {
                    "schema": description.cookie_storage.schema,
                    "candidates": list(description.cookie_storage.db_candidates),
                },
                "fingerprint": {
                    "available": description.fingerprint.available,
                    "reason": description.fingerprint.reason,
                },
                "automation": {
                    "available": description.automation.available,
                    "reason": description.automation.reason,
                },
            }
        )
    return rows


def executable_candidates(description: EngineDescription) -> Sequence[str]:
    """PATH probe names for an engine, in priority order."""
    return description.executable_names


__all__ = [
    "ENGINE_CHROMIUM",
    "ENGINE_FIREFOX",
    "DEFAULT_ENGINE",
    "CHROMIUM_PROFILE_DIR_SWITCH",
    "CHROMIUM_REMOTE_DEBUGGING_SWITCH",
    "CHROMIUM_LOAD_EXTENSION_PREFIX",
    "CHROMIUM_DISABLE_EXTENSIONS_EXCEPT_PREFIX",
    "CHROMIUM_REMOTE_ALLOW_ORIGINS_ARG",
    "CHROMIUM_EXECUTABLE_ENV",
    "FIREFOX_EXECUTABLE_ENV",
    "ChannelCapability",
    "CookieStorageDescription",
    "EngineDescription",
    "CAPABILITY_FIELDS",
    "describe_engine",
    "normalize_engine",
    "known_engines",
    "capability_matrix",
    "capability_matrix_rows",
]
