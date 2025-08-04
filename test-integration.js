// Test the MCP integration
const MCP_SERVER_URL = 'https://mcp.composio.dev/composio/server/b0a75710-9d0f-4606-8e88-b55378769ad0/mcp?include_composio_helper_actions=true&agent=cursor';

async function testMCPServer(toolName, args = {}) {
  try {
    console.log(`Testing MCP tool: ${toolName} with args:`, args);
    
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
        params: { name: toolName, arguments: args }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const responseText = await response.text();
    console.log('Response received successfully');
    
    // Handle SSE format
    const lines = responseText.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          if (data.result) {
            console.log('Result:', JSON.stringify(data.result, null, 2));
            return data.result;
          }
        } catch (e) {
          // Skip non-JSON lines
        }
      }
    }
    
    console.log('No result found in response');
    return null;
    
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

// Test a simple tool
console.log('Testing Composio MCP integration...');
testMCPServer('COMPOSIO_CHECK_ACTIVE_CONNECTION', { toolkit: 'gmail' }); 