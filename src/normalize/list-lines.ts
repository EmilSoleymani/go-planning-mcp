import type {
  RawLineAllEntry,
  RawLineAllResponse,
} from "../metrolinx/types.js";
import type { Line, ListLinesResult } from "../schemas/list-lines.js";

function modesOf(entry: RawLineAllEntry): ("train" | "bus")[] {
  const modes: ("train" | "bus")[] = [];
  if (entry.IsTrain) modes.push("train");
  if (entry.IsBus) modes.push("bus");
  return modes;
}

function normalizeLine(entry: RawLineAllEntry): Line {
  return {
    line_code: entry.Code,
    line_name: entry.Name,
    modes: modesOf(entry),
    variants: (entry.Variant ?? []).map((variant) => ({
      code: variant.Code,
      direction: variant.Direction,
      display: variant.Display,
    })),
  };
}

export function normalizeListLines(raw: RawLineAllResponse): ListLinesResult {
  const lines = (raw.AllLines?.Line ?? []).map(normalizeLine);
  return {
    lines,
    truncated: false,
    total_matched: lines.length,
  };
}
