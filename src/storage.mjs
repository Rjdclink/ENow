import {neon} from '@neondatabase/serverless';
import {createHash} from 'node:crypto';
const sql=process.env.DATABASE_URL?neon(process.env.DATABASE_URL):null;
const memoryCache=new Map();const memoryLimits=new Map();
let nextCleanup=0;
export const hash=x=>createHash('sha256').update(x).digest('hex');
export async function getCached(key){
  if(sql){try{const r=await sql`SELECT payload FROM search_cache WHERE cache_key=${key} AND expires_at>now()`;return r[0]?.payload||null;}catch{}}
  const item=memoryCache.get(key);return item&&item.expires>Date.now()?item.payload:null;
}
export async function saveCached(key,payload){
  if(memoryCache.size>100)memoryCache.clear();memoryCache.set(key,{payload,expires:Date.now()+300000});
  if(sql)try{await sql`INSERT INTO search_cache(cache_key,payload,expires_at) VALUES(${key},${JSON.stringify(payload)},now()+interval '5 minutes') ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at`;
    await sql`DELETE FROM search_cache WHERE expires_at<now()-interval '1 hour'`; // ephemeral cache only
  }catch{console.warn('Cache write unavailable');}
}
export async function consumeLimit(key,limit,windowSeconds){
  const window=Math.floor(Date.now()/1000/windowSeconds);const id=hash(key+':'+window);
  if(sql){try{if(Date.now()>nextCleanup){nextCleanup=Date.now()+3600000;await sql`DELETE FROM request_limits WHERE expires_at<now()-interval '1 hour'`;}
    const r=await sql`INSERT INTO request_limits(bucket,hits,expires_at) VALUES(${id},1,now()+(${windowSeconds}*interval '1 second')) ON CONFLICT(bucket) DO UPDATE SET hits=request_limits.hits+1 RETURNING hits`;return r[0].hits<=limit;}catch{return false;}}
  // Local development only. Production fails closed if the database is down.
  if(process.env.NODE_ENV==='production')return false;
  if(memoryLimits.size>2000)memoryLimits.clear();const count=(memoryLimits.get(id)||0)+1;memoryLimits.set(id,count);return count<=limit;
}
export async function databaseHealthy(){if(!sql)return false;try{await sql`SELECT 1`;return true;}catch{return false;}}
