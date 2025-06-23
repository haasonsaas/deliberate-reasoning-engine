# Deliberate Reasoning Engine (DRE)

[![npm version](https://img.shields.io/npm/v/deliberate-reasoning-engine.svg)](https://www.npmjs.com/package/deliberate-reasoning-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green)](https://modelcontextprotocol.io)

A Model Context Protocol (MCP) server that transforms linear AI reasoning into structured, auditable thought graphs. DRE enables Language Models to externalize their reasoning process as a directed acyclic graph (DAG) with semantic thought types, dependencies, and validation.

## 🌟 Features

- **🧠 Semantic Thought Types**: Categorize thoughts as Objectives, Hypotheses, Assumptions, Questions, Evidence, Actions, Synthesis, and Critiques
- **🔗 Graph-Based Dependencies**: Build a DAG of thoughts with explicit relationships and dependencies
- **🚨 Assumption Tracking**: Monitor and invalidate assumptions with automatic cascade to dependent thoughts
- **📊 Hypothesis Scoring**: Track supporting and contradicting evidence (coming soon)
- **💾 Session Persistence**: Save and load reasoning sessions (coming soon)
- **✅ Graph Validation**: Detect cycles, contradictions, and orphaned thoughts
- **🎯 Focused Reasoning**: Keep LLMs on track with structured problem decomposition

## 📦 Installation

### As an MCP Server

```bash
npm install -g deliberate-reasoning-engine
```

### For Development

```bash
git clone https://github.com/haasonsaas/deliberate-reasoning-engine.git
cd deliberate-reasoning-engine
npm install
npm run build
```

## 🚀 Quick Start

### Configure with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "dre": {
      "command": "npx",
      "args": ["deliberate-reasoning-engine"]
    }
  }
}
```

Or use the local development version:

```json
{
  "mcpServers": {
    "dre": {
      "command": "node",
      "args": ["/absolute/path/to/dre/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop, and you'll see the DRE tools available in the 🔧 menu.

## 🛠️ Available Tools

### `log_thought`
Log a structured thought with semantic type and dependencies.

**Parameters:**
- `thought` (string, required): The content of the thought
- `thought_type` (enum, required): One of:
  - `objective`: The overall goal of the reasoning task
  - `hypothesis`: A proposed explanation or solution
  - `assumption`: A belief taken as true for this reasoning line
  - `question`: A point of uncertainty to resolve
  - `sub_problem`: Decomposition of a larger problem
  - `evidence`: Data from tools or prior knowledge
  - `action`: A plan to use a tool
  - `synthesis`: A conclusion from previous thoughts
  - `critique`: Self-correction or flaw identification
- `dependencies` (string[], optional): IDs of thoughts this depends on
- `confidence` (number 0-1, optional): Confidence level
- `action_request` (object, optional): Tool and parameters to execute

### `get_thought_graph`
Retrieve the current reasoning graph.

**Parameters:**
- `format` (enum, optional): `"full"` or `"summary"` (default: `"summary"`)

### `invalidate_assumption`
Mark an assumption as invalid, cascading to all dependent thoughts.

**Parameters:**
- `thought_id` (string, required): ID of the assumption to invalidate
- `reason` (string, required): Explanation for invalidation

## 📖 Example Usage

Here's how an LLM might use DRE to analyze a complex decision:

```typescript
// 1. Set the objective
const objective = await use_mcp_tool("dre", "log_thought", {
  thought: "Should we acquire Company X?",
  thought_type: "objective"
});

// 2. Form hypotheses
const hyp1 = await use_mcp_tool("dre", "log_thought", {
  thought: "Acquiring Company X will increase our market share by 20%",
  thought_type: "hypothesis",
  dependencies: [objective.thought_id],
  confidence: 0.7
});

// 3. Identify assumptions
const assumption = await use_mcp_tool("dre", "log_thought", {
  thought: "Company X's technology is compatible with our stack",
  thought_type: "assumption",
  dependencies: [hyp1.thought_id],
  confidence: 0.8
});

// 4. Break down into sub-problems
const subproblem = await use_mcp_tool("dre", "log_thought", {
  thought: "Verify technical compatibility through due diligence",
  thought_type: "sub_problem",
  dependencies: [assumption.thought_id]
});

// 5. If assumption proves false, invalidate it
await use_mcp_tool("dre", "invalidate_assumption", {
  thought_id: assumption.thought_id,
  reason: "Technical audit revealed major incompatibilities"
});
// This automatically marks the sub-problem and any dependent thoughts as stale
```

## 🏗️ Architecture

DRE models reasoning as a directed acyclic graph where:
- **Nodes** are thoughts with semantic types
- **Edges** represent dependencies between thoughts
- **Status** tracking (active/stale) enables dynamic reasoning updates
- **Cascade invalidation** ensures reasoning consistency

## 🤝 Use Cases

- **Strategic Decision Making**: Break down complex business decisions
- **Research Planning**: Structure research questions and hypotheses
- **Problem Solving**: Decompose problems into manageable sub-problems
- **Risk Analysis**: Track assumptions and their implications
- **Debugging**: Systematic root cause analysis
- **Learning**: Structured exploration of new topics

## 🔧 Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

## 📝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 🐛 Troubleshooting

### Common Issues

1. **"Server not found" in Claude Desktop**
   - Ensure the path in your config is absolute
   - Restart Claude Desktop after config changes

2. **"Cannot find module" errors**
   - Run `npm install` and `npm run build`
   - Check that you're using Node.js 18+

## 📄 License

MIT - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built on the [Model Context Protocol](https://modelcontextprotocol.io)
- Inspired by structured reasoning systems and cognitive architectures
- Thanks to Anthropic for Claude and the MCP specification

---

## 🚦 Roadmap

- [ ] Hypothesis scoring based on evidence
- [ ] Session persistence and resumption
- [ ] Graph visualization export
- [ ] Conflict detection between branches
- [ ] Integration with external reasoning tools
- [ ] Multi-agent reasoning support

## 📊 Stats

![GitHub stars](https://img.shields.io/github/stars/haasonsaas/deliberate-reasoning-engine)
![GitHub forks](https://img.shields.io/github/forks/haasonsaas/deliberate-reasoning-engine)
![GitHub issues](https://img.shields.io/github/issues/haasonsaas/deliberate-reasoning-engine)