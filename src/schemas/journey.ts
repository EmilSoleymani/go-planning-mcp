import { z } from "zod";

import { DATE_PATTERN } from "./list-lines.js";
import { stopMatchSchema } from "./search-stops.js";

const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const stopRefSchema = z.object({
  stop_code: z.string(),
  stop_name: z.string(),
});

const legStopSchema = z.object({
  stop_code: z.string(),
  stop_name: z.string(),
  time: z.string(),
});

export const itineraryLegSchema = z.object({
  mode: z.enum(["train", "bus"]),
  line_code: z.string(),
  line_name: z.string(),
  direction: z.string(),
  from: legStopSchema,
  to: legStopSchema,
  trip_number: z.string(),
});

export const itinerarySchema = z.object({
  departure_time: z.string(),
  arrival_time: z.string(),
  duration_minutes: z.number(),
  transfers: z.number(),
  accessible: z.boolean(),
  legs: z.array(itineraryLegSchema),
});

export const ambiguitySchema = z.object({
  field: z.enum(["from", "to"]),
  query: z.string(),
  candidates: z.array(stopMatchSchema),
});

export type Itinerary = z.infer<typeof itinerarySchema>;
export type ItineraryLeg = z.infer<typeof itineraryLegSchema>;
export type Ambiguity = z.infer<typeof ambiguitySchema>;

const maxResultsSchema = z
  .number()
  .int()
  .min(1)
  .max(10)
  .optional()
  .describe(
    "Maximum itineraries to return; defaults to 3, max 10 (mirrors Metrolinx's MaxJourney).",
  );

export const planTripInputShape = {
  from: z
    .string()
    .min(1)
    .describe(
      "Origin station/stop name (fuzzy-matched, e.g. 'union') or exact stop code.",
    ),
  to: z
    .string()
    .min(1)
    .describe(
      "Destination station/stop name (fuzzy-matched, e.g. 'oakville') or exact stop code.",
    ),
  date: z
    .string()
    .regex(DATE_PATTERN)
    .optional()
    .describe("Travel date, YYYY-MM-DD. Defaults to today (Toronto)."),
  time: z
    .string()
    .regex(HHMM_PATTERN)
    .optional()
    .describe(
      "Departure or arrival time (see time_mode), HH:MM 24h. Defaults to now (Toronto).",
    ),
  time_mode: z
    .enum(["depart_after", "arrive_by"])
    .optional()
    .describe(
      "'depart_after' (default) finds itineraries leaving at/after time; " +
        "'arrive_by' emulates an arrive-by search by back-shifting the " +
        "query window and filtering on arrival at/before time.",
    ),
  max_results: maxResultsSchema,
  lang: z
    .enum(["en", "fr"])
    .optional()
    .describe("Response language; defaults to 'en'."),
};

export const planTripOutputSchema = z.object({
  status: z.enum(["ok", "ambiguous"]),
  from: stopRefSchema
    .optional()
    .describe("Only present when status is 'ok' — what 'from' resolved to."),
  to: stopRefSchema
    .optional()
    .describe("Only present when status is 'ok' — what 'to' resolved to."),
  itineraries: z
    .array(itinerarySchema)
    .optional()
    .describe(
      "Only present when status is 'ok'. Cross-line trips are composed " +
        "automatically via a Union Station transfer when no direct journey " +
        "exists. Empty means nothing was found in the requested window even " +
        "via Union — suggest a different time/date, or a bus-terminal " +
        "transfer the server does not compose yet.",
    ),
  ambiguities: z
    .array(ambiguitySchema)
    .optional()
    .describe(
      "Only present when status is 'ambiguous'. Disambiguation is not a " +
        "failure — ask the user to pick a candidate, then retry.",
    ),
});

export type PlanTripResult = z.infer<typeof planTripOutputSchema>;

export const planTripOutputShape = planTripOutputSchema.shape;

export const planJourneyInputShape = {
  from_stop_code: z
    .string()
    .min(1)
    .describe(
      "Exact GO stop code, e.g. 'UN' (Union Station). Obtain via search_stops — no fuzzy resolution here, use plan_trip for that.",
    ),
  to_stop_code: z
    .string()
    .min(1)
    .describe(
      "Exact GO stop code, e.g. 'OA' (Oakville GO). Obtain via search_stops — no fuzzy resolution here, use plan_trip for that.",
    ),
  date: z
    .string()
    .regex(DATE_PATTERN)
    .optional()
    .describe("Travel date, YYYY-MM-DD. Defaults to today (Toronto)."),
  time: z
    .string()
    .regex(HHMM_PATTERN)
    .optional()
    .describe(
      "Depart-after time, HH:MM 24h. Defaults to now (Toronto). No arrive_by mode — use plan_trip for that.",
    ),
  max_results: maxResultsSchema,
};

export const planJourneyOutputSchema = z.object({
  itineraries: z
    .array(itinerarySchema)
    .describe(
      "Raw single-call mirror: Metrolinx's journey planner only returns " +
        "single-service journeys, and this tool does not compose " +
        "transfers. Empty on a cross-line pair is expected — use plan_trip, " +
        "which composes a via-Union transfer automatically.",
    ),
});

export type PlanJourneyResult = z.infer<typeof planJourneyOutputSchema>;

export const planJourneyOutputShape = planJourneyOutputSchema.shape;
