import { z } from "zod";

export const getUnionDeparturesInputShape = {
  mode: z
    .enum(["train", "bus", "any"])
    .optional()
    .describe("Filter by service type; defaults to any."),
};

export const unionStopSchema = z.object({
  stop_code: z.string(),
  stop_name: z.string(),
});

export const unionDepartureSchema = z.object({
  trip_number: z.string(),
  mode: z.enum(["train", "bus"]),
  service: z.string(),
  time: z.string(),
  platform: z.string().optional(),
  stops_served: z.array(unionStopSchema),
});

export const unionDeparturesOutputSchema = z.object({
  departures: z.array(unionDepartureSchema),
  truncated: z.boolean(),
  total_matched: z.number().optional(),
});

export type UnionDeparture = z.infer<typeof unionDepartureSchema>;
export type UnionDeparturesResult = z.infer<typeof unionDeparturesOutputSchema>;

export const unionDeparturesOutputShape = unionDeparturesOutputSchema.shape;
