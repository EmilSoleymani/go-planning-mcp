import { z } from "zod";

export const getNextServiceInputShape = {
  stop_code: z
    .string()
    .min(1)
    .describe(
      "GO stop code, e.g. 'UN' (Union Station). Obtain via search_stops — do not guess.",
    ),
};

export const departureSchema = z.object({
  line_code: z.string(),
  line_name: z.string(),
  direction: z.string(),
  mode: z.enum(["train", "bus"]),
  scheduled_time: z.string(),
  expected_time: z.string(),
  delay_minutes: z.number(),
  status: z.string(),
  platform: z.object({
    scheduled: z.string().optional(),
    actual: z.string().optional(),
  }),
  trip_number: z.string(),
});

export const nextServiceOutputSchema = z.object({
  departures: z.array(departureSchema),
  truncated: z.boolean(),
  total_matched: z.number().optional(),
});

export type Departure = z.infer<typeof departureSchema>;
export type NextServiceResult = z.infer<typeof nextServiceOutputSchema>;

export const nextServiceOutputShape = nextServiceOutputSchema.shape;
