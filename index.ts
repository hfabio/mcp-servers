import express from "express";
import server from "./server.js";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getTemplate } from "utils/cache.js";
import path from "path";
import fs from "fs";

const app = express();
app.use(express.json());
app.use(cors({
  origin: "*",
  methods: ["POST", "GET", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Map to store transports by session ID
app
// Handle GET requests for server-to-client notifications via SSE
.get('/', async (req, res) => {
  console.log('Received GET MCP request');
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }));
})
// Handle DELETE requests for session termination
.delete('/', async (req, res) => {
  console.log('Received DELETE MCP request');
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }));

})
.post("/", async (req, res) => {
  // In stateless mode, create a new instance of transport and server for each request
  // to ensure complete isolation. A single instance would cause request ID collisions
  // when multiple clients connect concurrently.
  console.log('Received POST MCP request');
  try {
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => {
      console.log('Request closed');
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

app.get("/cache/", (req, res) => {
  const template = getTemplate();
  res.setHeader("Content-Type", "text/html");
  res.send(template);
});
app.get("/cache/:context/", (req, res) => {
  const { context } = req.params;
  const template = getTemplate(context);
  res.setHeader("Content-Type", "text/html");
  res.send(template);
});
app.get("/cache/:context/:toolName/", (req, res) => {
  const { context, toolName } = req.params;
  const template = getTemplate(context, toolName);
  res.setHeader("Content-Type", "text/html");
  res.send(template);
});
app.get("/cache/:context/:toolName/:type", (req, res) => {
  const { context, toolName, type } = req.params;
  const file = fs.readFileSync(path.resolve("cache", context, toolName, type), "utf-8");
  res.send(JSON.parse(file));
});

const port = process.env.PORT || '3232'
app.listen(port, () => {
  console.clear();
  console.log(`server started on http://localhost:${port}/`);
});