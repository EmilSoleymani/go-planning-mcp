import { z } from "zod";

export const getVehiclePositionsInputShape = {
  mode: z
    .enum(["train", "bus", "upx"])
    .describe("Vehicle mode to query — train, bus, or UPX."),
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
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum vehicles to return; defaults to 20, max 50."),
};

export const vehiclePositionSchema = z.object({
  trip_number: z.string(),
  line_code: z.string(),
  mode: z.enum(["train", "bus", "upx"]),
  position: z.object({ lat: z.number(), lon: z.number() }),
  delay_minutes: z.number(),
  occupancy_percent: z
    .number()
    .optional()
    .describe("Populated only when the upstream GTFS-RT feed reports it."),
  next_stop: z
    .object({ stop_code: z.string(), stop_name: z.string() })
    .optional(),
  in_motion: z.boolean(),
  updated_at: z.string(),
});

export const vehiclePositionsOutputSchema = z.object({
  vehicles: z.array(vehiclePositionSchema),
  truncated: z
    .boolean()
    .describe(
      "True when more vehicles matched than fit under limit — narrow the filter, don't request more.",
    ),
  total_matched: z.number().optional(),
});

export type VehiclePosition = z.infer<typeof vehiclePositionSchema>;
export type VehiclePositionsResult = z.infer<
  typeof vehiclePositionsOutputSchema
>;

export const vehiclePositionsOutputShape = vehiclePositionsOutputSchema.shape;
