// Direct test of the MCP server using stdio
import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js']);

let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line in buffer
  
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        console.log('Response:', JSON.stringify(message, null, 2));
      } catch (e) {
        // Not JSON, ignore
      }
    }
  });
});

server.stderr.on('data', (data) => {
  console.error('Server:', data.toString().trim());
});

// Send initialize request
const initialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

// Send list tools request after initialization
const listTools = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/list',
  params: {}
};

// Send a log_thought request
const logThought = {
  jsonrpc: '2.0',
  id: 3,
  method: 'tools/call',
  params: {
    name: 'log_thought',
    arguments: {
      thought: 'Test objective',
      thought_type: 'objective'
    }
  }
};

console.log('Sending initialize...');
server.stdin.write(JSON.stringify(initialize) + '\n');

setTimeout(() => {
  console.log('\nSending list tools...');
  server.stdin.write(JSON.stringify(listTools) + '\n');
}, 100);

setTimeout(() => {
  console.log('\nSending log_thought...');
  server.stdin.write(JSON.stringify(logThought) + '\n');
}, 200);

setTimeout(() => {
  console.log('\nTest complete');
  server.kill();
  process.exit(0);
}, 1000);