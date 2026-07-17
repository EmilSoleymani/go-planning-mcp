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
  it("maps parking lots and applies fallbacks for absent upstream fields", () => {
    const raw: RawStopDetailsResponse = {
      Metadata: metadata,
      Stop: {
        LocationCode: "OA",
        LocationName: "Oakville GO",
        LocationType: "Train Station",
        City: null,
        Latitude: 43.455,
        Longitude: -79.682,
        IsBus: true,
        IsTrain: true,
        Facilities: null,
        ParkingLots: [
          { Name: "North Lot", SpacesTotal: 850, Type: "Surface" },
          { Name: "Overflow", SpacesTotal: null, Type: null },
        ],
        BoardingInfo: "Board from platform 2.",
        DrivingDirections: "Exit QEW at Trafalgar Rd.",
      },
    };

    const dto = normalizeStopDetails(raw);

    expect(dto).toEqual({
      stop_code: "OA",
      stop_name: "Oakville GO",
      city: "",
      coordinates: { lat: 43.455, lon: -79.682 },
      served_by: { train: true, bus: true },
      facilities: [],
      parking: [
        { name: "North Lot", spaces: 850, type: "Surface" },
        { name: "Overflow", spaces: 0, type: "unknown" },
      ],
      boarding_info: "Board from platform 2.",
      driving_directions: "Exit QEW at Trafalgar Rd.",
    });
  });

  it("throws not_found when the response carries no stop", () => {
    expect(() =>
      normalizeStopDetails({ Metadata: metadata, Stop: null }),
    ).toThrowError(MetrolinxError);
  });
});
