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

export type LogThoughtInput = z.infer<typeof LogThoughtSchema>;
export type GetGraphInput = z.infer<typeof GetGraphSchema>;
export type InvalidateInput = z.infer<typeof InvalidateSchema>;