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
        
        const listResponse = await fetch(`${MCP_SERVER_URL}`, {
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
        
        
        
        if (listResponse.ok) {
          // Handle both JSON and SSE responses
          const contentType = listResponse.headers.get('content-type');
          let listData = null;
          
          if (contentType && contentType.includes('text/event-stream')) {
            // Handle SSE response (Composio server)
            const responseText = await listResponse.text();
            
            
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
                    
                    
                    const response = await fetch(`${MCP_SERVER_URL}`, {
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
                      
                      return 'No valid result found in response';
                    }
                  }
                };
              }

            }
            
            
            return availableTools;
          } else {
            
            throw new Error('No valid result found in response');
          }
        } else {
          console.log('Failed to fetch tools list');
          throw new Error(`Failed to fetch tools: ${listResponse.status} ${listResponse.statusText}`);
        }
      } catch (error) {
        console.error('Error fetching tools from MCP server:', error);
        throw error;
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




export const POST = async (req: NextRequest) => {
  console.log('📨 POST request received to /api/copilotkit');
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: '/api/copilotkit',
  });

  return handleRequest(req);
};