import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {YouTubeTools} from './tools';

const server = new McpServer({
  name: "example-server",
  version: "1.0.0"
});

for (const tool of YouTubeTools) {
  server.tool(...tool);
}

export default server;
