import { MetrolinxError } from "../errors.js";
import type { RawStopDetailsResponse } from "../metrolinx/types.js";
import type { StopDetails } from "../schemas/stop-details.js";

export function normalizeStopDetails(raw: RawStopDetailsResponse): StopDetails {
  const stop = raw.Stop;
  if (!stop) {
    throw new MetrolinxError(
      "not_found",
      "No stop matches that code. Verify the code via search_stops.",
      false,
    );
  }
  return {
    stop_code: stop.LocationCode,
    stop_name: stop.LocationName,
    city: stop.City ?? "",
    coordinates: { lat: stop.Latitude, lon: stop.Longitude },
    served_by: { train: stop.IsTrain, bus: stop.IsBus },
    facilities: stop.Facilities ?? [],
    parking: (stop.ParkingLots ?? []).map((lot) => ({
      name: lot.Name,
      spaces: lot.SpacesTotal ?? 0,
      type: lot.Type ?? "unknown",
    })),
    ...(stop.AccessibilityInfo
      ? { accessibility_info: stop.AccessibilityInfo }
      : {}),
    ...(stop.BoardingInfo ? { boarding_info: stop.BoardingInfo } : {}),
    ...(stop.DrivingDirections
      ? { driving_directions: stop.DrivingDirections }
      : {}),
  };
}
