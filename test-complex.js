import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js']);
let buffer = '';
let requestId = 1;

// Helper to send requests
function sendRequest(method, params) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params
  };
  console.log(`\n→ ${method}:`, JSON.stringify(params, null, 2));
  server.stdin.write(JSON.stringify(request) + '\n');
  return new Promise(resolve => {
    responseHandlers[request.id] = resolve;
  });
}

const responseHandlers = {};

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();
  
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        if (message.id && responseHandlers[message.id]) {
          responseHandlers[message.id](message);
          delete responseHandlers[message.id];
        }
      } catch (e) {}
    }
  });
});

server.stderr.on('data', (data) => {
  console.error('Server:', data.toString().trim());
});

async function runComplexTest() {
  console.log('=== COMPLEX DRE TEST ===\n');

  // Initialize
  await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'complex-test', version: '1.0.0' }
  });

  console.log('\n1. BUILDING REASONING GRAPH');
  console.log('   Creating a complex dependency tree...\n');

  // Create objective
  const obj = await sendRequest('tools/call', {
    name: 'log_thought',
    arguments: {
      thought: 'Should we pivot our product strategy to focus on enterprise customers?',
      thought_type: 'objective'
    }
  });
  const objId = JSON.parse(obj.result.content[0].text).thought_id;
  console.log(`   ✓ Objective: ${objId}`);

  // Create two competing hypotheses
  const hyp1 = await sendRequest('tools/call', {
    name: 'log_thought',
    arguments: {
      thought: 'Enterprise pivot will increase revenue by 3x within 2 years',
      thought_type: 'hypothesis',
      dependencies: [objId],
      confidence: 0.7
    }
  });
  const hyp1Id = JSON.parse(hyp1.result.content[0].text).thought_id;
  console.log(`   ✓ Hypothesis 1: ${hyp1Id}`);

  const hyp2 = await sendRequest('tools/call', {
    name: 'log_thought',
    arguments: {
      thought: 'Enterprise pivot will alienate our existing user base',
      thought_type: 'hypothesis',
      dependencies: [objId],
      confidence: 0.6
    }
  });
  const hyp2Id = JSON.parse(hyp2.result.content[0].text).thought_id;
  console.log(`   ✓ Hypothesis 2: ${hyp2Id}`);

  // Add assumptions under hypothesis 1
  const ass1 = await sendRequest('tools/call', {
    name: 'log_thought',
    arguments: {
      thought: 'Enterprise customers have budget for our premium features',
      thought_type: 'assumption',
      dependencies: [hyp1Id],
      confidence: 0.8
    }
  });
  const ass1Id = JSON.parse(ass1.result.content[0].text).thought_id;
  console.log(`   ✓ Assumption 1: ${ass1Id}`);

  const ass2 = await sendRequest('tools/call', {
    name: 'log_thought',
    arguments: {
      thought: 'Our tech stack can handle enterprise-level security requirements',
      thought_type: 'assumption',
      dependencies: [hyp1Id],
      confidence: 0.5
    }
  });
  const ass2Id = JSON.parse(ass2.result.content[0].text).thought_id;
  console.log(`   ✓ Assumption 2: ${ass2Id}`);

  // Add sub-problems dependent on assumptions
  const sub1 = await sendRequest('tools/call', {
    name: 'log_thought',
    arguments: {
      thought: 'Research enterprise pricing models in our industry',
      thought_type: 'sub_problem',
      dependencies: [ass1Id]
    }
  });
  const sub1Id = JSON.parse(sub1.result.content[0].text).thought_id;
  console.log(`   ✓ Sub-problem 1: ${sub1Id}`);

  const sub2 = await sendRequest('tools/call', {
    name: 'log_thought',
    arguments: {
      thought: 'Conduct security audit for SOC2 compliance',
      thought_type: 'sub_problem',
      dependencies: [ass2Id]
    }
  });
  const sub2Id = JSON.parse(sub2.result.content[0].text).thought_id;
  console.log(`   ✓ Sub-problem 2: ${sub2Id}`);

  // Add action dependent on sub-problem
  const action = await sendRequest('tools/call', {
    name: 'log_thought',
    arguments: {
      thought: 'Interview 20 enterprise decision makers',
      thought_type: 'action',
      dependencies: [sub1Id],
      action_request: {
        tool: 'schedule_interviews',
        parameters: { count: 20, type: 'enterprise' }
      }
    }
  });
  const actionId = JSON.parse(action.result.content[0].text).thought_id;
  console.log(`   ✓ Action: ${actionId}`);

  // Add evidence
  const evidence = await sendRequest('tools/call', {
    name: 'log_thought',
    arguments: {
      thought: 'Market research shows 70% of competitors focusing on enterprise',
      thought_type: 'evidence',
      dependencies: [hyp1Id]
    }
  });
  const evidenceId = JSON.parse(evidence.result.content[0].text).thought_id;
  console.log(`   ✓ Evidence: ${evidenceId}`);

  // Add synthesis that depends on multiple thoughts
  const synthesis = await sendRequest('tools/call', {
    name: 'log_thought',
    arguments: {
      thought: 'Enterprise pivot is viable if we can meet security requirements',
      thought_type: 'synthesis',
      dependencies: [hyp1Id, ass2Id, evidenceId]
    }
  });
  const synthesisId = JSON.parse(synthesis.result.content[0].text).thought_id;
  console.log(`   ✓ Synthesis: ${synthesisId}`);

  console.log('\n2. CHECKING GRAPH STATE');
  
  const summary = await sendRequest('tools/call', {
    name: 'get_thought_graph',
    arguments: { format: 'summary' }
  });
  const summaryData = JSON.parse(summary.result.content[0].text);
  console.log('\n   Graph Summary:');
  console.log(`   - Total thoughts: ${summaryData.total_thoughts}`);
  console.log(`   - Thought types:`, summaryData.thought_types);
  console.log(`   - Stale thoughts: ${summaryData.stale_thoughts}`);

  console.log('\n3. INVALIDATING CRITICAL ASSUMPTION');
  console.log('   Invalidating security assumption (this should cascade)...\n');

  const invalidate = await sendRequest('tools/call', {
    name: 'invalidate_assumption',
    arguments: {
      thought_id: ass2Id,
      reason: 'Security audit revealed we need 18 months to meet enterprise requirements'
    }
  });
  const invalidateResult = JSON.parse(invalidate.result.content[0].text);
  console.log(`   ✓ Invalidated ${invalidateResult.invalidated_thoughts.length} thoughts`);
  console.log(`   ✓ Created critique: ${invalidateResult.critique_id}`);

  console.log('\n4. CHECKING CASCADE EFFECT');
  
  const fullGraph = await sendRequest('tools/call', {
    name: 'get_thought_graph',
    arguments: { format: 'full' }
  });
  const fullData = JSON.parse(fullGraph.result.content[0].text);
  
  console.log('\n   Analyzing thought status:');
  fullData.thoughts.forEach(thought => {
    const deps = thought.dependencies.length > 0 ? `[deps: ${thought.dependencies.join(', ')}]` : '[no deps]';
    console.log(`   - ${thought.thought_type}: ${thought.status} ${deps}`);
    if (thought.thought.length < 50) {
      console.log(`     "${thought.thought}"`);
    }
  });

  const staleCount = fullData.thoughts.filter(t => t.status === 'stale').length;
  console.log(`\n   Total stale thoughts: ${staleCount}`);

  // Verify cascade worked correctly
  const expectedStale = [ass2Id, sub2Id, synthesisId];
  const actualStale = fullData.thoughts
    .filter(t => t.status === 'stale')
    .map(t => t.id);
  
  console.log('\n5. VERIFICATION');
  console.log(`   Expected stale: ${expectedStale.length} thoughts`);
  console.log(`   Actually stale: ${actualStale.length} thoughts`);
  
  const allExpectedStale = expectedStale.every(id => actualStale.includes(id));
  console.log(`   ✓ Cascade invalidation: ${allExpectedStale ? 'PASSED' : 'FAILED'}`);

  // Check that unrelated thoughts are still active
  const unrelatedActive = fullData.thoughts
    .filter(t => [objId, hyp2Id, ass1Id, sub1Id, actionId, evidenceId].includes(t.id))
    .every(t => t.status === 'active');
  console.log(`   ✓ Unrelated thoughts active: ${unrelatedActive ? 'PASSED' : 'FAILED'}`);

  console.log('\n=== TEST COMPLETE ===');
  
  server.kill();
  process.exit(0);
}

runComplexTest().catch(error => {
  console.error('Test failed:', error);
  server.kill();
  process.exit(1);
});