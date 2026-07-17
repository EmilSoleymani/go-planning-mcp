import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { RawStopDetailsResponse } from "../metrolinx/types.js";
import { normalizeStopDetails } from "./stop-details.js";

const metadata = {
  TimeStamp: "2026-07-17 10:00:00",
  ErrorCode: "200",
  ErrorMessage: "OK",
};

describe("normalizeStopDetails", () => {
  it("maps parking lots, derives accessibility from facility codes, and applies fallbacks for absent upstream fields", () => {
    const raw: RawStopDetailsResponse = {
      Metadata: metadata,
      Stop: {
        Code: "OA",
        StopName: "Oakville GO",
        StopNameFr: "",
        City: "Oakville",
        Latitude: "43.455",
        Longitude: "-79.682",
        IsBus: true,
        IsTrain: true,
        Facilities: [
          {
            Code: "WAT",
            Description: "Wheelchair Accessible Train Service",
            DescriptionFr: "",
          },
          { Code: "BR", Description: "Bicycle Rack", DescriptionFr: "" },
        ],
        Parkings: [
          { Name: "North Lot", NameFr: "", ParkSpots: "850", Type: "Surface" },
          { Name: "Overflow", NameFr: "", ParkSpots: "", Type: "" },
        ],
        BoardingInfo: "Board from platform 2.",
        BoardingInfoFr: "",
        DrivingDirections: "Exit QEW at Trafalgar Rd.",
        DrivingDirectionsFr: "",
      },
    };

    const dto = normalizeStopDetails(raw);

    expect(dto).toEqual({
      stop_code: "OA",
      stop_name: "Oakville GO",
      city: "Oakville",
      coordinates: { lat: 43.455, lon: -79.682 },
      served_by: { train: true, bus: true },
      facilities: ["Wheelchair Accessible Train Service", "Bicycle Rack"],
      parking: [
        { name: "North Lot", spaces: 850, type: "Surface" },
        { name: "Overflow", spaces: 0, type: "unknown" },
      ],
      accessibility_info: "Wheelchair Accessible Train Service",
      boarding_info: "Board from platform 2.",
      driving_directions: "Exit QEW at Trafalgar Rd.",
    });
  });

  it("falls back to English when the French field is empty, but uses French when populated", () => {
    const raw: RawStopDetailsResponse = {
      Metadata: metadata,
      Stop: {
        Code: "UN",
        StopName: "Union Station GO",
        StopNameFr: "", // empty upstream, per live capture
        City: "Toronto",
        Latitude: "43.645195",
        Longitude: "-79.3806",
        IsBus: false,
        IsTrain: true,
        Facilities: [
          {
            Code: "WAT",
            Description: "Wheelchair Accessible Train Service",
            DescriptionFr: "Service de train accessible en fauteuil roulant",
          },
        ],
        Parkings: [],
        BoardingInfo: "Board from the concourse.",
        BoardingInfoFr: "",
        DrivingDirections: "",
        DrivingDirectionsFr: "",
      },
    };

    const dto = normalizeStopDetails(raw, "fr");

    expect(dto.stop_name).toBe("Union Station GO"); // fallback: StopNameFr empty
    expect(dto.facilities).toEqual([
      "Service de train accessible en fauteuil roulant",
    ]); // French used when present
    expect(dto.accessibility_info).toBe(
      "Service de train accessible en fauteuil roulant",
    );
  });

  it("throws not_found when the response carries no stop", () => {
    expect(() =>
      normalizeStopDetails({ Metadata: metadata, Stop: null }),
    ).toThrowError(MetrolinxError);
  });
});
