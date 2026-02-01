import type { SessionTodos, TodoItem } from '../types.js';
export declare class SessionTodoStore {
    private store;
    private readonly MAX_SESSION_AGE;
    set(sessionId: string, todos: TodoItem[], agentName: string): void;
    get(sessionId: string): SessionTodos | undefined;
    delete(sessionId: string): boolean;
    has(sessionId: string): boolean;
    hasUnfinishedTodos(sessionId: string): boolean;
    countUnfinished(sessionId: string): number;
    getAllPending(sessionId: string): TodoItem[];
    cleanup(): void;
    clear(): void;
    getStats(): {
        total: number;
        withTodos: number;
        totalTodos: number;
    };
}
export declare const todoStore: SessionTodoStore;
//# sourceMappingURL=sessionStore.d.ts.map