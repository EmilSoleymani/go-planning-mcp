import { z } from "zod";

export const getServiceExceptionsInputShape = {
  mode: z
    .enum(["train", "bus", "any"])
    .optional()
    .describe("Filter by service type; defaults to any."),
};

export const affectedStopSchema = z.object({
  stop_code: z.string(),
  stop_name: z.string(),
  scheduled_time: z.string(),
  cancelled: z.boolean(),
  actual_time: z.string().optional(),
});

export const exceptionSchema = z.object({
  trip_number: z.string(),
  trip_name: z.string(),
  cancelled: z.boolean(),
  affected_stops: z.array(affectedStopSchema),
});

export const serviceExceptionsOutputSchema = z.object({
  exceptions: z.array(exceptionSchema),
  truncated: z.boolean(),
  total_matched: z.number().optional(),
});

export type AffectedStop = z.infer<typeof affectedStopSchema>;
export type Exception = z.infer<typeof exceptionSchema>;
export type ServiceExceptionsResult = z.infer<
  typeof serviceExceptionsOutputSchema
>;

export const serviceExceptionsOutputShape = serviceExceptionsOutputSchema.shape;
