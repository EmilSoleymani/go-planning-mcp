import { MetrolinxError } from "../errors.js";
import type { RawStopDetailsResponse } from "./types.js";

const DEFAULT_BASE_URL = "https://api.openmetrolinx.com/OpenDataAPI/api/V1";
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 5000;

/**
 * The surface tools depend on. Tool tests inject a hand-built fake
 * implementing this interface (test-architecture spec §1).
 */
export interface MetrolinxClient {
  getStopDetails(stopCode: string): Promise<RawStopDetailsResponse>;
}

interface RawEnvelope {
  Metadata?: {
    ErrorCode?: string | null;
    ErrorMessage?: string | null;
  } | null;
}

export interface MetrolinxHttpClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Injected in tests to skip real backoff waits. */
  sleep?: (ms: number) => Promise<void>;
}

export class MetrolinxHttpClient implements MetrolinxClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: MetrolinxHttpClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async getStopDetails(stopCode: string): Promise<RawStopDetailsResponse> {
    return this.get<RawStopDetailsResponse>(
      `/Stop/Details/${encodeURIComponent(stopCode)}`,
    );
  }

  // ADR 0001: at most 2 retries, only on retryable failures — network errors
  // and 5xx, including 5xx tunneled through HTTP 200 bodies. 429 is never
  // retried; it surfaces to the LLM immediately.
  private async get<T extends RawEnvelope>(path: string): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.requestOnce<T>(path);
      } catch (error) {
        if (
          error instanceof MetrolinxError &&
          error.retryable &&
          attempt < MAX_RETRIES
        ) {
          await this.sleep(fullJitterDelay(attempt));
          continue;
        }
        throw error;
      }
    }
  }

  private async requestOnce<T extends RawEnvelope>(path: string): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set("key", this.apiKey);

    let response: Response;
    try {
      response = await fetch(url, { headers: { Accept: "application/json" } });
    } catch {
      throw new MetrolinxError(
        "upstream_unavailable",
        "Metrolinx API unreachable; try again later.",
        true,
      );
    }

    if (response.status === 429) throw rateLimitedError();
    if (response.status >= 500) {
      throw new MetrolinxError(
        "upstream_unavailable",
        "Metrolinx API unreachable; try again later.",
        true,
      );
    }
    if (!response.ok) {
      throw new MetrolinxError(
        "upstream_error",
        `Metrolinx API returned HTTP ${String(response.status)}.`,
        false,
      );
    }

    const body = (await response.json()) as T;
    // Metrolinx tunnels failures through HTTP 200 bodies — the status line
    // lies; only Metadata.ErrorCode tells the truth (ticket 001).
    const tunneled = body.Metadata?.ErrorCode;
    if (tunneled && tunneled !== "200") {
      throw tunneledError(tunneled, body.Metadata?.ErrorMessage ?? undefined);
    }
    return body;
  }
}

function rateLimitedError(): MetrolinxError {
  return new MetrolinxError(
    "rate_limited",
    "Metrolinx rate limit hit. Do not retry now; tell the user real-time data is temporarily unavailable.",
    false,
  );
}

function tunneledError(code: string, message?: string): MetrolinxError {
  if (code === "429") return rateLimitedError();
  if (code === "401") {
    return new MetrolinxError(
      "upstream_auth_failed",
      "Server misconfigured; operator must check METROLINX_API_KEY. Do not retry.",
      false,
    );
  }
  if (code.startsWith("5")) {
    return new MetrolinxError(
      "upstream_unavailable",
      "Metrolinx API unreachable; try again later.",
      true,
    );
  }
  return new MetrolinxError(
    "upstream_error",
    message ?? `Metrolinx reported error ${code}.`,
    false,
  );
}

function fullJitterDelay(attempt: number): number {
  return (
    Math.random() * Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt)
  );
}
