'use strict';
const app = require("tcb-admin-node");
app.init({env: process.env.env})
const db = app.database(), _ = db.command;
const cacheCollectionName = "MY_CACHE"
const cacheTimeout = 3600*1000;//缓存有效时间，毫秒。
const cacheCollection = db.collection(cacheCollectionName);

exports.main_handler = async (event, context, callback) => {
    const cachePath = context.namespace+"/"+context.function_name+(event.path?event.path:"/");
    var cache = await readCache(cachePath);
    if(!!cache) {
        callback(null,cache.data);//不管是否超时先返回上次的数据
    }else{
        console.log("没有读到缓存数据");
    }
    if(!cache || cache.timeout){//缓存已超时
        let s=Math.random().toString(36).substr(2)
        await saveCache(cachePath,s);//生成新数据并更新缓存
    }else{
        console.log("缓存仍新鲜")
    }
};
async function readCache(path){
    let doc = await cacheCollection.doc(path).get();
    if("data"in doc && doc.data.length>0 && "cache" in doc.data[0]){
        return {data:doc.data[0].cache,timeout:(new Date()-doc.data[0].createTime>cacheTimeout)};
    }else{
        return null;
    }
}
async function saveCache(path,s){
    let doc = await cacheCollection.doc(path).field({"_id":false,"hash":true}).get()
    if(doc.code && doc.code == "DATABASE_COLLECTION_NOT_EXIST"){
        console.log("集合不存在");
        let res = await db.createCollection(cacheCollectionName)
        console.log(JSON.stringify(res))
        if("code" in res){
            console.log("创建集合失败，发生了"+res.code+"错误( "+res.message+" )。");
            return
        }else{
            console.log("创建了集合 "+cacheCollectionName);
            doc={data:[]}
        }
    }
    var newHash = times33(s)
    if(doc.data.length>0){
        var oldHash = doc.data[0].hash;
        if(newHash == oldHash){
            console.log("缓存内容 "+newHash+" 未改变");
            return "nochange"
        }else{
            await cacheCollection.doc(path).update({cache:s,createTime:new Date(),hash:newHash});
            console.log("缓存路径"+path+"已从"+oldHash+"更新为"+newHash)
            return "update"
        }
    }else{
        console.log("缓存不存在，新增缓存路径"+ path +" : "+s);
        await cacheCollection.add({_id:path,cache:s,createTime:new Date(),hash:newHash});
        return "append"
    }
}
function times33(str){
	if(!str) str = typeof str
	if(typeof str == "object") str = JSON.stringify(str);
	if(typeof str != "string") str = str.toString();		
	while(str.length<32) str = str +"&"+ str.split("").reverse().join("");
	let hash = 5381;
    for(let i = 0, len = str.length; i < len; ++i){
       hash += (hash << 5) + str.charCodeAt(i);
    };
    return (hash & 0x7fffffff).toString(16).toUpperCase();
}
