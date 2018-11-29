"use strict"
const utils=require('./utils.js')
const UUID = require('uuid');
const ship_templates = new Map()
    .set(1,{width:117,height:58,mass:50})
    .set(2,{width:109,height:61,mass:80})
    .set(3,{width:119,height:70,mass:120})
    .set(4,{width:132,height:64,mass:200});
const rock_templates = new Map()
    .set(1,{width:156,height:156,mass:1500})
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
        this.coin_count = 0;
        //飞船
        this.ships = {};
        //陨石
        this.rocks = [];
        //特效
        this.efforts = {}
        //黑洞
        this.black_holes = [new BlackHole(2000,2000,true),new BlackHole(4000,4000,false)];
        this.socks = {};
        let self = this;
        setInterval(function() {
            if(self.coin_count<20){
                let coin = new Coin(utils.random(0,self.width), utils.random(0,self.height),Math.floor(utils.random(1, 100)));
                self.efforts[coin.oid]=coin;
                self.coin_count += 1;
            }
        }, 200);
        setInterval(function() {
            if(self.rocks.length<8)self.rocks.push(new Rock(utils.random(0,self.width), utils.random(0,self.height),1));
        }, 500);
        setInterval(function () {
            self.hue += 0.75;
            //陨石动画
            let i=self.rocks.length;
            while (i--){
                self.rocks[i].update(self);
            }
            //黑洞动画
            i=self.black_holes.length;
            while (i--){
                self.black_holes[i].update(self);
            }
            //特效动画
            for(let i in self.efforts){
                let effort = self.efforts[i];
                effort.update(self);
                self.clear(effort);
            }
            //飞船动画
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
                            let force = utils.update_entity_speed_after_collided(ship, rock, true);
                            ship.after_collided(self, force);
                            //产生撞击点
                            let collision = new Collision(c[0],c[1],force);
                            self.efforts[collision.oid] = collision;
                            if(ship.health <= 0){
                                ship.destory(self);
                                break
                            }
                        }
                    }
                    if(!ship.is_destory){
                        for(let j=i+1; j < ship_ids.length; j++){
                            let other_ship = self.ships[ship_ids[j]];
                            if(!other_ship.is_destory){
                                let c=ship.collide(other_ship);
                                if(c instanceof Array){
                                    let force = utils.update_entity_speed_after_collided(ship, other_ship, true);
                                    ship.after_collided(self, force);
                                    other_ship.after_collided(self, force);
                                    //产生撞击点
                                    let collision = new Collision(c[0],c[1],force);
                                    self.efforts[collision.oid] = collision;
                                    if(other_ship.health <= 0)other_ship.destory(self);
                                    if(ship.health <= 0){
                                        ship.destory(self);
                                        break
                                    }
                                }
                            }
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
    clear(entity) {
        if(entity.should_remove(this)){
            delete this.efforts[entity.oid];
            entity.after_remove(this);
        };
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
        this.oid = oid ? oid:UUID.v1();
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
    outOfBounds(ctx) {
        return (this.x > ctx.width || this.x < 0 || this.y > ctx.height || this.y < 0);
    }
    outOfCamera(cam){
        return (this.x < cam.x || this.x > cam.x+cam.width || this.y < cam.y || this.y > cam.y+cam.height)
    }
    should_remove(){return false}
    after_remove(){}
}

class Circle extends Entity{
    constructor(x, y, radius, oid){
        super(x, y, oid);
        this.radius = radius;
    }
    outOfBounds(ctx) {
        return (this.x > ctx.width + this.radius || this.x < -this.radius || this.y > ctx.height + this.radius || this.y < -this.radius);
    }
    outOfCamera(cam){
        return (this.x > cam.x + cam.width + this.radius || this.x < cam.x - this.radius || this.y > cam.y + cam.height + this.radius || this.y < cam.y - this.radius);
    }
}
class Rect extends Entity{
    constructor(x, y, width, height, oid){
        super(x, y, oid);
        this.width = width;
        this.height = height;
    }
    outOfBounds(ctx) {
        return this.x > ctx.width + this.width || this.x < -this.width || this.y > ctx.height + this.height || this.y < -this.height;
    }
    outOfCamera(cam){
        return (this.x > cam.x + cam.width + this.width || this.x < cam.x - this.width || this.y > cam.y + cam.height + this.height || this.y < cam.y - this.height);
    }
}
class InfoPoint extends Entity{
    constructor(x, y, info, hue, font_size){
        super(x, y);
        this.info = info;
        this.alpha = 1;
        this.hue = hue;
        this.font_size=font_size;
        this.cv = 0;
    }
    update(ctx){
        this.alpha -= 0.03 * ctx.ndt;
        this.cv += 0.15 * ctx.ndt;
        this.y -= this.cv * ctx.ndt;
    }
    should_remove(ctx){
        return (this.outOfBounds(ctx) || this.alpha <= 0)
    }
}

class Spark extends Circle{
    constructor(x, y, range){
        super(x, y, range/2);
        this.move_angle=utils.random(0,Math.PI*2)
        this.move_range=utils.random(20,range)
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
        super(x, y, force*12.5);
        this.force = force;
        this.isShow=!0;
        this.sparks=[];
        let count=force;
        while (count--){
            this.sparks.push(new Spark(x,y,this.radius))
        }
        if(force > 2){
            this.explode=new Explode(x,y,this.radius);
        }
    }
    update() {
        let i = this.sparks.length;
        let spark_isShow = false;
        while (i--) {
            let spark=this.sparks[i]
            spark.update()
            spark_isShow=spark_isShow||spark.isShow;
        }
        this.isShow = spark_isShow
        if(this.explode){
            this.explode.update();
            this.isShow=this.explode.isShow;
        }
    }
    should_remove(ctx){
        return (this.outOfBounds(ctx) || (!this.isShow))
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
        this.explodes=[]
        this.sparks=[]
        this.info_points=[]
        this.profit=profit
    }
    locateInCamera(entity){
        let clone = Object.assign({}, entity);
        clone["dx"] = entity.x - this.x;
        clone["dy"] = entity.y - this.y;
        delete clone["oid"];
        return clone;
    }
    lookAt(ctx){
        this.hue = ctx.hue;
        for(let i in ctx.efforts){
            let effort = ctx.efforts[i];
            if(!effort.outOfCamera(this)){
                if(effort instanceof Coin)this.coins.push(this.locateInCamera(effort));
                else if(effort instanceof Collision){
                    //定位火花
                    let j=effort.sparks.length;
                    while(j--){
                        this.sparks.push(this.locateInCamera(effort.sparks[j]));
                    }
                    //定位爆炸
                    if(effort.explode) this.explodes.push(this.locateInCamera(effort.explode));
                }
                else if(effort instanceof InfoPoint)this.info_points.push(this.locateInCamera(effort))
            }
        }
        for(let ship of ctx.ship_values()){
            if(!ship.outOfCamera(this))this.ships.push(this.locateInCamera(ship));
        }
        let self=this;
        ctx.rocks.forEach(function (rock) {
            if(!rock.outOfCamera(self))self.rocks.push(self.locateInCamera(rock));
        })
        ctx.black_holes.forEach(function (bla) {
            if(!bla.outOfCamera(self))self.black_hole=self.locateInCamera(bla);
        })
    }
}
class Rock extends Circle{
    constructor(x, y, level){
        let template =  rock_templates.get(level);
        let width = template.width;
        super(x, y, width/2);
        this.mass=template.mass;
        this.vx=0;
        this.vy=0;
        this.level=level;
        this.width = width;
        this.height=rock_templates.get(level).height;
        this.halfWidth=this.width/2;
        this.halfHeight=this.height/2;
        this.catch=false;
    }
    update(){
        this.x+=this.vx;
        this.y+=this.vy
        this.vx*=0.95
        this.vy*=0.95
    }
}

class BlackHole extends Circle{
    constructor(x, y, isBlack){
        super(x, y, 559/2);
        this.inRadius=204/2;
        this.isBlack=isBlack;
        //引力场范围
        this.gravitationRange = 500;
        this.inRotaionSpeed = 0.003;
        this.outRotationSpeed = 0.002;
        this.inRotation = 0;
        this.outRotation = 0;
        this.damage = 10;
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
        let rocks,anotherHole;
        rocks=ctx.rocks;
        anotherHole=(ctx.black_holes[0].isBlack!=this.isBlack)?ctx.black_holes[0]:ctx.black_holes[1];
        let self=this;
        rocks.forEach(function (rock) {
            let dx,dy,dist,angle,mvx,mvy,power
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
                    if (rock.width <= rock_templates.get(rock.level).width)rock.width += 0.05 * power;
                    if (rock.height <= rock_templates.get(rock.level).height)rock.height += 0.05 * power;
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
                        ship.in_hole(ctx, this)
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
                    if (ship.width <= ship_templates.get(ship.level).width)ship.width += ship.width * 0.01 * power;
                    if (ship.height <= ship_templates.get(ship.level).height)ship.height += ship.height * 0.01 * power;
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
       let scaleChange;
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
            let angle, dist, dx, dy, mvx, mvy, power;
            for(let ship of ctx.ship_values()){
                dx = ship.x + ship.width / 2 - this.x;
                dy = ship.y + ship.height / 2 - this.y;
                dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= ctx.magnetRange) {
                    this.magnetized = true;
                    angle = Math.atan2(dy, dx);
                    mvx = Math.cos(angle);
                    mvy = Math.sin(angle);
                    power = 3 + (100 / dist);
                    this.x += (mvx * power) * ctx.ndt;
                    this.y += (mvy * power) * ctx.ndt;
                } else {
                    this.magnetized = false;
                    this.x += this.vx * ctx.ndt;
                    this.y += this.vy * ctx.ndt;
                }
                if (dist <= Math.sqrt((ship.width * ship.width) + (ship.height * ship.height))/2) {
                    // ship.flashFlag = true;
                    ship.profit += this.value;
                    this.collected = true;
                    this.magnetized = false;
                }
            }
        } else {
            this.alpha -= 0.03 * ctx.ndt;
            this.cv += 0.15 * ctx.ndt;
            this.y -= this.cv * ctx.ndt;
        }
    }
    should_remove(ctx){
        return (this.outOfBounds(ctx) || this.alpha <= 0)
    }
    after_remove(ctx){
        ctx.coin_count -= 1;
    }
}
class Ship extends Rect{
    constructor(screenX, screenY, screenWidth, screenHeight, username, oid){
        let level = 1;
        let template = ship_templates.get(level);
        let width = template.width;
        let height = template.height;
        let x = screenX+(screenWidth-width)/2;
        let y = screenY+(screenHeight-height)/2;
        super(x, y, width, height, oid);
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.username=username;
        this.mass=template.mass;
        this.init_properties();
    }
    init_properties(){
        this.bWidth = this.width;
        this.bHeight = this.height;
        this.tlx = this.blx = this.xMin = this.x;
        this.tly = this['try'] = this.yMin = this.y;
        this.trx = this.brx = this.xMax = this.x + this.width;
        this.bly = this.bry = this.yMax = this.y + this.height;
        this.halfWidth = this.width / 2;
        this.halfHeight = this.height / 2;
        //在后台的坐标
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
        this.pre_x = this.x;
        this.pre_y = this.y;
        //分数
        this.profit=0;
        //血量
        this.health=100;
        //击晕
        this.is_stunned=false;
        //碰撞效果持续时间
        this.stunned_eff_time=0;
        this.stunned_begin_time=0;
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
        this.canmove=(!this.inhole) && (!this.outhole) && (!this.is_stunned);
        this.pre_x = this.x;
        this.pre_y = this.y;
        this.pre_rotation = this.rotation;
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
        this.x += this.vx * ctx.ndt;
        this.y += this.vy * ctx.ndt;
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
        if(this.stunned_begin_time!=0&&(new Date-this.stunned_begin_time)>=this.stunned_eff_time){
            this.is_stunned=false;
            this.stunned_begin_time=0;
        }
    }
    destory(ctx){
        this.is_destory=true;
        this.msg=null;
        this.msgTime=0;
        this.is_stunned=false;
        this.stunned_begin_time = this.stunned_eff_time = 0;
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
    after_collided(ctx, force){
        //对于主动碰撞者，第一次检测到碰撞后，可能已经发生重叠，矫正重叠
        //返回上一帧没有碰撞检测的位置
        this.x = this.pre_x;
        this.y = this.pre_y;
        this.rotation = this.pre_rotation;
        if(force<4)return;
        this.is_stunned=true;
        this.stunned_begin_time =+ new Date;
        this.health -= force;
        let info_point = new InfoPoint(this.x, this.y, "-HP " + force, 0, 26);
        ctx.efforts[info_point.oid] = info_point;
        this.stunned_eff_time = force * 100;
    }
    in_hole(ctx, hole){
        this.health-=hole.damage;
        this.inhole=false;
        let info_point = new InfoPoint(this.x, this.y, "-HP " + hole.damage, 0, 26);
        ctx.efforts[info_point.oid] = info_point;
    }
    resume(screenX, screenY, screenWidth, screenHeight){
        let template = ship_templates.get(1);
        let width = template.width, height = template.height;
        let x = screenX+(screenWidth-width)/2, y = screenY+(screenHeight-height)/2;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.mass = template.mass;
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.init_properties();
    }
}
module.exports=Context;
