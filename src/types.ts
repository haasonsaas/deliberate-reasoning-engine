export type ThoughtType = 
  | 'objective'
  | 'hypothesis' 
  | 'assumption'
  | 'question'
  | 'sub_problem'
  | 'evidence'
  | 'action'
  | 'synthesis'
  | 'critique';

export interface ActionRequest {
  tool: string;
  parameters?: Record<string, any>;
}

export interface Thought {
  id: string;
  thought: string;
  thought_type: ThoughtType;
  dependencies: string[];
  confidence?: number;
  action_request?: ActionRequest;
  timestamp: string;
  status: 'active' | 'stale';
}

export interface ReasoningGraph {
  thoughts: Map<string, Thought>;
  session_id: string;
  created_at: string;
}