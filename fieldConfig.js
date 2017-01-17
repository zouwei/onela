/**
 * 字段配置
 * tableFiles可以通过代码获取（效率）
 */

module.exports = {
    /**
     * 用户模块：钱包表
     */
    "tables": {
        /**
         * 城市（行政区）
         */
        "com_citys": {
            "tableName": 'com_citys',
            "tableFiles": ["id", "cityname", "fullname", "pinyin", "first_letter", "parent_id", "citycode", "adcode", "municipality", "center", "level", "hot", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        }
    },
    "proc": {
        /**
         * 存储过程名称命名一致，描述功能分页获取info的数据
         * 命名规则，手写存储过程usp_打头，后面跟数据表的前缀biz_，后面再跟功能名称，首字母小写（驼峰命名规则）
         * 参数规则：编写存储过程优先排列输入参数，后面再跟输出参数，没有输出参数可以忽略
         */
        "usp_biz_getInfoList": {
            /**
             * 输入参数，没有参数不配置
             * 参数的顺序必须和存储过程一致
             * {
             *   name：参数名称，名称统一下划线打头
             *   mandatory：强制参数，ture表示可以为空，不传值可以正常执行，可缺省参数
             *   type：参数对应的类型；
             *   notes：参数描述，此描述可以直接抛出给前端显示配置为通俗语言
             * }
             * parameter输入参数和outs输出参数规则一致
             */
            "parameter": [
                {"name": "_start", "mandatory": false, "type": "INT(10)", "notes": "数据分页开始位置"},
                {"name": "_length", "mandatory": false, "type": "INT(10)", "notes": "数据分页每页取值的记录数"}
            ],
            /**
             * 输出参数，没有参数不配置
             * 参数的顺序必须和存储过程一致
             * 特别注意：输出参数在此定义之后，Coding不用再配置，结果数据取值输出参数参照此配置
             */
            "outs": [
                {"name": "_totalCount", "mandatory": false, "type": "INT(10)", "notes": "记录总数"}
            ]
        }
    }

};
