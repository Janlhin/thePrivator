"""Tests for the engine descriptions and the single-source capability matrix."""

import copy
import json

import pytest

from theprivator_sidecar import chromium
from theprivator_sidecar.engines import (
    DEFAULT_ENGINE,
    ENGINE_CHROMIUM,
    ENGINE_FIREFOX,
    capability_matrix,
    capability_matrix_rows,
    describe_engine,
    known_engines,
    normalize_engine,
)
from theprivator_sidecar.protocol import INVALID_REQUEST, PROFILE_STORE_CORRUPT, SidecarError
from theprivator_sidecar.profiles import ProfileRecord


def test_registry_lists_chromium_and_firefox_only():
    assert known_engines() == (ENGINE_CHROMIUM, ENGINE_FIREFOX)
    assert "safari" not in known_engines()
    assert {description.engine for description in capability_matrix()} == {
        ENGINE_CHROMIUM,
        ENGINE_FIREFOX,
    }


def test_describe_unknown_engine_is_rejected():
    with pytest.raises(SidecarError) as exc_info:
        describe_engine("safari")
    assert exc_info.value.code == INVALID_REQUEST

    with pytest.raises(SidecarError):
        describe_engine(None)

    with pytest.raises(SidecarError):
        describe_engine(123)


def test_normalize_engine_defaults_missing_to_chromium():
    assert normalize_engine(None) == DEFAULT_ENGINE
    assert normalize_engine(ENGINE_CHROMIUM) == ENGINE_CHROMIUM
    assert normalize_engine(ENGINE_FIREFOX) == ENGINE_FIREFOX


def test_normalize_engine_rejects_unknown_and_non_string():
    with pytest.raises(SidecarError) as exc_info:
        normalize_engine("edge")
    assert exc_info.value.code == INVALID_REQUEST

    with pytest.raises(SidecarError):
        normalize_engine(["chromium"])


def test_capability_matrix_describes_every_channel():
    rows = {row["engine"]: row for row in capability_matrix_rows()}

    chromium_row = rows[ENGINE_CHROMIUM]
    assert chromium_row["fingerprint"]["available"] is True
    assert chromium_row["automation"]["available"] is True
    assert chromium_row["launch"]["remoteDebugging"] is True
    assert chromium_row["launch"]["extensions"] is True
    assert chromium_row["cookies"]["schema"] == "chromium"

    firefox_row = rows[ENGINE_FIREFOX]
    assert firefox_row["fingerprint"]["available"] is False
    assert firefox_row["fingerprint"]["reason"]
    assert firefox_row["automation"]["available"] is False
    assert firefox_row["automation"]["reason"]
    assert firefox_row["launch"]["remoteDebugging"] is False
    assert firefox_row["launch"]["extensions"] is False
    assert firefox_row["cookies"]["schema"] == "firefox"

    # The matrix is the only place channel availability is decided.
    for row in rows.values():
        for field in ("executable", "launch", "cookies", "fingerprint", "automation"):
            assert field in row


def test_matrix_rows_are_json_safe():
    json.dumps(capability_matrix_rows())


def test_chromium_profile_dir_argument_is_attached():
    description = describe_engine(ENGINE_CHROMIUM)
    assert description.profile_dir_arguments("D:\\profiles\\demo") == [
        "--user-data-dir=D:\\profiles\\demo"
    ]


def test_firefox_profile_dir_argument_is_separate_token():
    description = describe_engine(ENGINE_FIREFOX)
    assert description.profile_dir_arguments("/home/user/demo") == ["-profile", "/home/user/demo"]


def test_build_launch_args_delegates_profile_dir_to_engine_template(tmp_path):
    executable = tmp_path / "chromium"
    executable.write_text("", encoding="utf-8")
    user_data_dir = tmp_path / "user-data"

    args = chromium.build_launch_args(executable, user_data_dir, "about:blank")

    assert args[0] == str(executable)
    assert f"--user-data-dir={user_data_dir}" in args


def test_profile_record_without_engine_reads_back_as_chromium():
    record = ProfileRecord.create("Demo")
    stored = record.to_store_dict()
    assert stored["engine"] == ENGINE_CHROMIUM

    legacy = copy.deepcopy(stored)
    del legacy["engine"]

    rebuilt = ProfileRecord.from_dict(legacy)
    assert rebuilt.engine == ENGINE_CHROMIUM
    assert rebuilt.to_public_dict()["engine"] == ENGINE_CHROMIUM
    assert rebuilt.defaults.browser == ENGINE_CHROMIUM


def test_profile_record_with_unknown_engine_is_rejected():
    record = ProfileRecord.create("Demo")
    stored = record.to_store_dict()
    stored["engine"] = "safari"

    with pytest.raises(SidecarError) as exc_info:
        ProfileRecord.from_dict(stored)
    assert exc_info.value.code == PROFILE_STORE_CORRUPT
