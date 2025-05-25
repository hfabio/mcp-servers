import { McpServer, ToolCallback, Args } from "@modelcontextprotocol/sdk/server/mcp.js";

import * as MCPTools from './tools';

const server = new McpServer({
  name: "example-server",
  version: "1.0.0"
});

Object.values(MCPTools).forEach((tools) => {
  for (const [name, description, paramsSchema, handler] of tools) {
    server.tool(name, description, paramsSchema as Args, handler as ToolCallback<Args>);
  }
})

export default server;
