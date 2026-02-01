import type { TodoItem, TodoExtractResult } from '../types.js';
export declare class TodoParser {
    private static readonly TODO_PATTERNS;
    static extractTodos(content: string): TodoExtractResult;
    static generateTodoId(): string;
    static hasUnfinishedTodos(todos: TodoItem[]): boolean;
    static formatTodoList(todos: TodoItem[], onlyPending?: boolean): string;
}
//# sourceMappingURL=todoParser.d.ts.map