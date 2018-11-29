(function ($) {
	var docCxt = document.compatMode == 'CSS1Compat' ? document.documentElement: document.body;
	var w=window
	//游戏服务
	w.GAME = {
		id:null,
		socket:null,
		setup_data:function (ctx) {
			//发出获取当前游戏数据
			this.socket.emit('setup_canvas',{
				id:GAME.id,
				ship:ctx.ship,
				width:ctx.width,
				height:ctx.height,
                username:CHAT.username
			});
		},
		//获取后台数据
		setup_game:function (ctx) {
			//监听玩家的火箭
			this.socket.on('game_data',function(o){
				ctx.profit=o.profit;
				ctx.ships=o.ships;
				ctx.coins=o.coins;
                ctx.rocks=o.rocks;
                ctx.black_hole=o.black_hole;
				ctx.hit.explodes=o.explodes;
                ctx.hit.sparks=o.sparks;
                ctx.hue=o.hue;
                ctx.info_points=o.info_points;
				ctx.clear();
			});
			// 游戏结束
			this.socket.on('destory', function (o) {
                $('#restartbox').show();
            });
		},
		//按键控制
		move:function (ctx) {
			this.socket.emit('move',{
				id:this.id,
				w:(!!ctx.keys[87] || ctx.keys[38]),
				d:(!!ctx.keys[68] || ctx.keys[39]),
				s:(!!ctx.keys[83] || ctx.keys[40]),
				a:(!!ctx.keys[65] || ctx.keys[37]),
			})
		},
		// 窗体变化
		resize:function (ctx) {
			this.socket.emit('resize', {
				id:this.id,
                width:ctx.width,
                height:ctx.height,
			})
        },
		restart:function (ctx) {
			this.socket.emit('restart',{
				id:this.id,
                width:ctx.width,
                height:ctx.height,
			})
        }
	}
	//聊天服务
	w.CHAT = {
		msgObj:$('#message'),

		screenheight:w.innerHeight ? w.innerHeight : docCxt.clientHeight,
		username:null,
		userid:null,
		socket:null,
		//让浏览器滚动条保持在最低部
		scrollToBottom:function(){
			this.msgObj.scrollTop(this.msgObj.height());
		},
		//退出，本例只是一个简单的刷新
		logout:function(){
			//this.socket.disconnect();
			location.reload();
		},
		//提交聊天消息内容
		submit:function(){
			var content = $("#content").val();
			if(content != ''){
				var obj = {
					userid: this.userid,
					username: this.username,
					content: content
				};
				this.socket.emit('message', obj);
				$("#content").val('');
			}
			return false;
		},
		genUid:function(){
			return new Date().getTime()+""+Math.floor(Math.random()*899+100);
		},
		//更新系统消息，本例中在用户加入、退出的时候调用
		updateSysMsg:function(o, action){
			var system_txt;
			if(action == "login" || action == "logout"){
                //当前在线用户列表
                var onlineUsers = o.onlineUsers;
                //当前在线人数
                var onlineCount = o.onlineCount;
                //新加入用户的信息
                var user = o.user;
                //更新在线人数
                var userhtml = '';
                var separator = '';
                for(var key in onlineUsers) {
                    if(onlineUsers.hasOwnProperty(key)){
                        userhtml += separator+onlineUsers[key];
                        separator = '、';
                    }
                }
                $("#onlinecount").html( '当前共有 '+onlineCount+' 人在线，在线列表：'+userhtml);

                system_txt = "";
                system_txt += user.username;
                system_txt += (action == 'login') ? ' 加入了聊天室' : ' 退出了聊天室';

			}else if(action == "destory"){
                system_txt = "";
                system_txt += o.data.username;
                system_txt += "的飞船已经被摧毁"
			}
			if(system_txt){
                //添加系统消息
                var html = '';
                html += '<div class="msg-system">';
                html += system_txt;
                html += '</div>';
                var section = $('<section>');
                section.addClass( 'system');
                section.html(html);
                section.appendTo(this.msgObj);
                this.scrollToBottom();
			}
		},
		//第一个界面用户提交用户名并加入游戏
		usernameSubmit:function(){
			var username = $("#username").val();
			if(username != ""){
				$("#username").val('');
				$("#loginbox").css({'display':'none'});
				$("#gamebox").css({'display':'block'});
				this.init(username);
			}
			return false;
		},
		init:function(username){
			/*
			客户端根据时间和随机数生成uid,这样使得聊天室用户名称可以重复。
			实际项目中，如果是需要用户登录，那么直接采用用户的uid来做标识就可以
			*/
			this.userid = this.genUid();
			this.username = username;

			$("#showusername").text(this.username);
			this.scrollToBottom();

			//连接websocket后端服务器
			GAME.socket=this.socket = io.connect("https://codehub.gq", {
                path:"/app/realtime-astronavigation/socket.io"
            });
			//告诉服务器端有用户登录
			this.socket.emit('login', {userid:this.userid, username:this.username});
			//监听新用户登录
			this.socket.on('login', function(o){
				CHAT.updateSysMsg(o, 'login');
				var uid=o.user.userid;
				if(GAME.id===null&&uid===CHAT.userid){
					GAME.id=uid;
					window.start_game();
				}
			});

			//监听用户退出
			this.socket.on('logout', function(o){
				CHAT.updateSysMsg(o, 'logout');
			});

			//监听消息发送
			this.socket.on('message', function(obj){
				var isme = (obj.userid == CHAT.userid) ? true : false;
				var contentDiv = '<div>'+obj.content+'</div>';
				var usernameDiv = '<span>'+obj.username+'</span>';

				var section = $('<section>');
				if(isme){
					section.addClass('user');
					section.html(contentDiv + usernameDiv);
				} else {
					section.addClass('service');
					section.html( usernameDiv + contentDiv);
				}
				section.appendTo(CHAT.msgObj)
				CHAT.scrollToBottom();
			});
			this.socket.on('info', function (obj) {
				CHAT.updateSysMsg(obj, obj.action);
            })
		}
	};
	//通过“回车”提交用户名
	$("#username").keydown(function(e) {
		e = e || event;
		if (e.keyCode === 13) {
			CHAT.usernameSubmit();
		}
	});
	//通过“回车”提交信息
	$("#content").keydown(function(e){
		e = e || event;
		if (e.keyCode === 13) {
			CHAT.submit();
		}
	});
})("function" == typeof jQuery?jQuery:{fn:{}});
