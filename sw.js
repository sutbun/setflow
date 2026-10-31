const CACHE="setflow-mvp-v21";
const ASSETS=["./","./index.html","./style.css?v=dev-10.31-9","./app.js?v=dev-10.31-9","./body.js?v=dev-10.31-9","./history-edit.js?v=dev-10.31-9","./manifest.webmanifest","./icon.svg?v=dev-10.31-9","./apple-touch-icon-fixed-20261030.png"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET"||new URL(request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(request).then(response=>{
    if(response.ok){
      const copy=response.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));
    }
    return response;
  }).catch(async()=>{
    const cached=await caches.match(request);
    if(cached)return cached;
    if(request.mode==="navigate")return caches.match("./index.html");
    return Response.error();
  }));
});
