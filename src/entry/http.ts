#!/usr/bin/env node
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { MetrolinxHttpClient } from "../metrolinx/client.js";
import { buildServer } from "../server.js";

const apiKey = process.env.METROLINX_API_KEY;
if (!apiKey) {
  console.error(
    "METROLINX_API_KEY is required. Set it in the environment (see .env.example).",
  );
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
const client = new MetrolinxHttpClient({ apiKey });

function methodNotAllowed(res: ServerResponse): void {
  res.writeHead(405, { "content-type": "application/json" }).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }),
  );
}

// Pure liveness: no upstream Metrolinx call (docker-deployment spec §2).
function health(res: ServerResponse): void {
  res
    .writeHead(200, { "content-type": "application/json" })
    .end(JSON.stringify({ status: "ok" }));
}

// One MCP server + transport per request, stateless mode
// (sessionIdGenerator: undefined) — the same pattern the SDK's stateless
// example and Vercel's mcp-handler use, so all three entry surfaces share
// buildServer() without diverging on session lifecycle.
async function handleMcp(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method === "GET" || req.method === "DELETE") {
    methodNotAllowed(res);
    return;
  }

  const mcpServer = buildServer(client);
  // Omitting sessionIdGenerator (rather than setting it to undefined) means
  // stateless mode without tripping exactOptionalPropertyTypes.
  const transport = new StreamableHTTPServerTransport({});
  res.on("close", () => {
    void transport.close();
    void mcpServer.close();
  });
  // The SDK's own Transport getters/setters are typed `T | undefined`,
  // wider than the Transport interface's `T | undefined`-less optional
  // fields; exactOptionalPropertyTypes rejects the structural match even
  // though the class declares `implements Transport`.
  await mcpServer.connect(transport as Transport);
  await transport.handleRequest(req, res);
}

const httpServer = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/health") {
    health(res);
    return;
  }

  if (url.pathname === "/mcp") {
    handleMcp(req, res).catch((error: unknown) => {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" }).end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          }),
        );
      }
    });
    return;
  }

  res.writeHead(404).end();
});

httpServer.listen(port, () => {
  console.error(`go-transit-mcp listening on port ${String(port)}`);
});
