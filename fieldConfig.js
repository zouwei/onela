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
        },
        /**
         * 键值对（临时数据库存在）
         */
        "com_redis": {
            "tableName": 'com_redis',
            "tableFiles": ["id", "redis_key", "redis_value", "redis_expire", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 文件对象信息
         */
        "com_files": {
            "tableName": 'com_files',
            "tableFiles": ["id", "oss_name", "oss_type", "oss_path", "oss_key", "query_count", "download_count", "mimetype", "oss_size", "status", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 文件对象关联信息
         */
        "com_files_rel": {
            "tableName": 'com_files_rel',
            "tableFiles": ["id", "files_id", "record_id", "sign", "oper_code", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 消息通知
         */
        "com_notice": {
            "tableName": 'com_notice',
            "tableFiles": ["id", "appid", "requestid", "relevanceid", "title", "type", "template", "content", "request", "attachment", "notice_time", "status", "is_read", "read_time", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 空气质量统计信息
         */
        "com_air": {
            "tableName": 'com_air',
            "tableFiles": ["id", "cityid", "adcode", "tag", "cityname", "AQI", "quality", "primary_pollutant", "pm25", "pm10", "tips", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 空气质量数据
         */
        "com_air_quality": {
            "tableName": 'com_air_quality',
            "tableFiles": ["id", "cityid", "adcode", "tag", "cityname", "name", "AQI", "quality", "primary_pollutant", "pm25", "pm10", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 用户基础信息
         */
        "user_info": {
            "tableName": 'user_info',
            "tableFiles": ["id", "name", "type", "level", "idtype", "idcard", "identity", "mobile", "mobile_auth", "email", "email_auth", "nickname", "headimgurl", "country", "province", "city", "sex", "brithday", "status", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 第三方托管账户
         */
        "user_escrow": {
            "tableName": 'user_escrow',
            "tableFiles": ["id", "userid", "type", "openid", "subscribe", "nickname", "headimgurl", "country", "province", "city", "status", "request_count", "last_request_time", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 用户模块：钱包表
         */
        "user_wallet": {
            "tableName": 'user_wallet',
            "tableFiles": ["id", "userid", "balance", "credit", "level", "status", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 用户模块：钱包流水
         */
        "user_account": {
            "tableName": 'user_account',
            "tableFiles": ["id", "appid", "userid", "type", "action", "money", "memo", "tax_tag", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 用户模块：提现记录
         */
        "user_withdrawals": {
            "tableName": 'user_withdrawals',
            "tableFiles": ["id", "userid", "payment_type", "payment_no", "realname", "openid", "idcard", "money", "payment_time", "status", "memo", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 用户模块：红包记录
         */
        "user_bonus": {
            "tableName": 'user_bonus',
            "tableFiles": ["id", "appid", "task_no", "userid", "name", "type", "worth", "expire_time", "status", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 用户模块:税率配置
         */
        "user_tax": {
            "tableName": 'user_tax',
            "tableFiles": ["id", "appid", "rate_name", "start_point", "end_point", "rate", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 用户模块：税收记录
         */
        "user_paytaxes": {
            "tableName": 'user_paytaxes',
            "tableFiles": ["id", "orderid", "appid", "userid", "order_name", "monthly", "rate", "amount", "tax", "taxed_income", "taxed_total", "status", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 用户模块：浏览记录
         */
        "user_userview": {
            "tableName": 'user_userview',
            "tableFiles": ["id", "userid", "appid", "type", "operid", "openid", "nickname", "headimg", "title", "content", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 用户模块：销售记录
         */
        "user_sales": {
            "tableName": 'user_sales',
            "tableFiles": ["id", "appid", "tag", "userid", "orderid", "name", "openid", "nickname", "headimg", "mobile", "product_id", "product_name", "type", "paytime", "worth", "status", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 用户模块：收货地址
         */
        "user_address": {
            "tableName": 'user_address',
            "tableFiles": ["id", "name", "mobile", "region", "street", "postcode", "telephone", "is_default", "sort", "status", "sponsor", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 用户模块：位置记录
         */
        "user_location_daily": {
            "tableName": 'user_location_daily',
            "tableFiles": ["id", "userid", "origin", "latitude", "longitude", "accuracy", "city", "citycode", "address", "location", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 用户模块：业务控制流程信息
         */
        "user_service_flow": {
            "tableName": 'user_service_flow',
            "tableFiles": ["id", "userid", "tag", "service_tag", "data_info", "verify_count", "verify_max", "status", "expire_time", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },

        /**
         * 微信模块：微信消息
         */
        "wechat_message": {
            "tableName": 'wechat_message',
            "tableFiles": ["id", "toUserName", "fromUserName", "createTime", "msgType", "message", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        /**
         * 房产数据：楼盘数据
         */
        "fang_loupan": {
            "tableName": 'fang_loupan',
            "tableFiles": ["id", "cityid", "citycode", "cityname", "name", "cover_url", "detail_url", "red_tag", "label", "region", "layout", "area", "price", "remark", "created_time", "created_id", "update_time", "update_id", "valid"]
        },
        "fang_house": {
            "tableName": 'fang_house',
            "tableFiles": ["id","cityid","citycode","cityname","type","name","cover_url","detail_url","xiaoqu","xiaoqu_url","layout","area","orientations","redecorated","lift","position","tag","district_tag","district_name","totalPrice","unitPrice","remark","created_time","created_id","update_time","update_id","valid"]
        },
        "fang_zufang": {
            "tableName": 'fang_zufang',
            "tableFiles": ["id","cityid","citycode","cityname","type","name","cover_url","detail_url","xiaoqu","xiaoqu_url","layout","area","orientations","redecorated","lift","position","tag","red_link","red_name","unitPrice","remark","created_time","created_id","update_time","update_id","valid"]
        },
    },
    "proc": {
        /**
         * 存储过程名称命名一致，描述功能分页获取biz_info的数据
         * 命名规则，手写存储过程usp_打头，后面跟数据表的前缀biz_，后面再跟功能名称，首字母小写（驼峰命名规则）
         * 参数规则：编写存储过程优先排列输入参数，后面再跟输出参数，没有输出参数可以忽略
         */
        "usp_biz_getBizInfoList": {
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