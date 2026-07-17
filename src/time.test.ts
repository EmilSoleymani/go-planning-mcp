import { describe, expect, it } from "vitest";

import {
  addHoursToTime,
  diffMinutes,
  hhmmToWire,
  toIsoWithTorontoOffset,
} from "./time.js";

describe("toIsoWithTorontoOffset", () => {
  it("attaches the EDT offset (-04:00) in summer", () => {
    expect(toIsoWithTorontoOffset("2026-07-17 17:29:00")).toBe(
      "2026-07-17T17:29:00-04:00",
    );
  });

  it("attaches the EST offset (-05:00) in winter", () => {
    expect(toIsoWithTorontoOffset("2026-01-15 09:00:00")).toBe(
      "2026-01-15T09:00:00-05:00",
    );
  });

  it("throws on an unrecognized timestamp shape", () => {
    expect(() => toIsoWithTorontoOffset("not-a-timestamp")).toThrow();
  });
});

describe("diffMinutes", () => {
  it("computes a positive delay", () => {
    expect(diffMinutes("2026-07-17 17:35:00", "2026-07-17 17:29:00")).toBe(6);
  });

  it("computes a negative (early) delay", () => {
    expect(diffMinutes("2026-07-17 17:25:00", "2026-07-17 17:29:00")).toBe(-4);
  });

  it("is zero for an on-time departure", () => {
    expect(diffMinutes("2026-07-17 17:29:00", "2026-07-17 17:29:00")).toBe(0);
  });
});

describe("addHoursToTime", () => {
  it("adds hours within the same day", () => {
    expect(addHoursToTime("09:00", 4)).toBe("13:00");
  });

  it("wraps past midnight", () => {
    expect(addHoursToTime("22:30", 4)).toBe("02:30");
  });

  it("wraps negative hours back before midnight", () => {
    expect(addHoursToTime("01:00", -4)).toBe("21:00");
  });
});

describe("hhmmToWire", () => {
  it("strips the colon", () => {
    expect(hhmmToWire("09:15")).toBe("0915");
  });
});
