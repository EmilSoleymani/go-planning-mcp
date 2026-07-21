import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { RawServiceExceptionsResponse } from "../metrolinx/types.js";
import { normalizeServiceExceptions } from "./service-exceptions.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/service-exceptions.json", import.meta.url),
    "utf8",
  ),
) as RawServiceExceptionsResponse;

describe("normalizeServiceExceptions", () => {
  // Fixture captured live 2026-07-21 (issue #27) during real GO Transit
  // service exceptions — confirms the wire format is "0"/"1" strings, not
  // "True"/"False" as an earlier (unverified) comment in this file claimed.
  it("coerces a stop-level cancellation ('1') to true while the trip itself stays uncancelled ('0')", () => {
    const result = normalizeServiceExceptions(fixture);
    const trip = result.exceptions.find((e) => e.trip_number === "1960");

    expect(trip?.cancelled).toBe(false);
    expect(trip?.affected_stops).toHaveLength(1);
    expect(trip?.affected_stops[0]?.stop_code).toBe("CF");
    expect(trip?.affected_stops[0]?.cancelled).toBe(true);
  });

  it("coerces a trip-level cancellation ('1') to true when the trip has no stops", () => {
    const result = normalizeServiceExceptions(fixture);
    const trip = result.exceptions.find((e) => e.trip_number === "E1960");

    expect(trip?.cancelled).toBe(true);
    expect(trip?.affected_stops).toEqual([]);
  });

  it("includes an overridden-but-not-cancelled stop in affected_stops, with cancelled: false", () => {
    const result = normalizeServiceExceptions(fixture);
    const trip = result.exceptions.find((e) => e.trip_number === "E1960Q");

    expect(trip?.cancelled).toBe(false);
    expect(trip?.affected_stops).toHaveLength(1);
    expect(trip?.affected_stops[0]?.stop_code).toBe("CF");
    expect(trip?.affected_stops[0]?.cancelled).toBe(false);
  });

  it("marks every stop on a stop-level-only cancellation cancelled while the trip itself is not", () => {
    const result = normalizeServiceExceptions(fixture);
    const trip = result.exceptions.find((e) => e.trip_number === "21324");

    expect(trip?.cancelled).toBe(false);
    expect(trip?.affected_stops).toHaveLength(22);
    expect(trip?.affected_stops.every((s) => s.cancelled)).toBe(true);
  });

  it("prefers scheduled departure, falling back to arrival when departure is null", () => {
    const result = normalizeServiceExceptions({
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      Trip: [
        {
          TripNumber: "9724",
          TripName: "LW - Aldershot GO",
          IsCancelled: "0",
          IsOverride: "0",
          Stop: [
            {
              Order: 1,
              ID: "2",
              SchArrival: "2026-07-17 17:45:00",
              SchDeparture: "2026-07-17 17:47:00",
              Name: "Oakville GO",
              IsStopping: "0",
              IsCancelled: "1",
              IsOverride: "0",
              Code: "OA",
              ActualTime: null,
              ServiceType: "T",
            },
            {
              Order: 2,
              ID: "3",
              SchArrival: "2026-07-17 18:10:00",
              SchDeparture: null,
              Name: "Aldershot GO",
              IsStopping: "1",
              IsCancelled: "0",
              IsOverride: "1",
              Code: "AL",
              ActualTime: "2026-07-17 18:15:00",
              ServiceType: "T",
            },
          ],
        },
      ],
    });

    const trip = result.exceptions[0];
    const oakville = trip?.affected_stops.find((s) => s.stop_code === "OA");
    const aldershot = trip?.affected_stops.find((s) => s.stop_code === "AL");

    expect(oakville?.scheduled_time).toBe("2026-07-17T17:47:00-04:00");
    expect(aldershot?.scheduled_time).toBe("2026-07-17T18:10:00-04:00");
  });

  it("includes actual_time only when present", () => {
    const result = normalizeServiceExceptions({
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      Trip: [
        {
          TripNumber: "9724",
          TripName: "LW - Aldershot GO",
          IsCancelled: "0",
          IsOverride: "0",
          Stop: [
            {
              Order: 1,
              ID: "2",
              SchArrival: null,
              SchDeparture: "2026-07-17 17:47:00",
              Name: "Oakville GO",
              IsStopping: "0",
              IsCancelled: "1",
              IsOverride: "0",
              Code: "OA",
              ActualTime: null,
              ServiceType: "T",
            },
            {
              Order: 2,
              ID: "3",
              SchArrival: "2026-07-17 18:10:00",
              SchDeparture: null,
              Name: "Aldershot GO",
              IsStopping: "1",
              IsCancelled: "0",
              IsOverride: "1",
              Code: "AL",
              ActualTime: "2026-07-17 18:15:00",
              ServiceType: "T",
            },
          ],
        },
      ],
    });

    const trip = result.exceptions[0];
    const oakville = trip?.affected_stops.find((s) => s.stop_code === "OA");
    const aldershot = trip?.affected_stops.find((s) => s.stop_code === "AL");

    expect(oakville?.actual_time).toBeUndefined();
    expect(aldershot?.actual_time).toBe("2026-07-17T18:15:00-04:00");
  });

  it("marks a fully cancelled trip and all its affected stops cancelled", () => {
    const result = normalizeServiceExceptions({
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      Trip: [
        {
          TripNumber: "9999",
          TripName: "LW - Hamilton GO",
          IsCancelled: "1",
          IsOverride: "0",
          Stop: [
            {
              Order: 1,
              ID: "4",
              SchArrival: null,
              SchDeparture: "2026-07-17 20:00:00",
              Name: "Union Station GO",
              IsStopping: "1",
              IsCancelled: "1",
              IsOverride: "0",
              Code: "UN",
              ActualTime: null,
              ServiceType: "T",
            },
            {
              Order: 2,
              ID: "5",
              SchArrival: "2026-07-17 20:40:00",
              SchDeparture: null,
              Name: "Hamilton GO Centre",
              IsStopping: "1",
              IsCancelled: "1",
              IsOverride: "0",
              Code: "HA",
              ActualTime: null,
              ServiceType: "T",
            },
          ],
        },
      ],
    });

    const trip = result.exceptions.find((e) => e.trip_number === "9999");

    expect(trip?.cancelled).toBe(true);
    expect(trip?.affected_stops.every((s) => s.cancelled)).toBe(true);
  });

  it("coerces IsCancelled/IsOverride from native booleans and defensively from 'true'/'false' casing variants", () => {
    const result = normalizeServiceExceptions({
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      Trip: [
        {
          TripNumber: "1",
          TripName: "mixed-representation trip",
          IsCancelled: "TRUE",
          IsOverride: false,
          Stop: [
            {
              Order: 1,
              ID: "1",
              SchArrival: null,
              SchDeparture: "2026-07-17 10:00:00",
              Name: "A",
              IsStopping: "1",
              IsCancelled: true,
              IsOverride: "false",
              Code: "A",
              ActualTime: null,
              ServiceType: "T",
            },
          ],
        },
      ],
    });

    const trip = result.exceptions[0];
    expect(trip?.cancelled).toBe(true);
    expect(typeof trip?.cancelled).toBe("boolean");
    expect(trip?.affected_stops[0]?.cancelled).toBe(true);
    expect(typeof trip?.affected_stops[0]?.cancelled).toBe("boolean");
  });

  it("returns an empty exceptions list when Trip is absent", () => {
    const result = normalizeServiceExceptions({
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      Trip: null,
    });
    expect(result).toEqual({
      exceptions: [],
      truncated: false,
      total_matched: 0,
    });
  });
});
