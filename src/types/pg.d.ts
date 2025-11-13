// src/types/pg.d.ts
declare module 'pg' {
  export class Pool {
    constructor(config?: any);
    connect(): Promise<PoolClient> & {
      (callback: (err: Error, client: PoolClient, done: (release?: any) => void) => void): void;
    };
    query(config: { text: string; values?: any[] }, callback: (err: Error | null, result: any) => void): void;
    query(config: { text: string; values?: any[] }): Promise<{ rows: any[] }>;
    end(): Promise<void>;
  }

  export interface PoolClient {
    query(config: { text: string; values?: any[] }, callback: (err: Error | null, result: any) => void): void;
    query(config: { text: string; values?: any[] }): Promise<{ rows: any[] }>;
    release(): void;
  }

  export interface TypeParser {
    (value: string): any;
  }

  export interface Types {
    setTypeParser(oid: number, parser: TypeParser | 'text' | 'binary'): void;
    getTypeParser(oid: number, format: 'text' | 'binary'): TypeParser;
  }
  
  export const types: Types;
}