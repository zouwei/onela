/**
 * MySQL 测试用例（TypeScript 版）
 */

import { Onela, OnelaBaseModel } from '../dist/onela.js';

// === 数据库配置 ===
const dbconfig = [
  {
    engine: 'default',
    type: 'mysql' as const,
    value: {
      connectionLimit: 5,
      host: '127.0.0.1',
      user: 'test',
      password: '7t1tusx+pvluIj',
      database: 'test_db',
    },
  },
];

// === 初始化 Onela ===
Onela.init(dbconfig);

// === 模型定义 ===
class ToDoManager extends OnelaBaseModel {
  static configs = {
    tableName: 'core_offline_order',
    engine: 'default',
    fields: [
      { name: 'id', type: 'int', default: null },
      { name: 'content', type: 'varchar' },
      { name: 'is_done', type: 'int', default: 0 },
      {
        name: 'create_time',
        type: 'datetime',
        default: () => new Date(),
      },
      {
        name: 'finish_time',
        type: 'datetime',
        default: () => new Date(),
      },
    ],
  };
}

/**
 * 事务测试
 */
(async () => {
  const t = await ToDoManager.transaction();

  try {
    // 1. 新增
    const insertRes = await ToDoManager.insertEntity(
      { content: '测试' },
      { transaction: t }
    );

    // 2. 更新刚插入的记录
    await ToDoManager.updateEntity(
      {
        update: [
          { key: 'content', value: '执行修改测试', operator: 'replace' },
        ],
        where: [
          { logic: 'and', key: 'id', operator: '=', value: insertRes.insertId },
        ],
      },
      { transaction: t }
    );

    console.log('事务执行成功');
    await t.commit();
    console.log('事务已提交');
  } catch (ex) {
    console.log('事务异常回滚', ex);
    await t.rollback();
    console.log('事务已回滚');
  }
})();

/**
 * 单条查询
 */
ToDoManager.getEntity({
  where: [
    // { logic: 'and', key: 'id', operator: '=', value: 1 },
  ],
})
  .then(data => console.log('单条查询结果:', data))
  .catch(console.error);

/**
 * 新增
 */
ToDoManager.insertEntity({ content: '测试' })
  .then(data => console.log('新增结果:', data))
  .catch(console.error);

/**
 * 分页查询
 */
ToDoManager.getEntityList({
  where: [
    // { logic: 'and', key: 'id', operator: '=', value: 1 },
  ],
  limit: [0, 10],
})
  .then(console.log)
  .catch(console.error);

/**
 * 瀑布流查询
 */
ToDoManager.getEntityWaterfall({
  where: [{ logic: 'and', key: 'valid', operator: '=', value: 1 }],
  orderBy: { id: 'DESC' },
  limit: [230, 10],
})
  .then(console.log)
  .catch(console.error);

/**
 * 批量新增
 */
ToDoManager.insertBatch([
  { content: '测试1' },
  { content: '测试2' },
  { content: '测试3' },
])
  .then(console.log)
  .catch(console.error);

/**
 * 物理删除
 */
ToDoManager.deleteEntity({
  where: [
    { key: 'id', operator: 'in', value: [12360, 12361], logic: 'and' },
  ],
})
  .then(console.log)
  .catch(console.error);

/**
 * 更新 + CASE WHEN
 */
ToDoManager.updateEntity({
  update: [
    { key: 'is_done', value: 1, operator: 'replace' },
    {
      key: 'content',
      case_field: 'id',
      case_item: [
        { case_value: 12381, value: '修改结果A', operator: 'replace' },
        { case_value: 12384, value: '修改结果B', operator: 'replace' },
      ],
    },
  ],
  where: [
    { key: 'id', operator: 'in', value: [12381, 12384], logic: 'and' },
  ],
})
  .then(console.log)
  .catch(console.error);

/**
 * 聚合统计
 */
ToDoManager.getEntityByAggregate({
  aggregate: [
    { function: 'count', field: 'is_done', name: 'undone_tasks' },
  ],
})
  .then(console.log)
  .catch(console.error);