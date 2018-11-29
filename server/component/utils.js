/**
 * Created by lenovo on 2016/12/22.
 */
module.exports={
    ObjVals2Arr:function(obj){
        var arr = [];
        for(var item in obj){
            arr.push(obj[item]);
        }
        return arr;
    },
    random:function (Min,Max) {
        return Min + (Max - Min)* Math.random();
    },
    between: function (num , min , max) {
        if(num<min)num=min;
        if(num>max)num=max;
        return num
    },
    dot: function(axis, axis0){
        return Math.abs(axis[0]*axis0[0] + axis[1]*axis0[1])
    },
    is_point_in_rect(rect, point){
        let x = point[0], y = point[1];
        let unrotatedX = rect.cosRotation * (x-rect.centerX) - rect.sinRotation * (y - rect.centerY) + rect.centerX;
        let unrotatedY = rect.sinRotation * (x-rect.centerX) + rect.cosRotation * (y - rect.centerY) + rect.centerY;
        let unrotatedRectX = rect.centerX - rect.width/2;
        let unrotatedRectY = rect.centerY - rect.height/2;
        return (unrotatedRectX <= unrotatedX && unrotatedX <= unrotatedRectX+rect.width && unrotatedRectY <= unrotatedY && unrotatedY <= unrotatedRectY+rect.height)
    },
    collide_2_rect(rect1, rect2){
        let rect1_axisX = [rect1.cosRotation, rect1.sinRotation];
        let rect1_axisY = [-rect1.sinRotation, rect1.cosRotation];
        let rect2_axisX = [rect2.cosRotation, rect2.sinRotation];
        let rect2_axisY = [-rect2.sinRotation, rect2.cosRotation];
        let axis_arr = [rect1_axisX, rect1_axisY, rect2_axisX, rect2_axisY];
        for(let i =0; i < 4; i++){
            let axis = axis_arr[i];
            if(rect1.halfWidth * this.dot(axis, rect1_axisX) + rect1.halfHeight * this.dot(axis, rect1_axisY)
                + rect2.halfWidth * this.dot(axis, rect2_axisX) + rect2.halfHeight * this.dot(axis, rect2_axisY)
                <= this.dot([rect1.centerX - rect2.centerX, rect1.centerY - rect2.centerY], axis))
                return;
        }
        let collision_points = [];
        let vertex;
        outer_loop:
        for(let i=0; i < 2; i++){
            if(i==1){
                vertex = null;
                let tmp = rect1;
                rect1 = rect2;
                rect2 = tmp;
            }
            vertex = [
                [rect2.tlx, rect2.tly],
                [rect2.trx, rect2['try']],
                [rect2.brx, rect2.bry],
                [rect2.blx, rect2.bly]
            ]
            for(let j=0; j < vertex.length; j++){
                let p = vertex[j];
                if(this.is_point_in_rect(rect1, p)){
                    collision_points.push(p);
                    if(collision_points.length > 1)break outer_loop;
                }
            }
        }
        let p1=collision_points[0], p2=collision_points.length > 1 ? collision_points[1]:null;
        let collision_point;
        if(p2){
            collision_point = [p1[0]-(p1[0]-p2[0])/2, p1[1]-(p1[1]-p2[1])/2]
        }else {
            collision_point = collision_points[0];
        }
        return collision_point;
    },
    collide_rect_circle:function(rect,circle){
        let unrotatedCircleX = rect.cosRotation * (circle.x-rect.centerX) - rect.sinRotation * (circle.y - rect.centerY) + rect.centerX;
        let unrotatedCircleY = rect.sinRotation * (circle.x-rect.centerX) + rect.cosRotation * (circle.y - rect.centerY) + rect.centerY;
        let unrotatedRectX = rect.centerX - rect.width/2;
        let unrotatedRectY = rect.centerY - rect.height/2;
        let closestX, closestY;
        if (unrotatedCircleX  < unrotatedRectX)
            closestX = unrotatedRectX;
        else if (unrotatedCircleX  > unrotatedRectX + rect.width)
            closestX = unrotatedRectX + rect.width;
        else
            closestX = unrotatedCircleX ;
        if (unrotatedCircleY < unrotatedRectY)
            closestY = unrotatedRectY;
        else if (unrotatedCircleY > unrotatedRectY + rect.height)
            closestY = unrotatedRectY + rect.height;
        else
            closestY = unrotatedCircleY;
        let a = Math.abs(unrotatedCircleX-closestX), b = Math.abs(unrotatedCircleY-closestY);
        if((a*a + b*b) <= circle.radius * circle.radius){
            let collideX = rect.cosRotation * (closestX-rect.centerX) + rect.sinRotation * (closestY - rect.centerY) + rect.centerX;
            let collideY = rect.cosRotation * (closestY - rect.centerY) - rect.sinRotation * (closestX-rect.centerX) + rect.centerY;
            return [collideX, collideY]
        }
    },
    update_entity_speed_after_collided:function (e1, e2, get_force) {
        let vx1 = e1.vx, vx2 = e2.vx, vy1 = e1.vy, vy2 = e2.vy;
        let m1 = e1.mass, m2 = e2.mass;
        e1.vx = ((m1-m2)*vx1+2*m2*vx2)/(m1+m2);
        e1.vy = ((m1-m2)*vy1+2*m2*vy2)/(m1+m2);
        e2.vx = ((m2-m1)*vx2+2*m1*vx1)/(m1+m2);
        e2.vy = ((m2-m1)*vy2+2*m1*vy1)/(m1+m2);
        if(!get_force)return;
        let fx = vx1 * m1 - vx2 * m2, fy = vy1 * m1 - vy2 * m2;
        return Math.floor(Math.sqrt(fx*fx+fy*fy)/100);
    }
}