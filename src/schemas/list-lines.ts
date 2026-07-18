import { z } from "zod";

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const listLinesInputShape = {
  date: z
    .string()
    .regex(DATE_PATTERN)
    .optional()
    .describe("Service day, YYYY-MM-DD. Defaults to today (Toronto)."),
};

export const lineVariantSchema = z.object({
  code: z.string(),
  direction: z
    .string()
    .describe(
      "Valid direction code for this line — pass to get_line_schedule's direction param.",
    ),
  display: z.string(),
});

export const lineSchema = z.object({
  line_code: z.string(),
  line_name: z.string(),
  modes: z.array(z.enum(["train", "bus"])),
  variants: z.array(lineVariantSchema),
});

export const listLinesOutputSchema = z.object({
  lines: z.array(lineSchema),
  truncated: z.boolean(),
  total_matched: z.number().optional(),
});

export type LineVariant = z.infer<typeof lineVariantSchema>;
export type Line = z.infer<typeof lineSchema>;
export type ListLinesResult = z.infer<typeof listLinesOutputSchema>;

export const listLinesOutputShape = listLinesOutputSchema.shape;
