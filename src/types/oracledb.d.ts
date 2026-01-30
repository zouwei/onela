/**
 * oracledb 最小类型声明
 * 用于动态导入时避免 TS2307 错误
 */
declare module 'oracledb' {
  const oracledb: any;
  export default oracledb;
  export const OUT_FORMAT_OBJECT: number;
  export function createPool(config: any): Promise<any>;
  export function getConnection(config: any): Promise<any>;
  export let outFormat: number;
  export let autoCommit: boolean;
}
