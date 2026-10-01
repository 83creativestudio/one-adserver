export type Parameter = string | number | null;
export interface Database {
  provider: string;
  migrate(): Promise<void>;
  close(): Promise<void>;
  prepare(sql: string): {
    all(...params: Parameter[]): Promise<any[]>;
    get(...params: Parameter[]): Promise<any | undefined>;
    run(...params: Parameter[]): Promise<{ changes: number }>;
  };
}
export function createDatabase(env?: NodeJS.ProcessEnv): Database;
