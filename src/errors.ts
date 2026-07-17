import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type MetrolinxErrorCode =
  | "rate_limited"
  | "upstream_auth_failed"
  | "upstream_unavailable"
  | "not_found"
  | "invalid_input"
  | "upstream_error";

/**
 * An operational failure surfaced to the LLM as an in-result error
 * (tool-schemas spec §1.5). Messages are instructions for the model,
 * not diagnostics.
 */
export class MetrolinxError extends Error {
  readonly code: MetrolinxErrorCode;
  readonly retryable: boolean;

  constructor(code: MetrolinxErrorCode, message: string, retryable: boolean) {
    super(message);
    this.name = "MetrolinxError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function toToolErrorResult(error: MetrolinxError): CallToolResult {
  const payload = {
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    },
  };
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}
