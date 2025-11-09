// src/types/sqlite3.d.ts
declare module 'sqlite3' {
  export class Database {
    constructor(filename: string, callback?: (err: Error | null) => void);
    constructor(filename: string, mode: number, callback?: (err: Error | null) => void);

    run(sql: string, callback?: (err: Error | null) => void): this;
    run(sql: string, params: any[], callback?: (err: Error | null) => void): this;

    get(sql: string, callback?: (err: Error | null, row: any) => void): this;
    get(sql: string, params: any[], callback?: (err: Error | null, row: any) => void): this;

    all(sql: string, callback?: (err: Error | null, rows: any[]) => void): this;
    all(sql: string, params: any[], callback?: (err: Error | null, rows: any[]) => void): this;

    close(callback?: (err: Error | null) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
  }

  export function verbose(): typeof import('sqlite3');
}