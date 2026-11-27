import { useEffect, useRef, useState } from "react";
import { t } from "../../i18n";
import { pickDirectory, pickFiles } from "../../dialogs";
import { exportProfileToDirectory, importProfilePackage, normalizeSidecarError } from "../../sidecar/client";
import type { ProfileRow } from "./tableModel";
import styles from "./ProfilesPage.module.css";

export function BatchTransfer({ rows = [], selectedIds = [], onImported }: { rows?: readonly ProfileRow[]; selectedIds?: readonly string[]; onImported?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const cancelled = useRef(false);
  const active = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);
  async function run(kind: "import" | "selected" | "all") {
    if (active.current) return;
    active.current = true; cancelled.current = false;
    setBusy(true); setResults([]); setProgress("");
    let finished = 0, succeeded = 0, total = 0;
    try {
      const files = kind === "import" ? await pickFiles(t("Import profile packages"), [{ name: t("ThePrivator packages"), extensions: ["tpkg"] }]) : [];
      const directory = kind === "import" ? null : await pickDirectory(t("Export profiles to folder"));
      if (kind !== "import" && !directory) return;
      const profiles = rows.filter(({ profile }) => kind === "all" || selectedIds.includes(profile.id));
      const jobs = kind === "import"
        ? files.map((file, index) => ({ label: t("Package {index}", { index: index + 1 }), work: async () => { const result = await importProfilePackage(file); return t("Imported {name}", { name: result.importedProfileName }); } }))
        : profiles.map(({ profile, running }) => ({ label: profile.name, work: async () => {
          if (running) throw new Error(t("Stop this profile before exporting."));
          await exportProfileToDirectory(profile.id, directory!); return t("Exported {name}", { name: profile.name });
        } }));
      total = jobs.length;
      for (const job of jobs) {
        if (cancelled.current) break;
        setProgress(t(kind === "import" ? "Importing {done} of {total}…" : "Exporting {done} of {total}…", { done: finished + 1, total }));
        try { const message = await job.work(); succeeded++; setResults((items) => [...items, message]); }
        catch (error) { setResults((items) => [...items, `${job.label}: ${error instanceof Error ? error.message : normalizeSidecarError(error).message}`]); }
        finished++;
      }
      setProgress(t("{succeeded} succeeded, {failed} failed, {skipped} skipped", { succeeded, failed: finished - succeeded, skipped: total - finished }) + (cancelled.current ? ` · ${t("Cancelled")}` : "") + ".");
    } catch (error) { setProgress(normalizeSidecarError(error).message); }
    finally { active.current = false; setBusy(false); if (kind === "import") onImported?.(); }
  }
  return <section aria-label={t("Batch profile transfer")}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" className={styles.secondary} disabled={busy} onClick={() => void run("import")}>{t("Import packages")}</button>
      {rows.length ? <>
        <button type="button" className={styles.secondary} disabled={busy || !selectedIds.length} onClick={() => void run("selected")}>{t("Export selected")}</button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={() => void run("all")}>{t("Export all")}</button>
      </> : null}
      {busy ? <button type="button" className={styles.secondary} onClick={() => { cancelled.current = true; setProgress(t("Cancelling after the current profile…")); }}>{t("Cancel remaining")}</button> : null}
    </div>
    <small>{t("Portable packages omit proxy passwords. Exported browser sessions are not encrypted by the app vault.")}</small>
    {progress ? <p role="status">{progress}</p> : null}
    {results.length ? <details open><summary>{t("Transfer results ({count})", { count: results.length })}</summary><ul>{results.map((message, index) => <li key={index}>{message}</li>)}</ul></details> : null}
  </section>;
}
