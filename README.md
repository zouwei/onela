# Onela is an open source object-relational mapping framework

> Onela is an object-based mapping framework based on node.js open source, supporting a variety of relational database data infrastructure. At the same time support a variety of database object read and write separation, the database instance vertical split. On top of the onela architecture you can experience the fun of programming without SQL, and you only need to focus on the business logic code section. And, I will be in the later version of the support to join the distributed cache to achieve the front and back end with node.js program to challenge the case of large-scale applications.



### step 1 npm install node_modules

npm install onela





### step 2 Mapping data sources

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
var dbconn = require("../service/dbconnect");

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
            "READER": dbconn.db,
            "WRITER": dbconn.db              //读写没有分离的情况，绑定到同一个数据源即可
        },
        /**
         * 如果存在数据库拆分的实例（多个库组成一套系统的情况）
         * 如果不存在多个数据库的实例，OTHER节点可以删除
         */
        "CENTRAL": {
            "READER": dbconn.central,           //权限系统,直接使用riskey数据库的central数据表
            "WRITER": dbconn.central            //权限系统,直接使用riskey数据库的central数据表
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



### step 3 Initialize the object relationship configuration file 

Automatically initialize the object relationship configuration file, of course, you can also add it manually.



Later make up……