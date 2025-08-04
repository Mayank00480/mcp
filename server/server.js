const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Sample student data
const students = [
  {
    id: 1,
    name: "John Doe",
    age: 20,
    grade: "A",
    major: "Computer Science",
    email: "john.doe@university.edu",
    courses: ["Data Structures", "Algorithms", "Web Development"]
  },
  {
    id: 2,
    name: "Jane Smith",
    age: 19,
    grade: "A-",
    major: "Mathematics",
    email: "jane.smith@university.edu",
    courses: ["Calculus", "Linear Algebra", "Statistics"]
  },
  {
    id: 3,
    name: "Mike Johnson",
    age: 21,
    grade: "B+",
    major: "Physics",
    email: "mike.johnson@university.edu",
    courses: ["Mechanics", "Thermodynamics", "Quantum Physics"]
  },
  {
    id: 4,
    name: "Sarah Wilson",
    age: 20,
    grade: "A+",
    major: "Biology",
    email: "sarah.wilson@university.edu",
    courses: ["Cell Biology", "Genetics", "Ecology"]
  },
  {
    id: 5,
    name: "David Brown",
    age: 22,
    grade: "B",
    major: "Chemistry",
    email: "david.brown@university.edu",
    courses: ["Organic Chemistry", "Inorganic Chemistry", "Biochemistry"]
  }
];

// Available tools
const availableTools = {
  "GET_ALL_STUDENTS": {
    description: "Get all students in the database",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  "GET_STUDENT_BY_ID": {
    description: "Get a specific student by their ID",
    inputSchema: {
      type: "object",
      properties: {
        studentId: {
          type: "number",
          description: "The ID of the student to retrieve"
        }
      },
      required: ["studentId"]
    }
  },
  "GET_STUDENTS_BY_MAJOR": {
    description: "Get all students studying a specific major",
    inputSchema: {
      type: "object",
      properties: {
        major: {
          type: "string",
          description: "The major to filter students by"
        }
      },
      required: ["major"]
    }
  },
  "GET_STUDENTS_BY_GRADE": {
    description: "Get all students with a specific grade",
    inputSchema: {
      type: "object",
      properties: {
        grade: {
          type: "string",
          description: "The grade to filter students by (A, A-, B+, B, B-, C+, C, C-, D, F)"
        }
      },
      required: ["grade"]
    }
  },
  "SEARCH_STUDENTS": {
    description: "Search students by name or email",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to match against student names or emails"
        }
      },
      required: ["query"]
    }
  },
  "GET_STUDENT_COURSES": {
    description: "Get all courses for a specific student",
    inputSchema: {
      type: "object",
      properties: {
        studentId: {
          type: "number",
          description: "The ID of the student"
        }
      },
      required: ["studentId"]
    }
  }
};

// Tool execution functions
const toolExecutors = {
  "GET_ALL_STUDENTS": () => {
    return {
      success: true,
      data: students,
      count: students.length
    };
  },
  
  "GET_STUDENT_BY_ID": (args) => {
    const student = students.find(s => s.id === args.studentId);
    if (!student) {
      return {
        success: false,
        error: "Student not found"
      };
    }
    return {
      success: true,
      data: student
    };
  },
  
  "GET_STUDENTS_BY_MAJOR": (args) => {
    const filteredStudents = students.filter(s => 
      s.major.toLowerCase().includes(args.major.toLowerCase())
    );
    return {
      success: true,
      data: filteredStudents,
      count: filteredStudents.length
    };
  },
  
  "GET_STUDENTS_BY_GRADE": (args) => {
    const filteredStudents = students.filter(s => s.grade === args.grade);
    return {
      success: true,
      data: filteredStudents,
      count: filteredStudents.length
    };
  },
  
  "SEARCH_STUDENTS": (args) => {
    const query = args.query.toLowerCase();
    const filteredStudents = students.filter(s => 
      s.name.toLowerCase().includes(query) || 
      s.email.toLowerCase().includes(query)
    );
    return {
      success: true,
      data: filteredStudents,
      count: filteredStudents.length
    };
  },
  
  "GET_STUDENT_COURSES": (args) => {
    const student = students.find(s => s.id === args.studentId);
    if (!student) {
      return {
        success: false,
        error: "Student not found"
      };
    }
    return {
      success: true,
      data: {
        studentName: student.name,
        courses: student.courses
      }
    };
  }
};

// MCP Tools List endpoint
app.post('/tools/list', (req, res) => {
  console.log('Tools list requested');
  
  const response = {
    jsonrpc: '2.0',
    id: req.body.id,
    result: {
      tools: Object.keys(availableTools).map(toolName => ({
        name: toolName,
        description: availableTools[toolName].description,
        inputSchema: availableTools[toolName].inputSchema
      }))
    }
  };
  
  res.json(response);
});

// MCP Tools Call endpoint with SSE
app.post('/tools/call', (req, res) => {
  const { name, arguments: args } = req.body.params;
  const requestId = req.body.id;
  
  console.log(`Tool call requested: ${name} with args:`, args);
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  // Check if tool exists
  if (!availableTools[name]) {
    const errorResponse = {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: -32601,
        message: `Tool '${name}' not found`
      }
    };
    res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
    res.end();
    return;
  }
  
  // Execute the tool
  try {
    const executor = toolExecutors[name];
    const result = executor(args);
    
    const response = {
      jsonrpc: '2.0',
      id: requestId,
      result: result
    };
    
    // Send SSE response
    res.write(`data: ${JSON.stringify(response)}\n\n`);
    res.end();
    
  } catch (error) {
    const errorResponse = {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: -32603,
        message: `Internal error: ${error.message}`
      }
    };
    res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
    res.end();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'MCP Student Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`MCP Student Server running on http://localhost:${PORT}`);
  console.log('Available tools:');
  Object.keys(availableTools).forEach(tool => {
    console.log(`- ${tool}: ${availableTools[tool].description}`);
  });
}); 