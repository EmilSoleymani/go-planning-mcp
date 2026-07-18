import { z } from "zod";

import { DATE_PATTERN } from "./list-lines.js";

export const getTripStatusInputShape = {
  trip_number: z
    .string()
    .min(1)
    .describe(
      "GO trip number, e.g. '1004'. Obtain via get_next_service, " +
        "get_union_departures, or list_lines + get_line_schedule.",
    ),
  date: z
    .string()
    .regex(DATE_PATTERN)
    .optional()
    .describe(
      "Operational day, YYYY-MM-DD — the day the trip departed its first " +
        "stop. Trips that run past midnight keep their origin day even " +
        "though later stops show the next calendar date (confirmed live). " +
        "Defaults to today (Toronto).",
    ),
};

export const tripStatusStopSchema = z.object({
  stop_code: z.string(),
  stop_name: z.string(),
  scheduled_arrival: z.string().optional(),
  expected_arrival: z.string().optional(),
  scheduled_departure: z.string().optional(),
  expected_departure: z.string().optional(),
  track: z.object({
    scheduled: z.string().optional(),
    actual: z.string().optional(),
  }),
  status: z.string(),
});

export const tripStatusOutputSchema = z.object({
  trip_number: z.string(),
  destination: z.string(),
  status: z.string(),
  position: z.object({ lat: z.number(), lon: z.number() }).optional(),
  stops: z.array(tripStatusStopSchema),
});

export type TripStatusStop = z.infer<typeof tripStatusStopSchema>;
export type TripStatusResult = z.infer<typeof tripStatusOutputSchema>;

export const tripStatusOutputShape = tripStatusOutputSchema.shape;
