import { useId, useLayoutEffect, useRef, useState } from "react";
import { createIdentityDraftState, type IdentityDraftState } from "../../identityControls";
import { refreshIdentityPresets } from "../../identityPresetApi";
import { t } from "../../i18n";
import type { ProfileIdentity } from "../../sidecar/types";
import styles from "./FingerprintForm.module.css";

interface Props {
  draft: IdentityDraftState;
  presets: readonly ProfileIdentity[];
  disabled?: boolean;
  onChange: (draft: IdentityDraftState) => void;
}

// A complete replacement, not a merge: no old mask values or policies survive.
const REAL_PRESET: ProfileIdentity = {
  identityVersion: 2,
  label: "Real",
  presetId: null,
  browser: { mode: "real" },
  navigator: { mode: "real" },
  screen: { mode: "real" },
  locale: { mode: "real" },
  canvas: { mode: "real" },
  audio: { mode: "real" },
  webgl: { mode: "real" },
  webrtc: { mode: "real", policy: "real" },
  geolocation: { mode: "real", permission: "prompt" },
  mediaDevices: { mode: "real" },
  ports: { mode: "real" },
};

export function IdentityPresetPicker({ draft, presets, disabled, onChange }: Props) {
  const id = useId();
  const request = useRef<AbortController | null>(null);
  const [generated, setGenerated] = useState<ProfileIdentity[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  useLayoutEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );

  async function refresh() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setFailed(false);
    setMessage(t("Fetching presets from randomapi.dev…"));
    try {
      const next = await refreshIdentityPresets(presets, controller.signal);
      if (request.current !== controller || controller.signal.aborted) return;
      setGenerated(next);
      setMessage(t("Presets refreshed. Choose an API preset, then Save to apply it."));
    } catch {
      if (request.current !== controller || controller.signal.aborted) return;
      controller.abort();
      setFailed(true);
      setMessage(t("Could not refresh presets from randomapi.dev. Previous presets and draft unchanged. Try again."));
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  const selected = generated.findIndex((preset) => JSON.stringify(preset) === JSON.stringify(draft.identity));
  const isRealPreset = JSON.stringify(draft.identity) === JSON.stringify(REAL_PRESET);
  return (
    <div className={styles.labelRow}>
      <label htmlFor={id}>{t("Start from a preset")}</label>
      <div className={styles.inputAction}>
        <select
          id={id}
          disabled={disabled}
          value={isRealPreset ? "real" : selected >= 0 ? `api:${selected}` : ""}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "real") {
              onChange(createIdentityDraftState(structuredClone(REAL_PRESET)));
            } else if (value.startsWith("api:")) {
              const preset = generated[Number(value.slice(4))];
              if (preset) onChange(createIdentityDraftState(preset));
            }
          }}
        >
          <option value="">{t("Custom")}</option>
          <option value="real">{t("Real")}</option>
          {generated.length > 0 ? (
            <optgroup label={t("Generated from API")}>
              {generated.map((preset, index) => (
                <option key={index} value={`api:${index}`}>
                  {preset.label}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <button
          type="button"
          className={styles.refreshButton}
          disabled={busy || disabled || presets.length === 0}
          aria-label={t("Refresh presets")}
          aria-describedby={`${id}-hint`}
          onClick={() => void refresh()}
        >
          <span aria-hidden="true">↻</span> {busy ? t("Refreshing…") : t("Refresh")}
        </button>
        <button
          type="button"
          className={styles.infoButton}
          aria-label={t("Preset information")}
          aria-expanded={showInfo}
          aria-controls={`${id}-info`}
          title={t("Preset information")}
          onClick={() => setShowInfo(!showInfo)}
        >
          ⓘ
        </button>
      </div>
      <div id={`${id}-info`} className={styles.presetInfo} hidden={!showInfo}>
        <p className={styles.hint}>
          {t("A preset sets every surface at once. Editing any field afterwards makes the identity custom.")}
        </p>

        <p className={styles.hint}>
          {t(
            "Real disables masking on every surface, restores real WebRTC and asks for geolocation permission. Changes stay in the draft until Save.",
          )}
        </p>
        <p className={styles.hint} id={`${id}-hint`}>
          {t(
            "randomapi.dev: direct connection, not the profile proxy. Sends only OS/browser filters, no profile configuration or cookies; the provider sees your IP. Refresh does not change your draft.",
          )}
        </p>
        <p className={styles.hint}>
          {t(
            "API supplies random Chrome desktop user agents, not necessarily the latest Chrome. Other settings come from OS-matched local templates. This does not update Chromium; review consistency warnings before saving.",
          )}
        </p>
      </div>
      {message ? (
        <p className={failed ? styles.error : styles.hint} role={failed ? "alert" : "status"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
