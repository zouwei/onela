# Onela 一套业务代码无缝接入多种类型数据库

> 基于nodejs 开源ORM框架，旨在实现一套业务代码无缝对接不同类型的数据库实现接入。
>
> tips：4文件纯净包/400kb

[![npm](https://img.shields.io/npm/v/onela?color=success)](https://npmjs.com/package/onela)[![Downloads](https://img.shields.io/npm/dm/onela.svg?color=blue)](https://www.npmjs.com/package/onela)

### TS版本：v3.0版本发布

js版本更新到最后一个版本v2.4.7之后不再更新，新版本改用ts实现，版本号从v3.*开始。

已经支持 MySQL、PostgreSQL、SQL Server、SQLite数据库



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
    "type": "mysql",        // 数据库类型：支持类型：mysql、postgresql、sqlite、sqlserver
    "value": {
        "connectionLimit": 5,
        "host": "localhost",
        "port": 3432,
        "user": "demo",
        "password": "demo",
        "database": "test_db"
    }
}];

```



### 步骤三：Onela ORM对象初始化（step 3 Onela ORM object initialization）

~~~~~~
import { Onela, OnelaBaseModel } from 'onela';
import type { Configs } from 'onela';

// 初始化Onela模块（建议全局初始化）
Onela.init(dbconfig);
~~~~~~



### 步骤四：单例（数据表）对象配置以及方法的扩展封装

~~~~~
// 在OnelaBaseModel类中封装了常用的ORM方法
class ToDoManager extends OnelaBaseModel {
  // 可以在此自定义扩展方法（默认封装没有的方法）
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
  } as Configs;
}

~~~~~



### 步骤五：常用CRUD操作代码示例（step 5 Examples of common CRUD operation code）

到这一步骤，可以直接使用ORM的方法了，增删改查，包含事务处理。

Ok, you can now play happily~



### Use instance to show（方法使用示例）

#### Query example（示例：查询）

There are several ways to apply the query to different business scenarios. Paging query, waterfall flow inquiries, Standard query

~~~
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
    ToDoManager.query(p)
        .then(function (data) {
            resolve(data);
        })
        .catch(function (err) {
            reject(err);
        });
~~~



#### Insert example（示例：新增）

There is also a new batch method db_instance.inserts(arr),The incoming value is an array of objects

~~~
	//parameter
    let p = {
        "name":"Sandy",
        "sex":"female",
        "email":"sandy@xxx.com"
        //……
        //Other fields are added in turn
    }
    //execute insert
    ToDoManager.insert(p)
        .then((data)=> {
            resolve(data);
        })
        .catch(function (err) {
            reject(err);
        });
~~~



#### Update example（示例：更新）

There are two main ways to update the field,replace or plus

~~~
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
  ToDoManager.update(p)
        .then((data)=> {
            resolve(data);
        })
        .catch(function (err) {
            reject(err);
        });
~~~



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
  ToDoManager.update(p)
        .then((data)=> {
            resolve(data);
        })
        .catch(function (err) {
            reject(err);
        });
```



#### Delete example（示例：删除）

Physical deletion, generally do not recommend this operation, it is recommended to delete the logic

~~~

	//parameter
    let p = {
        "where": [
            //Allow multiple query conditions
            //{"key": "字段名1", "value": "值", "logic": "连接联符 （默认为and 非必须 ）", operator: "关联符号 (默认为: =)"},
            {"key": "id", "value": "abc", "logic": "and", operator: "="}
        ]
    }
    //execute delete
    ToDoManager.delete(p)
        .then((data=>) {
            resolve(data);
        })
        .catch(function (err) {
            reject(err);
        });
~~~



### sql example（实例：直接执行SQL案例）

Not recommended，Direct execution of sql can only be applied to specific types of databases

Note that using the `streak()` method will break compatibility with multiple database types, and will enter a single-database-type operation mode.

~~~
var sql = "SELECT * FROM tableName Where ...";
 
 ToDoManager.streak(sql).then(result =>{
 	// Get execution results
 }); 
~~~



#### Transaction example（实例：事务）

Can only achieve local Transaction 

~~~
// transaction
ToDoManager.transaction().then(t => {
    // 先新增一条记录
    ToDoManager.insert({
        "content": "测试"
    }, {transaction: t})
        .then(data => {
            // 再对新增的记录执行修改
            return ToDoManager.update({
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
~~~

