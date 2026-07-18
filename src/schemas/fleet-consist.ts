import { z } from "zod";

export const getFleetConsistInputShape = {
  trip_number: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Trip number to look up the currently-assigned consist for (obtain via get_trip_status or get_vehicle_positions). Provide exactly one of trip_number/engine_number.",
    ),
  engine_number: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Locomotive engine number to look up directly. Provide exactly one of trip_number/engine_number.",
    ),
};

export const consistCarSchema = z.object({
  type: z.string(),
  order: z.number(),
  number: z.string(),
});

export const remainingTripSchema = z.object({
  trip_number: z.string(),
  line: z.string(),
  start_time: z.string(),
  end_time: z.string(),
});

export const fleetConsistOutputSchema = z.object({
  engine_number: z.string(),
  coach_count: z.number(),
  cars: z.array(consistCarSchema),
  remaining_trips: z.array(remainingTripSchema),
});

export type ConsistCar = z.infer<typeof consistCarSchema>;
export type RemainingTrip = z.infer<typeof remainingTripSchema>;
export type FleetConsistResult = z.infer<typeof fleetConsistOutputSchema>;

export const fleetConsistOutputShape = fleetConsistOutputSchema.shape;
