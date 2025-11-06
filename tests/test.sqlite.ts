import { Onela, OnelaBaseModel } from '../src/index.js';
import type { Configs } from '../src/index.js';

/**
 * SQLite数据库实例
 * 数据库配置，可以初始化多个数据库实例
 */
let dbconfig = [{
    "engine": "default",    // 数据库实例名称
    "type": "sqlite" as const,        // 数据库类型
    "value": {
        "host": "./sqlite_db.db"

    }
}];

// === 初始化 Onela ===
Onela.init(dbconfig);
// 已经在OnelaBaseModel封装的常用方法，可以在此基础自行扩展

class tableInstance extends OnelaBaseModel {
    // 可以在此自定义扩展方法（默认封装没有的方法）
    static configs = {
        fields: [
            {name: "id", type: "int", default: null, increment: true},
            {name: "content", type: "varchar"},
            {name: "is_done", type: "int", default: 0},
            {
                name: "create_time", type: "datetime", default: () => {
                return new Date()
            }
            },
            {
                name: "finish_time", type: "datetime", default: () => {
                return new Date()
            }
            }
        ],
        tableName: "todos",
        engine: "default"
    } as Configs;
}   


/**
 * 事务(仅支持本地事务）
 */
tableInstance.transaction().then(t => {
    // 先新增一条记录
    tableInstance.insert({
        "content": "执行事务新增测试A"
    }, {transaction: t})
        .then(data => {
            // 再对新增的记录执行修改
            return tableInstance.update({
                "update": [
                    {"key": "content", "value": "执行事务修改测试A", "operator": "replace"}    // 修改了content字段
                ],
                "where": [
                    {"logic": "and", "key": "id", operator: "=", "value": 9}
                ]
            }, {transaction: t});
        })
        .then(data => {
            console.log('执行结果', data);
            t.commit();
        })
        .catch(ex => {
            console.log('事务异常回滚', ex);
            t.rollback();
        });
});

// /**
//  * 获取数据瀑布
//  */
// tableInstance.queryList({
//     "where": [
//         // {"logic": "and", "key": "valid", "operator": "=", "value": 1}
//     ],
//     "limit":[0,2]
// }).then(console.log);


// /**
//  * 新增实体对象
//  * @param params ,新增实体对象
//  * {
//  *    "id":"3",             // 字段1，
//  *    "valid":1,            // 字段2，
//  * }
//  * @returns {Promise.<TResult>} 出参，返回新增实体对象
//  * {
//  *      "id":"3",
//  *      "valid":1
//  * }
//  */
// tableInstance.insert({
//     "content": "测试00"
// }).then(data => {
//     console.log('查询结果', data)
// });



// /**
//  * 单例模式：数据查询
//  */
// tableInstance.queryOne({
//     select:["id","content"],
//     where: [
//          //{"logic": "and", "key": "id", "operator": "in", "value": [9,10]}
//     ],
//     orderBy:{"id":"desc"},
//     limit:[0,10]
// }).then(data => {
//     console.log('查询结果', data)
// }).then();


// /**
//  * 单例模式：分页查询
//  */
// tableInstance.query({
//     "where": [
//             //{"logic": "and", "key": "id", "operator": "=", "value": 1}
//         ],
//     "limit":[0,2]
// }).then(console.log);

// /**
//  * 批量新增
//  * @param entity_list 新增实体对象列表
//  * [
//  *    {
//      *          "id":"10",          // 批量新增对象1
//      *          "valid":1
//      *    },
//  *    {
//      *          "id":"10",          // 批量新增对象2
//      *          "valid":1
//      *    }
//  * ]
//  * @returns {Promise.<T>}
//  */
// tableInstance.insert([
//     {content: "测试A"},
//     {content: "测试B"},
//     {content: "测试C"}
// ]).then(console.log);


// /**
//  * 物理删除（数据不可恢复，慎用）
//  * @param params 查询参数
//  * {
//  *    "where":[                 // where是查询条件模型数组，对应SQL语句where条件
//  *      {                      // 例句：select * from tableName where 1=1 and valid = 1
//  *          "logic": "and",    // logic，逻辑运算符，对应SQL语句运算符，可选值：and、or等
//  *          "key": "id",      // key，字段关键字，对应数据表表字段名称
//  *          "operator":"=",    // operator，运算符，对应字段对比关系，可选值：=、>、>=、<、<=、<>、%、x%、%%、in、not in等
//  *          "value": 1         // value，查询条件值
//  *      }
//  *    ]
//  * }
//  * @param option 其他参数
//  * @returns {Promise.<TResult>} 出参
//  * }
//  */
// tableInstance.delete({
//     "where": [
//         {"key": "id", operator: ">=", value:10, logic: "and"}
//     ]
// }).then(console.log);

// /**
//  * 实例更新（支持WHEN THEN CASE 更新）
//  * @param params 更新对象模型
//  * {
//  *    "where":[                // where，是查询条件模型数组，对应SQL语句where条件
//  *      {                      // 例句：select * from tableName where 1=1 and valid = 1
//  *          "logic": "and",    // logic，逻辑运算符，对应SQL语句运算符，可选值：and、or等
//  *          "key": "valid",    // key，字段关键字，对应数据表表字段名称
//  *          "operator":"=",    // operator，运算符，对应字段对比关系，可选值：=、>、>=、<、<=、<>、%、x%、%%、in、not in等
//  *          "value": 1         // value，查询条件值
//  *      }
//  *    ],
//  *    "update":[              // where，是更新对象，对应SQL语句中的set更新
//  *          {
//  *              "key": "name",          // 更新字段
//  *              "value": "更改名字",    // 更新之后的值
//  *              "operator": "replace"   // 更新方式：replace（替换更新）、plus（+=更新，例如金额更新）、reduce（-=更新，例如金额更新）
//  *          },
//  *         {                             // WHEN THEN CASE 更新
//  *               "key": "money",		 // 更新字段
//  *               "case_field": "id",	 // CASE 条件字段
//  *               "case_item": [
//  *                   {
//  *                      "case_value": "22",         // 把id值为22的这条记录
//  *                      "value": 12,                // 例句：WHEN '22' THEN money += 12
//  *                      "operator": "plus"         //
//  *                    },
//  *                   {"case_value": 23, "value": "B", "operator": "replace"}		//WHEN '001' THEN balance+2
//  *               ]
//  *           }
//  *    ]
//  * }
//  * @returns {Promise.<TResult>} 出参
//  */
// tableInstance.update({
//     update: [
//         {key: "is_done", value: 1, operator: "replace"},
//         {
//             "key": "content",		 //update field
//             "case_field": "id",		 //balance =  CASE id
//             "case_item": [
//                 {"case_value": 22, "value": "A", "operator": "replace"},		//WHEN '001' THEN 1
//                 {"case_value": 23, "value": "B", "operator": "replace"}		//WHEN '001' THEN balance+2
//             ]
//         }
//     ],
//     where: [
//         {"key": "id", operator: "in", value: [22, 23], logic: "and"},
//     ]
// }).then(console.log);

// /**
//  * 统计查询（聚合函数的使用）
//  * @param params 统计查询参数
//  * {
//  *    "where":[                // where，是查询条件模型数组，对应SQL语句where条件
//  *      {                      // 例句：select * from tableName where 1=1 and valid = 1
//  *          "logic": "and",    // logic，逻辑运算符，对应SQL语句运算符，可选值：and、or等
//  *          "key": "valid",    // key，字段关键字，对应数据表表字段名称
//  *          "operator":"=",    // operator，运算符，对应字段对比关系，可选值：=、>、>=、<、<=、<>、%、x%、%%、in、not in等
//  *          "value": 1         // value，查询条件值
//  *      }
//  *    ],
//  *   "aggregate":[
//  *     {
//  *          "function": "count",        // function，聚合函数：COUNT、SUM、MAX、MIN、ABS、AVG
//  *          "field": "id",              // 字段
//  *          "name": "total"             // 输出字段重命名
//  *      },
//  *   ]
//  * }
//  * @returns {Promise.<TResult>} 出参
//  * [
//  *  { total: 0 }
//  * ]
//  */
// tableInstance.aggregate({
//     // where:
//     "aggregate":[
//         {"function": "count", "field": "id", "name": "total"},
//     ]
// }).then(console.log);

