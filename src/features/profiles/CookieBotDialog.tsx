import { useEffect, useRef, useState } from "react";
import { t } from "../../i18n";
import { getCookieBotDefaults, getCookieBotStatus, startCookieBot, cancelCookieBot, normalizeSidecarError } from "../../sidecar/client";
import type { CookieBotConfig, CookieBotJob } from "../../sidecar/types";
import styles from "./ProfilesPage.module.css";
import fields from "./CookieBotDialog.module.css";

interface Props {
  profileId: string;
  profileName: string;
  onClose: () => void;
  onRefresh: () => void;
  onBusyChange: (busy: boolean) => void;
}

export function CookieBotDialog({ profileId, profileName, onClose, onRefresh, onBusyChange }: Props) {
  const [config, setConfig] = useState<CookieBotConfig | null>(null);
  const [defaultUrls, setDefaultUrls] = useState<string[]>([]);
  const [urls, setUrls] = useState("");
  const [job, setJob] = useState<CookieBotJob | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector("textarea")?.focus();
    return () => previous?.focus();
  }, []);
  const active = job !== null && ["queued", "running", "cancelling"].includes(job.status);

  const displayedConfig = active ? job.config : config;
  const displayedUrls = active ? job.config.urls.join("\n") : urls;

  useEffect(() => {
    let disposed = false;
    void Promise.all([getCookieBotDefaults(), getCookieBotStatus(profileId)]).then(([defaults, status]) => {
      if (!disposed) {
        setDefaultUrls(defaults.config.urls);
        setConfig(defaults.config);
        setJob(status.job);
      }
    }).catch((caught) => { if (!disposed) setError(normalizeSidecarError(caught).message); });
    return () => { disposed = true; };
  }, [profileId]);

  useEffect(() => { onBusyChange(pending || active); }, [pending, active, onBusyChange]);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const status = await getCookieBotStatus(profileId);
        if (!disposed) {
          setJob(status.job);
          if (!status.job || !["queued", "running", "cancelling"].includes(status.job.status)) onRefresh();
        }
      } catch (caught) { if (!disposed) setError(normalizeSidecarError(caught).message); }
      if (!disposed) timer = setTimeout(() => void poll(), 1000);
    };
    timer = setTimeout(() => void poll(), 1000);
    return () => { disposed = true; clearTimeout(timer); };
  }, [active, profileId, onRefresh]);

  const cancel = async () => {
    if (lock.current || !job || !active || job.status === "cancelling") return;
    lock.current = true; setPending(true); setError(null);
    try { setJob((await cancelCookieBot(profileId, job.jobId)).job); }
    catch (caught) { setError(normalizeSidecarError(caught).message); }
    finally { lock.current = false; setPending(false); }
  };

  const run = async () => {
    if (lock.current || active || config === null) return;
    setError(null);
    let normalized: string[];
    try {
      normalized = [...new Set(urls.trim().split(/[\s,]+/).filter(Boolean).map((value) => {
        const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error(t("Use HTTP or HTTPS URLs without embedded credentials."));
        url.hash = "";
        return url.href;
      }))];
      if (normalized.length > 25) throw new Error(t("Enter at most 25 URLs."));
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("Check the URLs.")); return; }
    lock.current = true; setPending(true);
    try { setJob((await startCookieBot(profileId, { ...config, urls: normalized.length ? normalized : defaultUrls })).job); onRefresh(); }
    catch (caught) { setError(normalizeSidecarError(caught).message); }
    finally { lock.current = false; setPending(false); }
  };

  return <div className={styles.overlay} role="presentation">
    <div ref={dialog} className={`${styles.dialog} ${fields.dialog}`} role="dialog" aria-modal="true" aria-label={t("Run Cookie Bot — {name}", { name: profileName })} onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); if (!pending && !active) onClose(); }
      if (event.key === "Tab") {
        const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement>("button, input, textarea")).filter((element) => !element.disabled);
        const target = event.shiftKey ? nodes[nodes.length - 1] : nodes[0];
        if ((event.shiftKey && document.activeElement === nodes[0]) || (!event.shiftKey && document.activeElement === nodes[nodes.length - 1])) { event.preventDefault(); target?.focus(); }
      }
    }}>
      <h2>{t("Run Cookie Bot")}</h2>
      <p>{t("Visit websites in {name} using its browser and configured proxy. Cookies set by those sites stay in this profile; sites may set no cookies. No login or consent buttons are clicked.", { name: profileName })}</p>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <label className={fields.field}>{t("Links to crawl")}
        <textarea value={displayedUrls} onChange={(event) => setUrls(event.target.value)} disabled={pending || active} rows={6}
          placeholder={t("Separate URLs with line breaks, commas or spaces. https:// is optional. Leave empty for the default sites.")} />
      </label>
      {displayedConfig ? <>
        <p className={fields.hint}>{t("Default sites: {sites}", { sites: defaultUrls.join(", ") })}</p>
        <p className={fields.hint}>{t("Only same-origin links are followed, up to depth {depth}. Browsing is limited to {pages} pages and {seconds} seconds, with {dwell} seconds per page after the DOM is ready. Within the overall time limit, pages get up to 10 seconds for the DOM and 2 extra seconds for delayed links. Cross-origin redirect destinations are not crawled further. Browser startup and cleanup take additional time.", {
          depth: displayedConfig.maxDepth,
          pages: displayedConfig.maxPages,
          seconds: displayedConfig.maxDurationSeconds,
          dwell: displayedConfig.dwellSeconds,
        })}</p>
        <label className={fields.toggle}><input type="checkbox" checked={displayedConfig.closeAfterCompletion} disabled={pending || active}
          onChange={(event) => setConfig((current) => current ? { ...current, closeAfterCompletion: event.target.checked } : current)} />{t("Close profile after all URLs are crawled")}</label>
      </> : <p>{t("Loading cookie bot settings…")}</p>}
      {job ? <p role="status">{t("{status}: {visited} pages visited; {failed} failed.", { status: job.status, visited: job.visitedPages, failed: job.failedPages })}{job.stopReason ? ` ${job.stopReason}.` : ""}{job.currentUrl ? ` ${t("Current page: {url}", { url: job.currentUrl })}` : ""}</p> : null}
      {job && job.errors.length > 0 ? <p role="alert" className={styles.error}>{job.errors.join(" · ")}</p> : null}
      <div className={styles.dialogActions}>
        <button type="button" className={styles.secondary} disabled={pending || active} onClick={onClose}>{job ? t("Close") : t("Cancel")}</button>
        {active ? <button type="button" className={styles.danger} disabled={pending || job?.status === "cancelling"} onClick={() => void cancel()}>{job?.status === "cancelling" ? t("Cancelling…") : t("Cancel run")}</button> :
          <button type="button" className={styles.primary} disabled={config === null || pending} onClick={() => void run()}>{pending ? t("Starting…") : t("Run")}</button>}
      </div>
    </div>
  </div>;
}
