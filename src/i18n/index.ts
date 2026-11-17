/**
 * The translation seam.
 *
 * Keys are the English source strings themselves. That is deliberate: the
 * English interface is the product's source of truth, so a component keeps
 * reading like the copy it renders, and a missing translation falls back to
 * something a reader recognises instead of a key like `profiles.empty.trash`.
 *
 * Interpolation uses braces: `t("{count} profiles", { count })`.
 */
import { useEffect, useState } from "react";

import {
  currentLanguage,
  readPreference,
  subscribe,
  writePreference,
  type Language,
  type LanguagePreference,
} from "./language";
import { ZH } from "./messages/zh";

export type TParams = Readonly<Record<string, string | number>>;

function interpolate(template: string, params?: TParams): string {
  if (params === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** Translate one string. Unknown strings pass through unchanged. */
export function t(template: string, params?: TParams): string {
  const translated = currentLanguage() === "zh" ? ZH[template] : undefined;
  return interpolate(translated ?? template, params);
}

/**
 * A component's `t`, re-rendering the component when the language changes.
 *
 * The value is the module-level function rather than a per-render closure so
 * components can pass it into helpers without losing it across renders.
 */
export function useT(): typeof t {
  const [, bump] = useState(0);
  useEffect(() => subscribe(() => bump((count) => count + 1)), []);
  return t;
}

/** The current preference plus a setter, for the Appearance settings control. */
export function useLanguagePreference(): {
  preference: LanguagePreference;
  language: Language;
  choose: (next: LanguagePreference) => void;
} {
  const [, bump] = useState(0);
  useEffect(() => subscribe(() => bump((count) => count + 1)), []);
  return {
    preference: readPreference(),
    language: currentLanguage(),
    choose: writePreference,
  };
}

/** Keep `<html lang>` honest, so screen readers and spell-check follow the text. */
export function useDocumentLanguage(): void {
  useEffect(() => {
    const sync = () => {
      document.documentElement.setAttribute("lang", currentLanguage() === "zh" ? "zh-CN" : "en");
    };
    sync();
    return subscribe(sync);
  }, []);
}
