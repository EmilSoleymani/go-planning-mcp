import { z } from "zod";

export const searchStopsInputShape = {
  query: z
    .string()
    .min(1)
    .describe(
      "Stop or station name fragment to search for, e.g. 'union' or 'oakville'.",
    ),
  stop_type: z
    .enum(["train", "bus", "any"])
    .optional()
    .describe("Filter by service type; defaults to any."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe("Maximum results to return; defaults to 10, max 25."),
};

export const stopMatchSchema = z.object({
  stop_code: z
    .string()
    .describe(
      "Unified GO stop code — pass this to get_stop_details / get_next_service, do not guess.",
    ),
  stop_name: z.string(),
  stop_type: z.enum(["train", "bus", "both"]),
  city: z.string().optional(),
});

export const searchStopsOutputSchema = z.object({
  matches: z.array(stopMatchSchema),
  truncated: z
    .boolean()
    .describe(
      "True when more stops matched than fit under limit — narrow the query, don't request more.",
    ),
  total_matched: z.number().optional(),
});

export type StopMatch = z.infer<typeof stopMatchSchema>;
export type SearchStopsResult = z.infer<typeof searchStopsOutputSchema>;

export const searchStopsOutputShape = searchStopsOutputSchema.shape;
