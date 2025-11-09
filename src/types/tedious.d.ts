// src/types/tedious.d.ts
declare module 'tedious' {
  export class Connection {
    constructor(config: any);
    on(event: 'connect', listener: (err?: Error) => void): this;
    beginTransaction(callback: (err?: Error) => void): void;
    commitTransaction(callback: (err?: Error) => void): void;
    rollbackTransaction(callback: (err?: Error) => void): void;
    execSql(request: Request): void;
    close(): void;
  }

  export class Request {
    constructor(sql: string, callback: (err?: Error, rowCount?: number) => void);
    addParameter(name: string, type: any, value: any): void;
    on(event: 'row', listener: (columns: any[]) => void): this;
  }

  export const TYPES: {
    VarChar: any;
    NVarChar: any;
    Text: any;
    Int: any;
    BigInt: any;
    TinyInt: any;
    SmallInt: any;
    Bit: any;
    Float: any;
    Numeric: any;
    Decimal: any;
    Real: any;
    Date: any;
    DateTime: any;
    DateTime2: any;
    DateTimeOffset: any;
    Time: any;
    UniqueIdentifier: any;
    SmallDateTime: any;
    Money: any;
    SmallMoney: any;
    Binary: any;
    VarBinary: any;
    Image: any;
    Xml: any;
    Char: any;
    NChar: any;
    NText: any;
    TVP: any;
    UDT: any;
    Geography: any;
    Geometry: any;
    Variant: any;
  };
}