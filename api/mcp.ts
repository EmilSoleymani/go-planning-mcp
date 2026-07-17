import { createMcpHandler } from "mcp-handler";

import { MetrolinxHttpClient } from "../src/metrolinx/client.js";
import { SERVER_INFO, registerTools } from "../src/server.js";

const apiKey = process.env.METROLINX_API_KEY;
if (!apiKey) {
  throw new Error(
    "METROLINX_API_KEY is required. Set it as a Vercel project environment variable.",
  );
}

const client = new MetrolinxHttpClient({ apiKey });

const handler = createMcpHandler(
  (server) => {
    registerTools(server, client);
  },
  { serverInfo: SERVER_INFO },
);

export { handler as GET, handler as POST, handler as DELETE };
