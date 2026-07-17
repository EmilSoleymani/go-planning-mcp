import { readFileSync } from "node:fs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import { MetrolinxError } from "../errors.js";
import type { MetrolinxClient } from "../metrolinx/client.js";
import type { RawStopDetailsResponse } from "../metrolinx/types.js";
import { buildServer } from "../server.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test/fixtures/stop-details.json", import.meta.url),
    "utf8",
  ),
) as RawStopDetailsResponse;

interface ErrorPayload {
  error: { code: string; message: string; retryable: boolean };
}

async function callTool(
  fake: MetrolinxClient,
  args: Record<string, unknown>,
): Promise<{
  isError: boolean;
  structuredContent: unknown;
  errorPayload: ErrorPayload | undefined;
}> {
  const server = buildServer(fake);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  try {
    const result = await client.callTool({
      name: "get_stop_details",
      arguments: args,
    });
    const content = result.content as { type: string; text: string }[];
    const isError = result.isError === true;
    return {
      isError,
      structuredContent: result.structuredContent,
      errorPayload: isError
        ? (JSON.parse(content[0]!.text) as ErrorPayload)
        : undefined,
    };
  } finally {
    await client.close();
    await server.close();
  }
}

describe("get_stop_details", () => {
  it("returns the normalized DTO as structuredContent (live-captured Union fixture)", async () => {
    const result = await callTool(
      { getStopDetails: () => Promise.resolve(fixture) },
      { stop_code: "UN" },
    );

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      stop_code: "UN",
      stop_name: "Union Station GO",
      city: "Toronto",
      coordinates: { lat: 43.645195, lon: -79.3806 },
      // Confirmed live: this Stop/Details entry reports IsBus: false — GO
      // bus boarding at Union is tracked separately (see boarding_info).
      served_by: { train: true, bus: false },
      parking: [],
      accessibility_info:
        "Wheelchair Accessible Train Service; Upexpress Wheelchair Accessible Train Service",
      boarding_info:
        "GO Buses board at Union Station GO Bus Terminal on the east side of Bay Street at Lake Shore Blvd.",
    });
    expect(result.structuredContent).toHaveProperty(
      "facilities",
      expect.arrayContaining(["Wi-Fi", "Waiting Room", "Bicycle Rack"]),
    );
  });

  it("collapses to French facility descriptions when lang: fr is requested", async () => {
    const result = await callTool(
      { getStopDetails: () => Promise.resolve(fixture) },
      { stop_code: "UN", lang: "fr" },
    );

    expect(result.isError).toBe(false);
    // StopNameFr is empty upstream — falls back to English.
    expect(result.structuredContent).toMatchObject({
      stop_name: "Union Station GO",
    });
    expect(result.structuredContent).toHaveProperty(
      "facilities",
      expect.arrayContaining(["Ascenseurs", "Wi-Fi"]),
    );
  });

  it("returns an in-result not_found error for an unknown stop code", async () => {
    const empty: RawStopDetailsResponse = {
      Metadata: { TimeStamp: "", ErrorCode: "200", ErrorMessage: "OK" },
      Stop: null,
    };
    const result = await callTool(
      { getStopDetails: () => Promise.resolve(empty) },
      { stop_code: "NOPE" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error.code).toBe("not_found");
    expect(result.errorPayload?.error.message).toContain("search_stops");
  });

  it("surfaces client failures through the error taxonomy", async () => {
    const result = await callTool(
      {
        getStopDetails: () =>
          Promise.reject(
            new MetrolinxError(
              "rate_limited",
              "Metrolinx rate limit hit. Do not retry now.",
              false,
            ),
          ),
      },
      { stop_code: "UN" },
    );

    expect(result.isError).toBe(true);
    expect(result.errorPayload?.error).toMatchObject({
      code: "rate_limited",
      retryable: false,
    });
  });
});
