/**
 * Created by yanghao on 2015/12/28.
 */
var async = require('async');
var config = require("config");
var m = {};


m.init = function (callback) {
    async.parallel([
            function (cb) {
                var mysql = require("mysql");
                var pool = mysql.createPool(config.get('global.mysql'));
                console.log("mysql poll is ready");
                cb(null, pool);
            }           //,
            //function (cb) {
            //    var redis = require("redis").createClient(config.get('global.redis.port'), config.get('global.redis.host'), config.get('global.redis'));
            //    redis.on("error", function (err) {
            //        console.log("Error " + err);
            //    });
            //
            //    redis.on("connect", function (err) {
            //        console.log("redis is connected");
            //        if (cb) cb(null, redis);
            //        cb = null;
            //    });
            //},
            //function (cb) {
            //    var MongoClient = require('mongodb').MongoClient;
            //    MongoClient.connect(config.get('global.mongodb.url'),
            //        function (err, db) {
            //            if (err == null) console.log("mongodb is connected");
            //            cb(err, db);
            //        });
            //}
        ], function (err, data) {
            m.db = data[0];
            //m.redis = data[1];
            //m.mongo = data[2];
            //m.socketio = data[3];
            callback(err, data);

        }
    )
};


module.exports = exports = m;