import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawAlertsResponse } from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

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

describe("get_service_alerts", () => {
  it("defaults to service + information, never fetching marketing", async () => {
    let calledMarketing = false;
    const result = await callTool(
      fakeClient({
        getServiceAlerts: () => Promise.resolve(serviceFixture),
        getInformationAlerts: () => Promise.resolve(emptyFeed),
        getMarketingAlerts: () => {
          calledMarketing = true;
          return Promise.resolve(emptyFeed);
        },
      }),
      "get_service_alerts",
      {},
    );

    expect(result.isError).toBe(false);
    expect(calledMarketing).toBe(false);
    const structured = result.structuredContent as {
      alerts: { category: string }[];
    };
    expect(structured.alerts.every((a) => a.category === "service")).toBe(true);
  });

  it("fetches only the marketing feed when category: marketing is requested", async () => {
    let calledService = false;
    const result = await callTool(
      fakeClient({
        getServiceAlerts: () => {
          calledService = true;
          return Promise.resolve(serviceFixture);
        },
        getMarketingAlerts: () => Promise.resolve(serviceFixture),
      }),
      "get_service_alerts",
      { category: "marketing" },
    );

    expect(result.isError).toBe(false);
    expect(calledService).toBe(false);
    const structured = result.structuredContent as {
      alerts: { category: string }[];
    };
    expect(structured.alerts.every((a) => a.category === "marketing")).toBe(
      true,
    );
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      fakeClient({
        getServiceAlerts: () =>
          Promise.reject(new MetrolinxError("rate_limited", "wait", false)),
        getInformationAlerts: () => Promise.resolve(emptyFeed),
      }),
      "get_service_alerts",
      {},
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("rate_limited");
  });
});
