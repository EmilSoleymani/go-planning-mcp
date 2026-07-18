import { z } from "zod";

import { DATE_PATTERN } from "./list-lines.js";

export const getLineScheduleInputShape = {
  line_code: z
    .string()
    .min(1)
    .describe("GO line code, e.g. 'LW' (Lakeshore West). From list_lines."),
  direction: z
    .string()
    .min(1)
    .describe("Line direction code, e.g. 'E'. Valid values from list_lines."),
  date: z
    .string()
    .regex(DATE_PATTERN)
    .optional()
    .describe("Service day, YYYY-MM-DD. Defaults to today (Toronto)."),
  stop_code: z
    .string()
    .optional()
    .describe(
      "GO stop code to get times at that stop. Without it, only trip " +
        "summaries (first/last stop) are returned — a full day's stop-by-stop " +
        "times for every trip is never dumped. Obtain via search_stops.",
    ),
};

export const scheduleTripSchema = z.object({
  trip_number: z.string(),
  display: z.string(),
  departs_first_stop: z
    .string()
    .optional()
    .describe("Only present without stop_code."),
  arrives_last_stop: z
    .string()
    .optional()
    .describe("Only present without stop_code."),
  time: z.string().optional().describe("Only present with stop_code."),
});

export const lineScheduleOutputSchema = z.object({
  trips: z.array(scheduleTripSchema),
  truncated: z.boolean(),
  total_matched: z.number().optional(),
});

export type ScheduleTrip = z.infer<typeof scheduleTripSchema>;
export type LineScheduleResult = z.infer<typeof lineScheduleOutputSchema>;

export const lineScheduleOutputShape = lineScheduleOutputSchema.shape;
