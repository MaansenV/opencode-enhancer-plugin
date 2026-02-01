// Todo Parser Utility - Extracts todos from agent responses

import type { TodoItem, TodoExtractResult } from '../types.js';

export class TodoParser {
  private static readonly TODO_PATTERNS = [
    // Markdown Checkbox: - [ ] oder - [x]
    {
      regex: /[-*]\s*\[([ x✓✔])\]\s*(.+?)(?:\n|$)/gi,
      extract: (match: RegExpExecArray) => ({
        description: match[2].trim(),
        isDone: ['x', '✓', '✔'].includes(match[1].trim()),
      }),
    },
    // TODO: Kommentare
    {
      regex: /(?:TODO|FIXME|HACK|NOTE|XXX|BUG):\s*(.+?)(?:\n|$)/gi,
      extract: (match: RegExpExecArray) => ({
        description: match[1].trim(),
        isDone: false,
      }),
    },
    // Nummerierte Listen mit Status
    {
      regex: /(?:\d+\.|[a-z]\))\s*(?:\[([ x✓✔])\])?\s*(.+?)(?:\n|$)/gi,
      extract: (match: RegExpExecArray) => ({
        description: match[2].trim(),
        isDone: match[1] ? ['x', '✓', '✔'].includes(match[1].trim()) : false,
      }),
    },
  ];

  static extractTodos(content: string): TodoExtractResult {
    const todos: TodoItem[] = [];
    const seenDescriptions = new Set<string>();

    for (const pattern of this.TODO_PATTERNS) {
      let match: RegExpExecArray | null;
      
      // Reset regex lastIndex
      pattern.regex.lastIndex = 0;
      
      while ((match = pattern.regex.exec(content)) !== null) {
        const extracted = pattern.extract(match);
        
        // Deduplizierung
        if (seenDescriptions.has(extracted.description)) continue;
        seenDescriptions.add(extracted.description);

        todos.push({
          id: this.generateTodoId(),
          description: extracted.description,
          status: extracted.isDone ? 'completed' : 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    return {
      todos,
      hasTodos: todos.length > 0,
      completedCount: todos.filter(t => t.status === 'completed').length,
      pendingCount: todos.filter(t => t.status !== 'completed').length,
    };
  }

  static generateTodoId(): string {
    return `todo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  static hasUnfinishedTodos(todos: TodoItem[]): boolean {
    return todos.some(t => t.status !== 'completed');
  }

  static formatTodoList(todos: TodoItem[], onlyPending: boolean = false): string {
    const filteredTodos = onlyPending 
      ? todos.filter(t => t.status !== 'completed')
      : todos;

    if (filteredTodos.length === 0) return 'Keine Todos vorhanden.';

    return filteredTodos
      .map(t => {
        const checkbox = t.status === 'completed' ? '[x]' : '[ ]';
        const status = t.status === 'completed' ? '✅' : '⏳';
        return `${checkbox} ${status} ${t.description}`;
      })
      .join('\n');
  }
}
