import type { ProxyCheckSnapshot } from "../../sidecar/types";
import { currentLanguage } from "../../i18n/language";
import { t } from "../../i18n";
import styles from "./ProxyExit.module.css";

export interface ProxyCheckState {
  status: "pending" | "done" | "error";
  result?: ProxyCheckSnapshot;
  checkedAt?: number;
}

export function ProxyExit({
  direct,
  state,
  onCheck,
}: {
  direct: boolean;
  state?: ProxyCheckState | undefined;
  onCheck?: (() => void) | undefined;
}) {
  const ip = state?.status === "done" ? state.result?.ipHiding.publicExitIp : null;
  const location = state?.result?.ipHiding.publicExitLocation;
  const code = location?.countryCode;
  // Country names come from Intl, so they follow the interface language rather
  // than always arriving in English next to Chinese labels.
  const country = code
    ? (new Intl.DisplayNames([currentLanguage() === "zh" ? "zh" : "en"], { type: "region" }).of(code) ?? code)
    : null;
  const pending = state?.status === "pending";
  const label = pending
    ? t("Checking proxy…")
    : state?.status === "error"
      ? t("Check failed · Retry")
      : state?.status === "done"
        ? t("Exit IP unknown · Retry")
        : t("Check proxy");
  return (
    <span className={styles.root} aria-live="polite">
      {direct ? <span className={styles.direct}>{t("No proxy · Direct")}</span> : null}
      {ip ? (
        <span className={styles.exit}>
          {code ? (
            <span
              className={styles.flag}
              role="img"
              aria-label={t("{country} flag", { country: country ?? code })}
              title={country ?? code}
            >
              {String.fromCodePoint(...[...code].map((letter) => 127397 + letter.charCodeAt(0)))}
            </span>
          ) : (
            <span className={styles.flag} role="img" aria-label={t("Country unknown")} title={t("Country unknown")}>
              ?
            </span>
          )}
          <button
            className={styles.ip}
            type="button"
            disabled={!onCheck}
            title={`${direct ? t("Direct public IP (no proxy)") : t("Last checked public exit IP")}: ${ip}.${state?.checkedAt ? ` ${t("Checked {time}.", { time: new Date(state.checkedAt).toLocaleString() })}` : ""}${onCheck ? ` ${t("Click to recheck.")}` : ""}`}
            onDoubleClick={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onCheck?.();
            }}
          >
            {ip}
          </button>
        </span>
      ) : !direct || state ? (
        <button
          className={styles.check}
          type="button"
          disabled={pending || !onCheck}
          title={
            state?.status === "error"
              ? t("Proxy check failed. Verify the proxy configuration and connection, then retry.")
              : undefined
          }
          onDoubleClick={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onCheck?.();
          }}
        >
          {label}
        </button>
      ) : null}
    </span>
  );
}
