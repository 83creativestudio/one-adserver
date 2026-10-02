export type Parameter = string | number | null;
export interface Database {
  provider: string;
  migrate(): Promise<void>;
  close(): Promise<void>;
  transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;
  prepare(sql: string): {
    all(...params: Parameter[]): Promise<any[]>;
    get(...params: Parameter[]): Promise<any | undefined>;
    run(...params: Parameter[]): Promise<{ changes: number }>;
  };
}
export type Transaction = Pick<Database, 'provider' | 'prepare'>;
export function createDatabase(env?: NodeJS.ProcessEnv): Database;
