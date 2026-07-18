import { describe, expect, it } from "vitest";

import { fakeClient, getPrompt } from "./tools/test-support.js";

describe("plan_a_trip", () => {
  it("renders with from/to/when and instructs normalization before calling plan_trip", async () => {
    const messages = await getPrompt(fakeClient({}), "plan_a_trip", {
      from: "Union",
      to: "Oakville",
      when: "tomorrow at 8am",
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe("user");
    const text = messages[0]!.content.text;
    expect(text).toContain("Union");
    expect(text).toContain("Oakville");
    expect(text).toContain("tomorrow at 8am");
    expect(text).toContain("plan_trip");
    expect(text).toContain("ambiguous");
  });

  it("defaults when to now-ish phrasing", async () => {
    const messages = await getPrompt(fakeClient({}), "plan_a_trip", {
      from: "Union",
      to: "Oakville",
    });
    expect(messages[0]!.content.text).toContain("leaving now");
  });
});

describe("check_my_commute", () => {
  it("renders with an explicit direction", async () => {
    const messages = await getPrompt(fakeClient({}), "check_my_commute", {
      home_stop: "Oakville GO",
      work_stop: "Union",
      direction: "to work",
    });

    const text = messages[0]!.content.text;
    expect(text).toContain("Oakville GO");
    expect(text).toContain("Union");
    expect(text).toContain("Direction: to work.");
  });

  it("instructs inference from time of day when direction is omitted", async () => {
    const messages = await getPrompt(fakeClient({}), "check_my_commute", {
      home_stop: "Oakville GO",
      work_stop: "Union",
    });

    expect(messages[0]!.content.text).toContain(
      "infer it from the current time of day",
    );
  });
});

describe("service_status", () => {
  it("scopes to a line when provided", async () => {
    const messages = await getPrompt(fakeClient({}), "service_status", {
      line: "LW",
    });
    const text = messages[0]!.content.text;
    expect(text).toContain("LW line");
    expect(text).toContain("get_service_alerts");
    expect(text).toContain("get_service_exceptions");
  });

  it("defaults to the whole network when line is omitted", async () => {
    const messages = await getPrompt(fakeClient({}), "service_status", {});
    expect(messages[0]!.content.text).toContain("whole network");
  });
});
