import {discover} from './providers.mjs';
import {rankProducts,parseQuery,discoveryMatches} from './products.mjs';
import {planSearch,reviewMatches,worker} from './ai.mjs';
import {getCached,saveCached,consumeLimit,databaseHealthy,hash} from './storage.mjs';
import {serveAsset} from './static.mjs';

const headers={'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type','x-content-type-options':'nosniff','cache-control':'no-store'};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers});
const countries=new Set(['US','GB','CA','AU','NZ','DE','FR','IT','ES','NL','IN','JP','SG','BR','MX','ZA','SE','NO','CH','AE']);
const currencies=new Set(['USD','GBP','CAD','AUD','NZD','EUR','INR','JPY','SGD','BRL','MXN','ZAR','SEK','NOK','CHF','AED']);
async function bodyJSON(request){
  if(!request.headers.get('content-type')?.includes('application/json'))throw new Error('Use JSON');
  if(Number(request.headers.get('content-length'))>16000)throw new Error('Request too large');
  const reader=request.body?.getReader();if(!reader)throw new Error('Empty request');let text='',size=0;const decoder=new TextDecoder();
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16000){await reader.cancel();throw new Error('Request too large');}text+=decoder.decode(value,{stream:true});}return JSON.parse(text+decoder.decode());
}
async function allowance(request){
  const ip=request.headers.get('x-real-ip')||request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'anonymous';
  if(!await consumeLimit('client:'+hash(ip),8,60))return false;
  if(!await consumeLimit('global-hour',100,3600))return false;
  return consumeLimit('global-day',500,86400);
}
export default {
  async fetch(request){
    const asset=serveAsset(request);if(asset)return asset;
    const path=new URL(request.url).pathname;
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method==='GET'&&(path==='/health'||path==='/api/health'))return json({ok:true,app:'e-verse',version:'1.4.1',database:await databaseHealthy()});
    if(request.method==='GET'&&path==='/api/status')return json({ai:{provider:'Vireonix',model:'auto',roles:['query_planning','product_match_review','photo_evidence_interpretation']},photo:{processing:'on_device',formats:['JPEG','PNG','WebP','GIF','AVIF','HEIC','HEIF']},search:{mode:'open_web_discovery',ebay_api:Boolean(process.env.EBAY_CLIENT_ID&&process.env.EBAY_CLIENT_SECRET),searxng:Boolean(process.env.SEARXNG_URL)},cost:{paid_providers:false,rate_limits:true}});
    if(request.method!=='POST'||!['/api/search','/api/photo-query'].includes(path))return json({error:'Not found'},404);
    let body;try{body=await bodyJSON(request);}catch{return json({error:'Please enter a short shopping request.'},400);}
    if(!await allowance(request))return json({error:'Search is busy. Please try again in a minute.',code:'rate_limited'},429);
    if(path==='/api/photo-query'){
      const evidence={caption:String(body.caption||'').slice(0,300),text:String(body.text||'').slice(0,1500)};
      if(!evidence.caption&&!evidence.text)return json({error:'Add a few words about the item to continue.'},422);
      try{const r=await worker('photo',evidence);if(typeof r.query==='string'&&r.query.trim())return json({query:r.query.trim().slice(0,200),confidence:['low','medium','high'].includes(r.confidence)?r.confidence:'low',worker:'active'});}catch{}
      return json({query:(evidence.text||evidence.caption).slice(0,180),confidence:'low',worker:'unavailable'});
    }
    if(typeof body.query!=='string'||body.query.trim().length<2||body.query.length>240)return json({error:'Describe what you would like to find.'},400);
    const parsed=parseQuery(body.query);if(parsed.query.length<2)return json({error:'Include the item name.'},400);
    const country=countries.has(body.country)?body.country:'US';const currency=currencies.has(body.currency)?body.currency:'USD';const condition=['new','used','refurbished'].includes(body.condition)?body.condition:'any';
    const budget=body.budget==null||body.budget===''?parsed.budget:Number(body.budget);
    if(budget!==null&&(!Number.isFinite(budget)||budget<=0))return json({error:'Enter a valid budget.'},400);
    const options={country,currency,condition,budget};const key=hash(JSON.stringify({v:9,query:parsed.query.toLowerCase(),...options}));
    const cached=await getCached(key);if(cached)return json({...cached,cached:true});
    const start=Date.now();
    try{
      const plan=await planSearch(parsed.query);
      const found=await discover(parsed.query,country,plan);
      const ranked=rankProducts(found.products,options);
      const reviewed=await reviewMatches(parsed.query,ranked);
      const results=reviewed.products.slice(0,12);
      const matches=discoveryMatches(found.leads,parsed.query,{currency,excludeURLs:results.map(p=>p.url)});
      const payload={query:parsed.query,options,results,matches,leads:found.leads.slice(0,40),coverage:found.coverage,ai:{provider:'Vireonix',planning:plan.status,review:reviewed.status},checkedAt:new Date().toISOString(),durationMs:Date.now()-start,cached:false,comparison:results.every(p=>p.total!==null)?'price_plus_shipping':'listed_price_with_available_shipping',message:results.length>=3?'Lowest matching prices found':results.length?`Found ${results.length} source-backed ${results.length===1?'offer':'offers'}. More stores are listed below.`:matches.length?`Found ${matches.length} matching listings. Open a listing to check its current price.`:'No matching listings were found in the available sources. Try a model number or another description.'};
      if(found.coverage.discovered||results.length||matches.length)await saveCached(key,payload);
      return json(payload);
    }catch{return json({error:'The search could not finish. Please try again.',code:'search_unavailable'},503);}
  }
};

