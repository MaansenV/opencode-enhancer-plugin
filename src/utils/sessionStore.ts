// Session Store - Manages todo state per session

import type { SessionTodos, TodoItem } from '../types.js';

export class SessionTodoStore {
  private store: Map<string, SessionTodos> = new Map();
  private readonly MAX_SESSION_AGE = 24 * 60 * 60 * 1000; // 24 Stunden

  set(sessionId: string, todos: TodoItem[], agentName: string): void {
    this.cleanup();
    
    this.store.set(sessionId, {
      sessionId,
      todos,
      lastUpdated: Date.now(),
      agentName,
    });
  }

  get(sessionId: string): SessionTodos | undefined {
    return this.store.get(sessionId);
  }

  delete(sessionId: string): boolean {
    return this.store.delete(sessionId);
  }

  has(sessionId: string): boolean {
    return this.store.has(sessionId);
  }

  hasUnfinishedTodos(sessionId: string): boolean {
    const session = this.store.get(sessionId);
    if (!session) return false;
    return session.todos.some(t => t.status !== 'completed');
  }

  countUnfinished(sessionId: string): number {
    const session = this.store.get(sessionId);
    if (!session) return 0;
    return session.todos.filter(t => t.status !== 'completed').length;
  }

  getAllPending(sessionId: string): TodoItem[] {
    const session = this.store.get(sessionId);
    if (!session) return [];
    return session.todos.filter(t => t.status !== 'completed');
  }

  cleanup(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.store.entries()) {
      if (now - session.lastUpdated > this.MAX_SESSION_AGE) {
        this.store.delete(sessionId);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  getStats(): { total: number; withTodos: number; totalTodos: number } {
    let totalTodos = 0;
    let withTodos = 0;
    
    for (const session of this.store.values()) {
      if (session.todos.length > 0) {
        withTodos++;
        totalTodos += session.todos.length;
      }
    }

    return {
      total: this.store.size,
      withTodos,
      totalTodos,
    };
  }
}

// Singleton Export
export const todoStore = new SessionTodoStore();
