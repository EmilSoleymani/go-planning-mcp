import { MetrolinxError } from "../errors.js";
import type { RawStopDetailsResponse } from "../metrolinx/types.js";
import type { StopDetails } from "../schemas/stop-details.js";

// Facility codes that signal wheelchair-accessible train service (Data
// Catalogue). Metrolinx has no dedicated AccessibilityInfo field — verified
// against a live capture (issue #3) — so accessibility is derived here.
const ACCESSIBILITY_FACILITY_CODES = new Set(["WAT", "UPWAT"]);

function pickLang(en: string, fr: string, lang: "en" | "fr"): string {
  // Bilingual field pairs collapse to one field per requested language
  // (tool-schemas spec §1.1); live data sometimes ships an empty French
  // string, so fall back to English rather than returning "".
  if (lang === "fr" && fr) return fr;
  return en;
}

export function normalizeStopDetails(
  raw: RawStopDetailsResponse,
  lang: "en" | "fr" = "en",
  // The unified stop_code to echo back. Stop/Details' own `Code` field
  // mirrors whatever code the request was made with — for a bus-only stop
  // that's the wire LocationCode (issue #61), not the unified stop_code
  // search_stops handed out. Callers that queried by wireCode must pass
  // the canonical unified code back in here so the DTO round-trips.
  stopCodeOverride?: string,
): StopDetails {
  const stop = raw.Stop;
  if (!stop) {
    throw new MetrolinxError(
      "not_found",
      "No stop matches that code. Verify the code via search_stops.",
      false,
    );
  }

  const facilities = stop.Facilities ?? [];
  const facilityDescriptions = facilities.map((f) =>
    pickLang(f.Description, f.DescriptionFr, lang),
  );
  const accessibilityText = facilities
    .filter((f) => ACCESSIBILITY_FACILITY_CODES.has(f.Code))
    .map((f) => pickLang(f.Description, f.DescriptionFr, lang))
    .join("; ");

  const boardingInfo = pickLang(stop.BoardingInfo, stop.BoardingInfoFr, lang);
  const drivingDirections = pickLang(
    stop.DrivingDirections,
    stop.DrivingDirectionsFr,
    lang,
  );

  return {
    stop_code: stopCodeOverride ?? stop.Code,
    stop_name: pickLang(stop.StopName, stop.StopNameFr, lang),
    city: stop.City ?? "",
    coordinates: { lat: Number(stop.Latitude), lon: Number(stop.Longitude) },
    served_by: { train: stop.IsTrain, bus: stop.IsBus },
    facilities: facilityDescriptions,
    parking: (stop.Parkings ?? []).map((lot) => ({
      name: pickLang(lot.Name, lot.NameFr, lang),
      spaces: Number(lot.ParkSpots) || 0,
      type: lot.Type || "unknown",
    })),
    ...(accessibilityText ? { accessibility_info: accessibilityText } : {}),
    ...(boardingInfo ? { boarding_info: boardingInfo } : {}),
    ...(drivingDirections ? { driving_directions: drivingDirections } : {}),
  };
}
