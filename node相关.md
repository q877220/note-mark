## windows环境设置
- [下载](https://npm.taobao.org/mirrors/)
- npm全局包及缓存路径设置
```
//查看相关路径： (其中prefix为全局包路径,cache为缓存路径)
npm config ls -l

//设置全局路径：
npm config set prefix  'XXX'

//设置缓存路径：
npm config set cache 'XXX'

//设置安装源：
npm set registry  "https://registry.npm.taobao.org"

//设置全局包搜索路径
export NODE_PATH=XXX
```