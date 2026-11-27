import type { CookieHealthInfo, ProfileRecord } from "../../sidecar/types";

/**
 * Cookie health, as pure rules.
 *
 * The table cell and the health filter both ask for a verdict; keeping that
 * verdict here means neither the DOM nor the network can reach into the rule.
 * Every function takes its clock as an optional `Date` so the expiry boundaries
 * are testable without faking time.
 */

export type CookieHealthStatus =
  | "unknown"
  | "ok"
  | "expired"
  | "unauthorized"
  | "redirected-login"
  | "login-page"
  | "error";

/** The toolbar filter value: "all" leaves the health verdict out of the query. */
export type CookieHealthFilter = "all" | CookieHealthStatus;

export const COOKIE_HEALTH_STATUSES: readonly CookieHealthStatus[] = [
  "ok",
  "expired",
  "unauthorized",
  "redirected-login",
  "login-page",
  "error",
  "unknown",
];

/** English source label per verdict; the UI translates these through `t()`. */
export const HEALTH_STATUS_LABELS: Record<CookieHealthStatus, string> = {
  unknown: "Unknown · not probed",
  ok: "OK",
  expired: "Expired",
  unauthorized: "Unauthorized (401)",
  "redirected-login": "Redirected to login",
  "login-page": "Login page detected",
  error: "Probe error",
};

const DAY_MS = 86_400_000;

/** Fragments that mark a URL as a login destination, matched on host and path. */
const LOGIN_URL_KEYWORDS = ["login", "signin", "sign-in", "log-in", "auth"];

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * Read the optional health section off a profile.
 *
 * The section is optional and may arrive half-formed from an older sidecar; a
 * missing, null or non-object record reads back as `null`, which the UI shows
 * as "unknown / not probed" rather than a fabricated result.
 */
export function readCookieHealth(profile: ProfileRecord): CookieHealthInfo | null {
  const raw = profile.cookieHealth;
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  return {
    expiresAt: asStringOrNull(raw.expiresAt),
    probedAt: asStringOrNull(raw.probedAt),
    probeStatus: asNumberOrNull(raw.probeStatus),
    probeFinalUrl: asStringOrNull(raw.probeFinalUrl),
    loginPageMarkers: asStringArray(raw.loginPageMarkers),
  };
}

/**
 * Whole days between now and the expiry timestamp.
 *
 * Returns `null` when there is no expiry (a session cookie) or the timestamp
 * cannot be parsed. A negative number means the cookie is already expired;
 * zero means it expires today.
 */
export function daysUntilExpiry(expiresAt: string | null, now: Date = new Date()): number | null {
  if (expiresAt === null) {
    return null;
  }
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return null;
  }
  return Math.trunc((expiry.getTime() - now.getTime()) / DAY_MS);
}

/** True when the URL points at a login destination by host or path keyword. */
export function matchesLoginUrl(url: string | null): boolean {
  if (url === null) {
    return false;
  }
  let host = "";
  let path = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    path = parsed.pathname;
  } catch {
    return false;
  }
  const haystack = `${host} ${path}`.toLocaleLowerCase();
  return LOGIN_URL_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

/** True when the final page carried at least one non-empty login-page marker. */
export function hasLoginPageMarkers(markers: readonly string[]): boolean {
  return markers.some((marker) => marker.trim().length > 0);
}

/**
 * Classify one health snapshot.
 *
 * Precedence, most certain first: an expired cookie stays expired even if a
 * probe later ran; then the probe's own failure signals (401, login redirect,
 * login-page markers, server error); a probe with no negative signal is `ok`.
 * A snapshot that was never probed degrades to `unknown`.
 */
export function classifyCookieHealth(info: CookieHealthInfo | null, now: Date = new Date()): CookieHealthStatus {
  if (info === null) {
    return "unknown";
  }
  const daysLeft = daysUntilExpiry(info.expiresAt, now);
  if (daysLeft !== null && daysLeft < 0) {
    return "expired";
  }
  if (info.probedAt === null) {
    return "unknown";
  }
  if (info.probeStatus === 401) {
    return "unauthorized";
  }
  if (matchesLoginUrl(info.probeFinalUrl)) {
    return "redirected-login";
  }
  if (hasLoginPageMarkers(info.loginPageMarkers)) {
    return "login-page";
  }
  if (info.probeStatus !== null && info.probeStatus >= 500) {
    return "error";
  }
  return "ok";
}

export interface CookieHealthView {
  status: CookieHealthStatus;
  /** Whole days left until expiry; null for a session cookie or unknown expiry. */
  daysLeft: number | null;
}

/** The verdict and expiry countdown a row renders, derived from one record. */
export function cookieHealthView(profile: ProfileRecord, now: Date = new Date()): CookieHealthView {
  const info = readCookieHealth(profile);
  return {
    status: classifyCookieHealth(info, now),
    daysLeft: daysUntilExpiry(info?.expiresAt ?? null, now),
  };
}
