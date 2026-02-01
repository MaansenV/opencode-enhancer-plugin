// Session Store - Manages todo state per session
export class SessionTodoStore {
    store = new Map();
    MAX_SESSION_AGE = 24 * 60 * 60 * 1000; // 24 Stunden
    set(sessionId, todos, agentName) {
        this.cleanup();
        this.store.set(sessionId, {
            sessionId,
            todos,
            lastUpdated: Date.now(),
            agentName,
        });
    }
    get(sessionId) {
        return this.store.get(sessionId);
    }
    delete(sessionId) {
        return this.store.delete(sessionId);
    }
    has(sessionId) {
        return this.store.has(sessionId);
    }
    hasUnfinishedTodos(sessionId) {
        const session = this.store.get(sessionId);
        if (!session)
            return false;
        return session.todos.some(t => t.status !== 'completed');
    }
    countUnfinished(sessionId) {
        const session = this.store.get(sessionId);
        if (!session)
            return 0;
        return session.todos.filter(t => t.status !== 'completed').length;
    }
    getAllPending(sessionId) {
        const session = this.store.get(sessionId);
        if (!session)
            return [];
        return session.todos.filter(t => t.status !== 'completed');
    }
    cleanup() {
        const now = Date.now();
        for (const [sessionId, session] of this.store.entries()) {
            if (now - session.lastUpdated > this.MAX_SESSION_AGE) {
                this.store.delete(sessionId);
            }
        }
    }
    clear() {
        this.store.clear();
    }
    getStats() {
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
//# sourceMappingURL=sessionStore.js.map