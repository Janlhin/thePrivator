import { describe, expect, it } from "vitest";

import { currentLanguage, readPreference, resolve, writePreference } from "./language";
import { t } from "./index";
import { ZH } from "./messages/zh";

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? "").sort();
}

describe("the Chinese dictionary", () => {
  it("keeps every placeholder the English string carries", () => {
    const mismatched = Object.entries(ZH).filter(([key, value]) => {
      const expected = placeholders(key).join(",");
      const actual = placeholders(value).join(",");
      return expected !== actual;
    });
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });

  it("has no empty translation", () => {
    expect(Object.entries(ZH).filter(([, value]) => value.trim().length === 0)).toEqual([]);
  });

  it("translates the strings the first screen shows", () => {
    // A handful the interface cannot do without: a Chinese build that fell back
    // to English here would look broken before the vault even opens.
    for (const key of ["Unlock", "Cancel", "Save", "Settings", "Profiles"]) {
      expect(ZH[key]).toBeTruthy();
    }
  });
});

describe("the language preference", () => {
  it("defaults to following the system, and resolves to a real language", () => {
    // jsdom reports en-US, so the resolved language is English here; what this
    // pins is that an unset preference is not a fixed choice.
    expect(readPreference()).toBe("system");
    expect(["en", "zh"]).toContain(currentLanguage());
    expect(resolve("system")).toBe(currentLanguage());
  });

  it("stores an explicit choice and reports it back", () => {
    writePreference("zh");
    expect(readPreference()).toBe("zh");
    expect(currentLanguage()).toBe("zh");
    writePreference("system");
    expect(readPreference()).toBe("system");
  });

  it("translates only when Chinese is in force", () => {
    writePreference("en");
    expect(t("Cancel")).toBe("Cancel");
    writePreference("zh");
    expect(t("Cancel")).toBe(ZH["Cancel"]);
  });

  it("passes unknown strings and interpolates parameters", () => {
    writePreference("zh");
    expect(t("A string nobody translated")).toBe("A string nobody translated");
    expect(t("Remove tag {tag}", { tag: "EU" })).toBe("移除标签 EU");
    writePreference("system");
  });
});
