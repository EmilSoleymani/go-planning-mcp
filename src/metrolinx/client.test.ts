import { readFileSync } from "node:fs";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import { MetrolinxHttpClient } from "./client.js";
import type {
  RawAlertsResponse,
  RawGtfsTripUpdatesResponse,
  RawGtfsVehiclePositionsResponse,
  RawJourneyResponse,
  RawLineAllResponse,
  RawLineScheduleResponse,
  RawServiceExceptionsResponse,
  RawServiceGuaranteeResponse,
  RawStopAllResponse,
  RawStopDestinationsResponse,
  RawStopDetailsResponse,
  RawTripStatusResponse,
  RawUnionDeparturesResponse,
} from "./types.js";

const BASE_URL = "https://api.openmetrolinx.com/OpenDataAPI/api/V1";
const DETAILS_URL = `${BASE_URL}/Stop/Details/UN`;
const STOP_ALL_URL = `${BASE_URL}/Stop/All`;
const NEXT_SERVICE_URL = `${BASE_URL}/Stop/NextService/UN`;
const DESTINATIONS_URL = `${BASE_URL}/Stop/Destinations/UN/0900/1300`;
const FARES_URL = `${BASE_URL}/Fares/UN/OA`;
const FARES_DATED_URL = `${BASE_URL}/Fares/UN/OA/20260720`;
const FLEET_ALL_URL = `${BASE_URL}/Fleet/Consist/All`;
const FLEET_ENGINE_URL = `${BASE_URL}/Fleet/Consist/Engine/651`;
const SERVICE_ALERT_URL = `${BASE_URL}/ServiceUpdate/ServiceAlert/All`;
const INFORMATION_ALERT_URL = `${BASE_URL}/ServiceUpdate/InformationAlert/All`;
const MARKETING_ALERT_URL = `${BASE_URL}/ServiceUpdate/MarketingAlert/All`;
const UNION_DEPARTURES_URL = `${BASE_URL}/ServiceUpdate/UnionDepartures/All`;
const EXCEPTIONS_TRAIN_URL = `${BASE_URL}/ServiceUpdate/Exceptions/Train`;
const EXCEPTIONS_BUS_URL = `${BASE_URL}/ServiceUpdate/Exceptions/Bus`;
const EXCEPTIONS_ALL_URL = `${BASE_URL}/ServiceUpdate/Exceptions/All`;
const SERVICE_GUARANTEE_URL = `${BASE_URL}/ServiceUpdate/ServiceGuarantee/1029/20260717`;
const LINE_ALL_URL = `${BASE_URL}/Schedule/Line/All/20260717`;
const LINE_SCHEDULE_URL = `${BASE_URL}/Schedule/Line/20260717/LW/E`;
const TRIP_STATUS_URL = `${BASE_URL}/Schedule/Trip/20260717/1039`;
const SERVICE_GLANCE_TRAINS_URL = `${BASE_URL}/ServiceataGlance/Trains/All`;
const SERVICE_GLANCE_BUSES_URL = `${BASE_URL}/ServiceataGlance/Buses/All`;
const SERVICE_GLANCE_UPX_URL = `${BASE_URL}/ServiceataGlance/UPX/All`;
const VEHICLE_POSITIONS_URL = `${BASE_URL}/Gtfs/Feed/VehiclePosition`;
const TRIP_UPDATES_URL = `${BASE_URL}/Gtfs/Feed/TripUpdates`;
const JOURNEY_URL = `${BASE_URL}/Schedule/Journey/20260717/UN/00137/0900/3`;

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
const lineAllFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/schedule-line-all.json", import.meta.url),
    "utf8",
  ),
) as RawLineAllResponse;

const lineScheduleFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/schedule-line.json", import.meta.url),
    "utf8",
  ),
) as RawLineScheduleResponse;

const tripStatusFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/schedule-trip.json", import.meta.url),
    "utf8",
  ),
) as RawTripStatusResponse;

const vehiclePositionsFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/gtfs-vehicle-position.json", import.meta.url),
    "utf8",
  ),
) as RawGtfsVehiclePositionsResponse;

const tripUpdatesFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/gtfs-trip-updates.json", import.meta.url),
    "utf8",
  ),
) as RawGtfsTripUpdatesResponse;

const journeyFixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/schedule-journey.json", import.meta.url),
    "utf8",
  ),
) as RawJourneyResponse;

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

  it("requests Fares/{From}/{To} without a date, and with one appended when given", async () => {
    const emptyFares = {
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      AllFares: { FareCategory: [] },
    };
    mswServer.use(
      http.get(FARES_URL, () => HttpResponse.json(emptyFares)),
      http.get(FARES_DATED_URL, () => HttpResponse.json(emptyFares)),
    );

    const undated = await makeClient().getFares("UN", "OA");
    const dated = await makeClient().getFares("UN", "OA", "20260720");

    expect(undated.AllFares).toEqual({ FareCategory: [] });
    expect(dated.AllFares).toEqual({ FareCategory: [] });
  });

  it("caches Fares for 6h — a second identical call within TTL hits the cache", async () => {
    let calls = 0;
    mswServer.use(
      http.get(FARES_URL, () => {
        calls += 1;
        return HttpResponse.json({
          Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
          AllFares: { FareCategory: [] },
        });
      }),
    );

    const client = makeClient();
    await client.getFares("UN", "OA");
    await client.getFares("UN", "OA");

    expect(calls).toBe(1);
  });

  it("requests Fleet/Consist/All and Fleet/Consist/Engine/{EngineNumber}, uncached", async () => {
    let allCalls = 0;
    let engineCalls = 0;
    const emptyConsists = {
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      AllConsists: { Consists: [] },
    };
    mswServer.use(
      http.get(FLEET_ALL_URL, () => {
        allCalls += 1;
        return HttpResponse.json(emptyConsists);
      }),
      http.get(FLEET_ENGINE_URL, () => {
        engineCalls += 1;
        return HttpResponse.json(emptyConsists);
      }),
    );

    const client = makeClient();
    await client.getFleetConsistAll();
    await client.getFleetConsistAll();
    await client.getFleetConsistByEngine("651");

    expect(allCalls).toBe(2);
    expect(engineCalls).toBe(1);
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

  it("requests Schedule/Line/All/{Date}", async () => {
    mswServer.use(
      http.get(LINE_ALL_URL, () => HttpResponse.json(lineAllFixture)),
    );

    const body = await makeClient().getLineAll("20260717");
    expect(body.AllLines?.Line?.length).toBeGreaterThan(0);
  });

  it("caches Schedule/Line/All/{Date} for 6h — a second call within TTL hits the cache", async () => {
    let calls = 0;
    mswServer.use(
      http.get(LINE_ALL_URL, () => {
        calls += 1;
        return HttpResponse.json(lineAllFixture);
      }),
    );

    const client = makeClient();
    await client.getLineAll("20260717");
    await client.getLineAll("20260717");

    expect(calls).toBe(1);
  });

  it("requests Schedule/Line/{Date}/{LineCode}/{LineDirection}", async () => {
    mswServer.use(
      http.get(LINE_SCHEDULE_URL, () => HttpResponse.json(lineScheduleFixture)),
    );

    const body = await makeClient().getLineSchedule("20260717", "LW", "E");
    expect(body.Lines?.Line?.[0]?.Code).toBe("LW");
  });

  it("caches Schedule/Line/{Date}/{LineCode}/{LineDirection} for 6h", async () => {
    let calls = 0;
    mswServer.use(
      http.get(LINE_SCHEDULE_URL, () => {
        calls += 1;
        return HttpResponse.json(lineScheduleFixture);
      }),
    );

    const client = makeClient();
    await client.getLineSchedule("20260717", "LW", "E");
    await client.getLineSchedule("20260717", "LW", "E");

    expect(calls).toBe(1);
  });

  it("requests Schedule/Trip/{Date}/{TripNumber}", async () => {
    mswServer.use(
      http.get(TRIP_STATUS_URL, () => HttpResponse.json(tripStatusFixture)),
    );

    const body = await makeClient().getTripStatus("20260717", "1039");
    expect(body.Trips?.[0]?.Number).toBe("1041");
  });

  it("never caches Schedule/Trip (live stop-by-stop status)", async () => {
    let calls = 0;
    mswServer.use(
      http.get(TRIP_STATUS_URL, () => {
        calls += 1;
        return HttpResponse.json(tripStatusFixture);
      }),
    );

    const client = makeClient();
    await client.getTripStatus("20260717", "1039");
    await client.getTripStatus("20260717", "1039");

    expect(calls).toBe(2);
  });

  it.each([
    ["train", SERVICE_GLANCE_TRAINS_URL],
    ["bus", SERVICE_GLANCE_BUSES_URL],
    ["upx", SERVICE_GLANCE_UPX_URL],
  ] as const)(
    "requests ServiceataGlance/{Segment}/All for mode %s",
    async (mode, url) => {
      mswServer.use(
        http.get(url, () =>
          HttpResponse.json({
            Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
            Trips: { Trip: [] },
          }),
        ),
      );

      const body = await makeClient().getServiceGlance(mode);
      expect(body.Trips?.Trip).toEqual([]);
    },
  );

  it("never caches ServiceataGlance (real-time)", async () => {
    let calls = 0;
    mswServer.use(
      http.get(SERVICE_GLANCE_TRAINS_URL, () => {
        calls += 1;
        return HttpResponse.json({
          Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
          Trips: { Trip: [] },
        });
      }),
    );

    const client = makeClient();
    await client.getServiceGlance("train");
    await client.getServiceGlance("train");

    expect(calls).toBe(2);
  });

  it("requests Gtfs/Feed/VehiclePosition and parses the GTFS-RT envelope", async () => {
    mswServer.use(
      http.get(VEHICLE_POSITIONS_URL, () =>
        HttpResponse.json(vehiclePositionsFixture),
      ),
    );

    const body = await makeClient().getVehiclePositions();
    expect(body.entity).toHaveLength(3);
  });

  it("requests Gtfs/Feed/TripUpdates and parses the real captured feed", async () => {
    mswServer.use(
      http.get(TRIP_UPDATES_URL, () => HttpResponse.json(tripUpdatesFixture)),
    );

    const body = await makeClient().getTripUpdates();
    expect(body.entity.length).toBeGreaterThan(0);
  });

  it("never caches GTFS-RT feeds (real-time)", async () => {
    let calls = 0;
    mswServer.use(
      http.get(TRIP_UPDATES_URL, () => {
        calls += 1;
        return HttpResponse.json(tripUpdatesFixture);
      }),
    );

    const client = makeClient();
    await client.getTripUpdates();
    await client.getTripUpdates();

    expect(calls).toBe(2);
  });

  it("requests Schedule/Journey/{Date}/{From}/{To}/{StartTime}/{MaxJourney}", async () => {
    mswServer.use(
      http.get(JOURNEY_URL, () => HttpResponse.json(journeyFixture)),
    );

    const body = await makeClient().getJourney(
      "20260717",
      "UN",
      "00137",
      "0900",
      3,
    );
    expect(body.SchJourneys?.[0]?.From).toBe("UN");
  });

  it("never caches Schedule/Journey (real-time journey plans)", async () => {
    let calls = 0;
    mswServer.use(
      http.get(JOURNEY_URL, () => {
        calls += 1;
        return HttpResponse.json(journeyFixture);
      }),
    );

    const client = makeClient();
    await client.getJourney("20260717", "UN", "00137", "0900", 3);
    await client.getJourney("20260717", "UN", "00137", "0900", 3);

    expect(calls).toBe(2);
  });
});
