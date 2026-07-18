import { z } from "zod";

const YYYY_MM_DD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const getFaresInputShape = {
  from_stop_code: z
    .string()
    .min(1)
    .describe(
      "GO stop code to travel from, e.g. 'UN' (Union Station). Obtain via search_stops — do not guess.",
    ),
  to_stop_code: z
    .string()
    .min(1)
    .describe(
      "GO stop code to travel to, e.g. 'OA' (Oakville GO). Obtain via search_stops — do not guess.",
    ),
  date: z
    .string()
    .regex(YYYY_MM_DD_PATTERN)
    .optional()
    .describe(
      "Operational day, YYYY-MM-DD. Defaults to the standard fare table (undated).",
    ),
};

export const fareSchema = z.object({
  rider: z.enum(["adult", "student", "senior", "child"]),
  method: z.enum(["presto", "paper"]),
  amount: z.number(),
  category: z.string(),
});

export const faresOutputSchema = z.object({
  fares: z.array(fareSchema),
  truncated: z.boolean(),
  total_matched: z.number().optional(),
});

export type Fare = z.infer<typeof fareSchema>;
export type FaresResult = z.infer<typeof faresOutputSchema>;

export const faresOutputShape = faresOutputSchema.shape;
