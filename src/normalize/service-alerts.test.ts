import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { RawAlertsResponse } from "../metrolinx/types.js";
import { normalizeServiceAlerts } from "./service-alerts.js";

const serviceFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/service-alerts.json", import.meta.url),
    "utf8",
  ),
) as RawAlertsResponse;

const emptyFeed: RawAlertsResponse = {
  Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
  Messages: { Message: [] },
};

describe("normalizeServiceAlerts", () => {
  it("normalizes the live-captured ServiceAlert feed, tagging category from the source feed", () => {
    const result = normalizeServiceAlerts([
      { category: "service", raw: serviceFixture },
    ]);

    expect(result.total_matched).toBe(serviceFixture.Messages?.Message?.length);
    const first = result.alerts[0];
    expect(first).toMatchObject({
      id: "M0000442934",
      category: "service",
      status: "new",
      subject: "Elevator out of service",
    });
    expect(first?.affected.lines).toEqual(["LW"]);
    // Raw Stop.Name is null for this message; falls back to the code.
    expect(first?.affected.stops).toEqual([
      { stop_code: "HA", stop_name: "HA" },
    ]);
  });

  it("expands UPD to updated", () => {
    const result = normalizeServiceAlerts([
      { category: "service", raw: serviceFixture },
    ]);
    const updated = result.alerts.find((a) => a.id === "M0000507712");
    expect(updated?.status).toBe("updated");
  });

  it("folds multiple feeds, tagging each alert by its source category", () => {
    const marketing: RawAlertsResponse = {
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      Messages: {
        Message: [
          {
            Code: "M9999999999",
            ParentCode: null,
            Status: "INIT",
            PostedDateTime: "2026-07-17 10:00:00",
            SubjectEnglish: "Summer promo",
            SubjectFrench: "Promo d'été",
            BodyEnglish: "Save on weekend fares.",
            BodyFrench: "Économisez sur les tarifs de fin de semaine.",
            Category: "Promo",
            SubCategory: "Fare",
            Lines: [],
            Stops: [],
            Trips: [],
          },
        ],
      },
    };

    const result = normalizeServiceAlerts([
      { category: "service", raw: serviceFixture },
      { category: "marketing", raw: marketing },
    ]);

    expect(
      result.alerts.some(
        (a) => a.category === "marketing" && a.id === "M9999999999",
      ),
    ).toBe(true);
    expect(result.alerts.filter((a) => a.category === "service").length).toBe(
      serviceFixture.Messages?.Message?.length,
    );
  });

  it("filters by line", () => {
    const result = normalizeServiceAlerts(
      [{ category: "service", raw: serviceFixture }],
      { line: "LE" },
    );
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.alerts.every((a) => a.affected.lines.includes("LE"))).toBe(
      true,
    );
  });

  it("filters by stop", () => {
    const result = normalizeServiceAlerts(
      [{ category: "service", raw: serviceFixture }],
      { stop: "HA" },
    );
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(
      result.alerts.every((a) =>
        a.affected.stops.some((s) => s.stop_code === "HA"),
      ),
    ).toBe(true);
  });

  it("caps results at limit and reports truncation", () => {
    const result = normalizeServiceAlerts(
      [{ category: "service", raw: serviceFixture }],
      { limit: 2 },
    );
    expect(result.alerts).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(result.total_matched).toBeGreaterThan(2);
  });

  it("collapses to French when lang: fr is given", () => {
    const result = normalizeServiceAlerts(
      [{ category: "service", raw: serviceFixture }],
      { lang: "fr" },
    );
    expect(result.alerts[0]?.subject).toBe("Ascenseur hors service");
  });

  it("returns an empty list for an empty feed", () => {
    const result = normalizeServiceAlerts([
      { category: "information", raw: emptyFeed },
    ]);
    expect(result).toEqual({ alerts: [], truncated: false, total_matched: 0 });
  });
});
