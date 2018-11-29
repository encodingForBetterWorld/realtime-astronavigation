"use strict"
var app = require('express')();
var http = require('http').Server(app);
var app_url = process.env.APP_URL || "/"
var io = require('socket.io')(http, {
    path:app_url+"/socket.io"
});
var fs=require('fs');
var path = require('path');
var port = process.env.PORT || 3000;
var component_path=__dirname + '/component';
var express=require('express');
var self=this;
var client_path=path.join(__dirname,'../','client/');
//设置引擎
app.set("views",client_path);
app.set("view engine","ejs");
app.engine('.html',require('ejs').__express);
app.use(app_url, express.static(client_path)); // 设置静态文件目录

var walk = function(path) {
    fs
        .readdirSync(path)
        .forEach(function(file) {
            var newPath = path + '/' + file;
            var stat = fs.statSync(newPath);
            // 如果是js文件
            if (stat.isFile()) {
                if (/(.*)\.(js|coffee)/.test(file)) {
                    var cn=file.substr(0,file.lastIndexOf('.'));
                    self[cn]=require(newPath);
                }
                // 如果是文件夹则继续遍历
            }else if (stat.isDirectory()) {
                walk(newPath);
            }
        });
};
//加载组件
walk(component_path);
app.get(app_url,function (req,res) {
    res.render('index.html')
});
var game_ctx = new self.game(io);
var chat = new self.chat(io, game_ctx);
io.on('connection', function(socket){
    console.log('a user connected');
    chat.setup(socket);
    game_ctx.update(socket);
});
http.listen(port, function(){
    console.log('listening on *:' + port);
});