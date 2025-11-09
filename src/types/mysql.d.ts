// src/types/mysql.d.ts
declare module 'mysql' {
  export interface PoolConnection {
    query(sql: string, callback: (err: any, results?: any, fields?: any) => void): void;
    query(sql: string, values: any[], callback: (err: any, results?: any, fields?: any) => void): void;
    beginTransaction(callback: (err: any) => void): void;
    commit(callback: (err: any) => void): void;
    rollback(callback: (err: any) => void): void;
    release(): void;
  }

  export interface Pool {
    getConnection(callback: (err: any, connection: PoolConnection) => void): void;
    query(sql: string, callback: (err: any, results?: any, fields?: any) => void): void;
    query(sql: string, values: any[], callback: (err: any, results?: any, fields?: any) => void): void;
    end(callback?: (err: any) => void): void;
  }

  export function createPool(config: any): Pool;
}