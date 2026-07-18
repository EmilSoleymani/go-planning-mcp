import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { RawFleetConsistResponse } from "../metrolinx/types.js";
import { callTool, fakeClient } from "./test-support.js";

const allFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/fleet-consist.json", import.meta.url),
    "utf8",
  ),
) as RawFleetConsistResponse;

const engineFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/fleet-consist-engine.json", import.meta.url),
    "utf8",
  ),
) as RawFleetConsistResponse;

describe("get_fleet_consist", () => {
  it("looks up a consist by trip_number via the all-consists feed", async () => {
    let called = false;
    const result = await callTool(
      fakeClient({
        getFleetConsistAll: () => {
          called = true;
          return Promise.resolve(allFixture);
        },
      }),
      "get_fleet_consist",
      { trip_number: "2011" },
    );

    expect(called).toBe(true);
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({ engine_number: "651" });
  });

  it("looks up a consist by engine_number directly", async () => {
    let capturedEngine: string | undefined;
    const result = await callTool(
      fakeClient({
        getFleetConsistByEngine: (engineNumber) => {
          capturedEngine = engineNumber;
          return Promise.resolve(engineFixture);
        },
      }),
      "get_fleet_consist",
      { engine_number: "651" },
    );

    expect(capturedEngine).toBe("651");
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({ engine_number: "651" });
  });

  it("returns invalid_input when both trip_number and engine_number are given", async () => {
    const result = await callTool(fakeClient({}), "get_fleet_consist", {
      trip_number: "2011",
      engine_number: "651",
    });

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("invalid_input");
  });

  it("returns invalid_input when neither trip_number nor engine_number is given", async () => {
    const result = await callTool(fakeClient({}), "get_fleet_consist", {});

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("invalid_input");
  });

  it("returns not_found when no consist matches the trip number", async () => {
    const result = await callTool(
      fakeClient({
        getFleetConsistAll: () => Promise.resolve(allFixture),
      }),
      "get_fleet_consist",
      { trip_number: "does-not-exist" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
  });

  it("returns not_found when the engine-filtered response has no consist", async () => {
    const result = await callTool(
      fakeClient({
        getFleetConsistByEngine: () =>
          Promise.resolve({
            Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
            AllConsists: { Consists: [] },
          }),
      }),
      "get_fleet_consist",
      { engine_number: "nope" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
  });
});
