import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import * as MCPTools from './tools';

const server = new McpServer({
  name: "example-server",
  version: "1.0.0"
});

Object.values(MCPTools).forEach((tools) => {
  for (const tool of tools) {
    // @ts-ignore
    server.tool(...tool);
  }
})
// for (const tool of YouTubeTools) {
//   server.tool(...tool);
// }

export default server;
