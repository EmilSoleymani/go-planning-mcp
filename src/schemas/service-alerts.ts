import { z } from "zod";

export const getServiceAlertsInputShape = {
  line: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Filter to alerts affecting this line code. Valid values from list_lines.",
    ),
  stop: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Filter to alerts affecting this stop code. Obtain via search_stops — do not guess.",
    ),
  category: z
    .enum(["service", "information", "marketing"])
    .optional()
    .describe(
      "Filter to one alert category. Defaults to service + information combined; marketing is opt-in only.",
    ),
  lang: z
    .enum(["en", "fr"])
    .optional()
    .describe("Response language; defaults to English."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum alerts to return; defaults to 20, max 50."),
};

export const alertStopSchema = z.object({
  stop_code: z.string(),
  stop_name: z.string(),
});

export const alertAffectedSchema = z.object({
  lines: z.array(z.string()),
  stops: z.array(alertStopSchema),
  trips: z.array(z.string()),
});

export const alertSchema = z.object({
  id: z.string(),
  category: z.enum(["service", "information", "marketing"]),
  status: z.enum(["new", "updated", "corrected", "final"]),
  posted_at: z.string(),
  subject: z.string(),
  body: z.string(),
  affected: alertAffectedSchema,
});

export const serviceAlertsOutputSchema = z.object({
  alerts: z.array(alertSchema),
  truncated: z
    .boolean()
    .describe(
      "True when more alerts matched than fit under limit — narrow the filter, don't request more.",
    ),
  total_matched: z.number().optional(),
});

export type Alert = z.infer<typeof alertSchema>;
export type ServiceAlertsResult = z.infer<typeof serviceAlertsOutputSchema>;

export const serviceAlertsOutputShape = serviceAlertsOutputSchema.shape;
