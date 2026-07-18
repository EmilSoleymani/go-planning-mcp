import { MetrolinxError } from "../errors.js";
import { TtlCache } from "./cache.js";
import type {
  RawAlertsResponse,
  RawLineAllResponse,
  RawLineScheduleResponse,
  RawNextServiceResponse,
  RawServiceExceptionsResponse,
  RawServiceGuaranteeResponse,
  RawStopAllResponse,
  RawStopDestinationsResponse,
  RawStopDetailsResponse,
  RawUnionDeparturesResponse,
  RawTripStatusResponse,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.openmetrolinx.com/OpenDataAPI/api/V1";
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 5000;

// Caching spec (ticket 005): stops are slow-changing (24h); published
// schedules are effectively static once a service day is published (6h);
// next-service, destinations, and trip status are real-time and never cached.
const STOP_ALL_TTL_MS = 24 * 60 * 60 * 1000;
const SCHEDULE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * The surface tools depend on. Tool tests inject a hand-built fake
 * implementing this interface (test-architecture spec §1).
 */
export interface MetrolinxClient {
  getStopDetails(stopCode: string): Promise<RawStopDetailsResponse>;
  getStopAll(): Promise<RawStopAllResponse>;
  getNextService(stopCode: string): Promise<RawNextServiceResponse>;
  getStopDestinations(
    stopCode: string,
    fromTimeWire: string,
    toTimeWire: string,
  ): Promise<RawStopDestinationsResponse>;
  getServiceAlerts(): Promise<RawAlertsResponse>;
  getInformationAlerts(): Promise<RawAlertsResponse>;
  getMarketingAlerts(): Promise<RawAlertsResponse>;
  getUnionDepartures(): Promise<RawUnionDeparturesResponse>;
  getServiceExceptions(
    mode: "train" | "bus" | "any",
  ): Promise<RawServiceExceptionsResponse>;
  getServiceGuarantee(
    tripNumber: string,
    dateWire: string,
  ): Promise<RawServiceGuaranteeResponse>;
  getLineAll(dateWire: string): Promise<RawLineAllResponse>;
  getLineSchedule(
    dateWire: string,
    lineCode: string,
    direction: string,
  ): Promise<RawLineScheduleResponse>;
  getTripStatus(
    dateWire: string,
    tripNumber: string,
  ): Promise<RawTripStatusResponse>;
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
  /** CACHE_ENABLED kill switch (caching spec, ticket 005); default true. */
  cacheEnabled?: boolean;
}

export class MetrolinxHttpClient implements MetrolinxClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly cache: TtlCache;

  constructor(options: MetrolinxHttpClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.cache = new TtlCache({ enabled: options.cacheEnabled ?? true });
  }

  async getStopDetails(stopCode: string): Promise<RawStopDetailsResponse> {
    return this.get<RawStopDetailsResponse>(
      `/Stop/Details/${encodeURIComponent(stopCode)}`,
    );
  }

  async getStopAll(): Promise<RawStopAllResponse> {
    return this.cache.getOrFetch("stop-all", STOP_ALL_TTL_MS, () =>
      this.get<RawStopAllResponse>("/Stop/All"),
    );
  }

  async getNextService(stopCode: string): Promise<RawNextServiceResponse> {
    return this.get<RawNextServiceResponse>(
      `/Stop/NextService/${encodeURIComponent(stopCode)}`,
    );
  }

  async getStopDestinations(
    stopCode: string,
    fromTimeWire: string,
    toTimeWire: string,
  ): Promise<RawStopDestinationsResponse> {
    return this.get<RawStopDestinationsResponse>(
      `/Stop/Destinations/${encodeURIComponent(stopCode)}/${fromTimeWire}/${toTimeWire}`,
    );
  }

  // Alerts change through the day and have no caching tier assigned by the
  // caching spec (ticket 005 only names stops/schedules/fares) — left
  // uncached rather than guessing a TTL.
  async getServiceAlerts(): Promise<RawAlertsResponse> {
    return this.get<RawAlertsResponse>("/ServiceUpdate/ServiceAlert/All");
  }

  async getInformationAlerts(): Promise<RawAlertsResponse> {
    return this.get<RawAlertsResponse>("/ServiceUpdate/InformationAlert/All");
  }

  async getMarketingAlerts(): Promise<RawAlertsResponse> {
    return this.get<RawAlertsResponse>("/ServiceUpdate/MarketingAlert/All");
  }

  async getUnionDepartures(): Promise<RawUnionDeparturesResponse> {
    return this.get<RawUnionDeparturesResponse>(
      "/ServiceUpdate/UnionDepartures/All",
    );
  }

  async getServiceExceptions(
    mode: "train" | "bus" | "any",
  ): Promise<RawServiceExceptionsResponse> {
    const segment = mode === "train" ? "Train" : mode === "bus" ? "Bus" : "All";
    return this.get<RawServiceExceptionsResponse>(
      `/ServiceUpdate/Exceptions/${segment}`,
    );
  }

  async getServiceGuarantee(
    tripNumber: string,
    dateWire: string,
  ): Promise<RawServiceGuaranteeResponse> {
    return this.get<RawServiceGuaranteeResponse>(
      `/ServiceUpdate/ServiceGuarantee/${encodeURIComponent(tripNumber)}/${dateWire}`,
  async getLineAll(dateWire: string): Promise<RawLineAllResponse> {
    return this.cache.getOrFetch(`line-all:${dateWire}`, SCHEDULE_TTL_MS, () =>
      this.get<RawLineAllResponse>(`/Schedule/Line/All/${dateWire}`),
    );
  }

  async getLineSchedule(
    dateWire: string,
    lineCode: string,
    direction: string,
  ): Promise<RawLineScheduleResponse> {
    return this.cache.getOrFetch(
      `line-schedule:${dateWire}:${lineCode}:${direction}`,
      SCHEDULE_TTL_MS,
      () =>
        this.get<RawLineScheduleResponse>(
          `/Schedule/Line/${dateWire}/${encodeURIComponent(lineCode)}/${encodeURIComponent(direction)}`,
        ),
    );
  }

  async getTripStatus(
    dateWire: string,
    tripNumber: string,
  ): Promise<RawTripStatusResponse> {
    return this.get<RawTripStatusResponse>(
      `/Schedule/Trip/${dateWire}/${encodeURIComponent(tripNumber)}`,
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
    // lies; only Metadata.ErrorCode tells the truth (ticket 001). "204" is
    // not a failure despite the tunneling mechanism: confirmed live
    // (issue #7) for an unknown stop code across Stop/Details,
    // Stop/NextService, and Stop/Destinations — ErrorMessage "No Content",
    // data field null. Treated as a passthrough so each tool's own
    // null-check produces `not_found` instead of a generic upstream error.
    const tunneled = body.Metadata?.ErrorCode;
    if (tunneled && tunneled !== "200" && tunneled !== "204") {
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
