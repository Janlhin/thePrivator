import { describe, expect, it } from "vitest";

import { makeProfile } from "../../testing/profileFactory";
import type { CookieHealthInfo } from "../../sidecar/types";
import {
  classifyCookieHealth,
  cookieHealthView,
  daysUntilExpiry,
  hasLoginPageMarkers,
  matchesLoginUrl,
  readCookieHealth,
} from "./cookieHealth";

const NOW = new Date("2026-06-01T00:00:00.000Z");

function info(overrides: Partial<CookieHealthInfo> = {}): CookieHealthInfo {
  return {
    expiresAt: null,
    probedAt: "2026-05-31T12:00:00.000Z",
    probeStatus: 200,
    probeFinalUrl: "https://example.com/account",
    loginPageMarkers: [],
    ...overrides,
  };
}

describe("daysUntilExpiry", () => {
  it("returns null for a session cookie with no expiry", () => {
    expect(daysUntilExpiry(null, NOW)).toBeNull();
  });

  it("returns null for an unparseable timestamp", () => {
    expect(daysUntilExpiry("not-a-date", NOW)).toBeNull();
  });

  it("counts whole days remaining in the future", () => {
    expect(daysUntilExpiry("2026-06-04T00:00:00.000Z", NOW)).toBe(3);
  });

  it("counts a past expiry as negative", () => {
    expect(daysUntilExpiry("2026-05-28T00:00:00.000Z", NOW)).toBe(-4);
  });

  it("rounds a same-day expiry down to zero", () => {
    expect(daysUntilExpiry("2026-06-01T12:00:00.000Z", NOW)).toBe(0);
  });
});

describe("matchesLoginUrl", () => {
  it("matches a login path", () => {
    expect(matchesLoginUrl("https://example.com/login")).toBe(true);
  });

  it("matches a login subdomain", () => {
    expect(matchesLoginUrl("https://signin.example.com/home")).toBe(true);
  });

  it("leaves a regular account URL alone", () => {
    expect(matchesLoginUrl("https://example.com/account")).toBe(false);
  });

  it("returns false for null or garbage input", () => {
    expect(matchesLoginUrl(null)).toBe(false);
    expect(matchesLoginUrl("not a url")).toBe(false);
  });
});

describe("hasLoginPageMarkers", () => {
  it("is false for an empty or whitespace-only marker list", () => {
    expect(hasLoginPageMarkers([])).toBe(false);
    expect(hasLoginPageMarkers(["   "])).toBe(false);
  });

  it("is true once any non-empty marker survives", () => {
    expect(hasLoginPageMarkers(["", "Password"])).toBe(true);
  });
});

describe("readCookieHealth", () => {
  it("returns null when the section is absent", () => {
    expect(readCookieHealth(makeProfile({ name: "No health" }))).toBeNull();
  });

  it("returns null for a null or non-object section", () => {
    expect(readCookieHealth(makeProfile({ name: "Null health", cookieHealth: null }))).toBeNull();
    const garbage = makeProfile({ name: "Garbage" });
    (garbage as { cookieHealth: unknown }).cookieHealth = "not-an-object";
    expect(readCookieHealth(garbage)).toBeNull();
  });

  it("parses a complete section", () => {
    const parsed = readCookieHealth(
      makeProfile({
        name: "Complete",
        cookieHealth: info({
          expiresAt: "2026-06-04T00:00:00.000Z",
          loginPageMarkers: ["Sign in"],
        }),
      }),
    );
    expect(parsed).toEqual({
      expiresAt: "2026-06-04T00:00:00.000Z",
      probedAt: "2026-05-31T12:00:00.000Z",
      probeStatus: 200,
      probeFinalUrl: "https://example.com/account",
      loginPageMarkers: ["Sign in"],
    });
  });

  it("degrades half-formed fields instead of throwing", () => {
    const broken = makeProfile({ name: "Broken" });
    (broken as { cookieHealth: unknown }).cookieHealth = {
      expiresAt: 42,
      probedAt: null,
      probeStatus: "401",
      probeFinalUrl: 7,
      loginPageMarkers: ["keep", 5, null],
    };
    expect(readCookieHealth(broken)).toEqual({
      expiresAt: null,
      probedAt: null,
      probeStatus: null,
      probeFinalUrl: null,
      loginPageMarkers: ["keep"],
    });
  });
});

describe("classifyCookieHealth", () => {
  it("is unknown with no snapshot at all", () => {
    expect(classifyCookieHealth(null, NOW)).toBe("unknown");
  });

  it("is unknown when the cookie was never probed", () => {
    expect(classifyCookieHealth(info({ probedAt: null }), NOW)).toBe("unknown");
  });

  it("is expired once the expiry date has passed", () => {
    expect(classifyCookieHealth(info({ expiresAt: "2026-05-28T00:00:00.000Z" }), NOW)).toBe("expired");
  });

  it("prefers expiry over a later 401 signal", () => {
    expect(classifyCookieHealth(info({ expiresAt: "2026-05-28T00:00:00.000Z", probeStatus: 401 }), NOW)).toBe(
      "expired",
    );
  });

  it("reads a 401 as unauthorized", () => {
    expect(classifyCookieHealth(info({ probeStatus: 401 }), NOW)).toBe("unauthorized");
  });

  it("reads a redirect to a login destination as redirected-login", () => {
    expect(classifyCookieHealth(info({ probeFinalUrl: "https://auth.example.com/login" }), NOW)).toBe(
      "redirected-login",
    );
  });

  it("reads login-page markers as login-page", () => {
    expect(classifyCookieHealth(info({ loginPageMarkers: ["<title>Log in</title>"] }), NOW)).toBe("login-page");
  });

  it("reads a 5xx probe as an error", () => {
    expect(classifyCookieHealth(info({ probeStatus: 503 }), NOW)).toBe("error");
  });

  it("is ok for a clean probe, including a session cookie", () => {
    expect(classifyCookieHealth(info(), NOW)).toBe("ok");
    expect(classifyCookieHealth(info({ expiresAt: null, probeFinalUrl: "https://example.com/home" }), NOW)).toBe("ok");
  });
});

describe("cookieHealthView", () => {
  it("reports unknown with no expiry and no probe", () => {
    expect(cookieHealthView(makeProfile({ name: "Fresh" }), NOW)).toEqual({
      status: "unknown",
      daysLeft: null,
    });
  });

  it("carries the expiry countdown alongside the verdict", () => {
    const profile = makeProfile({
      name: "Active",
      cookieHealth: info({ expiresAt: "2026-06-04T00:00:00.000Z" }),
    });
    expect(cookieHealthView(profile, NOW)).toEqual({ status: "ok", daysLeft: 3 });
  });
});
