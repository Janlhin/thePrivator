import { useCallback, useState } from "react";

import { pickDirectory, pickFile } from "../../dialogs";
import { t } from "../../i18n";
import {
  importLegacyProfiles,
  importProfilePackage,
  normalizeSidecarError,
  scanLegacyProfiles,
} from "../../sidecar/client";
import type { LegacyImportResult, LegacyScanResult, ProfilePackageImportResult } from "../../sidecar/types";
import { BatchTransfer } from "../profiles/BatchTransfer";
import styles from "./SettingsPage.module.css";

/**
 * Bringing profiles in from elsewhere.
 *
 * Two routes: a .tpkg someone exported, and the folder an older ThePrivator
 * left behind. Both land as new profiles; neither ever overwrites something
 * already here, which is why the legacy import shows the target name it will
 * use before it runs.
 */
export function ImportSettings() {
  const [packageResult, setPackageResult] = useState<ProfilePackageImportResult | null>(null);
  const [scan, setScan] = useState<LegacyScanResult | null>(null);
  const [legacyRoot, setLegacyRoot] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [legacyResult, setLegacyResult] = useState<LegacyImportResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback((activity: string, work: () => Promise<void>) => {
    setBusy(activity);
    setError(null);
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

  const importPackage = () =>
    run("package", async () => {
      const source = await pickFile(t("Choose a ThePrivator package"), [
        { name: t("ThePrivator package"), extensions: ["tpkg"] },
      ]);
      if (source === null) {
        return;
      }
      setPackageResult(await importProfilePackage(source));
    });

  const chooseLegacyRoot = () =>
    run("scanning", async () => {
      const root = await pickDirectory(t("Choose the folder from an older ThePrivator"));
      if (root === null) {
        return;
      }
      const result = await scanLegacyProfiles(root);
      setLegacyRoot(root);
      setScan(result);
      setLegacyResult(null);
      // Nothing is preselected. Importing everything a scan happened to find is
      // how a user ends up with forty profiles they did not ask for.
      setSelected(new Set());
    });

  const importSelected = () =>
    run("importing", async () => {
      if (scan === null || legacyRoot === null) {
        return;
      }
      const items = scan.candidates
        .filter((candidate) => selected.has(candidate.legacyId))
        .map((candidate) => ({ legacyId: candidate.legacyId, targetName: candidate.targetName }));
      if (items.length === 0) {
        return;
      }
      setLegacyResult(await importLegacyProfiles(legacyRoot, items));
    });

  const toggle = (legacyId: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(legacyId)) {
        next.delete(legacyId);
      } else {
        next.add(legacyId);
      }
      return next;
    });

  return (
    <div className={styles.page}>
      <BatchTransfer />
      <header className={styles.header}>
        <h1>{t("Import")}</h1>
        <p className={styles.lede}>
          {t("Bring in a profile someone exported, or the profiles an older version of ThePrivator left on this computer. Both arrive as new profiles; nothing here replaces what you already have.")}
        </p>
      </header>

      {error !== null ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.card} aria-labelledby="package-heading">
        <h2 id="package-heading">{t("From a package")}</h2>
        <p className={styles.hint}>
          {t("A .tpkg carries the fingerprint, the proxy server and the browsing data. Proxy passwords are deliberately left out, so you will need to enter those again.")}
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={busy !== null} onClick={importPackage}>
            {busy === "package" ? t("Importing…") : t("Choose a package")}
          </button>
        </div>

        {packageResult !== null ? (
          <div role="status" className={styles.note}>
            {t("Imported as")} <strong>{packageResult.importedProfileName}</strong>
            {packageResult.nameConflictResolved ? ` ${t("(renamed, that name was taken)")}` : ""}.{" "}
            {t("{count} files restored.", { count: packageResult.payloadFileCount })}
            {packageResult.warningCount > 0 ? (
              <ul className={styles.list}>
                {packageResult.warnings.map((warning) => (
                  <li key={warning.code}>{warning.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={styles.card} aria-labelledby="legacy-heading">
        <h2 id="legacy-heading">{t("From an older ThePrivator")}</h2>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} disabled={busy !== null} onClick={chooseLegacyRoot}>
            {busy === "scanning" ? t("Scanning…") : t("Choose a folder to scan")}
          </button>
        </div>

        {scan !== null ? (
          scan.candidates.length === 0 ? (
            <p className={styles.hint}>{t("No profiles were found in that folder.")}</p>
          ) : (
            <>
              <ul className={styles.list} aria-label={t("Profiles found")}>
                {scan.candidates.map((candidate) => (
                  <li key={candidate.legacyId}>
                    <label className={styles.choice}>
                      <input
                        type="checkbox"
                        checked={selected.has(candidate.legacyId)}
                        onChange={() => toggle(candidate.legacyId)}
                      />
                      <span>
                        <strong>{candidate.legacyName ?? candidate.folderName}</strong>
                        <span className={styles.hint}>
                          {t("Will be imported as “{name}”", { name: candidate.targetName })}
                          {candidate.userData.status === "missing" ? ` · ${t("no browsing data found")}` : ""}
                        </span>
                        {candidate.issues.length > 0 ? (
                          <span className={styles.hint}>
                            {candidate.issues.map((issue) => issue.message).join(" ")}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={busy !== null || selected.size === 0}
                  onClick={importSelected}
                >
                  {busy === "importing"
                    ? t("Importing…")
                    : selected.size === 1
                      ? t("Import {count} profile", { count: selected.size })
                      : t("Import {count} profiles", { count: selected.size })}
                </button>
              </div>
            </>
          )
        ) : null}

        {scan !== null && scan.issues.length > 0 ? (
          <ul className={styles.list} aria-label={t("Problems with the scanned folder")}>
            {scan.issues.map((issue) => (
              <li key={issue.code}>{issue.message}</li>
            ))}
          </ul>
        ) : null}

        {legacyResult !== null ? (
          <div role="status" className={styles.note}>
            {t("{success} imported, {partial} partly imported, {failed} failed.", {
              success: legacyResult.successCount,
              partial: legacyResult.partialCount,
              failed: legacyResult.failedCount,
            })}
            <ul className={styles.list}>
              {legacyResult.outcomes.map((outcome) => (
                <li key={outcome.legacyId}>
                  <strong>{outcome.targetName}</strong>
                  <span className={styles.hint}>{outcome.status}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
