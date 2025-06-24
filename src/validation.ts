import { z } from 'zod';

export const LogThoughtSchema = z.object({
  thought: z.string(),
  thought_type: z.enum([
    'objective', 'hypothesis', 'assumption', 'question',
    'sub_problem', 'evidence', 'action', 'synthesis', 'critique'
  ] as const),
  dependencies: z.array(z.string()).optional().default([]),
  confidence: z.number().min(0).max(1).optional(),
  action_request: z.object({
    tool: z.string(),
    parameters: z.record(z.any()).optional()
  }).optional()
});

export const GetGraphSchema = z.object({
  format: z.enum(['full', 'summary']).optional().default('summary')
});

export const InvalidateSchema = z.object({
  thought_id: z.string(),
  reason: z.string()
});

export const GetMetricsSchema = z.object({
  include_sessions: z.boolean().optional().default(false)
});

export const QueryThoughtsSchema = z.object({
  query_type: z.enum(['by_type', 'by_dependency', 'by_content', 'by_confidence', 'recent']).optional().default('recent'),
  thought_type: z.enum([
    'objective', 'hypothesis', 'assumption', 'question',
    'sub_problem', 'evidence', 'action', 'synthesis', 'critique'
  ]).optional(),
  dependency_of: z.string().optional(),
  depends_on: z.string().optional(),
  content_search: z.string().optional(),
  min_confidence: z.number().min(0).max(1).optional(),
  max_confidence: z.number().min(0).max(1).optional(),
  status: z.enum(['active', 'stale']).optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0)
});

export type LogThoughtInput = z.infer<typeof LogThoughtSchema>;
export type GetGraphInput = z.infer<typeof GetGraphSchema>;
export type InvalidateInput = z.infer<typeof InvalidateSchema>;
export type GetMetricsInput = z.infer<typeof GetMetricsSchema>;
export type QueryThoughtsInput = z.infer<typeof QueryThoughtsSchema>;