import { MetrolinxError } from "../errors.js";
import type {
  RawGuaranteeStop,
  RawServiceGuaranteeResponse,
} from "../metrolinx/types.js";
import type {
  GuaranteeStop,
  ServiceGuaranteeResult,
} from "../schemas/service-guarantee.js";

function normalizeStop(
  stop: RawGuaranteeStop,
  lang: "en" | "fr",
): GuaranteeStop {
  return {
    stop_code: stop.Code,
    scope: stop.Scope,
    reason: lang === "fr" && stop.ReasonFr ? stop.ReasonFr : stop.ReasonEn,
  };
}

export function normalizeServiceGuarantee(
  raw: RawServiceGuaranteeResponse,
  lang: "en" | "fr" = "en",
): ServiceGuaranteeResult {
  // Same presence-vs-absence signal confirmed live across every other
  // endpoint in this API (Stop/Details, Stop/NextService, Stop/Destinations,
  // issues #3/#7): an absent Stops container means the trip/date itself
  // wasn't found; a present-but-empty array is a valid "not eligible for
  // any guarantee" result, not an error. ServiceGuarantee wasn't part of
  // issue #3's capture batch so this specific endpoint isn't independently
  // reconfirmed, but it's the same body-tunneling mechanism every other
  // endpoint uses.
  if (!raw.Stops) {
    throw new MetrolinxError(
      "not_found",
      "No trip matches that trip_number/date. Verify via get_line_schedule.",
      false,
    );
  }

  const stops = raw.Stops.Stop ?? [];
  return {
    eligible: stops.length > 0,
    stops: stops.map((s) => normalizeStop(s, lang)),
  };
}
