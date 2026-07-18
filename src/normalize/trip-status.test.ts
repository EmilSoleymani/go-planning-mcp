import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type {
  RawStopAllResponse,
  RawTripStatusResponse,
} from "../metrolinx/types.js";
import { normalizeTripStatus } from "./trip-status.js";

const tripFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/schedule-trip.json", import.meta.url),
    "utf8",
  ),
) as RawTripStatusResponse;

const stopAllFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-all.json", import.meta.url),
    "utf8",
  ),
) as RawStopAllResponse;

describe("normalizeTripStatus", () => {
  it("normalizes the trip envelope", () => {
    const result = normalizeTripStatus(tripFixture, stopAllFixture);

    expect(result.trip_number).toBe("1004");
    expect(result.destination).toBe("Union Station");
    expect(result.status).toBe("En Route");
    expect(result.stops).toHaveLength(4);
  });

  it("resolves stop_name from the Stop/All dataset, falling back to the code", () => {
    const result = normalizeTripStatus(tripFixture, stopAllFixture);
    const al = result.stops.find((s) => s.stop_code === "AL");
    expect(al?.stop_name).toBe("Aldershot GO");

    const unmapped = normalizeTripStatus(
      {
        Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
        Trips: [
          {
            Number: "1",
            Destination: "Nowhere",
            Longitude: -1,
            Latitude: -1,
            Status: "Scheduled",
            TimeStamp: "",
            Stops: [{ Code: "ZZZ", Status: "Scheduled" }],
          },
        ],
      },
      { Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" } },
    );
    expect(unmapped.stops[0]?.stop_name).toBe("ZZZ");
  });

  it("omits arrival/departure/track fields the raw stop doesn't carry", () => {
    const result = normalizeTripStatus(tripFixture, stopAllFixture);

    const first = result.stops.find((s) => s.stop_code === "AL");
    expect(first?.scheduled_arrival).toBeUndefined();
    expect(first?.scheduled_departure).toBe("2026-07-17T04:52:00-04:00");

    const last = result.stops.find((s) => s.stop_code === "UN");
    expect(last?.scheduled_departure).toBeUndefined();
    expect(last?.scheduled_arrival).toBe("2026-07-17T06:00:00-04:00");
    expect(last?.track).toEqual({});
  });

  it("keeps populated track fields", () => {
    const result = normalizeTripStatus(tripFixture, stopAllFixture);
    const bu = result.stops.find((s) => s.stop_code === "BU");
    expect(bu?.track).toEqual({ scheduled: "2", actual: "2" });
  });

  it("omits position when lat/lon are the -1/-1 not-tracked placeholder", () => {
    const result = normalizeTripStatus(
      {
        Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
        Trips: [
          {
            Number: "1004",
            Destination: "Union Station",
            Longitude: -1,
            Latitude: -1,
            Status: "Scheduled",
            TimeStamp: "",
            Stops: [],
          },
        ],
      },
      stopAllFixture,
    );
    expect(result.position).toBeUndefined();
  });

  it("includes position when lat/lon are real coordinates", () => {
    const result = normalizeTripStatus(tripFixture, stopAllFixture);
    expect(result.position).toEqual({ lat: 43.3, lon: -79.86 });
  });

  it("throws a not_found MetrolinxError when Trips is empty", () => {
    expect(() =>
      normalizeTripStatus(
        {
          Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
          Trips: [],
        },
        stopAllFixture,
      ),
    ).toThrow(MetrolinxError);
  });
});
