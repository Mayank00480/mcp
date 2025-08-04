import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import { NextRequest } from 'next/server';

const serviceAdapter = new OpenAIAdapter();

// MCP Server URL - now pointing to our local student server
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';

// Create a custom MCP client for the Composio server using HTTPMCP
async function createComposioMCPClient(config: any) {
  return {
    async tools() {
      try {
        // First, try to fetch available tools from the MCP server
        console.log('Fetching available tools from MCP server...');
        
        const listResponse = await fetch(`${MCP_SERVER_URL}/tools/list`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/list',
            params: {}
          })
        });
        
        if (listResponse.ok) {
          const listData = await listResponse.json();
          console.log('Successfully fetched tools from MCP server:', listData);
          
          // Convert the fetched tools to the format expected by CopilotKit
          const availableTools: any = {};
          
          if (listData.result && listData.result.tools) {
            for (const tool of listData.result.tools) {
              availableTools[tool.name] = {
                description: tool.description || `Tool: ${tool.name}`,
                schema: tool.inputSchema || {
                  parameters: {
                    properties: {},
                    required: []
                  }
                },
                async execute(params: any) {
                  const response = await fetch(`${MCP_SERVER_URL}/tools/call`, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Accept': 'application/json, text/event-stream'
                    },
                    body: JSON.stringify({
                      jsonrpc: '2.0',
                      id: Date.now(),
                      method: 'tools/call',
                      params: { 
                        name: tool.name,
                        arguments: params
                      }
                    })
                  });
                  
                  if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                  }
                  
                  const responseText = await response.text();
                  const lines = responseText.split('\n');
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      try {
                        const data = JSON.parse(line.substring(6));
                        if (data.result) {
                          return data.result;
                        }
                      } catch (e) {
                        console.log('Non-JSON data line:', line);
                      }
                    }
                  }
                  
                  return 'No valid result found in response';
                }
              };
            }
          }
          
          return availableTools;
        } else {
          console.log('Failed to fetch tools list, falling back to known tools');
          throw new Error(`Failed to fetch tools: ${listResponse.status}`);
        }
      } catch (error) {
        console.error('Error fetching tools from MCP server:', error);
        
        // Fallback to known tools if fetching fails
        console.log('Using fallback tools...');
        return {
          'COMPOSIO_CHECK_ACTIVE_CONNECTION': {
            description: 'Check if there is an active connection for a specific toolkit',
            schema: {
              parameters: {
                properties: {
                  toolkit: {
                    type: 'string',
                    description: 'The toolkit name to check connection for (e.g., gmail)'
                  }
                },
                required: ['toolkit']
              }
            },
            async execute(params: any) {
              const response = await fetch(`${MCP_SERVER_URL}/tools/call`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Accept': 'application/json, text/event-stream'
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: Date.now(),
                  method: 'tools/call',
                  params: { 
                    name: 'COMPOSIO_CHECK_ACTIVE_CONNECTION',
                    arguments: params
                  }
                })
              });
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              const responseText = await response.text();
              const lines = responseText.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.substring(6));
                    if (data.result) {
                      return data.result;
                    }
                  } catch (e) {
                    console.log('Non-JSON data line:', line);
                  }
                }
              }
              
              return 'No valid result found in response';
            }
          }
        };
      }
    },
    async close() {
      // No cleanup needed for HTTP-based implementation
    }
  };
}

// Create runtime with MCP server configuration
const runtime = new CopilotRuntime({
  mcpServers: [
    {
      endpoint: MCP_SERVER_URL
    }
  ],
  createMCPClient: createComposioMCPClient
});

console.log('Composio MCP Server configured at:', MCP_SERVER_URL);
console.log('MCP tools will be automatically available to the LLM');

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: '/api/copilotkit',
  });

  return handleRequest(req);
};