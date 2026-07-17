import { readFileSync } from "node:fs";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import { MetrolinxHttpClient } from "./client.js";
import type { RawStopDetailsResponse } from "./types.js";

const DETAILS_URL =
  "https://api.openmetrolinx.com/OpenDataAPI/api/V1/Stop/Details/UN";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-details.json", import.meta.url),
    "utf8",
  ),
) as RawStopDetailsResponse;

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

function makeClient(): MetrolinxHttpClient {
  return new MetrolinxHttpClient({
    apiKey: "test-key",
    sleep: () => Promise.resolve(),
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
});
