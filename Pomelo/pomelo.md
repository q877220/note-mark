# 基本概念
1. session FrontendSession BackendSession SessionService BankendSessionService
```
  a. session是客户连接的一个抽象
  {
    id : <session id> // readonly
    frontendId : <frontend server id> // readonly
    uid : <bound uid> // readonly
    settings : <key-value map> // read and write  
    __socket__ : <raw_socket>
    __state__ : <session state>

    // ...
}

  b. FrontendSession可视作session的一个映象，FrontendSession设置settings属性后，可通过push方法将属性值同步到session
  c. FrontendSession通过bind方法可以将uid绑定到session
  e. BackendSession与FrontendSession类似，它由BackendSessionService创建、维护
```
2. 扩展服务时需要指定路由策略使各服务的负载均衡，默认策略是取uid的crc32校验和“模”服务节点个数一般步骤如下：
    - 定义路由策略
    - 通过在app.configure函数的回调函数中调用app.route来使路由生效
    注： app.configure用于向指定环境的指定服务加载配置(加载路由、加载filter、加载组件)
    ```
        var chatRoute = function (session, msg, app, cb) {
        var chatServers = app.getServersByType ('chat');

        if (! chatServers | | chatServers.length === 0) {
            cb (new Error ('can not find chat servers.'));
            return;
        }

        var res = dispatcher.dispatch (session.get ('rid'), chatServers);
            cb (null, res.id);
        };

        app.configure ('production|development', function() {
        app.route ('chat', chatRoute);
        });
    ```
3. filter分为before/after，before用来做一些预处理工作，after做清理工作（在after中不能修改响应用户的内容，因为此时响应已经完成），添加步骤：
   - 定义before after方法
   - 在app.configure方法的回调函数中，调用app.filter(before/after都定义)或app.before(只定义before)或app.after(只定义after)使用filter生效
4. 路由压缩：将路由路径(如：chat.chatHandler.send)映射为一个小的整型数字。目前该功能仅支持hydridconnector模式，该模式在客户端与服务端握手阶段同步字典(服务端config/dictionary.json)
    ```
        // dictionary.json
        [
          "onChat",
          "onAdd",
          "onLeave"
        ]
        // app.js
        app.configure('production|development', 'connector', function() {
          app.set ('connectorConfig', {
            connector: pomelo.connectors.hydridconnector,
            heartbeat: 3,
            useDict: true // enable dict
          });
        });

        app.configure('production|development', 'gate', function() {
          app.set ('connectorConfig', {
            connector: pomelo.connectors.hydridconnector,
            useDict: true // enable dict
          });
        });
    ```
5. Protobuf压缩，其配置方法与“路由压缩”类似(在'connectorConfig'中加入useProtobuf: true)
6. handler目录可被client直接访问，可视作connector组件; remote目录用于服务间的调用，可视作servers组件

# 组件相关
1. 加载组件步骤：
    a. 根据业务逻辑定义好相关组件的工厂方法(主要定义生命周期各阶段业务start afterStart stop)
    b. 通过app.load加载相关组件
2. master和monitor的定位：两者主要用于服务管理，master作为服务端监听端口，monitor作为客户端连接(该组件被所有的服务加载，包括master)。通信模式如下:
    - pull: master周期性的发送监控指令到monitor，后者收到指令后以相关信息回应
    - push: monitor周期性的向master上报自身的监控信息
3. Connector组件依赖于session组件、server组件、pushscheduler组件和connection组件，该组件只能被frontend server加载，该组件监听clientPort端口，并接收客户端的连接。该组件与客户端的交互方式如下：
    a. client发送连接请求
    b. Connector组件接收请求，并请求session组件产生该client对应的session
    c. Connector组件将client对应的session信息报告给connection组件(用于统计)
    d. 服务端处理完请求后，将响应信息返回给Connector组件
    e. 为了提高带宽使用率，Connector组件并不直接将响应信息返回给client,而是将信息放入缓存
    d. pushscheduler组件根据调试策略将信息返回给client
4. Session组件只能被frontend servers加载，该组件主要用于描述用户的会话信息。该组件被加载后将在全局上下文中添加sessionService属性，通过app.get('sessionService')可以获取会话信息。一个session对应一个连接，当一个客户从多个客户端登录时该客户对应多个session。 加载该组件时可通过'singleSession'设置是否允许一个用户从多端登录，默认是允许(false)
5. Connection组件同样只能被frontend servers加载，它是'connectionService'的组件包装器。该组件主要用于统计工作，当用户登录或登出时，connector组件会报告相关信息给该组件
6. Server组件被除master以外的所有服务加载，Server组件加载它的Handlers和Filters。当从Connector组件接收到请求时，使用它的before-filter-chain来预处理请求，然后使用Handler进行业务逻辑处理并返回响应级Connector，最后使用after-filter-chain作一引起清理工作。banckend servers并不直接接收client的请求，请求由client发送给frontend server，然后由frontend server通过RPC调用benckend server。RPC调用基于内建的'msgRemote'
7. Pushscheduler组件只能被frontend server加载。当Connector组件从backend server收到响应或推送信息后并不自己处理，而是将其调试到该组件。该组件提供两种调试策略:
    - 无缓冲，直接发送报文到client
    - 有缓冲，周期性的发送报文到client
    ```
        app.set('pushSchedulerConfig', {scheduler: pomelo.pushSchedulers.buffer, flushInterval: 20});
    ```
8. Proxy组件被除master以外的所有服务加载，服务间RPC交互时，该组件合建RpcClient与远端服务进行通信(作为RPC通信的客户端)
9. Remote组件被除master以外的所有服务加载，与Proxy相对应，Remote根据配置监听相应端口接收Proxy组件的连接(作为RPC通信的服务端)
10. Dictionary组件只有Connector组件启动useDict时才加载，它遍历当前服务的所有路由，并根据配置文件将每条路由对应成一个小的整型数字
11. Protobuf组件，当Connector组件启动'useProtobuf'功能时加载该组件，该组件进行消息的压缩与解压工作
12. Channel组件被除master以外的所有服务加载，它是'channelService'的组件包装器。Channel可以视作登录用户的一个集合，开发者可以通过该组件进行消息的广播
13. BackendSession组件被除master以外的所有服务加载，它是'BackendSessionService'的组件包装器，它可以通过RPC的方式修改原始session信息

# Frontend server与client通信
- 

# 问题汇总
1. 如何执行到component的stop回调？

# source code mark
1. node.js[精灵进程启动方法](https://nodejs.org/docs/latest-v10.x/api/child_process.html#child_process_options_detached, '官网示例')
```
const { spawn } = require('child_process');

const subprocess = spawn(process.argv[0], ['child_program.js'], {
  detached: true,  //父进程退出后，子进程可以仍然可以运行
  stdio: 'ignore'  //断开继承自父终端的STDIO
});

subprocess.unref();  //调用该方法后父进程将不会等待子进程退出
```
2. pomelo项目启动时，环境变量获取顺序。(实例根据环境变更从config/servers.json中加载相关配置)
```
//启动参数中env->NODE_ENV环境变量->默认的development
var setupEnv = function(app, args) {
  app.set(Constants.RESERVED.ENV, args.env || process.env.NODE_ENV || Constants.RESERVED.ENV_DEV, true);
};
```
3. pomelo项目启动顺序([框架执行流](https://github.com/NetEase/pomelo/wiki/Framework-execution-flow))
```
    a. 通过pomelo命令行启动，如：
        pomelo start -e localhost -t macher //node执行pomelo脚本
    b. 命令行以child_process.spawn方法启动子进程（根据命令行拼接参数），如：
        node /root/mjserver/game-server/app.js env=localhost type=macher
    c. 上步中进程通过env,type从配置文件({projectRoot}/config/servers)中找到指定服务参数，并以child_porcess的spawn方法启动子进程，如下：
        node /root/mjserver/game-server/app.js env=localhost restart-force=false auto-restart=false id=matcher0000 host=127.0.0.1 port=5050 serverType=matcher
```
4. master服务启动过程：
```
    a. 通过pomelo命令行启动，如：
        pomelo start -e localhost -t master //node执行pomelo脚本
    b. 命令行以child_process.spawn方法启动子进程（根据命令行拼接参数），如：
        node /root/mjserver/game-server/app.js env=localhost type=master
        b.1: 将pomelo包的lib目录下的components,filters,pushSchedulers,connectors等组件添加到Pomelo对象的相应属性（部分属性类型为function）
        b.2: 加载master,monitor组件（将两个组件的实例添加到App的loaded数组，同时在App的components对象中以键值对<实例名称，实例>维护
            //以master组件为例说明加载过程
            b.2.1: master实例成员masterConsole是ConsoleService类的一个实例
            b.2.2: ConsoleService类成员agent是MasterAgent类的一个实例
            b.2.3: MasterAgent类的listen方法用于启动mqtt服务端，并监听mqtt客户端发射的消息
            注：事件由mqtt链接发射到mqtt服务端->mqtt服务端将消息抛出到MasterAgent实例
        b.3: 执行lifecycleCbs对象的beforeStartup方法（如有， 每个服务都可以在{projectRoot}/app/servers/{type}/lifecycle.js配置）
        b.4: 按顺序执行b.2中添加的组件的start方法
            //以master组件为例说明start方法
            b.4.1: 注册默认的模块（pomelo/lib/modules/masterwatcher,pomelo/lib/modules/console,pomelo-admin/lib/modules/watchServer），即：将这些模块导出到APP的__modules__属性上（{moduleId:'模块名', module:'模块导出的函数', opts:'注册时传入的参数'}）
            b.4.2: 加载模块，即：遍历APP.__modules__所有属性，并执行module方法，并将返回实例注册到consoleService对象同时将实例追加到Master实例的modules数组属性中
            b.4.3: 调用Master实例masterConsole属性的start方法
                b.4.3.1: ConsoleService实例调用其agent（MasterAgent类）成员的listen方法
                b.4.3.2: 将agent监听到事件发射到ConsoleService实例
                b.4.3.3: 将consoleService成员modules中的所有模块enable设置true （如果是定时模块则加入注册到定时任务中）


        b.5: 按顺序执行b.2中添加的对象的afterStart方法
        b.6: 执行lifecycle对象的afterStartup方法
        b.7: app实例发射start_server事件（monitor中监听该事件）
```


| 系统    | 账号 |     权限 |
| :------ | :-- | :------- |
| 统计后台  |  18501252389  | 所有包、联运统计数据查看权限 |
|CRM      | 蔡旭欣    | 查看所有包运营数据|
| 贵州麻将 |  983547  | 运营数据查看权限 |
| 诚誉天下 |  chengyu_beian  | 备案 |
|乐玩     | jxlw_beian|备案|
|中胜元鑫  | zsyxbeian |备案|
|阿里云    | 嘉兴瑞锦   |备案|
|南方龙    | 1416276758@qq.com |备案|
|增值企业安全防护管理系统|administrator@lewangame.net|