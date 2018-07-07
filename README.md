# Onela一个Node.js开源的ORM对象关系映射框架

> Onela是基于node.js开源的基于对象的映射框架，支持各种关系数据库数据基础设施。 同时支持各种数据库对象的读写分离，数据库实例垂直拆分。 在onela架构之上，您可以体验无SQL编程的乐趣，您只需要关注业务逻辑代码部分。 而且，我将在后面的版本的支持下加入分布式缓存来实现前端和后端的node.js程序来挑战大规模应用的情况。
>
> Onela is an object-based mapping framework based on node.js open source, supporting a variety of relational database data infrastructure. At the same time support a variety of database object read and write separation, the database instance vertical split. On top of the onela architecture you can experience the fun of programming without SQL, and you only need to focus on the business logic code section. And, I will be in the later version of the support to join the distributed cache to achieve the front and back end with node.js program to challenge the case of large-scale applications.



### 重大更新：v2.0.0版本发布

此版本重大更新，原有如果使用了V2.0.0之前的版本请注意，升级到最新版，最原有代码也需要微调。

特别感谢Hugh-won在v2.0.0版本改进提供帮助~

**v2.3.0已经支持SQL Server数据库**

**v2.2.0已经支持SQLite数据库**

**v2.1.0已经支持PostgreSQL数据库**

**v2.0.0新增支持MySQL数据库**

**下一版本开发对SQLite数据的支持，敬请期待，如有建议，请在GitHub的Issues区留言~**

~~~~~
在就版本中模块引用需要批量调整下(2.0.0之前的老版本兼容）
const onela = require('onela');
更改为：
const onela = require('onela').Old;
~~~~~

此版本文档已经更新为最新文档，v2.0.0之前的老版本文档请查看：[老版本文档](https://github.com/zouwei/onela/wiki/v1.*%E7%89%88%E6%9C%AC%E6%96%87%E6%A1%A3%EF%BC%88%E6%97%A7%E7%89%88%EF%BC%89)



### 步骤一：安装node模块（step 1 npm install node_modules）

~~~~~~
npm install onela		// 项目核心包

依赖包安装
npm install mysql	// MySQL数据库
npm install pg		// PostgreSQL数据库
npm install sqlite3	// SQLite数据库
npm install tedious	// SQL Server数据库
~~~~~~



### 步骤二：配置数据源（step 2 Mapping data sources）

数据库的配置可以配置在config全局配置中，在初始化调用取出来就可以了了

```
/**
 * 数据库配置，可以初始化多个数据库实例
 */
let dbconfig = [{
    "engine": "default",    // 数据库实例名称
    "type": "mysql",        // 数据库类型：MYSQL（不区分大小写）,支持类型：mysql、postgresql、sqlite、sqlserver
    "value": {
        "connectionLimit": 5,
        "host": "localhost",
        "user": "",
        "password": "",
        "database": "todo"
    }
},
{
    "engine": "default",
    "type": "PostgreSQL",           // 数据库类型：PostgreSQL（不区分大小写）
    "value": {
        "port": 3432,
        "host": "127.0.0.1",
        "user": "manor",
        "password": "test",
        "database": "test_db"
    }
}];

```



###步骤三：Onela ORM对象初始化（step 3 Onela ORM object initialization）

~~~~~~
const {Onela, OnelaBaseModel}  = require("onela");
// 初始化Onela模块（建议全局初始化）
Onela.init(dbconfig);
~~~~~~



### 步骤四：单例（数据表）对象配置以及方法的扩展封装

~~~~~
// 在OnelaBaseModel类中封装了常用的ORM方法
class ToDoManager extends OnelaBaseModel {
    // 可以在此自定义扩展方法（默认封装没有的方法）
}

/**
 * 【重要】单例模式，数据表配置
 * tableName：数据表名
 * engine：数据库引擎名称，需要和dbconfig配置的名称对应起来
 * fields[n].name:数据表字段名
 * fields[n].type:数据表字段类型
 * fields[n].default:默认值
 * */
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
~~~~~



###步骤五：常用CRUD操作代码示例（step 5 Examples of common CRUD operation code）

到这一步骤，可以直接使用ORM的方法了，增删改查，包含事务处理。

```
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
        "content": "测试事务"
    }, {transaction: t})
        .then(data => {
            // 再对新增的记录执行修改
            return ToDoManager.updateEntity({
                "update": [
                    {"key": "content", "value": "事务修改", "operator": "replace"}    // 修改了content字段
                ],
                "where": [
                    {"logic": "and", "key": "id", operator: "=", "value": 8}
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


/**
 * 单例模式：数据查询
 */
ToDoManager.getEntity({
    where: [
        //{"logic": "and", "key": "id", "operator": "=", "value": 1}
    ]
}, null).then(data => {
    console.log('查询结果', data)
}).then();

/**
 * 单例模式：新增
 */
ToDoManager.insertEntity({
    "content":"测试"
}).then(data=>{console.log('查询结果',data)});

/**
 * 单例模式：分页查询
 */
ToDoManager.getEntityList({
    "where": [
            //{"logic": "and", "key": "id", "operator": "=", "value": 1}
        ]
}).then(console.log);

/**
 * 单例模式：新增
 */
ToDoManager.insertEntity({
    content: "设计智能保险顾问的用户体系"
}).then(console.log);

/**
 * 单例模式：批量新增
 */
ToDoManager.insertBatch([
    {content: "测试1"},
    {content: "测试2"},
    {content: "测试3"}
]).then(console.log);

/**
 * 单例模式：删除（物理删除，不推荐使用）
 */
ToDoManager.deleteEntity({
    "where": [
        {"key": "id", operator: "in", value: [12360,12361], logic: "and"},
        // {"key": "is_done", operator: "=", value: 1, logic: "and"}
    ]
}).then(console.log);

/**
 * 单例模式：更新（对于删除，建议使用逻辑删除）
 */
ToDoManager.updateEntity({
    update: [
        {key: "is_done", value: 1, operator: "replace"}
    ],
    where: [
        {"key": "id", operator: "in", value: [12362], logic: "and"},
    ]
}).then(console.log);

/**
 * 单例模式：实时统计
 */
ToDoManager.getEntityByAggregate({
    // where:
    "aggregate":[
        {"function": "count", "field": "is_done", "name": "undone_tasks"},
    ]
}).then(console.log);
```



Ok, you can now play happily~

### Use instance to show（方法使用示例）

#### Query example（示例：查询）

There are several ways to apply the query to different business scenarios. Paging query, waterfall flow inquiries, Standard query

~~~~~~
	//parameter
    let p = {
        "select": ["t.id"],     //Specify the output field, query all fields, use t. * Or select attributes by default
        "where": [
            {"logic": "and", "key": 'valid', "operator": "=", "value": 1},
            {"logic": "and", "key": 'id', "operator": "=", "value": id}
        ],
        "orderBy": {"created_time": "DESC"},
        "limit": [0, 1]         //Take the first data of the query results
    }
    //execute select
    ToDoManager.getEntity(p)
        .then(function (data) {
            resolve(data);
        })
        .catch(function (err) {
            reject(err);
        });
~~~~~~



#### Insert example（示例：新增）

There is also a new batch method db_instance.insertBatch(arr),The incoming value is an array of objects

~~~~~~
	//parameter
    let p = {
        "name":"Sandy",
        "sex":"female",
        "email":"sandy@xxx.com"
        //……
        //Other fields are added in turn
    }
    //execute insert
    ToDoManager.insertEntity(p)
        .then((data)=> {
            resolve(data);
        })
        .catch(function (err) {
            reject(err);
        });
~~~~~~



#### Update example（示例：更新）

There are two main ways to update the field,replace or plus

~~~~~~
 //parameter
 var p = {
     "update": [
         //operator：replace update
         {"key": "name", "value": 'Sandy', "operator": "replace"},
         //operator：plus update,The field type needs to be a numeric type
         {"key": "money", "value": 2, "operator": "plus"},
         //operator：reduce update,The field type needs to be a numeric type
         {"key": "score", "value": 1, "operator": "reduce"}
         
     ],
     "where": [
        //where条件：一般以主键id作为更新条件，支持多条件组合语
        {"logic": "and","key": "id",  "operator": "=", "value": 'abc'}
     ]
 }
 //execute update
  ToDoManager.updateEntity(p)
        .then((data)=> {
            resolve(data);
        })
        .catch(function (err) {
            reject(err);
        });
~~~~~~



#### Update example（示例：复杂SQL更新）

case when then else end 用法举例

```
 SQL示例：update todos set is_done=1,content= (CASE id WHEN 12381 THEN '修改结果A' WHEN 12384 THEN '修改结果B' END)  where  1=1  and id in (12381, 12384); 
 
 //parameter
 var p = {
    update: [
        {key: "is_done", value: 1, operator: "replace"},
        {
            "key": "content",		 //update field
            "case_field": "id",		 //balance =  CASE id
            "case_item": [
                {"case_value": 3, "value": "修改结果A", "operator": "replace"},		//WHEN '001' THEN 1
                {"case_value": 6, "value": "修改结果B", "operator": "replace"}		//WHEN '001' THEN balance+2
            ]
        }
    ],
    where: [
        {"key": "id", operator: "in", value: [3,6], logic: "and"},
    ]
 }
 //execute update
  ToDoManager.updateEntity(p)
        .then((data)=> {
            resolve(data);
        })
        .catch(function (err) {
            reject(err);
        });
```



#### Delete example（示例：删除）

Physical deletion, generally do not recommend this operation, it is recommended to delete the logic

~~~~~~

	//parameter
    let p = {
        "where": [
            //Allow multiple query conditions
            //{"key": "字段名1", "value": "值", "logic": "连接联符 （默认为and 非必须 ）", operator: "关联符号 (默认为: =)"},
            {"key": "id", "value": "abc", "logic": "and", operator: "="}
        ]
    }
    //execute delete
    ToDoManager.deleteEntity(p)
        .then((data=>) {
            resolve(data);
        })
        .catch(function (err) {
            reject(err);
        });
~~~~~~





#### Transaction example（实例：事务）

Can only achieve local Transaction 

~~~~~~
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
            // 事务提交
            t.commit();
        })
        .catch(ex => {
            console.log('事务异常回滚', ex.message);
            // 事务回滚
            t.rollback();
        });
});
~~~~~~





### 版本更新日志

#### v2.3.0(2018-05-30)：onela新增数据库映射

- 新增对SQL Server数据库的支持


#### v2.2.0(2018-04-26)：onela新增数据库映射

- 新增对SQLite数据库的支持
- 修改了事务语法



####v2.1.0(2018-04-25)：onela新增数据库映射

* 新增对PostgreSQL数据库的支持



#### v2.0.0(2018-04-23)：onela新版发布

* 面向对象编程
* 加强了数据表配置结构字段、类型、默认值，等配置，语义设计更规范
* 兼容老版本代码（需要在引用的时候区分下）
* 简化项目初始化配置代码，代码简化，例如事务处理
* 新增对MySQL的支持（仅支持MySQL对象关系映射）

