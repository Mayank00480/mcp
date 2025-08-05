import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import { NextRequest } from 'next/server';

const serviceAdapter = new OpenAIAdapter();

// MCP Server URL - supports both local and Composio servers
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;

// Create a custom MCP client for the MCP server using HTTPMCP
async function createComposioMCPClient(config: any) {
  return {
    async tools() {
      try {
        // First, try to fetch available tools from the MCP server
        console.log('Fetching available tools from MCP server...', MCP_SERVER_URL);
        
        const listResponse = await fetch(`${MCP_SERVER_URL}/tools/list`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            // ...(COMPOSIO_API_KEY && { 'x-api-key': COMPOSIO_API_KEY })
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/list',
            params: {}
          })
        });
        
        console.log("Tools list response status:", listResponse.status);
        
        if (listResponse.ok) {
          // Handle both JSON and SSE responses
          const contentType = listResponse.headers.get('content-type');
          let listData = null;
          
          if (contentType && contentType.includes('text/event-stream')) {
            // Handle SSE response (Composio server)
            const responseText = await listResponse.text();
            console.log('Raw SSE response text:', responseText);
            
            const lines = responseText.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  if (data.result) {
                    listData = data;
                    break;
                  }
                } catch (e) {
                  console.log('Non-JSON data line:', line);
                }
              }
            }
          } else {
            // Handle JSON response (local server)
            listData = await listResponse.json();
          }
          
          if (listData) {
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
                    console.log(`Executing tool: ${tool.name} with params:`, params);
                    
                    const response = await fetch(`${MCP_SERVER_URL}/tools/call`, {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, text/event-stream',
                        // ...(COMPOSIO_API_KEY && { 'x-api-key': COMPOSIO_API_KEY })
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
                    
                    // Handle both JSON and SSE responses for tool execution
                    const responseContentType = response.headers.get('content-type');
                    let result = null;
                    
                    if (responseContentType && responseContentType.includes('text/event-stream')) {
                      // Handle SSE response (Composio server)
                      const responseText = await response.text();
                      console.log('Tool execution SSE response:', responseText);
                      
                      const lines = responseText.split('\n');
                      for (const line of lines) {
                        if (line.startsWith('data: ')) {
                          try {
                            const data = JSON.parse(line.substring(6));
                            if (data.result) {
                              result = data.result;
                              break;
                            } else if (data.error) {
                              throw new Error(`Tool execution error: ${data.error.message}`);
                            }
                          } catch (e) {
                            console.log('Non-JSON data line:', line);
                          }
                        }
                      }
                    } else {
                      // Handle JSON response (local server)
                      const responseData = await response.json();
                      if (responseData.result) {
                        result = responseData.result;
                      } else if (responseData.error) {
                        throw new Error(`Tool execution error: ${responseData.error.message}`);
                      }
                    }
                    
                    if (result) {
                      console.log(`Tool ${tool.name} execution result:`, result);
                      
                      // Check for authentication errors in the result
                      if (result.error && typeof result.error === 'string' && result.error.toLowerCase().includes('authentication')) {
                        return {
                          error: 'Gmail authentication required',
                          message: 'Please connect your Gmail account in Composio first. Go to https://app.composio.dev, add Gmail integration, and authorize access.',
                          details: result.error
                        };
                      }
                      
                      return result;
                    } else {
                      console.log('No valid result found in response');
                      return 'No valid result found in response';
                    }
                  }
                };
              }
            }
            
            console.log(`Successfully loaded ${Object.keys(availableTools).length} tools`);
            return availableTools;
          } else {
            console.log('No valid result found in response');
            throw new Error('No valid result found in response');
          }
        } else {
          console.log('Failed to fetch tools list, falling back to known tools');
          throw new Error(`Failed to fetch tools: ${listResponse.status} ${listResponse.statusText}`);
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
              console.log('Executing fallback tool with params:', params);
              
              const response = await fetch(`${MCP_SERVER_URL}/tools/call`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Accept': 'application/json, text/event-stream',
                  // ...(COMPOSIO_API_KEY && { 'x-api-key': COMPOSIO_API_KEY })
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
              
              // Handle both JSON and SSE responses
              const contentType = response.headers.get('content-type');
              let result = null;
              
              if (contentType && contentType.includes('text/event-stream')) {
                const responseText = await response.text();
                const lines = responseText.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.substring(6));
                      if (data.result) {
                        result = data.result;
                        break;
                      }
                    } catch (e) {
                      console.log('Non-JSON data line:', line);
                    }
                  }
                }
              } else {
                const responseData = await response.json();
                if (responseData.result) {
                  result = responseData.result;
                }
              }
              
              return result || 'No valid result found in response';
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

console.log('MCP Server configured at:', MCP_SERVER_URL);
console.log('MCP tools will be automatically available to the LLM');

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: '/api/copilotkit',
  });

  return handleRequest(req);
};