import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type {
  RawLineAllResponse,
  RawStopAllResponse,
  RawStopDetailsResponse,
} from "./metrolinx/types.js";
import { dateToWire, nowInToronto } from "./time.js";
import { callTool, fakeClient, readResource } from "./tools/test-support.js";

const stopAll = JSON.parse(
  readFileSync(
    new URL("../test/fixtures/stop-all.json", import.meta.url),
    "utf8",
  ),
) as RawStopAllResponse;

const stopDetails = JSON.parse(
  readFileSync(
    new URL("../test/fixtures/stop-details.json", import.meta.url),
    "utf8",
  ),
) as RawStopDetailsResponse;

const lineAll = JSON.parse(
  readFileSync(
    new URL("../test/fixtures/schedule-line-all.json", import.meta.url),
    "utf8",
  ),
) as RawLineAllResponse;

function jsonOf(contents: { text: string }[]): unknown {
  return JSON.parse(contents[0]!.text);
}

describe("gotransit://stops", () => {
  it("returns the full stop dataset in the search_stops match shape", async () => {
    const contents = await readResource(
      fakeClient({ getStopAll: () => Promise.resolve(stopAll) }),
      "gotransit://stops",
    );

    expect(contents).toHaveLength(1);
    expect(contents[0]?.mimeType).toBe("application/json");
    const dto = jsonOf(contents) as {
      matches: { stop_code: string; stop_name: string }[];
      truncated: boolean;
      total_matched: number;
    };
    expect(dto.truncated).toBe(false);
    expect(dto.total_matched).toBe(stopAll.Stations?.Station?.length);
    expect(dto.matches).toContainEqual({
      stop_code: "UN",
      stop_name: "Union Station GO",
      stop_type: "train",
    });
  });
});

describe("gotransit://stops/{code}", () => {
  it("resolves and equals get_stop_details' structuredContent for the same code", async () => {
    const contents = await readResource(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getStopDetails: () => Promise.resolve(stopDetails),
      }),
      "gotransit://stops/UN",
    );
    const resourceDto = jsonOf(contents);

    const toolResult = await callTool(
      fakeClient({
        getStopAll: () => Promise.resolve(stopAll),
        getStopDetails: () => Promise.resolve(stopDetails),
      }),
      "get_stop_details",
      { stop_code: "UN" },
    );

    expect(resourceDto).toEqual(toolResult.structuredContent);
  });

  it("propagates a not_found failure as a resource read error", async () => {
    await expect(
      readResource(
        fakeClient({ getStopAll: () => Promise.resolve(stopAll) }),
        "gotransit://stops/NOPE",
      ),
    ).rejects.toThrow();
  });
});

describe("gotransit://lines/{date}", () => {
  it("resolves and equals list_lines' structuredContent for the same date", async () => {
    const contents = await readResource(
      fakeClient({ getLineAll: () => Promise.resolve(lineAll) }),
      "gotransit://lines/2026-07-17",
    );
    const resourceDto = jsonOf(contents);

    const toolResult = await callTool(
      fakeClient({ getLineAll: () => Promise.resolve(lineAll) }),
      "list_lines",
      { date: "2026-07-17" },
    );

    expect(resourceDto).toEqual(toolResult.structuredContent);
  });

  it("passes the dated path segment through as the wire date", async () => {
    let capturedDate: string | undefined;
    await readResource(
      fakeClient({
        getLineAll: (dateWire) => {
          capturedDate = dateWire;
          return Promise.resolve(lineAll);
        },
      }),
      "gotransit://lines/2026-07-17",
    );
    expect(capturedDate).toBe("20260717");
  });
});

describe("gotransit://lines", () => {
  it("is a static alias equal to today's dated form", async () => {
    const today = nowInToronto().date;

    const aliasContents = await readResource(
      fakeClient({ getLineAll: () => Promise.resolve(lineAll) }),
      "gotransit://lines",
    );
    const datedContents = await readResource(
      fakeClient({ getLineAll: () => Promise.resolve(lineAll) }),
      `gotransit://lines/${today}`,
    );

    expect(jsonOf(aliasContents)).toEqual(jsonOf(datedContents));
  });

  it("requests today's wire date from the client", async () => {
    let capturedDate: string | undefined;
    await readResource(
      fakeClient({
        getLineAll: (dateWire) => {
          capturedDate = dateWire;
          return Promise.resolve(lineAll);
        },
      }),
      "gotransit://lines",
    );
    expect(capturedDate).toBe(dateToWire(nowInToronto().date));
  });
});
