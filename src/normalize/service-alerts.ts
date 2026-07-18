import type { RawAlertMessage, RawAlertsResponse } from "../metrolinx/types.js";
import type { Alert, ServiceAlertsResult } from "../schemas/service-alerts.js";
import { toIsoWithTorontoOffset } from "../time.js";

// INIT/UPD/CORR/FINAL confirmed live across the ServiceAlert feed (issue #9:
// only INIT/UPD observed so far; CORR/FINAL carried over from ticket 006's
// documented mapping).
function expandStatus(code: string): Alert["status"] {
  if (code === "INIT") return "new";
  if (code === "UPD") return "updated";
  if (code === "CORR") return "corrected";
  if (code === "FINAL") return "final";
  return "new";
}

function pickLang(en: string, fr: string, lang: "en" | "fr"): string {
  if (lang === "fr" && fr) return fr;
  return en;
}

function normalizeMessage(
  message: RawAlertMessage,
  category: Alert["category"],
  lang: "en" | "fr",
): Alert {
  return {
    id: message.Code,
    category,
    status: expandStatus(message.Status),
    posted_at: toIsoWithTorontoOffset(message.PostedDateTime),
    subject: pickLang(message.SubjectEnglish, message.SubjectFrench, lang),
    body: pickLang(message.BodyEnglish, message.BodyFrench, lang),
    affected: {
      lines: (message.Lines ?? []).map((l) => l.Code),
      stops: (message.Stops ?? []).map((s) => ({
        stop_code: s.Code,
        stop_name: s.Name ?? s.Code,
      })),
      trips: (message.Trips ?? []).map((t) => t.TripNumber),
    },
  };
}

export interface AlertFeed {
  category: Alert["category"];
  raw: RawAlertsResponse;
}

export interface ServiceAlertsFilters {
  line?: string;
  stop?: string;
  limit?: number;
  lang?: "en" | "fr";
}

// The category filter selects which upstream feeds get fetched (tool layer)
// rather than being re-applied here — every message in `feeds` is already
// in-scope by category.
export function normalizeServiceAlerts(
  feeds: AlertFeed[],
  filters: ServiceAlertsFilters = {},
): ServiceAlertsResult {
  const lang = filters.lang ?? "en";
  const limit = filters.limit ?? 20;

  const alerts = feeds.flatMap((feed) =>
    (feed.raw.Messages?.Message ?? []).map((m) =>
      normalizeMessage(m, feed.category, lang),
    ),
  );

  const filtered = alerts.filter((alert) => {
    if (filters.line && !alert.affected.lines.includes(filters.line))
      return false;
    if (
      filters.stop &&
      !alert.affected.stops.some((s) => s.stop_code === filters.stop)
    )
      return false;
    return true;
  });

  const totalMatched = filtered.length;
  return {
    alerts: filtered.slice(0, limit),
    truncated: totalMatched > limit,
    total_matched: totalMatched,
  };
}
