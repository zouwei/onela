/**
 * 数据库配置，可以初始化多个数据库实例
 */
let dbconfig = [{
    "engine": "default",    // 数据库实例名称
    "type": "mysql",        // 数据库类型
    "value": {
        "connectionLimit": 5,
        "host": "127.0.0.1",
        "user": "test",
        "password": "7t1tusx+pvluIj",
        "database": "test_db"
    }
}];

const { Onela, OnelaBaseModel} = require("../lib/onela");
// 初始化Onela模块
Onela.init(dbconfig);
// 已经在OnelaBaseModel封装的常用方法，可以在此基础自行扩展

class ToDoManager extends OnelaBaseModel {
    // 可以在此自定义扩展方法（默认封装没有的方法）
}

// 【重要】单例模式，数据表配置
ToDoManager.configs = {
    fields: [
        {name: "id", type: "int", default: null},
        {name: "content", type: "varchar"},
        {name: "is_done", type: "int", default: 0},
        {
            name: "create_time", type: "datetime", default: () => {
            return new Date()
        }
        },
        {name: "finish_time", type: "datetime", default: null}
    ],
    tableName: "todos",
    engine: "default"
};

/**
 * 事务
 */
ToDoManager.transaction().then(t => {
    // 先新增一条记录
    ToDoManager.insertEntity({
        "content": "测试"
    }, {transaction: t})
        .then(data => {
            // 再对新增的记录执行修改
            return ToDoManager.updateEntity({
                "update": [
                    {"key": "content", "value": "执行修改测试", "operator": "replace"}    // 修改了content字段
                ],
                "where": [
                    {"logic": "and", "key": "id", operator: "=", "value": data.insertId}
                ]
            }, {transaction: t});
        })
        .then(data => {
            console.log('执行结果', data);
            t.commit().then(d=>{
                console.log(d);
            });
        })
        .catch(ex => {
            console.log('事务异常回滚', ex);
            t.rollback().then(d=>{
                console.log(d);
            });
        });
});

//
// /**
//  * 单例模式：数据查询
//  */
// ToDoManager.getEntity({
//     where: [
//         //{"logic": "and", "key": "id", "operator": "=", "value": 1}
//     ]
// }, null).then(data => {
//     console.log('查询结果', data)
// }).then();
//
// /**
//  * 单例模式：新增
//  */
// ToDoManager.insertEntity({
//     "content":"测试"
// }).then(data=>{console.log('查询结果',data)});
//
// /**
//  * 单例模式：分页查询
//  */
// ToDoManager.getEntityList({
//     "where": [
//             //{"logic": "and", "key": "id", "operator": "=", "value": 1}
//         ]
// }).then(console.log);
//
// /**
//  * 单例模式：批量新增
//  */
// ToDoManager.insertBatch([
//     {content: "测试1"},
//     {content: "测试2"},
//     {content: "测试3"}
// ]).then(console.log);
//
// /**
//  * 单例模式：删除（物理删除，不推荐使用）
//  */
// ToDoManager.deleteEntity({
//     "where": [
//         {"key": "id", operator: "in", value: [12360,12361], logic: "and"},
//         // {"key": "is_done", operator: "=", value: 1, logic: "and"}
//     ]
// }).then(console.log);
//
// /**
//  * 单例模式：更新（对于删除，建议使用逻辑删除）
//  */
// ToDoManager.updateEntity({
//     update: [
//         {key: "is_done", value: 1, operator: "replace"},
//         {
//             "key": "content",		 //update field
//             "case_field": "id",		 //balance =  CASE id
//             "case_item": [
//                 {"case_value": 12381, "value": "修改结果A", "operator": "replace"},		//WHEN '001' THEN 1
//                 {"case_value": 12384, "value": "修改结果B", "operator": "replace"}		//WHEN '001' THEN balance+2
//             ]
//         }
//     ],
//     where: [
//         {"key": "id", operator: "in", value: [12381, 12384], logic: "and"},
//     ]
// }).then(console.log);

//
// /**
//  * 单例模式：实时统计
//  */
// ToDoManager.getEntityByAggregate({
//     // where:
//     "aggregate":[
//         {"function": "count", "field": "is_done", "name": "undone_tasks"},
//     ]
// }).then(console.log);

