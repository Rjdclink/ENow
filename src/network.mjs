import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { gunzipSync, brotliDecompressSync, inflateSync } from 'node:zlib';

export function publicAddress(address) {
  const s = address.toLowerCase();
  if (isIP(s) === 4) {
    const [a,b] = s.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a===100 && b>=64 && b<=127) || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&[0,168].includes(b)) || (a===198&&[18,19,51].includes(b)) || (a===203&&b===0));
  }
  return isIP(s)===6 && !(/^(::|fc|fd|fe[89ab]|ff|2001:db8)/i.test(s));
}

export function publicURL(value) {
  const u = new URL(value);
  const host=u.hostname.replace(/^\[|\]$/g,'');
  if(u.protocol!=='https:' || u.username || u.password || (u.port&&u.port!=='443') || !host.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/i.test(host) || (isIP(host)&&!publicAddress(host))) throw new Error('Unsupported address');
  return u;
}

// Pin the checked public DNS address to the socket; revalidate every redirect.
export async function getText(value, {timeout=9000,maxBytes=2500000,redirects=3,headers={}}={}) {
  const url=publicURL(value);
  // The managed development proxy resolves remote DNS itself. Never enabled in production.
  if(process.env.ENOW_DEV_PROXY==='1'&&process.env.NODE_ENV!=='production'){
    const r=await fetch(url,{headers:{'User-Agent':'ENowBot/1.0',...headers},redirect:'manual',signal:AbortSignal.timeout(timeout)});
    if(r.status>=300&&r.status<400&&r.headers.get('location')){if(!redirects)throw new Error('Redirect limit');return getText(new URL(r.headers.get('location'),url).href,{timeout,maxBytes,redirects:redirects-1,headers});}
    const reader=r.body.getReader();const chunks=[];let count=0;while(true){const {value:chunk,done}=await reader.read();if(done)break;count+=chunk.length;if(count>maxBytes){await reader.cancel();throw new Error('Page too large');}chunks.push(chunk);}
    return {status:r.status,text:Buffer.concat(chunks).toString('utf8'),url:url.href,headers:Object.fromEntries(r.headers)};
  }
  const addresses=await Promise.race([lookup(url.hostname,{all:true}),new Promise((_,rej)=>{const t=setTimeout(()=>rej(new Error('DNS timeout')),3000);t.unref();})]);
  if(!addresses.length || addresses.some(a=>!publicAddress(a.address))) throw new Error('Private address blocked');
  const address=addresses.find(a=>a.family===4)||addresses[0];
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{
      headers:{'User-Agent':'ENowBot/1.0 (+https://github.com/Rjdclink/ENow)','Accept':'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5','Accept-Encoding':'identity',...headers},
      lookup:(_host,options,cb)=>options?.all?cb(null,[address]):cb(null,address.address,address.family)
    },res=>{
      if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();if(!redirects)return reject(new Error('Redirect limit'));return getText(new URL(res.headers.location,url).href,{timeout,maxBytes,redirects:redirects-1,headers}).then(resolve,reject);}
      const chunks=[];let bytes=0;
      res.on('data',chunk=>{bytes+=chunk.length;if(bytes>maxBytes){req.destroy(new Error('Page too large'));return;}chunks.push(chunk);});
      res.on('end',()=>{try{let b=Buffer.concat(chunks);const enc=res.headers['content-encoding'];const opts={maxOutputLength:maxBytes};if(enc==='gzip')b=gunzipSync(b,opts);if(enc==='br')b=brotliDecompressSync(b,opts);if(enc==='deflate')b=inflateSync(b,opts);resolve({status:res.statusCode,text:b.toString('utf8'),url:url.href,headers:res.headers});}catch(e){reject(e);}});
      res.on('error',reject);
    });
    const timer=setTimeout(()=>req.destroy(new Error('Request timeout')),timeout);timer.unref();
    req.on('error',reject);req.on('close',()=>clearTimeout(timer));
  });
}
