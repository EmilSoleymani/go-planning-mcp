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
  // Confirmed live (issue #9 follow-up): a real, unambiguously-valid
  // trip_number/date returned an absent Stops container. The
  // presence-vs-absence "not_found" signal confirmed for other endpoints
  // (Stop/Details, Stop/NextService, Stop/Destinations) does NOT hold here
  // — an absent container is the ordinary shape for "this trip wasn't
  // delayed enough to be guarantee-eligible," not a signal that the
  // trip/date itself is wrong. Previously this threw not_found for every
  // non-eligible trip, which is most of them.
  const stops = raw.Stops?.Stop ?? [];
  return {
    eligible: stops.length > 0,
    stops: stops.map((s) => normalizeStop(s, lang)),
  };
}
