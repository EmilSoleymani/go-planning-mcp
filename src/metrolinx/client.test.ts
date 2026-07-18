import { readFileSync } from "node:fs";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import { MetrolinxHttpClient } from "./client.js";
import type {
  RawAlertsResponse,
  RawServiceExceptionsResponse,
  RawServiceGuaranteeResponse,
  RawStopAllResponse,
  RawStopDestinationsResponse,
  RawStopDetailsResponse,
  RawUnionDeparturesResponse,
} from "./types.js";

const BASE_URL = "https://api.openmetrolinx.com/OpenDataAPI/api/V1";
const DETAILS_URL = `${BASE_URL}/Stop/Details/UN`;
const STOP_ALL_URL = `${BASE_URL}/Stop/All`;
const NEXT_SERVICE_URL = `${BASE_URL}/Stop/NextService/UN`;
const DESTINATIONS_URL = `${BASE_URL}/Stop/Destinations/UN/0900/1300`;
const SERVICE_ALERT_URL = `${BASE_URL}/ServiceUpdate/ServiceAlert/All`;
const INFORMATION_ALERT_URL = `${BASE_URL}/ServiceUpdate/InformationAlert/All`;
const MARKETING_ALERT_URL = `${BASE_URL}/ServiceUpdate/MarketingAlert/All`;
const UNION_DEPARTURES_URL = `${BASE_URL}/ServiceUpdate/UnionDepartures/All`;
const EXCEPTIONS_TRAIN_URL = `${BASE_URL}/ServiceUpdate/Exceptions/Train`;
const EXCEPTIONS_BUS_URL = `${BASE_URL}/ServiceUpdate/Exceptions/Bus`;
const EXCEPTIONS_ALL_URL = `${BASE_URL}/ServiceUpdate/Exceptions/All`;
const SERVICE_GUARANTEE_URL = `${BASE_URL}/ServiceUpdate/ServiceGuarantee/1029/20260717`;

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-details.json", import.meta.url),
    "utf8",
  ),
) as RawStopDetailsResponse;

const stopAllFixture = JSON.parse(
  readFileSync(
    new URL(
      "../../test/fixtures/ambiguous-name-oakville.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as RawStopAllResponse;

const destinationsFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-destinations.json", import.meta.url),
    "utf8",
  ),
) as RawStopDestinationsResponse;

const alertsFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/service-alerts.json", import.meta.url),
    "utf8",
  ),
) as RawAlertsResponse;

const unionDeparturesFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/union-departures.json", import.meta.url),
    "utf8",
  ),
) as RawUnionDeparturesResponse;

const exceptionsFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/service-exceptions.json", import.meta.url),
    "utf8",
  ),
) as RawServiceExceptionsResponse;

const guaranteeFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/service-guarantee.json", import.meta.url),
    "utf8",
  ),
) as RawServiceGuaranteeResponse;

function tunneled(code: string): RawStopDetailsResponse {
  return {
    Metadata: {
      TimeStamp: "2026-07-17 10:00:00",
      ErrorCode: code,
      ErrorMessage: `Error ${code}`,
    },
  };
}

const mswServer = setupServer();

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  mswServer.resetHandlers();
});
afterAll(() => {
  mswServer.close();
});

function makeClient(cacheEnabled?: boolean): MetrolinxHttpClient {
  return new MetrolinxHttpClient({
    apiKey: "test-key",
    sleep: () => Promise.resolve(),
    ...(cacheEnabled === undefined ? {} : { cacheEnabled }),
  });
}

describe("MetrolinxHttpClient", () => {
  it("sends the ?key param and Accept: application/json, and parses the body", async () => {
    let captured: Request | undefined;
    mswServer.use(
      http.get(DETAILS_URL, ({ request }) => {
        captured = request;
        return HttpResponse.json(fixture);
      }),
    );

    const body = await makeClient().getStopDetails("UN");

    expect(body.Stop?.Code).toBe("UN");
    expect(captured).toBeDefined();
    const url = new URL(captured!.url);
    expect(url.searchParams.get("key")).toBe("test-key");
    expect(captured!.headers.get("accept")).toBe("application/json");
  });

  it("retries an HTTP 5xx and succeeds", async () => {
    let calls = 0;
    mswServer.use(
      http.get(DETAILS_URL, () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json(fixture);
      }),
    );

    const body = await makeClient().getStopDetails("UN");

    expect(body.Stop?.Code).toBe("UN");
    expect(calls).toBe(2);
  });

  it("retries a body-tunneled 503 delivered over HTTP 200", async () => {
    let calls = 0;
    mswServer.use(
      http.get(DETAILS_URL, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(tunneled("503"))
          : HttpResponse.json(fixture);
      }),
    );

    const body = await makeClient().getStopDetails("UN");

    expect(body.Stop?.Code).toBe("UN");
    expect(calls).toBe(2);
  });

  it("retries network errors", async () => {
    let calls = 0;
    mswServer.use(
      http.get(DETAILS_URL, () => {
        calls += 1;
        return calls === 1 ? HttpResponse.error() : HttpResponse.json(fixture);
      }),
    );

    const body = await makeClient().getStopDetails("UN");

    expect(body.Stop?.Code).toBe("UN");
    expect(calls).toBe(2);
  });

  it("gives up after 2 retries and surfaces upstream_unavailable", async () => {
    let calls = 0;
    mswServer.use(
      http.get(DETAILS_URL, () => {
        calls += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    await expect(makeClient().getStopDetails("UN")).rejects.toMatchObject({
      code: "upstream_unavailable",
      retryable: true,
    });
    expect(calls).toBe(3);
  });

  it("never retries an HTTP 429", async () => {
    let calls = 0;
    mswServer.use(
      http.get(DETAILS_URL, () => {
        calls += 1;
        return new HttpResponse(null, { status: 429 });
      }),
    );

    await expect(makeClient().getStopDetails("UN")).rejects.toMatchObject({
      code: "rate_limited",
      retryable: false,
    });
    expect(calls).toBe(1);
  });

  it("never retries a body-tunneled 429", async () => {
    let calls = 0;
    mswServer.use(
      http.get(DETAILS_URL, () => {
        calls += 1;
        return HttpResponse.json(tunneled("429"));
      }),
    );

    await expect(makeClient().getStopDetails("UN")).rejects.toMatchObject({
      code: "rate_limited",
      retryable: false,
    });
    expect(calls).toBe(1);
  });

  it("maps other non-ok statuses to upstream_error without retrying", async () => {
    let calls = 0;
    mswServer.use(
      http.get(DETAILS_URL, () => {
        calls += 1;
        return new HttpResponse(null, { status: 404 });
      }),
    );

    await expect(makeClient().getStopDetails("UN")).rejects.toMatchObject({
      code: "upstream_error",
      retryable: false,
    });
    expect(calls).toBe(1);
  });

  it("maps unclassifiable tunneled codes to upstream_error with the upstream message", async () => {
    mswServer.use(
      http.get(DETAILS_URL, () => HttpResponse.json(tunneled("400"))),
    );

    await expect(makeClient().getStopDetails("UN")).rejects.toMatchObject({
      code: "upstream_error",
      message: "Error 400",
      retryable: false,
    });
  });

  it("maps a body-tunneled 401 to upstream_auth_failed without retrying", async () => {
    let calls = 0;
    mswServer.use(
      http.get(DETAILS_URL, () => {
        calls += 1;
        return HttpResponse.json(tunneled("401"));
      }),
    );

    const error = await makeClient()
      .getStopDetails("UN")
      .then(
        () => undefined,
        (e: unknown) => e,
      );

    expect(error).toBeInstanceOf(MetrolinxError);
    expect((error as MetrolinxError).code).toBe("upstream_auth_failed");
    expect(calls).toBe(1);
  });

  it("passes through a body-tunneled 204/No Content without throwing (live-confirmed: unknown stop code)", async () => {
    mswServer.use(
      http.get(DETAILS_URL, () =>
        HttpResponse.json({
          Metadata: {
            TimeStamp: "2026-07-17 19:45:47",
            ErrorCode: "204",
            ErrorMessage: "No Content",
          },
          Stop: null,
        }),
      ),
    );

    const body = await makeClient().getStopDetails("UN");
    expect(body.Stop).toBeNull();
  });

  it("requests Stop/NextService/{StopCode}", async () => {
    mswServer.use(
      http.get(NEXT_SERVICE_URL, () =>
        HttpResponse.json({
          Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
          NextService: { Lines: [] },
        }),
      ),
    );

    const body = await makeClient().getNextService("UN");
    expect(body.NextService?.Lines).toEqual([]);
  });

  it("requests Stop/Destinations/{StopCode}/{FromTime}/{ToTime}", async () => {
    mswServer.use(
      http.get(DESTINATIONS_URL, () => HttpResponse.json(destinationsFixture)),
    );

    const body = await makeClient().getStopDestinations("UN", "0900", "1300");
    expect(body.Stop?.Code).toBe("UN");
  });

  it("caches Stop/All for 24h — a second call within TTL hits the cache, not upstream", async () => {
    let calls = 0;
    mswServer.use(
      http.get(STOP_ALL_URL, () => {
        calls += 1;
        return HttpResponse.json(stopAllFixture);
      }),
    );

    const client = makeClient();
    await client.getStopAll();
    await client.getStopAll();

    expect(calls).toBe(1);
  });

  it("bypasses the Stop/All cache when cacheEnabled is false", async () => {
    let calls = 0;
    mswServer.use(
      http.get(STOP_ALL_URL, () => {
        calls += 1;
        return HttpResponse.json(stopAllFixture);
      }),
    );

    const client = makeClient(false);
    await client.getStopAll();
    await client.getStopAll();

    expect(calls).toBe(2);
  });

  it("never caches Stop/NextService (real-time)", async () => {
    let calls = 0;
    mswServer.use(
      http.get(NEXT_SERVICE_URL, () => {
        calls += 1;
        return HttpResponse.json({
          Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
          NextService: { Lines: [] },
        });
      }),
    );

    const client = makeClient();
    await client.getNextService("UN");
    await client.getNextService("UN");

    expect(calls).toBe(2);
  });

  it("requests ServiceUpdate/ServiceAlert/All", async () => {
    mswServer.use(
      http.get(SERVICE_ALERT_URL, () => HttpResponse.json(alertsFixture)),
    );

    const body = await makeClient().getServiceAlerts();
    expect(body.Messages?.Message?.length).toBeGreaterThan(0);
  });

  it("requests ServiceUpdate/InformationAlert/All", async () => {
    mswServer.use(
      http.get(INFORMATION_ALERT_URL, () => HttpResponse.json(alertsFixture)),
    );

    const body = await makeClient().getInformationAlerts();
    expect(body.Messages?.Message?.length).toBeGreaterThan(0);
  });

  it("requests ServiceUpdate/MarketingAlert/All", async () => {
    mswServer.use(
      http.get(MARKETING_ALERT_URL, () => HttpResponse.json(alertsFixture)),
    );

    const body = await makeClient().getMarketingAlerts();
    expect(body.Messages?.Message?.length).toBeGreaterThan(0);
  });

  it("requests ServiceUpdate/UnionDepartures/All", async () => {
    mswServer.use(
      http.get(UNION_DEPARTURES_URL, () =>
        HttpResponse.json(unionDeparturesFixture),
      ),
    );

    const body = await makeClient().getUnionDepartures();
    expect(body.AllDepartures?.Trip?.length).toBeGreaterThan(0);
  });

  it("requests ServiceUpdate/Exceptions/{Train,Bus,All} by mode", async () => {
    mswServer.use(
      http.get(EXCEPTIONS_TRAIN_URL, () =>
        HttpResponse.json(exceptionsFixture),
      ),
      http.get(EXCEPTIONS_BUS_URL, () => HttpResponse.json(exceptionsFixture)),
      http.get(EXCEPTIONS_ALL_URL, () => HttpResponse.json(exceptionsFixture)),
    );

    const client = makeClient();
    await expect(client.getServiceExceptions("train")).resolves.toBeDefined();
    await expect(client.getServiceExceptions("bus")).resolves.toBeDefined();
    await expect(client.getServiceExceptions("any")).resolves.toBeDefined();
  });

  it("requests ServiceUpdate/ServiceGuarantee/{TripNumber}/{OperationalDay}", async () => {
    mswServer.use(
      http.get(SERVICE_GUARANTEE_URL, () =>
        HttpResponse.json(guaranteeFixture),
      ),
    );

    const body = await makeClient().getServiceGuarantee("1029", "20260717");
    expect(body.Stops?.Stop?.length).toBeGreaterThan(0);
  });
});
