import { useCallback, useEffect, useState } from "react";

import { t, useLanguagePreference } from "../../i18n";
import type { LanguagePreference } from "../../i18n/language";
import { savePreferences, normalizeSidecarError } from "../../sidecar/client";
import styles from "./SettingsPage.module.css";

export type ThemeChoice = "system" | "light" | "dark";

const THEMES: Array<{ id: ThemeChoice; label: string; description: string }> = [
  { id: "system", label: "Match the system", description: "Follow whatever this computer is set to." },
  { id: "light", label: "Light", description: "Always light, whatever the system says." },
  { id: "dark", label: "Dark", description: "Always dark, whatever the system says." },
];

/**
 * The language choices.
 *
 * Each label is written in the language it selects, not translated: someone who
 * reads no Chinese still has to be able to find "中文" in a Chinese interface,
 * and vice versa.
 */
const LANGUAGES: Array<{ id: LanguagePreference; label: string; description: string }> = [
  { id: "system", label: "Follow the system", description: "Use the language this computer is set to, and follow it if it changes." },
  { id: "en", label: "English", description: "Always English, whatever the system says." },
  { id: "zh", label: "中文", description: "始终显示简体中文，不受系统语言影响。" },
];

/**
 * Read the theme back from the document.
 *
 * The attribute is the single source of truth rather than a piece of React
 * state: the tokens key off it, and keeping a second copy in state means the two
 * can disagree after any code path that sets one without the other.
 */
function currentTheme(): ThemeChoice {
  const attribute = document.documentElement.getAttribute("data-theme");
  return attribute === "light" || attribute === "dark" ? attribute : "system";
}

export function AppearanceSettings() {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>(currentTheme);
  const { preference, choose } = useLanguagePreference();

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  const selectTheme = useCallback(async (choice: ThemeChoice) => {
    setSaving(true); setError("");
    try {
      await savePreferences(choice);
    if (choice === "system") {
      // Removed, not set to "system": the token layer distinguishes "no
      // attribute" (follow prefers-color-scheme) from an explicit choice, and a
      // third value would match neither rule.
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", choice);
    }
    setTheme(choice);
    } catch (caught) { setError(normalizeSidecarError(caught).message); }
    finally { setSaving(false); }
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>{t("Appearance")}</h1>
        <p className={styles.lede}>{t("How ThePrivator looks on this device.")}</p>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      <section className={styles.card} aria-labelledby="theme-heading">
        <h2 id="theme-heading">{t("Theme")}</h2>

        <div className={styles.choices} role="radiogroup" aria-labelledby="theme-heading">
          {THEMES.map((entry) => (
            <label key={entry.id} className={styles.choice}>
              <input
                type="radio"
                name="theme"
                value={entry.id}
                checked={theme === entry.id}
                disabled={saving}
                onChange={() => selectTheme(entry.id)}
              />
              <span>
                <strong>{t(entry.label)}</strong>
                <span className={styles.hint}>{t(entry.description)}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.card} aria-labelledby="language-heading">
        <h2 id="language-heading">{t("Language")}</h2>

        <div className={styles.choices} role="radiogroup" aria-labelledby="language-heading">
          {LANGUAGES.map((entry) => (
            <label key={entry.id} className={styles.choice}>
              <input
                type="radio"
                name="language"
                value={entry.id}
                checked={preference === entry.id}
                onChange={() => choose(entry.id)}
              />
              <span>
                <strong>{entry.id === "system" ? t(entry.label) : entry.label}</strong>
                <span className={styles.hint}>{t(entry.description)}</span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
