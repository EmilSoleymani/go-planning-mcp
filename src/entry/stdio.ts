#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { cacheEnabledFromEnv } from "../metrolinx/cache.js";
import { MetrolinxHttpClient } from "../metrolinx/client.js";
import { buildServer } from "../server.js";

const apiKey = process.env.METROLINX_API_KEY;
if (!apiKey) {
  console.error(
    "METROLINX_API_KEY is required. Set it in the environment (see .env.example).",
  );
  process.exit(1);
}

const server = buildServer(
  new MetrolinxHttpClient({
    apiKey,
    cacheEnabled: cacheEnabledFromEnv(process.env.CACHE_ENABLED),
  }),
);
await server.connect(new StdioServerTransport());
