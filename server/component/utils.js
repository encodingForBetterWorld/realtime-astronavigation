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
    locateInCamera : function (cam,el) {
        var clone = Object.assign({}, el);
        clone["dx"] = el.x - cam.x;
        clone["dy"] = el.y - cam.y;
        return clone;
    },
    dot: function(axis, axis0){
        return Math.abs(axis[0]*axis0[0] + axis[1]*axis0[1])
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
        return true
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
        if((a*a + b*b) < circle.radius * circle.radius){
            let collideX = rect.cosRotation * (closestX-rect.centerX) + rect.sinRotation * (closestY - rect.centerY) + rect.centerX;
            let collideY = rect.cosRotation * (closestY - rect.centerY) - rect.sinRotation * (closestX-rect.centerX) + rect.centerY;
            return [collideX, collideY]
        }
    }
}