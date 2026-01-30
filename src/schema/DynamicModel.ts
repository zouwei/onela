/**
 * DynamicModel - 动态 Model 注册
 * 支持运行时动态创建和注册 Model，无需重启应用
 * 适用于 AI 场景下的动态表管理
 */

import type { Configs, FieldConfig } from '../types/onela.js';

/**
 * 动态 Model 注册表
 */
export class DynamicModelRegistry {
  /** 已注册的动态 Model 配置 */
  private static _models: Map<string, Configs> = new Map();

  /**
   * 注册动态 Model
   * @param configs Model 配置
   * @returns 注册的 key（engine:tableName）
   */
  static register(configs: Configs): string {
    const key = `${configs.engine}:${configs.tableName}`;
    this._models.set(key, { ...configs });
    return key;
  }

  /**
   * 通过表名和引擎获取 Model 配置
   */
  static get(tableName: string, engine: string = 'default'): Configs | undefined {
    return this._models.get(`${engine}:${tableName}`);
  }

  /**
   * 检查 Model 是否已注册
   */
  static has(tableName: string, engine: string = 'default'): boolean {
    return this._models.has(`${engine}:${tableName}`);
  }

  /**
   * 注销 Model
   */
  static unregister(tableName: string, engine: string = 'default'): boolean {
    return this._models.delete(`${engine}:${tableName}`);
  }

  /**
   * 获取所有已注册的 Model 列表
   */
  static list(engine?: string): Configs[] {
    const result: Configs[] = [];
    for (const [key, configs] of this._models) {
      if (!engine || key.startsWith(`${engine}:`)) {
        result.push(configs);
      }
    }
    return result;
  }

  /**
   * 清除所有注册
   */
  static clear(): void {
    this._models.clear();
  }

  /**
   * 从列信息动态创建 Model 配置
   * @param tableName 表名
   * @param engine 引擎标识
   * @param fields 字段配置
   */
  static createFromFields(
    tableName: string,
    engine: string,
    fields: FieldConfig[]
  ): Configs {
    const configs: Configs = {
      engine,
      tableName,
      fields,
    };
    this.register(configs);
    return configs;
  }

  /**
   * 获取所有 Model 的描述信息（供 AI 使用）
   */
  static describe(engine?: string): string {
    const models = this.list(engine);
    if (models.length === 0) return 'No models registered.';

    const lines: string[] = [`Registered Models (${models.length}):`];
    for (const model of models) {
      lines.push(`\n  Table: ${model.tableName} (engine: ${model.engine})`);
      if (model.fields) {
        for (const field of model.fields) {
          let desc = `    - ${field.name}: ${field.type}`;
          if (field.primary) desc += ' [PK]';
          if (field.increment) desc += ' [AUTO]';
          if (field.comment) desc += ` -- ${field.comment}`;
          lines.push(desc);
        }
      }
    }
    return lines.join('\n');
  }
}
