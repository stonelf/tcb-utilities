'use strict';
const app = require("tcb-admin-node");
app.init({env: process.env.env})
const db = app.database(), _ = db.command;
const cacheCollectionName = "MY_CACHE"
const cacheTimeout = 30*1000;//缓存有效时间，毫秒。
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
        await saveCache(cachePath,Math.random().toString());//生成新数据并更新缓存
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
    let doc = await cacheCollection.doc(path).get()
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
    if(doc.data.length>0){
        var s2 = doc.data[0].cache;
        await cacheCollection.doc(path).update({cache:s,createTime:new Date()});
        console.log("缓存路径"+path+"已从"+s2+"更新为"+s)
    }else{
        console.log("缓存不存在，新增缓存路径"+ path +" : "+s);
        await cacheCollection.add({_id:path,cache:s,createTime:new Date()});
    }
}
