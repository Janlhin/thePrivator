"""Tests for Chromium-family brand discovery and runtime brand recording."""

import pytest

from theprivator_sidecar import chromium
from theprivator_sidecar.protocol import CHROMIUM_EXECUTABLE_NOT_FOUND, SidecarError


def test_discovery_probes_edge_first(monkeypatch, tmp_path):
    seen: list[str] = []

    def fake_which(name: str):
        seen.append(name)
        return str(tmp_path / f"{name}.exe")

    monkeypatch.setattr(chromium.shutil, "which", fake_which)
    monkeypatch.setattr(chromium, "_is_executable_file", lambda _path: False)

    _path, brand = chromium.discover_executable_with_brand()

    assert brand == chromium.BRAND_EDGE
    assert seen[0] == "microsoft-edge"


def test_discovery_selects_chrome_when_edge_is_absent(monkeypatch):
    monkeypatch.setattr(chromium.shutil, "which", lambda _name: None)

    def fake_is_executable(path):
        return str(path).endswith("chrome.exe") and "Google" in str(path)

    monkeypatch.setattr(chromium, "_is_executable_file", fake_is_executable)

    _path, brand = chromium.discover_executable_with_brand()

    assert brand == chromium.BRAND_CHROME


def test_discovery_selects_brave_when_edge_and_chrome_absent(monkeypatch):
    monkeypatch.setattr(chromium.shutil, "which", lambda _name: None)

    def fake_is_executable(path):
        return str(path).endswith("brave.exe")

    monkeypatch.setattr(chromium, "_is_executable_file", fake_is_executable)

    _path, brand = chromium.discover_executable_with_brand()

    assert brand == chromium.BRAND_BRAVE


def test_explicit_env_path_wins_and_brand_is_derived(monkeypatch, tmp_path):
    executable = tmp_path / "msedge-custom.exe"
    executable.write_text("", encoding="utf-8")
    executable.chmod(0o755)
    monkeypatch.setenv("THEPRIVATOR_CHROMIUM_PATH", str(executable))

    path, brand = chromium.discover_executable_with_brand()

    assert path == executable
    assert brand == chromium.BRAND_EDGE


def test_missing_executable_reports_not_found(monkeypatch):
    monkeypatch.setattr(chromium.shutil, "which", lambda _name: None)
    monkeypatch.setattr(chromium, "_is_executable_file", lambda _path: False)

    with pytest.raises(SidecarError) as exc_info:
        chromium.discover_executable_with_brand()

    assert exc_info.value.code == CHROMIUM_EXECUTABLE_NOT_FOUND


def test_runtime_record_round_trips_brand():
    record = chromium.RuntimeRecord(
        profile_id="profile-1",
        pid=12345,
        started_at="2026-01-01T00:00:00.000Z",
        user_data_dir="profile-store/profiles/profile-1/user-data",
        owner_token="owner-token",
        brand=chromium.BRAND_EDGE,
    )

    restored = chromium.RuntimeRecord.from_dict(record.to_dict())

    assert restored is not None
    assert restored.brand == chromium.BRAND_EDGE


def test_find_launched_browser_pid_prefers_main_process(monkeypatch, tmp_path):
    if not chromium.HAS_PSUTIL:
        pytest.skip("psutil unavailable in this environment")
    udd = tmp_path / "user-data"

    class _FakeProc:
        def __init__(self, pid: int, cmdline: list[str]) -> None:
            self.pid = pid
            self._cmdline = cmdline

        def cmdline(self) -> list[str]:
            return self._cmdline

    procs = [
        _FakeProc(11, [f"--user-data-dir={udd}", "--type=renderer"]),
        _FakeProc(22, [f"--user-data-dir={udd}", "--profile-directory=Default"]),
    ]
    monkeypatch.setattr(chromium.psutil, "process_iter", lambda _fields=None: procs)

    assert chromium._find_launched_browser_pid(udd) == 22


def test_find_launched_browser_pid_returns_none_when_only_helpers(monkeypatch, tmp_path):
    if not chromium.HAS_PSUTIL:
        pytest.skip("psutil unavailable in this environment")
    udd = tmp_path / "user-data"

    class _FakeProc:
        def __init__(self, pid: int, cmdline: list[str]) -> None:
            self.pid = pid
            self._cmdline = cmdline

        def cmdline(self) -> list[str]:
            return self._cmdline

    procs = [_FakeProc(11, [f"--user-data-dir={udd}", "--type=renderer"])]
    monkeypatch.setattr(chromium.psutil, "process_iter", lambda _fields=None: procs)

    assert chromium._find_launched_browser_pid(udd) is None


def test_running_payload_carries_brand():
    record = chromium.RuntimeRecord(
        profile_id="profile-1",
        pid=12345,
        started_at="2026-01-01T00:00:00.000Z",
        user_data_dir="profile-store/profiles/profile-1/user-data",
        owner_token="owner-token",
        brand=chromium.BRAND_CHROME,
    )

    payload = chromium._running_payload(record)

    assert payload["brand"] == chromium.BRAND_CHROME
