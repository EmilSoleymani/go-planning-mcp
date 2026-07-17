import { createMcpHandler } from "mcp-handler";

import { cacheEnabledFromEnv } from "../src/metrolinx/cache.js";
import { MetrolinxHttpClient } from "../src/metrolinx/client.js";
import { SERVER_INFO, registerTools } from "../src/server.js";

const apiKey = process.env.METROLINX_API_KEY;
if (!apiKey) {
  throw new Error(
    "METROLINX_API_KEY is required. Set it as a Vercel project environment variable.",
  );
}

const client = new MetrolinxHttpClient({
  apiKey,
  cacheEnabled: cacheEnabledFromEnv(process.env.CACHE_ENABLED),
});

const handler = createMcpHandler(
  (server) => {
    registerTools(server, client);
  },
  { serverInfo: SERVER_INFO },
  // mcp-handler matches requests against this path itself; it has no way to
  // know Vercel is invoking it at /api/mcp (this file's location) rather
  // than its own "/mcp" default, so it must be told explicitly.
  { basePath: "/api" },
);

export { handler as GET, handler as POST, handler as DELETE };
