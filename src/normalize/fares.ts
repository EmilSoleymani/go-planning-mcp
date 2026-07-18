import { MetrolinxError } from "../errors.js";
import type { RawFaresResponse } from "../metrolinx/types.js";
import type { Fare, FaresResult } from "../schemas/fares.js";

const RIDER_BY_CATEGORY: Record<string, Fare["rider"]> = {
  Adult: "adult",
  Student: "student",
  Senior: "senior",
  Child: "child",
  // "Group Pass" (live-confirmed, issue #3) is a bulk purchase, not a rider
  // category — it has no slot in the closed rider enum and is dropped below.
};

function normalizeMethod(type: string): Fare["method"] {
  // Only "Paper"/"Presto" observed live (issue #3); best-effort default to
  // "paper" for anything else, same spirit as normalizeMode's ServiceType
  // fallback in normalize/next-service.ts.
  return type.toLowerCase() === "presto" ? "presto" : "paper";
}

export function normalizeFares(raw: RawFaresResponse): FaresResult {
  const categories = raw.AllFares?.FareCategory;
  if (!categories) {
    throw new MetrolinxError(
      "not_found",
      "No fare found between those stops. Verify both codes via search_stops.",
      false,
    );
  }

  const fares: Fare[] = [];
  for (const category of categories) {
    const rider = RIDER_BY_CATEGORY[category.Type];
    if (!rider) continue;
    for (const ticket of category.Tickets ?? []) {
      const method = normalizeMethod(ticket.Type);
      for (const fare of ticket.Fares ?? []) {
        fares.push({
          rider,
          method,
          amount: fare.Amount,
          category: fare.Category,
        });
      }
    }
  }

  return {
    fares,
    truncated: false,
    total_matched: fares.length,
  };
}
