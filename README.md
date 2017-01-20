![CI Status](https://api.travis-ci.org/cloes/wxBot.svg?branch=master)

# weixin-robot

这是一个微信机器人，是本人在学习使用Node.js的过程中，为激发自身的学习热情而做的项目。同时该项目也是为了解决在"聊聊架构"微信群在技术分享过程中消息自动转发的问题。

消息源---------------自动转发---------------->多个目标群

## 0. 问题的提出
在"聊聊架构"有多个微信群，群内定期有技术专家进行技术分享，但是由于嘉宾只在一个群中分享，其他的群都需要“手动”转发信息，这样无造成了极大的人力资源浪费，因此有了编写一个自动转发工具的念头。

## 1. 工具的技术选型
在项目前确定技术选型是一个重要的事情，搜索一番后，发现github上存在不少微信机器人，但是很多都是用于“新成员进群问好”、“发送天气信息”等，而且因为要监视新成员进群和群友的提问，所以这些程序大部分需要部署在服务器上作长时间的运行。

但是“聊聊架构”这边不需要这样的功能，我们只需要在特定的时间、特定的地点、特定的人的信息转发到其他群即可，因此考虑编写一个客户端程序，在考虑到“聊聊架构”的志愿者团队中使用了多种操作系统，因此跨平台是必须的，因此放弃的最初的技术选型.net,改用Node + Electron的技术形式。


## 2. 工具的功能

### 2.1 已经实现的功能
- 文字信息的转发
- 图片的转发

### 2.2 尚未实现的功能
- 对微信消息中连接消息的转发
- 引入持久化存储，记录每次转发的消息
- 完善log日志（目前很多log语句被注释掉，log的格式也不一致）

## 3. 工具的安装和使用

### 3.1 工具的安装
将源代码下载下来后，进入项目的根目录，执行以下命令安装依赖关系：

`
npm install
`

这样依赖关系就安装完成，遇到npm安装缓慢，需要设置镜像的同学可以看我的blog文章https://my.oschina.net/cloes/blog/825028

接着运行

`
npm start
`

开启程序，如图：

![启动图片](https://cloud.githubusercontent.com/assets/5997418/21980021/701663ee-dc1c-11e6-8b59-4ad0026cf5e0.png)

此时，后台终端也在输出调试信息：

![终端调试信息](https://cloud.githubusercontent.com/assets/5997418/21980686/327b9e2a-dc1f-11e6-8ed2-0d896402f9fb.png)

然后用手机微信程序扫描二维码，此时点击消息源就会显示群组和群组内的用户：

选择群组：

![选择群组](https://cloud.githubusercontent.com/assets/5997418/21980489/8d201b90-dc1e-11e6-932b-f6b415ec4aff.png)

选择群组后，选择用户(支持多选)：

![选择用户](https://cloud.githubusercontent.com/assets/5997418/21980571/ca684996-dc1e-11e6-9993-047edefd85af.png)

图中的三个用户的发言就会被转发到“目标群”

选择目标群(支持多选):

![选择目标群](https://cloud.githubusercontent.com/assets/5997418/21980734/66b33acc-dc1f-11e6-9fe1-d75d11cba38e.png)

点击确定后，程序开始进入监听转发状态。


**注意：** 只有在群设置里面设置了“保存到通讯录”的群组才会显示在下拉框里面

![保存到通讯录](https://cloud.githubusercontent.com/assets/5997418/21980948/2d532070-dc20-11e6-9b86-1f5777771462.png)

至此，设置完成，工具就会静静的工作，终端也会输出调试信息，如图：

![终端输出](https://cloud.githubusercontent.com/assets/5997418/21981041/9cad28e4-dc20-11e6-81a9-9a2b8884dd0e.png)


## 4.例子

### 需求

源头群：“来源群”中的cloes用户的发言

目标群：3个“目标群”，分别是目标群1、目标群2、目标群3

动作：当cloes在来源群发言的时候，自动将内容转发到3个目标群

### 设置

1. 设置“来源群”

![选择来源群](https://cloud.githubusercontent.com/assets/5997418/22145084/e4ff3c78-df3a-11e6-8a65-89ffc2db587f.png)

2. 设置“来源群”中的消息来源用户

![选择来源用户](https://cloud.githubusercontent.com/assets/5997418/22145143/1940df32-df3b-11e6-9184-da44ad08eddd.png)

3. 设置3个“目标群”

![设置目标群](https://cloud.githubusercontent.com/assets/5997418/22145174/344675f8-df3b-11e6-8668-3673c9d2b854.png)

4. 效果

当“来源群”的cloe发布消息后，消息将会被自动转发到其他的3个“目标值”

![转发效果](https://cloud.githubusercontent.com/assets/5997418/22145417/3e873d62-df3c-11e6-91ac-08410e9d5f17.png)


## 5.bug提交

各位如果遇到问题，欢迎提交到issues.







