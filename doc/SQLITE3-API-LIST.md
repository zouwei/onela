### SQLITE3-API-LIST

API
**1. new sqlite3.Database(filename,[mode],[callback])**
返回数据库对象并且自动打开和连接数据库
它没有独立打开数据库的方法
**2. sqlite3.verbose()**
集成数据库的执行模式，以便于调试，它没有重置的方法。
**3. Database#close([callback])**
关闭和释放数据库对象
**4. Database#run(sql,param,...],[callback])**
运行指定参数的SQL语句，完成之后调用回调函数，它不返回任何数据，在回调函数里面有一个参数，SQL语句执行成功，则参数的值为null,反之为一个错误的对象，它返回的是数据库的操作对象。在这个回调函数里面当中的this,里面包含有lastId(插入的ID)和change(操作影响的行数,如果执行SQL语句失败，则change的值永远为0);
**5. Database#get(sql,[param,...],[callback])**
运行指定参数的SQL语句，完成过后调用回调函数。如果执行成功，则回调函数中的第一个参数为null,第二个参数为结果集中的第一行数据，反之则回调函数中只有一个参数，只参数为一个错误的对象。

**6. Database#all(sql,[param,...],[callback])**
运行指定参数的SQL语句，完成过后调用回调函数。如果执行成功，则回调函数中的第一个参数为null,第二个参数为查询的结果集，反之，则只有一个参数，且参数的值为一个错误的对象。

**7. Database#prepare(sql,[param,...],[callback])**

预执行绑定指定参数的SQL语句，返回一个Statement对象，如果执行成功，则回调函数的第一个参数为null,反之为一个错误的对象。