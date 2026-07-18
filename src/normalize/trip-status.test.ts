import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type {
  RawStopAllResponse,
  RawTripStatusResponse,
} from "../metrolinx/types.js";
import { normalizeTripStatus } from "./trip-status.js";

const DATE = "2026-07-17";

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
  it("normalizes the live-captured trip envelope, resolving Destination via Stop/All", () => {
    const result = normalizeTripStatus(tripFixture, stopAllFixture, DATE);

    expect(result.trip_number).toBe("1039");
    expect(result.destination).toBe("Aldershot GO");
    expect(result.status).toBe("scheduled");
    expect(result.stops).toHaveLength(11);
  });

  it("resolves stop_name from the Stop/All dataset, falling back to the code", () => {
    const result = normalizeTripStatus(tripFixture, stopAllFixture, DATE);
    const un = result.stops.find((s) => s.stop_code === "UN");
    expect(un?.stop_name).toBe("Union Station GO");

    const unmapped = normalizeTripStatus(
      {
        Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
        Trips: [
          {
            Number: "1",
            Destination: "ZZZ",
            Longitude: 0,
            Latitude: 0,
            Status: "S",
            TimeStamp: "",
            Stops: [{ Code: "ZZZ", Status: "S" }],
          },
        ],
      },
      { Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" } },
      DATE,
    );
    expect(unmapped.stops[0]?.stop_name).toBe("ZZZ");
    expect(unmapped.destination).toBe("ZZZ");
  });

  it("converts bare HH:MM stop times onto the requested operational day", () => {
    const result = normalizeTripStatus(tripFixture, stopAllFixture, DATE);
    const un = result.stops.find((s) => s.stop_code === "UN");
    expect(un?.scheduled_arrival).toBe("2026-07-17T23:17:00-04:00");
    expect(un?.scheduled_departure).toBe("2026-07-17T23:17:00-04:00");
  });

  it("rolls an HH>=24 stop time onto the next calendar day", () => {
    const result = normalizeTripStatus(tripFixture, stopAllFixture, DATE);
    const al = result.stops.find((s) => s.stop_code === "AL");
    expect(al?.scheduled_departure).toBe("2026-07-18T00:27:00-04:00");
    expect(al?.scheduled_arrival).toBeUndefined();
  });

  it("takes an under-24-wrapped past-midnight HH:MM literally (known upstream quirk)", () => {
    // OA is genuinely visited after midnight on this overnight trip (real
    // order runs ...CL 23:53 -> OA -> BO -> AP -> BU -> AL 24:27), but
    // Metrolinx sent "00:01" instead of the "24:01" wraparound it used for
    // the final stop — there's no reliable signal to correct this from the
    // payload alone, so it's read as literally 00:01 on the requested day.
    const result = normalizeTripStatus(tripFixture, stopAllFixture, DATE);
    const oa = result.stops.find((s) => s.stop_code === "OA");
    expect(oa?.scheduled_departure).toBe("2026-07-17T00:01:00-04:00");
  });

  it("expands S/M status codes and passes through an empty status unchanged", () => {
    const result = normalizeTripStatus(tripFixture, stopAllFixture, DATE);
    const un = result.stops.find((s) => s.stop_code === "UN");
    expect(un?.status).toBe("scheduled");

    const al = result.stops.find((s) => s.stop_code === "AL");
    expect(al?.status).toBe("");
  });

  it("keeps populated track fields and omits a null Track.Actual", () => {
    const result = normalizeTripStatus(tripFixture, stopAllFixture, DATE);
    const oa = result.stops.find((s) => s.stop_code === "OA");
    expect(oa?.track).toEqual({ scheduled: "1" });

    const al = result.stops.find((s) => s.stop_code === "AL");
    expect(al?.track).toEqual({});
  });

  it("omits position when lat/lon are the 0/0 not-tracked placeholder", () => {
    const result = normalizeTripStatus(tripFixture, stopAllFixture, DATE);
    expect(result.position).toBeUndefined();
  });

  it("omits position when lat/lon are the -1/-1 placeholder too", () => {
    const result = normalizeTripStatus(
      {
        Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
        Trips: [
          {
            Number: "1004",
            Destination: "UN",
            Longitude: -1,
            Latitude: -1,
            Status: "S",
            TimeStamp: "",
            Stops: [],
          },
        ],
      },
      stopAllFixture,
      DATE,
    );
    expect(result.position).toBeUndefined();
  });

  it("includes position when lat/lon are real coordinates", () => {
    const result = normalizeTripStatus(
      {
        Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
        Trips: [
          {
            Number: "1004",
            Destination: "UN",
            Longitude: -79.86,
            Latitude: 43.3,
            Status: "M",
            TimeStamp: "",
            Stops: [],
          },
        ],
      },
      stopAllFixture,
      DATE,
    );
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
        DATE,
      ),
    ).toThrow(MetrolinxError);
  });
});
