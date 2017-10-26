# Onela is an open source object-relational mapping framework（Onela是一个开源对象关系映射框架）

> Onela is an object-based mapping framework based on node.js open source, supporting a variety of relational database data infrastructure. At the same time support a variety of database object read and write separation, the database instance vertical split. On top of the onela architecture you can experience the fun of programming without SQL, and you only need to focus on the business logic code section. And, I will be in the later version of the support to join the distributed cache to achieve the front and back end with node.js program to challenge the case of large-scale applications.
>
> Onela是基于node.js开源的基于对象的映射框架，支持各种关系数据库数据基础设施。 同时支持各种数据库对象的读写分离，数据库实例垂直拆分。 在onela架构之上，您可以体验无SQL编程的乐趣，您只需要关注业务逻辑代码部分。 而且，我将在后面的版本的支持下加入分布式缓存来实现前端和后端的node.js程序来挑战大规模应用的情况。



### step 1 npm install node_modules（第一步：安装node模块）

npm install onela



### step 2 Mapping data sources（第二步：配置数据源）

Create the oodbc.js file in the “common” folder in the project root directory. The reference is as follows:

```
/**
 * OODBC
 * 数据源（这个是自定义的）
 * Node.js 创建数据连接的实例（如下所示mysql的初始化实例，pool为数据源实例，绑定到配置即可）
 * 读写分离，或者分库读写分离，甚至是多种类型的数据库需要分别实例化配置
 * var mysql = require("mysql");
 * var pool = mysql.createPool(config.get('global.mysql'));
 * 另外需要注意的是，数据库实例化需要在app.js启动的时候预先加载，所以我这里放到一个单独文件进行进行初始化的。
 */
var db = require("../service/dbconnect");

/**
 * 数据源配置
 * 注意：配置的数据源必须是预先初始化好的
 */
var dataSource = {
    /**
     * 默认是MYSQL
     * 配置属性名称统一采用大写
     */
    "MYSQL": {
        /**
         * 默认数据库的配置实例
         * 大多数情况下，大多数据表放到同一个数据库的情况下
         */
        "DEFAULT": {
            "READER": db.db01,
            "WRITER": db.db02              //读写没有分离的情况，绑定到同一个数据源即可
        },
        /**
         * 如果存在数据库拆分的实例（多个库组成一套系统的情况）
         * 如果不存在多个数据库的实例，OTHER节点可以删除
         */
        "CENTRAL": {
            "READER": db.db10,           //Authority system
            "WRITER": db.db10            //Authority system
        }
    },
    /**
     * 如果不存在ORACLE的数据库的访问实例可以删除节点
     */
    "ORACLE": {
        "DEFAULT": {
            "READER": null,
            "WRITER": null
        }
    }
};


module.exports = dataSource;
```



### step 3 Initialize the object relationship configuration file（第三步：初始化对象关系配置文件） 

Automatically initialize the object relationship configuration file, of course, you can also add it manually.

**You need to write a way to implement the ona configuration file initialization, of course, you can directly copy the following code to achieve.**

Call initConfigFile () to complete the initialization of the onelaInstanceConfig.json file

```
/**
 * 工具方法，用来创建onela数据库表映射的初始配置文件
 */
var path = require("path");
/**
 * OFramework框架测试
 * 实例化实体对象
 */
var onela = require('onela');
//数据源
var oodbc = require('../core/oodbc');
//onela-tools，项目已经开源：（下载地址：https://github.com/zouwei/onela-tools）
let onelaTools = require('./onela-tools.js');

var m = {};

/**
 * 初始化OFramework配置文件
 * @param paras.tableName 数据表名称
 * @param cb 回调函数
 * author：zack zou
 * create time：2017-04-08
 */
m.initConfigFile = function () {
    return new Promise(function (resolve, reject) {
        let tools = new onelaTools(oodbc, {
            "database": "MySQL",
            "instance": "DEFAULT"
        });
        /**
         * 根据表字段获取数据表字段名称数据
         * 需要指定配置文件输出路径
         */
        let config_path = path.resolve('config') + "\\onelaInstanceConfig.json";
        //生成数据对象实例的配置
        tools.initConfigFile(config_path)
            .then((result) => {
                resolve(result);
            })
            .catch((err) => {
                reject(err);
            });
    });
}


/**
 * 自动化生产Control后台管理方法（常用的增删改查）
 * @param paras.tableName 数据表名称
 * author：zack zou
 * create time：2017-04-18
 */
m.initManagementMethodFile = function () {
    return new Promise(function (resolve, reject) {
        //实例初始化
        let tools = new onelaTools(oodbc, {
            "database": "MySQL",
            "instance": "DEFAULT"
        });
        /**
         * 根据表字段获取数据表字段名称数据
         * 需要指定配置文件输出路径
         */
        let paras = {
            "path": "./ws_test/",            //输出文件路径，指向到目录即可，结尾“/”
            //可选参数，否则会填写默认值
            "directory": "core",             //数据层输入目录名称
            "protocol": "http",
            "host": "localhost:8090",
            "author": "zack zou"
        }
        //工具方法 - 创建后台管理请求Control方法
        tools.initManagementMethodFile(paras)
            .then((result) => {
                resolve(result);
            })
            .catch((err) => {
                reject(err);
            });
    });
}


module.exports = exports = m;
```



### onelaInstanceConfig.json  configuration file structure（onela-tools工具方法生成的配置文件结构实例如下）

You can configure it manually，If it is distributed data deployment, need to control odbc.js configuration.

~~~~
{
  "tables": {
    "user_info": {
      "database": "MYSQL",
      "instance": "DEFAULT",
      "tableName": "user_info",
      "tableFiles": [
        "id",
        "name",
        "moblie",
        "email",
        "password",
        "remark",
        "created_time",
        "created_id",
        "update_time",
        "update_id",
        "valid"
      ]
    }
  },
  "proc": {
   "usp_user_info_getUserInfoList": {
      "database": "MYSQL",
      "instance": "DEFAULT",
      "proc_name": "usp_user_info_getUserInfoList",
      "parameter": [
        {
          "type": "in",
          "name": "_start",
          "mandatory": true,
          "dataType": "INT(10)",
          "notes": "数据分页开始位置"
        },
        {
          "type": "in",
          "name": "_length",
          "mandatory": false,
          "defaultValue": 5,
          "dataType": "INT(10)",
          "notes": "数据分页每页取值的记录数"
        },
        {
          "type": "out",
          "name": "_totalCount",
          "mandatory": false,
          "dataType": "INT(10)",
          "notes": "记录总数"
        }
      ]
    }
  }
}
~~~~



### step 4 Method of calling（第四步：方法的调用）

Here are the sample code for all methods

*Data cache is not currently implemented*

```
/**
 * 实体对象模型
 * author：zack zou
 * create time：2017-10-23
 */

//onela ORM框架
const onela = require('onela');
//数据源
const oodbc = require('../oodbc');
//配置文件
const onelaInstanceConfig = require("../../config/onelaInstanceConfig.json");

/**
 * onela框架使用实例（此类可以整体复用，采用class的写法，使用时new对象即可）
 * 实例化基础实例onela基础方法的通用ORM底层方法
 * 一般情况下不要在基础方法实例里面修改，如需新增方法，请在扩展方法体中进行编写
 */
class base {

    /**
     * 构造函数
     */
    constructor() {
        //初始化实例对象，根据实例名称指定不同的数据库实例
        this.db_instance = onela(oodbc, onelaInstanceConfig.tables["entity_name"]);

    }

    /**
     * 分页查询实体模型信息
     * @param paras 参数集合，任意参数的组合
     * @param use_cache 是否使用缓存；true表示使用缓存
     * 参数 结构
     * {
     *   start: 开始数据索引
     *   length: 获取数据行数
     *   orderBy:{"字段名":"规则（ASC|DESC）"  字段名:默认为 createtime  规则:默认为 DESC }
     *   keyword:
     *     [
     *        {"key": "字段名", "value":"值", "logic": "连接联符 （默认为and 非必须 ）", operator: "关联符号 (默认为: = 可以为空)"},
     *        {"key": "valid", "value": "1"}
     *     ]
     * }
     * 返回:{
     *        data: [],                  //数据列表
     *        recordsTotal: 0,           //查询记录总数
     *        start: 0,                  //当前页索引
     *        length: 10                  //页大小
          }
     * author:zack zou
     * create time:2017-10-23
     */
    getEntityList(paras, use_cache) {
        let self = this;
        //定义结构
        return new Promise(function (resolve, reject) {
            /**
             * 数据缓存暂时做方案预留
             */
            self.db_instance.getEntityList(paras)
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    }

    /**
     * 查询瀑布数据列表，不返回记录总数，当返回的isLastPage=true，查询到了末尾
     * 查询记录length，查询可以length+1，前台数据只显示length的记录，判断尾页，利用length+1判断，小于等于length的记录到了末尾页面
     * @param paras 关键参数：paras.command、paras.keyword、paras.orderBy
     * @param use_cache 是否使用缓存；true表示使用缓存
     * 参数 结构
     * {
     *   start: 开始数据索引
     *   length: 获取数据行数
     *   orderBy:{"字段名":"规则（ASC|DESC）"  字段名:默认为 createtime  规则:默认为 DESC }
     *   keyword:
     *     [
     *        {"key": "字段名", "value":"值", "logic": "连接联符 （默认为and 非必须 ）", operator: "关联符号 (默认为: = 可以为空)"},
     *        {"key": "valid", "value": "1"}
     *     ]
     * }
     * 返回:{
     *    data: [],                  //数据列表
     *    isLastPage:false,          //当前页是否为最后页
     *    start: 0,                  //当前页索引
     *    length: 10                 //页大小
     * }
     * author:zack zou
     * create time:2017-10-23
     */
    getEntityListByWaterfall(paras, use_cache) {
        let self = this;
        //定义结构
        return new Promise(function (resolve, reject) {
            /**
             * 数据缓存暂时做方案预留
             */
            self.db_instance.getEntityListByWaterfall(paras)
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    }

    /**
     * 根据动态参数条件查询数据实体对象
     * @param paras 参数模型
     * @param use_cache 是否使用缓存；true表示使用缓存
     * 参数 结构
     * {
     *   orderBy:{"字段名":"规则（ASC|DESC）"  字段名:默认为 createtime  规则:默认为 DESC }
     *   keyword:
     *     [
     *        {"key": "字段名", "value":"值", "logic": "连接联符 （默认为and 非必须 ）", operator: "关联符号 (默认为: = 可以为空)"},
     *        {"key": "valid", "value": "1"}
     *     ]
     * }
     * 返回:[]
     * author:zack zou
     * create time:2017-10-23
     */
    getEntity(paras, use_cache) {
        let self = this;
        //定义结构
        return new Promise(function (resolve, reject) {
            /**
             * 数据缓存暂时做方案预留
             */
            self.db_instance.getEntity(paras)
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    }

    /**
     * 新增实体模型信息
     * @param paras 参数
     * @param use_cache 是否使用缓存；true表示使用缓存
     * 参数 结构
     * {
     *      //新增主键id，可缺省，自动赋值，也可以补全id值
     *      “字段1”:"值"
     *      “字段1”:"值"
     *      ...
     * }
     * author:zack zou
     * create time:2017-10-23
     */
    insertEntity(paras, use_cache) {
        let self = this;
        //定义结构
        return new Promise(function (resolve, reject) {
            /**
             * 数据缓存暂时做方案预留
             */
            self.db_instance.insertEntity(paras)
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    }

    /**
     * 批量新增实体模型数据
     * @param data 实体列表数组
     * @param use_cache 是否使用缓存；true表示使用缓存
     * 参数结构
     * [{
     *      //新增主键id，可缺省，自动赋值，也可以补全id值
     *      “字段1”:"值"
     *      “字段1”:"值"
     *      ...
     * }]
     * author:zack zou
     * create time:2017-10-23
     */
    insertBatch(paras, use_cache) {
        let self = this;
        //定义结构
        return new Promise(function (resolve, reject) {
            /**
             * 数据缓存暂时做方案预留
             */
            self.db_instance.insertBatch(paras)
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });

        });
    }

    /**
     * 修改实体信息，可以进行运算的字段的更新（加减）
     * @param paras 参数（限制字段类型为数字类型）
     * @param use_cache 是否使用缓存；true表示使用缓存
     * 参数结构
     *{
     *    "update": [
     *        //字段：替换更新
     *        {"key": "字段1", "value": '值', "operator": "replace"},
     *        //字段：累加（数值类型）
     *        {"key": "字段2", "value": 1, "operator": "plus"},
     *        //字段：累减（数值类型）
     *        {"key": "字段3", "value": 1, "operator": "reduce"}
     *    ],
     *    "keyword": [
     *       //where条件：一般以主键id作为更新条件，支持多条件组合语句
     *       {"key": "条件字段1", "value": '值', "logic": "and", "operator": "="}
     *    ]
     *}
     * author:zack zou
     * create time:2017-10-23
     */
    updateBySenior(paras, use_cache) {
        let self = this;
        //定义结构
        return new Promise(function (resolve, reject) {
            /**
             * 数据缓存暂时做方案预留
             */
            self.db_instance.updateBySenior(paras)
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    }

    /**
     * 批量更新数据
     * @param data 实体列表数组
     * @param use_cache 是否使用缓存；true表示使用缓存
     * 参数结构
     * {
     *   "keyword": [
     *       {"key": "查询条件1", "value": "值", "logic": "and", "operator": "="},
     *       {"key": "查询条件2", "value": "值", "logic": "and", "operator": "="},
     *       {"key": "查询条件3", "value": "值", "logic": "and", "operator": "="}
     *   ],
     *   "orderBy": {"排序字段（created_time）": "DESC"},
     *   "sumField": "sum求和字段（数值类型）";
     * }
     * author:zack zou
     * create time:2017-10-23
     */
    updateBatchBySenior(paras, use_cache) {
        let self = this;
        //定义结构
        return new Promise(function (resolve, reject) {
            /**
             * 数据缓存暂时做方案预留
             * 批量更新，这个方式是采用遍历数据单条记录更新的方式（不合适大批量的数据更新）
             */
            self.db_instance.updateBatchBySenior(paras)
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    }

    /**
     * 获取统计信息，count统计
     * @param paras 参数集合，任意参数的组合
     * @param use_cache 是否使用缓存；true表示使用缓存
     * 参数结构
     *{
     *   "keyword": [
     *       {"key": "查询条件1", "value": "值", "logic": "and", "operator": "="},
     *       {"key": "查询条件2", "value": "值", "logic": "and", "operator": "="},
     *       {"key": "查询条件3", "value": "值", "logic": "and", "operator": "="}
     *   ],
     *   "orderBy": {"排序字段（created_time）": "DESC"},
     *   "aggregate":[{"count": "money"}]
     *}
     * author:zack zou
     * create time:2017-10-23
     */
    getEntityByAggregate(paras, use_cache) {
        let self = this;
        //定义结构
        return new Promise(function (resolve, reject) {
            /**
             * 数据缓存暂时做方案预留
             */
            self.db_instance.getEntityByAggregate(paras)
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    }

    /**
     * 物理删除数据实体对象
     * @param paras 删除条件模型
     * 参数 结构
     * {
     *   keyword:
     *     [
     *        {"key": "字段名", "value":"值", "logic": "连接联符 （默认为and 非必须 ）", operator: "关联符号 (默认为: = 可以为空)"}
     *     ]
     * }
     * author:zack zou
     * create time:2017-10-23
     */
    deleteEntity(paras) {
        let self = this;
        //定义结构
        return new Promise(function (resolve, reject) {
            /**
             * 数据缓存暂时做方案预留
             */
            self.db_instance.deleteEntity(paras)
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    }
}

/**
 * 方法块：指向具体的数据库实例对象
 * 假如存在方法扩展，直接在这里写入新的方法
 */
class entity_name extends base {


    /**
     * 根据id获取实体对象
     * @param id 主键id
     * @param use_cache 是否使用缓存；true表示使用缓存
     * 参数 结构
     * {
     *   orderBy:{"字段名":"规则（ASC|DESC）"  字段名:默认为 createtime  规则:默认为 DESC }
     *   keyword:
     *     [
     *        {"key": "字段名", "value":"值", "logic": "连接联符 （默认为and 非必须 ）", operator: "关联符号 (默认为: = 可以为空)"},
     *        {"key": "valid", "value": "1"}
     *     ]
     * }
     * 返回：{...}实体对象
     * author:zack zou
     * create time:2017-10-23
     */
    getEntityById(id, use_cache) {
        let self = this;
        //定义结构
        return new Promise(function (resolve, reject) {
            /**
             * 数据缓存暂时做方案预留
             */
            let condition = {
                "keyword": [
                    {"logic": "and", "key": 'id', "operator": "=", "value": id}
                ]
            }
            self.db_instance.getEntity(condition)
                .then(function (data) {
                    if (data && data.length > 0)
                        resolve(data[0]);
                    else {
                        //Not find
                        resolve(null);
                    }
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    }

    /**
     * 根据ids获取实体对象
     * @param id 主键ids
     * @param use_cache 是否使用缓存；true表示使用缓存，单个数组数量不宜太多
     * 参数 结构
     * [
     *   "id1",
     *   "id2"
     * ]
     * 返回：{...}实体对象
     * author:zack zou
     * create time:2017-10-23
     */
    getEntityByIds(ids, use_cache) {
        let self = this;
        //定义结构
        return new Promise(function (resolve, reject) {
            /**
             * 数据缓存暂时做方案预留
             */
            let condition = {
                "keyword": [
                    {"logic": "and", "key": 'id', "operator": "in", "value": ids}
                ]
            }
            self.db_instance.getEntity(condition)
                .then(function (data) {
                    if (data && data.length > 0)
                        resolve(data);
                    else {
                        //Not find
                        resolve(null);
                    }
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    }






}

module.exports = entity_name;
```



Ok, you can now play happily~



### Use instance to show（方法使用示例）

#### Query example（示例：查询）

There are several ways to apply the query to different business scenarios. Paging query, waterfall flow inquiries, Standard query

~~~~~~
	//parameter
    var p = {
        "select": ["t.id"],     //Specify the output field, query all fields, use t. * Or select attributes by default
        "keyword": [
            {"logic": "and", "key": 'valid', "operator": "=", "value": 1},
            {"logic": "and", "key": 'id', "operator": "=", "value": id}
        ],
        "orderBy": {"created_time": "DESC"},
        "limit": [0, 1]         //Take the first data of the query results
    }
    //execute select
    db_instance.getEntity(p)
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
    var p = {
        "name":"Sandy",
        "sex":"female",
        "email":"sandy@xxx.com"
        //……
        //Other fields are added in turn
    }
    //execute insert
    db_instance.insertEntity(p)
        .then(function (data) {
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
     "keyword": [
        //where条件：一般以主键id作为更新条件，支持多条件组合语
        {"logic": "and","key": "id",  "operator": "=", "value": 'abc'}
     ]
 }
 //execute update
  db_instance.updateBySenior(p)
        .then(function (data) {
            resolve(data);
        })
        .catch(function (err) {
            reject(err);
        });
~~~~~~



#### Delete example（示例：删除）

Physical deletion, generally do not recommend this operation, it is recommended to delete the logic

~~~~~~

	//parameter
    var p = {
        "keyword": [
            //Allow multiple query conditions
            //{"key": "字段名1", "value": "值", "logic": "连接联符 （默认为and 非必须 ）", operator: "关联符号 (默认为: =)"},
            {"key": "id", "value": "abc", "logic": "and", operator: "="}
        ]
    }
    //execute delete
    db_instance.deleteEntity(p)
        .then(function (data) {
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
 * 新增附件关联信息（单文件关联）
 * 基于node.js事务（mysql）事务执行的案例，基于onela架构实现
 * @param 参数结构如下
 * {
 *   "record_id":"",            //关联记录id
 *   "files_id":"",             //附件id
 *   "sign":"业务标识",         //业务标识
 *    "oper_code":""            //操作代码
 * }
 * author:zack zou
 * create time:2017-04-27
 */
m.addFileRelation = function (paras) {
    //业务执行
    return new Promise(function (resolve, reject) {
        /**
         * 数据源对象，从数据库实例对象中获取，oodbc是标准数据源配置文件
         * oodbc结构里面是允许配置不同种类的数据（Mysql、Oracle等），同时允许数据库的多实例垂直拆分（解决高IO问题）
         * 所以onela在执行本地事务是有限制的，注意onela执行本地事务只能同一个实例连接池里面执行，对于已经垂直拆分数据库多实例的情况在这个方案中无法实施
         * 下面的事务在同一个数据库实例的例子。
         */
        var db = oodbc.MYSQL.DEFAULT.WRITER;            //假如读写分离的情况，直接使用读写库的实例
        /**
         * 验证事务处理
         * 本地事务，必须保证操作对象在同一个数据服务实例里面，否则不能实现事务
         * 创建事务连接对象
         */
        db.getConnection(function (err, connection) {
            if (err) {
                throw err;
            }
            //需要执行事务的实例必须保证在同一个connection池里面，所以必须重新新建oodbc
            var proc_oodb = {
                "MYSQL": {
                    "DEFAULT": {
                        "READER": connection,   //本地事务必须在同一个数据实例中执行
                        "WRITER": connection    //本地事务必须在同一个数据实例中执行
                    }
                }
            }
            //数据库对象实例化
            var proc_com_files_rel = onela(proc_oodb, onelaInstanceConfig.tables.com_files_rel);
            var proc_com_files = onela(proc_oodb, onelaInstanceConfig.tables.com_files);
            console.log('开始执行事务');
            //开始事务：必须在同一个连接池中执行事务才会生效
            connection.beginTransaction(function (err) {
                if (err) {
                    throw err;
                }
                //先新增附件关联，然后再更新附件状态
                //insert数据库字段默认值处理
                paras.remark = "";
                paras.created_id = "";
                paras.update_id = "";
                //先新增附件关联信息
                proc_com_files_rel.insertEntity(paras, false)
                    .then(function (data) {
                        /**
                         * 新增附件关联信息成功，修改附件的使用状态
                         */
                        var p = {
                            "update": [
                                {"key": "status", "value": "use", "operator": "replace"}
                            ],
                            "keyword": [
                                {"logic": "and", "key": "id", operator: "=", "value": paras.files_id}
                            ]
                        };
                        return proc_com_files.updateBySenior(p, false);
                    })
                    .then(function (data) {
                        // 提交事务
                        connection.commit(function (err) {
                            if (err) {
                                //提交事务异常，执行事务回滚
                                console.log('提交事务异常，执行事务回滚', err);
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else {
                                console.log('success!');
                                resolve("附件关联更新成功");
                            }
                        });
                    })
                    .catch(function (err) {
                        //出现异常，事务回滚
                        console.log('出现异常，执行事务回滚', err);
                        connection.rollback(function (err) {
                            console.log('事务错误', err);
                            reject("执行事务提交出错");
                        });
                    });
            });
        });
    });
};
~~~~~~



#### stored  procedure example（示例：存储过程）

Onela An example of executing a stored procedure

~~~~~~
/**
 * 初始化实例对象，存储过程列表
 * new 一次和new多次对高并发是有很大影响的，这里采用new一次的做法
 */
var proc_instance = {
    "usp_user_info_getUserInfoList": onela.proc(oodbc, onelaInstanceConfig.proc.usp_user_info_getUserInfoList)
}

/**
 * 存储过程方式：分页查询用户数据
 * @param paras
 * {
 *      "_start":0,
 *      "_length":10
 * }
 */
m.procGetUserInfoList = function (paras) {
    return new Promise(function (resolve, reject) {
        //执行存储过程
        proc_instance.usp_user_info_getUserInfoList.call(paras)
            .then(function (data) {
                resolve(data);
            })
            .catch(function (ex) {
                reject(ex);
            });
    });
}
~~~~~~



### Version update log（版本更新日志）

#### v1.2.0 (2017-05-27 update)： Increase the bulk update

v1.2.0 (2017-05-27 更新)：增加批量更新的方式

Added updateBySenior () to update the new features of the condition, support the update of the "case when then"

增加updateBySenior()更新条件的新特性，支持字段的"case when then" 的更新方式

~~~~~~
var p = {
     "update": [
         //operator：replace update（替换更新）
         {"key": "name", "value": 'Sandy', "operator": "replace"},
         //Field batch update（字段批量更新）
         {
            "key": "balance",		 //update field
            "case_field": "id",		 //balance =  CASE id 
            "case_item": [
            	{"case_value": "001", "value": 1, "operator": "replace"},		//WHEN '001' THEN 1
            	{"case_value": "002", "value": 2, "operator": "replace"}		//WHEN '001' THEN balance+2
            ]
        }
     ],
     "keyword": [
        //where条件：一般以主键id作为更新条件，支持多条件组合语
        {"logic": "and","key": "id",  "operator": "=", "value": 'abc'}
     ]
 }
~~~~~~



#### v1.2.1 (2017-08-22 update)： insert data defect repair

v1.2.1 (2017-08-22 更新)：修复新增默认字段的bug修复



#### v1.3.0 (2017-10-26 update)：Separation tool class method

分离onela中分辅助工具类方法，onela-tools项目是基于onela的代码工具类项目，方便更快更便捷的构建项目代码。分离之后的onela将更加纯净，后续版本升级计划将专注ORM框架本身，敬请期待。

onela-tools项目地址：https://github.com/zouwei/onela-tools



