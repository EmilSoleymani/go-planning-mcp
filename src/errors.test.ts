import { describe, expect, it } from "vitest";

import { MetrolinxError, toToolErrorResult } from "./errors.js";

describe("toToolErrorResult", () => {
  it("omits structuredContent so it never fails a client's outputSchema validation (#29)", () => {
    const error = new MetrolinxError("not_found", "no such stop", false);
    const result = toToolErrorResult(error);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect("structuredContent" in result).toBe(false);
  });

  it("still carries the full error payload as JSON text content", () => {
    const error = new MetrolinxError("rate_limited", "slow down", true);
    const result = toToolErrorResult(error);

    const content = result.content as { type: string; text: string }[];
    expect(JSON.parse(content[0]!.text)).toEqual({
      error: { code: "rate_limited", message: "slow down", retryable: true },
    });
  });
});
