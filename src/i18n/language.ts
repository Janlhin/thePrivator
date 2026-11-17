/**
 * Which language the interface speaks, and how that choice survives a restart.
 *
 * Two decisions worth stating, because both are load-bearing:
 *
 * 1. The preference is "system" by default, not a fixed language. A machine
 *    whose system speaks Chinese gets a Chinese interface on first launch
 *    without anyone finding a setting; an English machine is unaffected.
 *
 * 2. It is stored in `window.localStorage`, not in the sidecar preferences.
 *    Language is a property of the screen the user is looking at, and the
 *    unlock screen renders before any sidecar command has answered -- reading
 *    it from the sidecar would leave the first screen in the wrong language
 *    until the vault opened. Nothing about a profile, a proxy credential or a
 *    browser command line passes through here, so it stays outside the redaction
 *    perimeter rather than widening it.
 *
 * This is the only module allowed to touch browser storage; the source guard
 * carries a named exemption for it (see `src/guards/source.test.ts`).
 */

export type Language = "en" | "zh";

/** What the user chose. `system` follows the operating system at every start. */
export type LanguagePreference = "system" | Language;

const STORAGE_KEY = "theprivator.language";

const listeners = new Set<() => void>();

function normalize(tag: string | null | undefined): Language | null {
  if (typeof tag !== "string" || tag.length === 0) {
    return null;
  }
  const primary = tag.toLowerCase().split(/[-_]/)[0];
  if (primary === "zh") {
    return "zh";
  }
  if (primary === "en") {
    return "en";
  }
  return null;
}

/** The operating system's preference, in the order a browser reports it. */
function systemLanguage(): Language {
  const listed = typeof navigator === "undefined" ? undefined : navigator.languages;
  for (const tag of listed ?? [navigator?.language]) {
    const match = normalize(tag);
    if (match !== null) {
      return match;
    }
  }
  return "en";
}

export function readPreference(): LanguagePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "zh" || stored === "system" ? stored : "system";
  } catch {
    // Storage can be unavailable (private mode, a wiped webview profile). A
    // preference nobody can read is not an error: fall back to the system.
    return "system";
  }
}

export function resolve(preference: LanguagePreference): Language {
  return preference === "system" ? systemLanguage() : preference;
}

/** The language in force right now. */
export function currentLanguage(): Language {
  return resolve(readPreference());
}

export function writePreference(preference: LanguagePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // A session that cannot persist the choice still renders it; only the
    // next start forgets.
  }
  announce();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function announce(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** @public Label helper kept for callers that render the stored preference outside the settings page. */
export function preferenceLabel(preference: LanguagePreference): string {
  return preference === "system" ? "system" : preference;
}
