# MCP Student Server

A simple MCP (Model Context Protocol) server that provides student data management tools.

## Features

- **Student Data Management**: Store and retrieve student information
- **MCP Protocol Support**: Implements MCP tools/list and tools/call endpoints
- **SSE (Server-Sent Events)**: Supports streaming responses
- **CORS Enabled**: Can be accessed from web applications

## Available Tools

1. **GET_ALL_STUDENTS** - Get all students in the database
2. **GET_STUDENT_BY_ID** - Get a specific student by their ID
3. **GET_STUDENTS_BY_MAJOR** - Get all students studying a specific major
4. **GET_STUDENTS_BY_GRADE** - Get all students with a specific grade
5. **SEARCH_STUDENTS** - Search students by name or email
6. **GET_STUDENT_COURSES** - Get all courses for a specific student

## Installation

```bash
cd server
npm install
```

## Running the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### Health Check
```
GET /health
```

### List Available Tools
```
POST /tools/list
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

### Call a Tool
```
POST /tools/call
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "GET_ALL_STUDENTS",
    "arguments": {}
  }
}
```

## Sample Student Data

The server includes sample data for 5 students with different majors, grades, and courses.

## Integration with CopilotKit

This server is designed to work with CopilotKit's MCP integration. The frontend application will automatically fetch available tools and can call them through the LLM. 