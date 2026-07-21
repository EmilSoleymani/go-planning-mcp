import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import type { MetrolinxClient } from "../metrolinx/client.js";
import { buildServer } from "../server.js";

export interface ErrorPayload {
  error: { code: string; message: string; retryable: boolean };
}

export interface CallToolOutcome {
  isError: boolean;
  structuredContent: unknown;
  errorPayload: ErrorPayload | undefined;
}

/** Shared MCP round-trip harness for tool tests (test-architecture spec §1). */
export async function callTool(
  fake: MetrolinxClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<CallToolOutcome> {
  const server = buildServer(fake);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  try {
    // Populates the SDK's per-tool output-schema validator cache (Client
    // caches it from listTools(), not callTool()) so tests exercise the same
    // structuredContent/outputSchema validation a real client hits (#29).
    await client.listTools();
    const result = await client.callTool({ name: toolName, arguments: args });
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

/** Reads an MCP resource over a real in-memory client/server pair. */
export async function readResource(
  fake: MetrolinxClient,
  uri: string,
): Promise<{ uri: string; mimeType?: string; text: string }[]> {
  const server = buildServer(fake);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  try {
    const result = await client.readResource({ uri });
    return result.contents as {
      uri: string;
      mimeType?: string;
      text: string;
    }[];
  } finally {
    await client.close();
    await server.close();
  }
}

/** Renders an MCP prompt over a real in-memory client/server pair. */
export async function getPrompt(
  fake: MetrolinxClient,
  name: string,
  args: Record<string, string>,
): Promise<{ role: string; content: { type: string; text: string } }[]> {
  const server = buildServer(fake);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  try {
    const result = await client.getPrompt({ name, arguments: args });
    return result.messages as {
      role: string;
      content: { type: string; text: string };
    }[];
  } finally {
    await client.close();
    await server.close();
  }
}

/** A MetrolinxClient fake with every method stubbed to reject — override what a test needs. */
export function fakeClient(
  overrides: Partial<MetrolinxClient>,
): MetrolinxClient {
  const unimplemented = (): Promise<never> =>
    Promise.reject(new Error("not stubbed for this test"));
  return {
    getStopDetails: unimplemented,
    getStopAll: unimplemented,
    getNextService: unimplemented,
    getStopDestinations: unimplemented,
    getFares: unimplemented,
    getFleetConsistAll: unimplemented,
    getFleetConsistByEngine: unimplemented,
    getServiceAlerts: unimplemented,
    getInformationAlerts: unimplemented,
    getMarketingAlerts: unimplemented,
    getUnionDepartures: unimplemented,
    getServiceExceptions: unimplemented,
    getServiceGuarantee: unimplemented,
    getLineAll: unimplemented,
    getLineSchedule: unimplemented,
    getTripStatus: unimplemented,
    getServiceGlance: unimplemented,
    getVehiclePositions: unimplemented,
    getTripUpdates: unimplemented,
    getJourney: unimplemented,
    ...overrides,
  };
}
