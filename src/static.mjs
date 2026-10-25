import assets from './static-assets.mjs';
export function serveAsset(request){
  if(!['GET','HEAD'].includes(request.method))return null;
  let path;try{path=decodeURIComponent(new URL(request.url).pathname);}catch{return null;}
  const item=assets[path==='/'?'/index.html':path];if(!item)return null;
  const headers={'Content-Type':item.type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':path.endsWith('.apk')?'public, max-age=3600':'no-cache'};
  if(item.type.startsWith('text/html'))headers['Content-Security-Policy']="frame-ancestors 'none'; object-src 'none'; base-uri 'self'";
  if(path==='/sw.js')headers['Service-Worker-Allowed']='/';
  if(path.endsWith('.apk'))headers['Content-Disposition']='attachment; filename="ENow.apk"';
  return new Response(request.method==='HEAD'?null:Buffer.from(item.body,'base64'),{headers});
}
