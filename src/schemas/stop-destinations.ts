import { z } from "zod";

const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const getStopDestinationsInputShape = {
  stop_code: z
    .string()
    .min(1)
    .describe(
      "GO stop code, e.g. 'UN' (Union Station). Obtain via search_stops — do not guess.",
    ),
  from_time: z
    .string()
    .regex(HHMM_PATTERN)
    .optional()
    .describe("Window start, HH:MM 24h. Defaults to now (Toronto)."),
  to_time: z
    .string()
    .regex(HHMM_PATTERN)
    .optional()
    .describe("Window end, HH:MM 24h. Defaults to 4 hours after from_time."),
};

export const destinationSchema = z.object({
  line_code: z.string(),
  line_name: z.string(),
  direction: z.string(),
  destination_stop_code: z.string(),
  destination_stop_name: z.string(),
});

export const stopDestinationsOutputSchema = z.object({
  destinations: z.array(destinationSchema),
  truncated: z.boolean(),
  total_matched: z.number().optional(),
});

export type Destination = z.infer<typeof destinationSchema>;
export type StopDestinationsResult = z.infer<
  typeof stopDestinationsOutputSchema
>;

export const stopDestinationsOutputShape = stopDestinationsOutputSchema.shape;
