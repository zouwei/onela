import { Onela, OnelaBaseModel } from '../src/index.js';
import type { Configs } from '../src/index.js.js';

/**
 * 数据库配置，可以初始化多个数据库实例
 */
let dbconfig = [{
    "engine": "default",    // 数据库实例名称
    "type": "sqlserver" as const,        // 数据库类型
    "value": {
        // "connectionLimit": 5,
        "host": "127.0.0.1",
        "port": 3433,
        "user": "onela",
        "password": "onela@123",
        "database": "test_db"
    }
}];

// === 初始化 Onela ===
Onela.init(dbconfig);
// 已经在OnelaBaseModel封装的常用方法，可以在此基础自行扩展

class ToDoManager extends OnelaBaseModel {
    // 可以在此自定义扩展方法（默认封装没有的方法）
    static configs = {
        fields: [
            {name: "id", type: "Int", default: null, increment: true},
            {name: "content", type: "nvarchar"},
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
 * 单例模式：新增
 */
ToDoManager.insert({
    "content": "中文2",
    "is_done": 100
}).then(data => {
    console.log('查询结果', data);
}).catch(ex => {
    console.log(ex);
});

/**
 * 单例模式：批量新增
 */
ToDoManager.inserts([
    {content: "批量01", "is_done": 100},
    {content: "批量02", "is_done": 100}
]).then(data => {
    console.log(data);
}).catch(ex => {
    console.log(ex);
});

/**
 * 单例模式：数据查询
 */
ToDoManager.queryOne({
    where: [
        {"logic": "and", "key": "id", "operator": ">=", "value": 12},
        {"logic": "and", "key": "id", "operator": "=", "value": 13}
    ]
}).then(data => {
    console.log(data);
}).catch(ex => {
    console.log(ex);
});

/**
 * 单例模式：分页查询
 */
ToDoManager.query({
    "where": [
        {"logic": "and", "key": "id", "operator": ">", "value": 12}
    ]
}).then(data => {
    console.log(data);
}).catch(ex => {
    console.log(ex);
});

/**
 * 获取数据瀑布
 */
ToDoManager.queryList({
    "where": [
        // {"logic": "and", "key": "valid", "operator": "=", "value": 1}
    ],
    "limit":[0,6]
}).then(console.log);

/**
 * 单例模式：删除（物理删除，不推荐使用）
 */
ToDoManager.delete({
    "where": [
        {"key": "id", operator: "in", value: [16], logic: "and"}
    ]
}).then(data => {
    console.log(data);
}).catch(ex => {
    console.log(ex);
});


/**
 * 单例模式：更新（对于删除，建议使用逻辑删除）
 */
ToDoManager.update({
    update: [
        {key: "is_done", value: 99, operator: "replace"},
        {
            "key": "content",		 //update field
            "case_field": "id",		 //balance =  CASE id
            "case_item": [
                {"case_value": 14, "value": "修改结果A", "operator": "replace"},		//WHEN '001' THEN 1
                {"case_value": 15, "value": "修改结果B", "operator": "replace"}		//WHEN '001' THEN balance+2
            ]
        }
    ],
    where: [
        {"key": "id", operator: "in", value: [14, 15], logic: "and"}
    ]
}).then(data => {
    console.log(data);
}).catch(ex => {
    console.log(ex);
});


/**
 * 单例模式：实时统计
 */
ToDoManager.aggregate({
    // where:
    "aggregate": [
        {"function": "count", "field": "is_done", "name": "undone_tasks"},
    ]
}).then(data => {
    console.log(data);
}).catch(ex => {
    console.log(ex);
});


/**
 * 事务
 */
ToDoManager.transaction().then(t => {
    // 先新增一条记录
    ToDoManager.insert({
        "content": "测试事务新增"
    }, {transaction: t})
        .then(data => {
            // 再对新增的记录执行修改
            return ToDoManager.update({
                "update": [
                    {"key": "content", "value": "执行事务修改测试", "operator": "replace"}    // 修改了content字段
                ],
                "where": [
                    {"logic": "and", "key": "id", operator: "=", "value": 20}
                ]
            }, {transaction: t});
        })
        .then(data => {
            console.log('执行结果', data);
            t.commit().then(d => {
                console.log(d);
            });
        })
        .catch(ex => {
            console.log('事务异常回滚', ex);
            t.rollback().then(d => {
                console.log(d);
            });
        });
});
