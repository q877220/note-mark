- 合并某个分支的单个commit
合并feature分支上的commit XXXX到master分支: 
1. git checkout master
2. git cherry-pick XXXX

- 合并某个分支上的一系列commits
假设你需要合并feature分支的commit XXX~YYY 到master分支:
1. 基于feature分支创建一个新的分支，并指明新分支的最后一个commit
2. rebase新分支的commit到master
>>将feature分支的commit XXX~YYY合并到master分支:
>> git checkout feature
>> git checkout -b newbranch XXX
>> git rebase --ontomaster YYY^

- 合并feature分支的某个文件(f.txt)到master分支上
1. git checkout master
2. git checkout --patch featrue f.txt

- 将feature分支的文件copy到master分支
1. git checkout master
2. git checkout feature f.txt

- 本地分支文件被删除后，拉取远程文件
1. 一个文件就：git checkout origin/master netpc.com.cn.txt
2. 所有文件：git checkout origin . 

- 远程分支强制覆盖本地
1. git reset --hard FETCH_HEAD
2. git pull

- 删除分支
1. 本地分支删除: git branch -d XXX
2. 远程分支删除: git push origin --delete XXX