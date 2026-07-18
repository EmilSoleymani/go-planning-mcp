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
    getLineAll: unimplemented,
    getLineSchedule: unimplemented,
    getTripStatus: unimplemented,
    ...overrides,
  };
}
