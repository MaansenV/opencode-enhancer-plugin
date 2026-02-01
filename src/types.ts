// Type definitions for opencode-enhancer-plugin

export interface TodoItem {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: number;
  updatedAt?: number;
}

export interface SessionTodos {
  sessionId: string;
  todos: TodoItem[];
  lastUpdated: number;
  agentName: string;
}

export interface TodoExtractResult {
  todos: TodoItem[];
  hasTodos: boolean;
  completedCount: number;
  pendingCount: number;
}

export interface AgentModelConfig {
  subagent?: string;
  primary?: string;
  perAgent?: Record<string, string>;
}

export interface EnhancerPluginConfig {
  models?: AgentModelConfig;
}
