import { useCallback, useState } from "react";

import { pickFile, pickSaveTarget } from "../../dialogs";
import { t } from "../../i18n";
import { buildIdentityAuditGuidance } from "../../identityAuditGuidance";
import {
  checkProfileProxy,
  collectIdentityAuditResults,
  exportProfileCookies,
  exportProfilePackage,
  getIdentityAuditPlan,
  normalizeSidecarError,
  openIdentityAuditPage,
  replaceProfileCookies,
} from "../../sidecar/client";
import type {
  IdentityAuditCollectResult,
  IdentityAuditPlanResult,
  ProfileIdentity,
  ProxyCheckResult,
} from "../../sidecar/types";
import styles from "./ProfileEditor.module.css";

interface ProfileToolsProps {
  profileId: string | null;
  running: boolean;
  /** The saved identity, so the audit can say what each page should report. */
  identity?: ProfileIdentity;
}

type Note = { tone: "ok" | "warn"; text: string };

/**
 * What a proxy check actually established.
 *
 * Split out so the wording can be tested on its own: the difference between
 * "not established" and a blank cell is the difference between telling someone
 * their traffic was not verified and letting them assume it was.
 */
export function ProxyCheckSummary({ result }: { result: ProxyCheckResult }) {
  return (
    <dl className={styles.checkFacts} aria-label={t("Proxy check result")}>
      <div>
        <dt>{t("Route")}</dt>
        <dd>{result.routeProof.status}</dd>
      </div>
      <div>
        <dt>{t("Exit address")}</dt>
        <dd>{result.ipHiding.publicExitIp ?? t("not established")}</dd>
      </div>
      <div>
        <dt>{t("WebRTC")}</dt>
        <dd>{result.webRtc.status}</dd>
      </div>
    </dl>
  );
}

interface AuditPageListProps {
  pages: IdentityAuditPlanResult["pages"];
  disabled: boolean;
  /** The identity to compare against; omitted while a draft is unsaved. */
  identity?: ProfileIdentity;
  onOpen: (pageId: string) => void;
}

/**
 * The audit pages, as a list you can act on.
 *
 * Split out because of the invariant it carries: *every* page gets a button,
 * including the ones that need the user to click something on the page itself.
 * A "needs user action" row with nothing to press tells someone that something
 * is required of them and then gives them no way to do it.
 */
export function AuditPageList({ pages, disabled, identity, onOpen }: AuditPageListProps) {
  return (
    <ul className={styles.auditList} aria-label={t("Audit pages")}>
      {pages.map((page) => {
        // What this profile *should* report on that page. Without it the user is
        // looking at a stranger's numbers with nothing to compare them to, which
        // is most of the work an audit is supposed to save them.
        const expected = identity === undefined ? [] : expectedRowsFor(identity, page);
        return (
          <li key={page.id}>
            <div>
              <strong>{page.label}</strong>
              <span className={styles.hint}>{page.comparisonNote}</span>
              {expected.length > 0 ? (
                <span className={styles.hint}>
                  {t("Expect: {rows}", { rows: expected.map((row) => `${row.label} ${row.expected}`).join(" · ") })}
                </span>
              ) : null}
            </div>
            <button type="button" disabled={disabled} onClick={() => onOpen(page.id)}>
              {page.requiresUserAction ? t("Open and finish by hand") : t("Open")}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The expected rows, or none.
 *
 * The guidance builder validates the page it is handed and throws on anything it
 * does not recognise. A page this build has no guidance for is not a reason to
 * hide the page -- the user can still open it and read it themselves.
 */
function expectedRowsFor(identity: ProfileIdentity, page: IdentityAuditPlanResult["pages"][number]) {
  try {
    return buildIdentityAuditGuidance(identity, page).expectedRows;
  } catch {
    return [];
  }
}

/**
 * The things you do to a profile rather than to its settings.
 *
 * Every one of them touches the profile's own directory or its live browser,
 * which is why they sit here rather than beside the fields: exporting a profile
 * whose browser is running copies a database mid-write, and checking a proxy
 * needs a browser to check it through.
 */
export function ProfileTools({ profileId, running, identity }: ProfileToolsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [proxyCheck, setProxyCheck] = useState<ProxyCheckResult | null>(null);
  const [auditPlan, setAuditPlan] = useState<IdentityAuditPlanResult | null>(null);
  const [auditResults, setAuditResults] = useState<IdentityAuditCollectResult | null>(null);

  const run = useCallback((activity: string, work: () => Promise<void>) => {
    setBusy(activity);
    setError(null);
    setNote(null);
    void (async () => {
      try {
        await work();
      } catch (caught) {
        setError(normalizeSidecarError(caught).message);
      } finally {
        setBusy(null);
      }
    })();
  }, []);

  if (profileId === null) {
    return (
      <p className={styles.loading}>
        {t("These tools work on a saved profile. Save this one first, then come back.")}
      </p>
    );
  }

  const exportPackage = () =>
    run("package", async () => {
      const destination = await pickSaveTarget(t("Export this profile as a package"), [
        { name: t("ThePrivator package"), extensions: ["tpkg"] },
      ]);
      if (destination === null) {
        return;
      }
      const result = await exportProfilePackage(profileId, destination);
      setNote({
        tone: "ok",
        text: t("Exported {count} files. Proxy passwords were left out on purpose -- whoever opens this will need their own.", { count: result.payloadFileCount }),
      });
    });

  const exportCookies = () =>
    run("cookies", async () => {
      const destination = await pickSaveTarget(
        t("Export cookies as JSON"),
        [{ name: t("Browser cookies JSON"), extensions: ["json"] }],
      );
      if (destination === null) {
        return;
      }
      const result = await exportProfileCookies(profileId, destination, "theprivator-json");
      setNote({
        tone: result.skippedCount > 0 ? "warn" : "ok",
        text:
          result.skippedCount > 0
            ? t("Exported {exported} cookies. {skipped} could not be represented in this format.", { exported: result.exportedCount, skipped: result.skippedCount })
            : t("Exported {exported} cookies.", { exported: result.exportedCount }),
      });
    });

  const replaceCookies = () =>
    run("cookies", async () => {
      const source = await pickFile(t("Import cookies into this profile"), [
        { name: t("Cookie files"), extensions: ["txt", "json"] },
      ]);
      if (source === null) {
        return;
      }
      const result = await replaceProfileCookies(profileId, source);
      setNote({
        tone: "warn",
        text: t("Imported {imported} cookies, replacing this profile's previous {replaced}. The old ones are gone.", { imported: result.importedCount, replaced: result.replacedCount }),
      });
    });

  const check = () =>
    run("proxy", async () => {
      setProxyCheck(await checkProfileProxy(profileId));
    });

  const plan = () =>
    run("audit", async () => {
      setAuditPlan(await getIdentityAuditPlan(profileId));
      setAuditResults(null);
    });

  const collect = () =>
    run("collecting", async () => {
      setAuditResults(await collectIdentityAuditResults(profileId));
    });

  const openPage = (pageId: string) =>
    run("opening", async () => {
      await openIdentityAuditPage(profileId, pageId);
    });

  return (
    <div className={styles.general}>
      {error !== null ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {note !== null ? (
        <p className={note.tone === "warn" ? styles.error : styles.hint} role="status">
          {note.text}
        </p>
      ) : null}

      <section className={styles.fieldset}>
        <h3>{t("Cookies and packages")}</h3>
        <p className={styles.hint}>
          {t("Importing cookies replaces the ones this profile already has; it does not merge them. A package carries the fingerprint, the proxy server and the browsing data, but never the proxy password. The browser must be stopped for all of these: copying a profile mid-write produces one that will not open.")}
        </p>
        <p className={styles.hint}>
          {t("JSON import and export use the same cookie array: expirationDate is Unix seconds, session cookies use 0, and exports use storeId \"Default\". Older ThePrivator JSON and cookies.txt can still be imported.")}
        </p>
        <div className={styles.toolActions}>
          <button type="button" disabled={busy !== null || running} onClick={exportPackage}>
            {busy === "package" ? t("Exporting…") : t("Export as package")}
          </button>
          <button type="button" disabled={busy !== null || running} onClick={exportCookies}>
            {t("Export cookies (JSON)")}
          </button>
          <button type="button" disabled={busy !== null || running} onClick={replaceCookies}>
            {t("Import cookies…")}
          </button>
        </div>
        {running ? <p className={styles.hint}>{t("Stop this profile's browser to use these.")}</p> : null}
      </section>

      <section className={styles.fieldset}>
        <h3>{t("Proxy")}</h3>
        <p className={styles.hint}>
          {t("Checks that traffic really leaves through the proxy, and that WebRTC is not routing around it.")}
        </p>
        <div className={styles.toolActions}>
          <button type="button" disabled={busy !== null} onClick={check}>
            {busy === "proxy" ? t("Checking…") : t("Check the proxy")}
          </button>
        </div>
        {proxyCheck !== null ? <ProxyCheckSummary result={proxyCheck} /> : null}
      </section>

      <section className={styles.fieldset}>
        <h3>{t("Fingerprint audit")}</h3>
        <p className={styles.hint}>
          {t("Opens pages that report what a site actually sees, so the fingerprint can be compared against what this profile claims. A mask that disagrees with itself makes a profile easier to recognise, not harder.")}
        </p>
        <div className={styles.toolActions}>
          <button type="button" disabled={busy !== null} onClick={plan}>
            {busy === "audit" ? t("Loading…") : t("Show the audit pages")}
          </button>
          <button type="button" disabled={busy !== null || auditPlan === null} onClick={collect}>
            {busy === "collecting" ? t("Collecting…") : t("Collect results")}
          </button>
        </div>

        {auditPlan !== null ? (
          <AuditPageList
            pages={auditPlan.pages}
            disabled={busy !== null}
            identity={identity}
            onOpen={openPage}
          />
        ) : null}

        {auditResults !== null ? (
          <ul className={styles.auditList} aria-label={t("Audit results")}>
            {auditResults.pages.map((page) => (
              <li key={page.id}>
                <div>
                  <strong>{page.label}</strong>
                  <span className={styles.hint}>{page.status}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
