"use strict"
var utils=require('./utils.js')
var ship_imgs = new Map()
    .set(1,{width:117,height:58})
    .set(2,{width:109,height:61})
    .set(3,{width:119,height:70})
    .set(4,{width:132,height:64});
var rock_imgs = new Map()
    .set(1,{width:156,height:156})
const global_with = 5000, global_height = 5000;
//全局画布
class Context{
    constructor(io){
        this.io=io;
        this.width=global_with;
        this.height=global_height;
        this.magnetRange = 250;
        this.hue = 60;
        this.ndt = 1;
        //金币
        this.coins = [];
        //飞船
        this.ships = {};
        //陨石
        this.rocks = [];
        //撞击点
        this.hits = [];
        //
        //黑洞
        this.black_holes = [new BlackHole(2000,2000,true),new BlackHole(4000,4000,false)];
        this.socks = {};
        var self = this;
        setInterval(function() {
            if(self.coins.length<20)self.coins.push(new Coin(utils.random(0,self.width), utils.random(0,self.height),Math.floor(utils.random(1, 100))));
        }, 200);
        setInterval(function() {
            if(self.rocks.length<8)self.rocks.push(new Rock(utils.random(0,self.width), utils.random(0,self.height),1));
        }, 500);
        setInterval(function () {
            self.hue += 0.75;
            //金币动画
            let i=self.coins.length;
            while (i--){
                self.coins[i].update(self,i)
            }
            i=self.rocks.length;
            while (i--){
                self.rocks[i].update(self);
            }
            i=self.black_holes.length;
            while (i--){
                self.black_holes[i].update(self);
            }
            i=self.hits.length;
            while(i--){
                let hit=self.hits[i];
                if(hit.isShow)hit.update()
                else self.hits.splice(i,1)
            }
            let ship_ids = Object.keys(self.ships);
            for(let i=0; i < ship_ids.length; i++){
                let sid = ship_ids[i];
                let ship = self.ships[sid];
                if(!ship.is_destory){
                    ship.update(self);
                    let k = self.rocks.length;
                    while (k--){
                        let rock = self.rocks[k];
                        let c = ship.collide(rock);
                        if(c instanceof Array){
                            ship.hit=true;
                            ship.hit_begin_time =+ new Date;
                            ship.health -= ship.v;
                            ship.hit_eff_time = 100*ship.v
                            //产生撞击点
                            self.hits.push(new Collision(c[0],c[1],20*ship.v));
                            //陨石运动
                            rock.vx=ship.vx;
                            rock.vy=ship.vy;
                            if(ship.health <= 0){
                                ship.destory(self);
                                break
                            }
                        }
                    }
                    for(let j=i+1; j < ship_ids.length; j++){
                        let other_ship = self.ships[ship_ids[j]];
                        if(ship.collide(other_ship)){
                            other_ship.hit=ship.hit=true;
                            other_ship.hit_begin_time =+ new Date;
                            ship.hit_begin_time =+ new Date;
                            other_ship.hit_eff_time=ship.hit_eff_time = 300;
                        }
                    }
                }
                //发送数据给客户端
                let cx,cy;
                let w=ship.screenWidth, h=ship.screenHeight;
                cx=ship.xMin-(w-ship.bWidth)/2;
                cy=ship.yMin-(h-ship.bHeight)/2;
                cx=utils.between(cx,0,self.width-w);
                cy=utils.between(cy,0,self.height-h);
                let cam = new Camera(cx,cy,w,h,ship.profit);
                cam.lookAt(self);
                self.socks[sid].emit('game_data', cam);
            }
        },20);
    }
    update(socket){
        let self=this;
        //记录下用户的火箭
        socket.on('setup_canvas',function (data) {
            self.ships[socket.name]=new Ship(
                utils.random(0,self.width-data.width),
                utils.random(0,self.height-data.height),
                data.width,
                data.height,
                data.username,
                socket.name);
            self.socks[socket.name]=socket;
        });
        //监听用户的操作
        socket.on('move',function (data) {
            let msh=self.ships[socket.name];
            msh && msh.move(data);
        });
        // 窗口变化
        socket.on('resize',function (data) {
            let msh=self.ships[socket.name];
            if(msh){
                msh.screenWidth=data.width
                msh.screenHeight=data.height
            }
        });
        //重新开始
         socket.on('restart', function (data) {
             let msh=self.ships[socket.name];
             if(msh){
                 msh.resume(
                     utils.random(0,self.width-data.width),
                     utils.random(0,self.height-data.height),
                     data.width,
                     data.height
                 );
             }
         })
    }
    * ship_values(){
        for(let sid in this.ships){
            let ship = this.ships[sid]
            if(ship.is_destory)continue;
            yield ship
        }
    }
}

class Entity{
    constructor(x, y, oid){
        this.x = x;
        this.y = y;
        this.oid = oid;
    }
    update(){}
    collide(entity){
        let rect, circle, rect0, ret;
        if(this instanceof Rect){
            rect = this;
            if(entity instanceof Rect)rect0=entity;
            else if(entity instanceof Circle)circle=entity;
        }
        else if(this instanceof Circle){
            circle = this;
            if(entity instanceof Rect)rect=entity;
        }
        if(rect && circle){
            ret = utils.collide_rect_circle(rect, circle);
        }else if (rect && rect0){
            ret = utils.collide_2_rect(rect, rect0);
        }
        return ret
    }
}
class Circle extends Entity{
    constructor(x, y, radius, oid){
        super(x, y, oid);
        this.radius = radius;
    }
}
class Rect extends Entity{
    constructor(x, y, width, height, oid){
        super(x, y, oid);
        this.width = width;
        this.height = height;
    }
}

class Spark extends Circle{
    constructor(x, y, radius){
        super(x, y, radius);
        this.move_angle=utils.random(0,Math.PI*2)
        this.move_range=utils.random(20,radius)
        this.move_dist=0
        this.v=6;
        this.isShow=!0;
    }
    update(){
        if(this.move_dist<this.move_range){
            this.move_dist+=this.v
            this.x+=Math.cos(this.move_angle)*this.v
            this.y+=Math.sin(this.move_angle)*this.v
        }
        else {
            this.isShow=!1;
        }
    }
}

class Explode extends Circle{
    constructor(x, y, range){
        super(x, y, 0);
        this.range=range;
        this.v=10;
        this.isShow=!0;
    }
    update() {
        if(this.radius<this.range){
            this.radius+=this.v
        }else {
            this.isShow=!1;
        }
    }
}

class Collision extends Circle{
    constructor(x, y, force){
        super(x, y, force);
        this.force = force;
        this.isShow=!0;
        this.sparks=[];
        var count=10
        while (count--){
            this.sparks.push(new Spark(x,y,this.force))
        }
        this.explode=new Explode(x,y,this.force)
    }
    update() {
        this.explode.update();
        this.isShow=this.explode.isShow;
        var i = this.sparks.length;
        while (i--) {
            let spark=this.sparks[i]
            spark.update()
            this.isShow=this.isShow||spark.isShow
        }
    }
}
//镜头
class Camera {
    constructor(x, y, width, height, profit){
        this.x=x;
        this.y=y;
        this.width=width;
        this.height=height;
        this.hue = 0;
        //镜头中的火箭
        this.ships=[]
        //镜头中的金币
        this.coins=[]
        //镜头中的陨石
        this.rocks = []
        //镜头中的黑洞
        this.black_hole = {}
        //撞击点
        // this.hits=[]
        this.explodes=[]
        this.sparks=[]
        this.profit=profit
    }
    lookAt(ctx){
        var coins,rocks,hits,self=this;
        var top=this.y,bottom=this.y+this.height;
        var left=this.x,right=this.x+this.width;
        coins=ctx.coins;
        this.hue = ctx.hue;
        coins.forEach(function (coin) {
            if(coin.x>left && coin.x<right
                && coin.y>top && coin.y<bottom){
                self.coins.push(utils.locateInCamera(self,coin))
            }
        })
        rocks=ctx.rocks;
        rocks.forEach(function (rock) {
            if(rock.x+rock.halfWidth>left && rock.x-rock.halfWidth<right
                && rock.y+rock.halfHeight>top && rock.y-rock.halfHeight<bottom){
                self.rocks.push(utils.locateInCamera(self,rock))
            }
        })
        for(let ship of ctx.ship_values()){
            if(ship.xMin && ship.xMin+ship.bWidth/2>left && ship.xMin-ship.bWidth/2<right
                && ship.yMin &&ship.yMin+ship.bHeight/2>top && ship.yMin-ship.bHeight/2<bottom){
                self.ships.push(utils.locateInCamera(self,ship))
            }
        }
        ctx.black_holes.forEach(function (bla) {
            if(bla.x+bla.outRadius >left && bla.x-bla.outRadius<right && bla.y+bla.outRadius>top && bla.y-bla.outRadius<bottom){
                self.black_hole=utils.locateInCamera(self,bla)
            }
        })
        hits=ctx.hits;
        hits.forEach(function (hit) {
            if(hit.x+hit.radius >left && hit.x-hit.radius<right && hit.y+hit.radius>top && hit.y-hit.radius<bottom){
                //定位爆炸
                self.explodes.push(utils.locateInCamera(self,hit.explode))
                //定位火花
                var i=hit.sparks.length
                while(i--){
                    self.sparks.push(utils.locateInCamera(self,hit.sparks[i]))
                }
            }
        })
    }
}
class Rock extends Circle{
    constructor(x, y, level){
        var width = rock_imgs.get(level).width;
        super(x, y, width/2);
        this.vx=0;
        this.vy=0;
        this.level=level;
        this.width = width;
        this.height=rock_imgs.get(level).height;
        this.halfWidth=this.width/2;
        this.halfHeight=this.height/2;
        this.hit=false;
        this.catch=false;
    }
    update(){
        this.x+=this.vx;
        this.y+=this.vy
        this.vx*=0.95
        this.vy*=0.95
    }
}

class BlackHole extends Entity{
    constructor(x, y, isBlack){
        super(x, y);
        this.outRadius=559/2;
        this.inRadius=204/2;
        this.isBlack=isBlack;
        //引力场范围
        this.gravitationRange = 500;
        this.inRotaionSpeed = 0.003;
        this.outRotationSpeed = 0.002;
        this.inRotation = 0;
        this.outRotation = 0;
    }
    update(ctx){
        if(this.isBlack){
            this.inRotation+=this.inRotaionSpeed;
            this.outRotation+=this.outRotationSpeed;
        }
        else {
            this.inRotation-=this.inRotaionSpeed;
            this.outRotation-=this.outRotationSpeed;
        }
        //黑洞吸引&白洞排斥的物理效果
        var rocks,ships,anotherHole;
        rocks=ctx.rocks;
        anotherHole=(ctx.black_holes[0].isBlack!=this.isBlack)?ctx.black_holes[0]:ctx.black_holes[1];
        var self=this;
        rocks.forEach(function (rock) {
            var dx,dy,dist,angle,mvx,mvy,power
            dx = rock.x + rock.width / 2 - self.x;
            dy = rock.y + rock.height / 2 - self.y;
            //环绕半径
            dist = Math.sqrt(dx * dx + dy * dy);
            //环绕角度
            angle = Math.atan2(dy, dx);
            //角速度
            mvx = Math.cos(angle);
            mvy = Math.sin(angle);
            power = 3 + (100 / dist);
            rock.catch=true;
            if (dist <= self.gravitationRange) {
                //黑洞吸引
                if(self.isBlack) {
                    //从白洞中出现
                    if (dist <= 15){
                        rock.x=anotherHole.x;
                        rock.y=anotherHole.y;
                    }
                    //陨石做向心圆周运动
                    else {
                        if (rock.width >15)rock.width -= 0.05 * power;
                        if (rock.height >15)rock.height -= 0.05 * power;
                        rock.x -= (mvx * power);
                        rock.y -= (mvy * power);
                    }
                }
                //白洞排斥
                else{
                    //陨石做离心圆周运动
                    if (rock.width <= rock_imgs.get(rock.level).width)rock.width += 0.05 * power;
                    if (rock.height <= rock_imgs.get(rock.level).height)rock.height += 0.05 * power;
                    rock.x += (mvx * power);
                    rock.y += (mvy * power);
                }
            }
            else {
                rock.catch=false;
                rock.rotation=0;
                rock.rotationSpeed=0;
                rock.rotationRadius=0;
            }
        })
        for (let ship of ctx.ship_values()){
            let dx,dy,dist,angle,mvx,mvy,power
            dx = ship.x + ship.width / 2 - self.x;
            dy = ship.y + ship.height / 2 - self.y;
            //环绕半径
            dist = Math.sqrt(dx * dx + dy * dy);
            //环绕角度
            angle = Math.atan2(dy, dx);
            //角速度
            mvx = Math.cos(angle);
            mvy = Math.sin(angle);
            power = 1 + (100 / dist);
            if (dist <= self.gravitationRange) {
                //黑洞吸引
                if(self.isBlack) {
                    if (dist <= 15){
                        ship.x=anotherHole.x;
                        ship.y=anotherHole.y;
                        ship.health-=10;
                        ship.inhole=false;
                        if(ship.health <= 0){
                            ship.destory(ctx);
                            continue;
                        }
                    }
                    //陨石做向心圆周运动
                    else {
                        ship.inhole=true;
                        ship.x -= (mvx * power);
                        ship.y -= (mvy * power);
                        if (ship.width >25)ship.width -= ship.width * 0.001 * power;
                        if (ship.height >10)ship.height -= ship.height * 0.001 * power;
                    }
                }
                else{
                    //陨石做离心圆周运动
                    ship.outhole=true;
                    ship.x += (mvx * power);
                    ship.y += (mvy * power);
                    if (ship.width <= ship_imgs.get(ship.level).width)ship.width += ship.width * 0.01 * power;
                    if (ship.height <= ship_imgs.get(ship.level).height)ship.height += ship.height * 0.01 * power;
                }
            }
            else {
                if(self.isBlack)ship.inhole=false;
                else ship.outhole=false;
            }
        }
    }
}

class Coin extends Circle{
    constructor(x, y, value){
        super(x, y, 4)
        this.vx = utils.random(-0.5, 1);
        this.vy = utils.random(-0.5, 1);
        this.value = value;
        this.magnetized = false;
        this.xScale = 1;
        this.xScaleGrow = true;
        this.collected = false;
        this.alpha = 0;
        this.cv = 0;
    }
    update(ctx, i){
        var scaleChange;
        if (this.alpha < 1 && !this.collected) {
            this.alpha += 0.05 * ctx.ndt;
        }
        if (this.xScaleGrow && this.xScale >= 1) {
            this.xScaleGrow = false;
        } else if (!this.xScaleGrow && this.xScale <= 0.1) {
            this.xScaleGrow = true;
        }
        scaleChange = this.magnetized ? 0.15 : 0.05;
        if (this.xScaleGrow) {
            this.xScale += scaleChange;
        } else {
            this.xScale -= scaleChange;
        }
        if (!this.collected) {
            var self=this;
            (function () {
                var angle, dist, dx, dy, mvx, mvy, power;
                for(let ship of ctx.ship_values()){
                    dx = ship.x + ship.width / 2 - self.x;
                    dy = ship.y + ship.height / 2 - self.y;
                    dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= ctx.magnetRange) {
                        self.magnetized = true;
                        angle = Math.atan2(dy, dx);
                        mvx = Math.cos(angle);
                        mvy = Math.sin(angle);
                        power = 3 + (100 / dist);
                        self.x += (mvx * power) * ctx.ndt;
                        self.y += (mvy * power) * ctx.ndt;
                    } else {
                        self.magnetized = false;
                        self.x += self.vx * ctx.ndt;
                        self.y += self.vy * ctx.ndt;
                    }
                    if (dist <= Math.sqrt((ship.width * ship.width) + (ship.height * ship.height))/2) {
                        // ship.flashFlag = true;
                        ship.profit += self.value;
                        self.collected = true;
                        self.magnetized = false;
                    }
                }
            })()
        } else {
            this.alpha -= 0.03 * ctx.ndt;
            this.cv += 0.15 * ctx.ndt;
            this.y -= this.cv * ctx.ndt;
        }
        if (this.outOfBounds(ctx)) {
            return ctx.coins.splice(i, 1);
        }
    }
    outOfBounds(ctx) {
        return this.x > ctx.width + this.radius || this.x < -this.radius || this.y > ctx.height + this.radius || this.y < -this.radius;
    }
}
class Ship extends Rect{
    constructor(screenX, screenY, screenWidth, screenHeight, username, oid){
        let level = 1;
        let ship_img = ship_imgs.get(level);
        let width = ship_img.width;
        let height = ship_img.height;
        let x = screenX+(screenWidth-width)/2;
        let y = screenY+(screenHeight-height)/2;
        super(x, y, width, height, oid);
        this.bWidth = width;
        this.bHeight = height;
        this.xMin = x;
        this.yMin = y;
        this.xMax = x + width;
        this.yMax = y + height;
        this.halfWidth = this.width / 2;
        this.halfHeight = this.height / 2;
        //在后台的坐标
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.maxLength = Math.max(this.width, this.height);
        this.diagLength = Math.sqrt(this.halfWidth * this.halfWidth + this.halfHeight * this.halfHeight);
        this.rotationSpeed = 0.05;
        this.rotation = 0;
        this.cosRotation = Math.cos(this.rotation);
        this.sinRotation = Math.sin(this.rotation);
        this.vx = 0;
        this.vy = 0;
        this.thrust = 0;
        this.centerX = this.xMin + this.bWidth/2;
        this.centerY = this.yMin + this.bHeight/2;
        //分数
        this.profit=0;
        //昵称
        this.username=username;
        //血量
        this.health=100;
        //碰撞
        this.hit=false;
        //碰撞效果持续时间
        this.hit_eff_time=0;
        this.hit_begin_time=0;
        //碰撞倒退
        this.forward=1;
        //被黑洞吸引
        this.inhole=false;
        //被白洞排斥
        this.outhole=false;

        this.canmove=true;

        //显示聊天消息
        this.msg=null;
        //消息显示五秒后消失
        this.msgTime=0;
        this.msgLife=5000;
        this.is_destory=false;
    }
    move(data){
        if(this.canmove){
            this.w = data.w;
            this.d = data.d;
            this.s = data.s;
            this.a = data.a;
        }
    }
    update(ctx){
        let ax, ay;
        let p=this.profit;
        this.canmove=(!this.inhole) && (!this.outhole);
        if(this.canmove) {
            if (this.w) {
                this.thrust = 0.15;
            } else {
                this.thrust = 0;
            }
            if (this.d) {
                this.rotation += this.rotationSpeed * ctx.ndt;
            }
            if (this.s) {
                this.vx *= 0.95;
                this.vy *= 0.95;
            }
            if (this.a) {
                this.rotation -= this.rotationSpeed;
            }
        }
        else {
            this.thrust = 0;
        }

        if(this.hit){
            this.forward=-0.35
        }
        else {
            if(this.forward<0){
                this.vx=0;
                this.vy=0;
            }
            this.forward=1
        }
        this.level=(p<2000)&&1||(p>=2000&&p<5000)&&2||(p>=5000&&p<10000)&&3||(p>=10000)&&4;
        this.cosRotation = Math.cos(this.rotation);
        this.sinRotation = Math.sin(this.rotation);
        ax = this.cosRotation * this.thrust;
        ay = this.sinRotation * this.thrust;
        this.vx += ax;
        this.vy += ay;
        this.vx *= 0.99 ;
        this.vy *= 0.99 ;
        this.v = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
        this.x += this.vx * ctx.ndt * this.forward;
        this.y += this.vy * ctx.ndt * this.forward;
        //如果到达边界
        this.x=utils.between(this.x,10,ctx.width - this.bWidth);
        this.y=utils.between(this.y,28,ctx.height - this.bHeight);
        let axRotation = -Math.atan2(this.halfHeight, this.halfWidth);
        this.tlx = this.x + (this.width / 2) - Math.cos(axRotation - this.rotation) * this.diagLength;
        this.tly = this.y + (this.height / 2) + Math.sin(axRotation - this.rotation) * this.diagLength;
        this.trx = this.x + (this.width / 2) - Math.cos(axRotation + this.rotation) * -this.diagLength;
        this["try"] = this.y + (this.height / 2) - Math.sin(axRotation+ this.rotation) * -this.diagLength;
        this.brx = this.x + (this.width / 2) + Math.cos(axRotation - this.rotation) * this.diagLength;
        this.bry = this.y + (this.height / 2) - Math.sin(axRotation - this.rotation) * this.diagLength;
        this.blx = this.x + (this.width / 2) + Math.cos(axRotation+ this.rotation) * -this.diagLength;
        this.bly = this.y + (this.height / 2) + Math.sin(axRotation + this.rotation) * -this.diagLength;
        this.xMin = Math.min(this.tlx, this.trx, this.brx, this.blx);
        this.xMax = Math.max(this.tlx, this.trx, this.brx, this.blx);
        this.yMin = Math.min(this.tly, this["try"], this.bry, this.bly);
        this.yMax = Math.max(this.tly, this["try"], this.bry, this.bly);
        this.bWidth = this.xMax - this.xMin;
        this.bHeight = this.yMax - this.yMin;
        this.centerX = this.xMin + this.bWidth/2;
        this.centerY = this.yMin + this.bHeight/2;
        if(this.msgTime!=0&&(new Date-this.msgTime)>=this.msgLife){
            this.msg=null;
            this.msgTime=0;
        }
        if(this.hit_begin_time!=0&&(new Date-this.hit_begin_time)>=this.hit_eff_time){
            this.hit=false;
            this.hit_begin_time=0;
        }
    }
    destory(ctx){
        this.is_destory=true;
        this.msg=null;
        this.msgTime=0;
        this.hit=false;
        this.hit_begin_time = this.hit_eff_time = 0;
        for(let sid in ctx.socks){
            let sock = ctx.socks[sid];
            if(sid == this.oid){
                sock.emit('destory', {
                    id: this.oid
                });
            }
            ctx.io.emit("info",{
                action: "destory",
                data:{
                    id:this.oid,
                    username:this.username
                }
            })
        }
    }
    resume(screenX, screenY, screenWidth, screenHeight){
        let ship_img = ship_imgs.get(1);
        let width = ship_img.width, height = ship_img.height;
        let x = screenX+(screenWidth-width)/2, y = screenY+(screenHeight-height)/2;
        this.bWidth = width;
        this.bHeight = height;
        this.xMin = this.x = x;
        this.yMin = this.y = y;
        this.xMax = x + width;
        this.yMax = y + height;
        this.width = width;
        this.height = height;
        this.halfWidth = this.width / 2;
        this.halfHeight = this.height / 2;
        //在后台的坐标
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.maxLength = Math.max(this.width, this.height);
        this.diagLength = Math.sqrt(this.halfWidth * this.halfWidth + this.halfHeight * this.halfHeight);
        this.rotationSpeed = 0.05;
        this.rotation = 0;
        this.cosRotation = Math.cos(this.rotation);
        this.sinRotation = Math.sin(this.rotation);
        this.vx = 0;
        this.vy = 0;
        this.thrust = 0;
        this.centerX = this.xMin + this.bWidth/2;
        this.centerY = this.yMin + this.bHeight/2;
        //分数
        this.profit=0;
        //血量
        this.health=100;
        //碰撞
        this.hit=false;
        //碰撞效果持续时间
        this.hit_eff_time=0;
        this.hit_begin_time=0;
        //碰撞倒退
        this.forward=1;
        //被黑洞吸引
        this.inhole=false;
        //被白洞排斥
        this.outhole=false;

        this.canmove=true;

        //显示聊天消息
        this.msg=null;
        //消息显示五秒后消失
        this.msgTime=0;
        this.msgLife=5000;
        this.is_destory=false;
    }
}
module.exports=Context;
