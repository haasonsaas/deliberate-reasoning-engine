import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testDRE() {
  console.log('Starting DRE test client...\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js']
  });

  const client = new Client({
    name: 'dre-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✓ Connected to DRE server\n');

    // List available tools
    const tools = await client.listTools();
    console.log('Available tools:');
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log();

    // Test scenario: Company acquisition analysis
    console.log('Running test scenario: Company acquisition analysis\n');

    // 1. Log objective
    console.log('1. Setting objective...');
    const objective = await client.callTool('log_thought', {
      thought: 'Should we acquire Company X?',
      thought_type: 'objective'
    });
    const objId = JSON.parse(objective.content[0].text).thought_id;
    console.log(`   ✓ Objective logged (ID: ${objId})\n`);

    // 2. Log hypothesis
    console.log('2. Adding hypothesis...');
    const hypothesis = await client.callTool('log_thought', {
      thought: 'Acquiring Company X will increase our market share by 20%',
      thought_type: 'hypothesis',
      dependencies: [objId],
      confidence: 0.7
    });
    const hypId = JSON.parse(hypothesis.content[0].text).thought_id;
    console.log(`   ✓ Hypothesis logged (ID: ${hypId})\n`);

    // 3. Log assumption
    console.log('3. Adding assumption...');
    const assumption = await client.callTool('log_thought', {
      thought: 'Company X\'s technology is compatible with our stack',
      thought_type: 'assumption',
      dependencies: [hypId],
      confidence: 0.8
    });
    const assId = JSON.parse(assumption.content[0].text).thought_id;
    console.log(`   ✓ Assumption logged (ID: ${assId})\n`);

    // 4. Log sub-problem
    console.log('4. Adding sub-problem...');
    const subproblem = await client.callTool('log_thought', {
      thought: 'Verify technology compatibility through technical due diligence',
      thought_type: 'sub_problem',
      dependencies: [assId]
    });
    const subId = JSON.parse(subproblem.content[0].text).thought_id;
    console.log(`   ✓ Sub-problem logged (ID: ${subId})\n`);

    // 5. Get graph summary
    console.log('5. Getting graph summary...');
    const summary = await client.callTool('get_thought_graph', {
      format: 'summary'
    });
    console.log('   Graph summary:');
    console.log(JSON.parse(summary.content[0].text));
    console.log();

    // 6. Invalidate assumption
    console.log('6. Invalidating assumption...');
    const invalidate = await client.callTool('invalidate_assumption', {
      thought_id: assId,
      reason: 'Technical audit revealed major incompatibilities'
    });
    const result = JSON.parse(invalidate.content[0].text);
    console.log(`   ✓ Invalidated ${result.invalidated_thoughts.length} thoughts\n`);

    // 7. Get updated graph
    console.log('7. Getting updated graph...');
    const updated = await client.callTool('get_thought_graph', {
      format: 'summary'
    });
    const updatedData = JSON.parse(updated.content[0].text);
    console.log(`   Stale thoughts: ${updatedData.stale_thoughts}`);
    console.log();

    // 8. Get full graph
    console.log('8. Getting full graph...');
    const full = await client.callTool('get_thought_graph', {
      format: 'full'
    });
    const fullData = JSON.parse(full.content[0].text);
    console.log(`   Total thoughts: ${fullData.total_thoughts}`);
    console.log(`   Session ID: ${fullData.session_id}`);
    
    await client.close();
    console.log('\n✓ Test completed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testDRE().catch(console.error);