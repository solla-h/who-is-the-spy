/**
 * Mock D1 Database for testing
 * Provides an in-memory implementation of D1Database interface
 */

interface MockRow {
  [key: string]: unknown;
}

interface MockTable {
  rows: MockRow[];
}

export class MockD1Database {
  private tables: Map<string, MockTable> = new Map();

  constructor() {
    // Initialize with empty tables
    this.tables.set('rooms', { rows: [] });
    this.tables.set('players', { rows: [] });
    this.tables.set('descriptions', { rows: [] });
    this.tables.set('votes', { rows: [] });
    this.tables.set('word_pairs', { rows: [] });
  }

  prepare(query: string): MockD1PreparedStatement {
    return new MockD1PreparedStatement(this, query);
  }

  async batch(statements: MockD1PreparedStatement[]): Promise<unknown[]> {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.run());
    }
    return results;
  }

  // Internal methods for mock implementation
  _getTable(name: string): MockTable {
    if (!this.tables.has(name)) {
      this.tables.set(name, { rows: [] });
    }
    return this.tables.get(name)!;
  }

  _insertRow(tableName: string, row: MockRow): void {
    const table = this._getTable(tableName);
    table.rows.push(row);
  }

  _findRows(tableName: string, predicate: (row: MockRow) => boolean): MockRow[] {
    const table = this._getTable(tableName);
    return table.rows.filter(predicate);
  }

  _updateRows(tableName: string, predicate: (row: MockRow) => boolean, updates: Partial<MockRow>): number {
    const table = this._getTable(tableName);
    let count = 0;
    for (const row of table.rows) {
      if (predicate(row)) {
        Object.assign(row, updates);
        count++;
      }
    }
    return count;
  }

  _deleteRows(tableName: string, predicate: (row: MockRow) => boolean): number {
    const table = this._getTable(tableName);
    const initialLength = table.rows.length;
    table.rows = table.rows.filter((row) => !predicate(row));
    return initialLength - table.rows.length;
  }

  _clear(): void {
    for (const table of this.tables.values()) {
      table.rows = [];
    }
  }
}

class MockD1PreparedStatement {
  private db: MockD1Database;
  private query: string;
  private bindings: unknown[] = [];

  constructor(db: MockD1Database, query: string) {
    this.db = db;
    this.query = query;
  }

  bind(...values: unknown[]): MockD1PreparedStatement {
    this.bindings = values;
    return this;
  }

  async run(): Promise<{ success: boolean; meta: { changes: number } }> {
    // Simple mock implementation - just return success
    return { success: true, meta: { changes: 1 } };
  }

  async first<T = unknown>(): Promise<T | null> {
    const results = await this.all<T>();
    return results.results?.[0] || null;
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: boolean }> {
    // Return empty results for mock
    return { results: [], success: true };
  }
}

/**
 * Create a fresh mock database instance
 */
export function createMockDb(): MockD1Database {
  return new MockD1Database();
}
