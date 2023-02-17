## windows环境设置
- [下载](https://npm.taobao.org/mirrors/)
- npm全局包及缓存路径设置
```
//查看相关路径： (其中prefix为全局包路径,cache为缓存路径)
npm config ls -l

//设置全局路径： (如: XXX为'/usr'则全局安装的模块路径为/usr/lib/node_modules)
npm config set prefix  'XXX'

//设置缓存路径：
npm config set cache 'XXX'

//设置安装源：
npm set registry  "https://registry.npm.taobao.org"

//设置全局包搜索路径
export NODE_PATH=XXX  (路径必须包含node_modules)
```

## nodejs core文件调试
- [安装lldb](https://github.com/llvm-mirror/lldb/)
- [安装llnode](https://github.com/nodejs/llnode)
- 安装过程
```
1. $ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash  //安装nvm，如果下载install.sh文件失败，则可以从git打开此项目直接复制该文件到本地，然后手工执行

2. $ nvm node-version

3. $ apt-get install lldb

4. $ npm install -g llnode

5. $ llnode node -c core-file  //分析core文件， v8 bt

注: 1. node推荐使用nvm安装
    2. 若llnode下载失败则设置ubuntu代理进行安装， export http_proxy=http://ip:port

```