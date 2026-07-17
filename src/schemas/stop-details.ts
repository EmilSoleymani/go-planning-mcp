import { z } from "zod";

// Zod is the single source for inputSchema AND outputSchema (tool-schemas
// spec §1.2); resources reuse these same schemas when they land.

export const getStopDetailsInputShape = {
  stop_code: z
    .string()
    .min(1)
    .describe(
      "GO stop code, e.g. 'UN' (Union Station). Obtain via search_stops — do not guess.",
    ),
  lang: z
    .enum(["en", "fr"])
    .optional()
    .describe("Response language; defaults to English."),
};

export const stopDetailsSchema = z.object({
  stop_code: z.string(),
  stop_name: z.string(),
  city: z.string(),
  coordinates: z.object({ lat: z.number(), lon: z.number() }),
  served_by: z.object({ train: z.boolean(), bus: z.boolean() }),
  facilities: z.array(z.string()),
  parking: z.array(
    z.object({ name: z.string(), spaces: z.number(), type: z.string() }),
  ),
  accessibility_info: z.string().optional(),
  boarding_info: z.string().optional(),
  driving_directions: z.string().optional(),
});

export type StopDetails = z.infer<typeof stopDetailsSchema>;

export const stopDetailsOutputShape = stopDetailsSchema.shape;
