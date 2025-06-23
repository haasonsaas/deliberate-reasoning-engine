#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Types
type ThoughtType = 
  | 'objective'
  | 'hypothesis' 
  | 'assumption'
  | 'question'
  | 'sub_problem'
  | 'evidence'
  | 'action'
  | 'synthesis'
  | 'critique';

interface Thought {
  id: string;
  thought: string;
  thought_type: ThoughtType;
  dependencies: string[];
  confidence?: number;
  action_request?: {
    tool: string;
    parameters?: Record<string, any>;
  };
  timestamp: string;
  status: 'active' | 'stale';
}

interface ReasoningGraph {
  thoughts: Map<string, Thought>;
  session_id: string;
  created_at: string;
}

// Validation schemas
const LogThoughtSchema = z.object({
  thought: z.string(),
  thought_type: z.enum([
    'objective', 'hypothesis', 'assumption', 'question',
    'sub_problem', 'evidence', 'action', 'synthesis', 'critique'
  ]),
  dependencies: z.array(z.string()).optional().default([]),
  confidence: z.number().min(0).max(1).optional(),
  action_request: z.object({
    tool: z.string(),
    parameters: z.record(z.any()).optional()
  }).optional()
});

const GetGraphSchema = z.object({
  format: z.enum(['full', 'summary']).optional().default('summary')
});

const InvalidateSchema = z.object({
  thought_id: z.string(),
  reason: z.string()
});

// Server implementation
class DREServer {
  private server: Server;
  private graph: ReasoningGraph;

  constructor() {
    this.server = new Server(
      {
        name: 'deliberate-reasoning-engine',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.graph = {
      thoughts: new Map(),
      session_id: this.generateId(),
      created_at: new Date().toISOString()
    };

    this.setupHandlers();
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'log_thought',
          description: 'Log a structured thought in the reasoning graph',
          inputSchema: {
            type: 'object',
            properties: {
              thought: { type: 'string', description: 'The content of the thought' },
              thought_type: {
                type: 'string',
                enum: ['objective', 'hypothesis', 'assumption', 'question', 'sub_problem', 'evidence', 'action', 'synthesis', 'critique'],
                description: 'The semantic type of the thought'
              },
              dependencies: {
                type: 'array',
                items: { type: 'string' },
                description: 'IDs of thoughts this depends on'
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: 'Confidence level (0-1)'
              },
              action_request: {
                type: 'object',
                properties: {
                  tool: { type: 'string' },
                  parameters: { type: 'object' }
                },
                description: 'Action to execute'
              }
            },
            required: ['thought', 'thought_type']
          }
        },
        {
          name: 'get_thought_graph',
          description: 'Get the current reasoning graph',
          inputSchema: {
            type: 'object',
            properties: {
              format: {
                type: 'string',
                enum: ['full', 'summary'],
                description: 'Output format'
              }
            }
          }
        },
        {
          name: 'invalidate_assumption',
          description: 'Mark an assumption as invalid',
          inputSchema: {
            type: 'object',
            properties: {
              thought_id: { type: 'string', description: 'ID of the assumption' },
              reason: { type: 'string', description: 'Reason for invalidation' }
            },
            required: ['thought_id', 'reason']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'log_thought': {
            const input = LogThoughtSchema.parse(args);
            const thought: Thought = {
              id: this.generateId(),
              thought: input.thought,
              thought_type: input.thought_type,
              dependencies: input.dependencies,
              confidence: input.confidence,
              action_request: input.action_request,
              timestamp: new Date().toISOString(),
              status: 'active'
            };

            this.graph.thoughts.set(thought.id, thought);

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  thought_id: thought.id,
                  status: 'logged',
                  total_thoughts: this.graph.thoughts.size
                }, null, 2)
              }]
            };
          }

          case 'get_thought_graph': {
            const input = GetGraphSchema.parse(args);
            
            if (input.format === 'full') {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    session_id: this.graph.session_id,
                    created_at: this.graph.created_at,
                    thoughts: Array.from(this.graph.thoughts.values()),
                    total_thoughts: this.graph.thoughts.size
                  }, null, 2)
                }]
              };
            } else {
              const typeCounts: Record<string, number> = {};
              for (const thought of this.graph.thoughts.values()) {
                typeCounts[thought.thought_type] = (typeCounts[thought.thought_type] || 0) + 1;
              }

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    session_id: this.graph.session_id,
                    total_thoughts: this.graph.thoughts.size,
                    thought_types: typeCounts,
                    stale_thoughts: Array.from(this.graph.thoughts.values()).filter(t => t.status === 'stale').length
                  }, null, 2)
                }]
              };
            }
          }

          case 'invalidate_assumption': {
            const input = InvalidateSchema.parse(args);
            const thought = this.graph.thoughts.get(input.thought_id);
            
            if (!thought) {
              throw new McpError(ErrorCode.InvalidParams, 'Thought not found');
            }
            
            if (thought.thought_type !== 'assumption') {
              throw new McpError(ErrorCode.InvalidParams, 'Thought is not an assumption');
            }

            // Mark assumption and dependents as stale
            const invalidated = this.markStale(input.thought_id);

            // Add critique
            const critique: Thought = {
              id: this.generateId(),
              thought: `Assumption invalidated: "${thought.thought}". Reason: ${input.reason}`,
              thought_type: 'critique',
              dependencies: [input.thought_id],
              timestamp: new Date().toISOString(),
              status: 'active'
            };

            this.graph.thoughts.set(critique.id, critique);

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  invalidated_thoughts: invalidated,
                  critique_id: critique.id
                }, null, 2)
              }]
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid parameters: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          );
        }
        if (error instanceof McpError) throw error;
        throw new McpError(ErrorCode.InternalError, String(error));
      }
    });
  }

  private markStale(thoughtId: string): string[] {
    const stale: string[] = [];
    const thought = this.graph.thoughts.get(thoughtId);
    
    if (thought && thought.status === 'active') {
      thought.status = 'stale';
      stale.push(thoughtId);

      // Find all thoughts that depend on this one
      for (const [id, t] of this.graph.thoughts.entries()) {
        if (t.dependencies.includes(thoughtId) && t.status === 'active') {
          stale.push(...this.markStale(id));
        }
      }
    }

    return stale;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('DRE Server running');
  }
}

const server = new DREServer();
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});