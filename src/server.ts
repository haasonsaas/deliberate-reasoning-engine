import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { Thought, ThoughtType, ReasoningGraph } from './types.js';
import { 
  LogThoughtSchema, 
  GetGraphSchema, 
  InvalidateSchema,
  GetMetricsSchema,
  QueryThoughtsSchema,
  LogThoughtInput,
  GetGraphInput,
  InvalidateInput,
  GetMetricsInput,
  QueryThoughtsInput
} from './validation.js';
import { SQLitePersistence } from './persistence.js';
import { RateLimitManager } from './rate-limiter.js';

export class DREServer {
  private server: Server;
  private graph: ReasoningGraph;
  private persistence: SQLitePersistence;
  private rateLimiter: RateLimitManager;

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

    this.persistence = new SQLitePersistence();
    this.rateLimiter = new RateLimitManager();
    
    // Configure rate limiters for different operations
    this.rateLimiter.addLimiter('log_thought', { maxTokens: 50, refillRate: 5, windowMs: 60000 });
    this.rateLimiter.addLimiter('query_thoughts', { maxTokens: 20, refillRate: 2, windowMs: 60000 });
    this.rateLimiter.addLimiter('get_metrics', { maxTokens: 10, refillRate: 1, windowMs: 60000 });
    this.rateLimiter.addLimiter('invalidate_assumption', { maxTokens: 30, refillRate: 3, windowMs: 60000 });
    this.rateLimiter.addLimiter('get_thought_graph', { maxTokens: 15, refillRate: 2, windowMs: 60000 });
    
    this.graph = {
      thoughts: new Map(),
      session_id: this.generateId(),
      created_at: new Date().toISOString()
    };

    this.setupHandlers();
    this.initializeSession();
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private async initializeSession(): Promise<void> {
    await this.persistence.saveSession(this.graph.session_id, this.graph.created_at);
  }

  private checkRateLimit(toolName: string, clientId: string = 'default'): void {
    const result = this.rateLimiter.checkLimit(toolName, clientId);
    
    if (!result.allowed) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Rate limit exceeded for ${toolName}. Try again in ${result.retryAfter}ms. Remaining tokens: ${result.remaining}`
      );
    }
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getToolDefinitions()
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'log_thought': {
            this.checkRateLimit('log_thought');
            const input = LogThoughtSchema.parse(args);
            return await this.handleLogThought(input);
          }

          case 'get_thought_graph': {
            this.checkRateLimit('get_thought_graph');
            const input = GetGraphSchema.parse(args);
            return this.handleGetThoughtGraph(input);
          }

          case 'invalidate_assumption': {
            this.checkRateLimit('invalidate_assumption');
            const input = InvalidateSchema.parse(args);
            return await this.handleInvalidateAssumption(input);
          }

          case 'get_metrics': {
            this.checkRateLimit('get_metrics');
            const input = GetMetricsSchema.parse(args);
            return await this.handleGetMetrics(input);
          }

          case 'query_thoughts': {
            this.checkRateLimit('query_thoughts');
            const input = QueryThoughtsSchema.parse(args);
            return await this.handleQueryThoughts(input);
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

  private getToolDefinitions(): Tool[] {
    return [
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
      },
      {
        name: 'get_metrics',
        description: 'Get usage metrics and analytics',
        inputSchema: {
          type: 'object',
          properties: {
            include_sessions: { 
              type: 'boolean', 
              description: 'Include session details in response',
              default: false
            }
          }
        }
      },
      {
        name: 'query_thoughts',
        description: 'Query and filter thoughts with powerful search capabilities',
        inputSchema: {
          type: 'object',
          properties: {
            query_type: {
              type: 'string',
              enum: ['by_type', 'by_dependency', 'by_content', 'by_confidence', 'recent'],
              description: 'Type of query to perform',
              default: 'recent'
            },
            thought_type: {
              type: 'string',
              enum: ['objective', 'hypothesis', 'assumption', 'question', 'sub_problem', 'evidence', 'action', 'synthesis', 'critique'],
              description: 'Filter by thought type'
            },
            dependency_of: {
              type: 'string',
              description: 'Find thoughts that this thought depends on'
            },
            depends_on: {
              type: 'string',
              description: 'Find thoughts that depend on this thought'
            },
            content_search: {
              type: 'string',
              description: 'Search within thought content'
            },
            min_confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Minimum confidence level'
            },
            max_confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Maximum confidence level'
            },
            status: {
              type: 'string',
              enum: ['active', 'stale'],
              description: 'Filter by status'
            },
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              description: 'Maximum number of results',
              default: 20
            },
            offset: {
              type: 'number',
              minimum: 0,
              description: 'Number of results to skip',
              default: 0
            }
          }
        }
      }
    ];
  }

  private validateDependencies(dependencies: string[]): void {
    // Check that all dependencies exist
    for (const depId of dependencies) {
      if (!this.graph.thoughts.has(depId)) {
        throw new McpError(ErrorCode.InvalidParams, `Dependency "${depId}" does not exist`);
      }
    }

    // Check for circular dependencies (with the new thought)
    const tempId = 'temp_' + Date.now();
    const visited = new Set<string>();
    const recursiveStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursiveStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursiveStack.add(nodeId);

      // Get dependencies for this node
      const deps = nodeId === tempId ? dependencies : this.graph.thoughts.get(nodeId)?.dependencies || [];
      
      for (const depId of deps) {
        if (hasCycle(depId)) return true;
      }

      recursiveStack.delete(nodeId);
      return false;
    };

    if (hasCycle(tempId)) {
      throw new McpError(ErrorCode.InvalidParams, 'Circular dependency detected');
    }
  }

  private async handleLogThought(input: LogThoughtInput) {
    // Validate dependencies before creating the thought
    this.validateDependencies(input.dependencies);

    const thought: Thought = {
      id: this.generateId(),
      thought: input.thought,
      thought_type: input.thought_type as ThoughtType,
      dependencies: input.dependencies,
      confidence: input.confidence,
      action_request: input.action_request,
      timestamp: new Date().toISOString(),
      status: 'active'
    };

    this.graph.thoughts.set(thought.id, thought);
    
    // Persist to database
    await this.persistence.saveThought(thought, this.graph.session_id);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          thought_id: thought.id,
          status: 'logged',
          total_thoughts: this.graph.thoughts.size
        }, null, 2)
      }]
    };
  }

  private handleGetThoughtGraph(input: GetGraphInput) {
    if (input.format === 'full') {
      return {
        content: [{
          type: 'text' as const,
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
          type: 'text' as const,
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

  private async handleInvalidateAssumption(input: InvalidateInput) {
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
    
    // Persist critique and update invalidated thoughts
    await this.persistence.saveThought(critique, this.graph.session_id);
    for (const thoughtId of invalidated) {
      const staleThought = this.graph.thoughts.get(thoughtId);
      if (staleThought) {
        await this.persistence.saveThought(staleThought, this.graph.session_id);
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          invalidated_thoughts: invalidated,
          critique_id: critique.id
        }, null, 2)
      }]
    };
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

  private async handleGetMetrics(input: GetMetricsInput) {
    const metrics = await this.persistence.getMetrics();
    
    let response: any = {
      current_session: {
        session_id: this.graph.session_id,
        created_at: this.graph.created_at,
        thoughts_in_memory: this.graph.thoughts.size,
        active_thoughts: Array.from(this.graph.thoughts.values()).filter(t => t.status === 'active').length,
        stale_thoughts: Array.from(this.graph.thoughts.values()).filter(t => t.status === 'stale').length
      },
      global_metrics: metrics
    };

    if (input.include_sessions) {
      const sessions = await this.persistence.getAllSessions();
      response.sessions = sessions;
    }

    // Add rate limiting stats
    response.rate_limiting = {
      log_thought: this.rateLimiter.getStats('log_thought'),
      get_thought_graph: this.rateLimiter.getStats('get_thought_graph'),
      invalidate_assumption: this.rateLimiter.getStats('invalidate_assumption'),
      get_metrics: this.rateLimiter.getStats('get_metrics'),
      query_thoughts: this.rateLimiter.getStats('query_thoughts')
    };

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(response, null, 2)
      }]
    };
  }

  private async handleQueryThoughts(input: QueryThoughtsInput) {
    let thoughts = Array.from(this.graph.thoughts.values());
    
    // Apply filters
    if (input.thought_type) {
      thoughts = thoughts.filter(t => t.thought_type === input.thought_type);
    }
    
    if (input.status) {
      thoughts = thoughts.filter(t => t.status === input.status);
    }
    
    if (input.content_search) {
      const searchTerm = input.content_search.toLowerCase();
      thoughts = thoughts.filter(t => t.thought.toLowerCase().includes(searchTerm));
    }
    
    if (input.min_confidence !== undefined) {
      thoughts = thoughts.filter(t => t.confidence !== undefined && t.confidence >= input.min_confidence!);
    }
    
    if (input.max_confidence !== undefined) {
      thoughts = thoughts.filter(t => t.confidence !== undefined && t.confidence <= input.max_confidence!);
    }
    
    if (input.dependency_of) {
      const targetThought = this.graph.thoughts.get(input.dependency_of);
      if (targetThought) {
        thoughts = thoughts.filter(t => targetThought.dependencies.includes(t.id));
      } else {
        thoughts = [];
      }
    }
    
    if (input.depends_on) {
      thoughts = thoughts.filter(t => t.dependencies.includes(input.depends_on!));
    }
    
    // Apply sorting based on query type
    switch (input.query_type) {
      case 'recent':
        thoughts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        break;
      case 'by_confidence':
        thoughts.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        break;
      case 'by_type':
        thoughts.sort((a, b) => a.thought_type.localeCompare(b.thought_type));
        break;
      case 'by_content':
        thoughts.sort((a, b) => a.thought.localeCompare(b.thought));
        break;
      case 'by_dependency':
        thoughts.sort((a, b) => b.dependencies.length - a.dependencies.length);
        break;
    }
    
    // Apply pagination
    const total = thoughts.length;
    const paginatedThoughts = thoughts.slice(input.offset, input.offset + input.limit);
    
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          query: input,
          total_results: total,
          returned_count: paginatedThoughts.length,
          offset: input.offset,
          limit: input.limit,
          thoughts: paginatedThoughts.map(t => ({
            ...t,
            dependencies_count: t.dependencies.length,
            dependent_thoughts: Array.from(this.graph.thoughts.values())
              .filter(other => other.dependencies.includes(t.id))
              .map(other => ({ id: other.id, thought_type: other.thought_type }))
          }))
        }, null, 2)
      }]
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('DRE Server running');
  }
}