import { z } from "zod";

const YYYYMMDD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const getServiceGuaranteeInputShape = {
  trip_number: z
    .string()
    .min(1)
    .describe(
      "GO trip number, e.g. '1004'. Obtain via get_line_schedule — do not guess.",
    ),
  date: z
    .string()
    .regex(YYYYMMDD_PATTERN)
    .describe(
      "Operational day, YYYY-MM-DD — the day the trip departed its first " +
        "stop, not necessarily the calendar date of the stop you're " +
        "checking. Trips that run past midnight keep their origin day " +
        "even though later stops show the next calendar date (confirmed " +
        "live). Get this from get_line_schedule's departs_first_stop or " +
        "get_trip_status, not by reading a later stop's timestamp.",
    ),
  lang: z
    .enum(["en", "fr"])
    .optional()
    .describe("Response language; defaults to English."),
};

export const guaranteeStopSchema = z.object({
  stop_code: z.string(),
  scope: z.string(),
  reason: z.string(),
});

export const serviceGuaranteeOutputSchema = z.object({
  eligible: z.boolean(),
  stops: z.array(guaranteeStopSchema),
});

export type GuaranteeStop = z.infer<typeof guaranteeStopSchema>;
export type ServiceGuaranteeResult = z.infer<
  typeof serviceGuaranteeOutputSchema
>;

export const serviceGuaranteeOutputShape = serviceGuaranteeOutputSchema.shape;
