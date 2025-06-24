# Changelog

All notable changes to the Deliberate Reasoning Engine (DRE) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2025-06-23

### Changed
- Complete TypeScript refactor with strict type checking
- Separated concerns into modules (server, types, validation)
- Improved code organization and maintainability
- Enhanced type safety throughout the codebase

### Added
- Hypothesis scoring based on evidence
- Session persistence and resumption  
- Graph visualization export
- Conflict detection between reasoning branches
- Multi-agent reasoning support

## [1.0.0] - 2025-06-23

### Added
- Initial release of Deliberate Reasoning Engine
- Core MCP server implementation with TypeScript
- Three primary tools: `log_thought`, `get_thought_graph`, `invalidate_assumption`
- Nine semantic thought types for structured reasoning
- Directed Acyclic Graph (DAG) based reasoning model
- Automatic cascade invalidation for dependent thoughts
- Support for action requests within thoughts
- Full and summary graph export formats
- Comprehensive test suite demonstrating complex reasoning scenarios
- Integration with Claude Desktop via MCP

### Technical
- Built with Model Context Protocol SDK
- TypeScript with ES2022 target
- Zod validation for all tool inputs
- Zero runtime dependencies (only MCP SDK and Zod)