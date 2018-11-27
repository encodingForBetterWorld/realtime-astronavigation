/**
 * Created by lenovo on 2016/12/18.
 */
"use strict"
class Chat{
    constructor(io, game_ctx){
        this.io = io;
        this.game_ctx = game_ctx;
        this.onlineUsers = {};
        this.onlineCount = 0;
    }
    setup(socket){
        var self=this;
        //监听新用户加入
        socket.on('login', function (obj) {
            //将新加入用户的唯一标识当作socket的名称，后面退出的时候会用到
            socket.name = obj.userid;
            //检查在线列表，如果不在里面就加入
            if (!self.onlineUsers.hasOwnProperty(obj.userid)) {
                self.onlineUsers[obj.userid] = obj.username;
                //在线人数+1
                self.onlineCount++;
            }
            //向所有客户端广播用户加入
            self.io.emit('login', {
                onlineUsers: self.onlineUsers,
                onlineCount: self.onlineCount,
                user: obj
            });
            console.log(obj.username + '加入了聊天室');
        });

        //监听用户退出
        socket.on('disconnect', function () {
            //将退出的用户从在线列表中删除
            if (self.onlineUsers.hasOwnProperty(socket.name)) {
                //退出用户的信息
                var obj = {userid: socket.name, username: self.onlineUsers[socket.name]};

                //删除
                delete self.onlineUsers[socket.name];
                delete self.game_ctx.ships[socket.name];
                delete self.game_ctx.socks[socket.name];
                //在线人数-1
                self.onlineCount--;

                //向所有客户端广播用户退出
                self.io.emit('logout', {onlineUsers: self.onlineUsers, onlineCount: self.onlineCount, user: obj});
                console.log(obj.username + '退出了聊天室');
            }
        });
        //监听用户发布聊天内容
        socket.on('message', function (obj) {
            //向所有客户端广播发布的消息
            self.io.emit('message', obj);
            let ship=self.game_ctx.ships[socket.name]
            ship.msg=obj.content;
            ship.msgTime =+ new Date;
            console.log(obj.username + '说：' + obj.content);
        });
    }
}
module.exports=Chat