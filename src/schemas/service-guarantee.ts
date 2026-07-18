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
    .describe("Service date, YYYY-MM-DD, for the trip being checked."),
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
