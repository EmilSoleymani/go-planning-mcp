import { z } from "zod";

export const getTripUpdatesInputShape = {
  line_code: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Filter to one line, e.g. 'LW' (Lakeshore West). Valid values from list_lines.",
    ),
  trip_number: z
    .string()
    .min(1)
    .optional()
    .describe("Filter to one trip number, e.g. '1026'."),
  stop_code: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Filter to trips with an update at this stop. Obtain via search_stops — do not guess.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum updates to return; defaults to 20, max 50."),
};

export const stopUpdateSchema = z.object({
  stop_code: z.string(),
  scheduled_arrival: z.string().optional(),
  expected_arrival: z.string().optional(),
  scheduled_departure: z.string().optional(),
  expected_departure: z.string().optional(),
  status: z.string(),
});

export const tripUpdateSchema = z.object({
  trip_number: z.string(),
  line_code: z.string(),
  direction: z.string().optional(),
  status: z.enum(["on_time", "delayed", "cancelled", "modified"]),
  delay_minutes: z.number(),
  stop_updates: z.array(stopUpdateSchema),
  updated_at: z.string(),
});

export const tripUpdatesOutputSchema = z.object({
  updates: z.array(tripUpdateSchema),
  truncated: z
    .boolean()
    .describe(
      "True when more updates matched than fit under limit — narrow the filter, don't request more.",
    ),
  total_matched: z.number().optional(),
});

export type StopUpdate = z.infer<typeof stopUpdateSchema>;
export type TripUpdate = z.infer<typeof tripUpdateSchema>;
export type TripUpdatesResult = z.infer<typeof tripUpdatesOutputSchema>;

export const tripUpdatesOutputShape = tripUpdatesOutputSchema.shape;
