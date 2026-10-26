import {load} from 'cheerio/slim';
import robotsParser from 'robots-parser';
import {getText} from './network.mjs';
import {canonicalURL,extractProducts,extractSellerLinks,extractProductImages,productMatch} from './products.mjs';
import {shopSavvySearch} from './shopsavvy.mjs';
import {marketplaces,marketplaceQueries,belongsToMarket,selectCandidates} from './marketplaces.mjs';

const robotsCache=new Map();
let duckCooldown=0;
const excluded=/(^|\.)(youtube\.com|reddit\.com|pinterest\.com|wikipedia\.org|tiktok\.com|instagram\.com)$/;
const gated=/(^|\.)(facebook\.com|fb\.com)$/;
export function parseDuck(html){
  const $=load(html);const results=[];
  $('.result').each((_,e)=>{const a=$(e).find('.result__a');let href=a.attr('href');if(!href)return;
    try{const u=new URL(href,'https://duckduckgo.com');href=u.searchParams.get('uddg')||u.href;}catch{return;}
    const url=canonicalURL(href);if(url)results.push({title:a.text().trim(),url,snippet:$(e).find('.result__snippet').text().trim(),source:'DuckDuckGo'});
  });return results;
}
async function duckSearch(query,country){
  if(Date.now()<duckCooldown)throw new Error('Search source cooling down');
  const regions={US:'us-en',GB:'uk-en',CA:'ca-en',AU:'au-en',DE:'de-de',FR:'fr-fr',IN:'in-en',JP:'jp-jp',NZ:'nz-en',IT:'it-it',ES:'es-es'};
  const url=new URL('https://html.duckduckgo.com/html/');url.searchParams.set('q',query);url.searchParams.set('kl',regions[country]||'wt-wt');
  const r=await getText(url.href,{timeout:12000});
  if(r.status!==200||/anomaly\.js|challenge-form|bots use DuckDuckGo/i.test(r.text)){duckCooldown=Date.now()+900000;throw new Error('Search source temporarily unavailable');}
  return parseDuck(r.text);
}
export function parseFreeSerp(data){
  if(!data.ok||data.index!=='web'||data.engine_fallback)throw new Error('Full web index unavailable');
  return (data.results||[]).map(x=>({title:String(x.title||''),url:canonicalURL(x.url),snippet:String(x.snippet||''),source:'FreeSerp'})).filter(x=>x.url);
}
async function freeSerpSearch(query){
  const url=new URL('https://freeserp.ai/api.php');url.search=new URLSearchParams({index:'web',q:query,size:'40'});
  const r=await getText(url.href,{timeout:9000,maxBytes:500000});if(r.status!==200)throw new Error('Web discovery unavailable');
  return parseFreeSerp(JSON.parse(r.text));
}
async function searxSearch(query){
  if(!process.env.SEARXNG_URL)return [];
  const url=new URL('/search',process.env.SEARXNG_URL);url.searchParams.set('q',query);url.searchParams.set('format','json');
  const r=await getText(url.href,{timeout:12000});if(r.status!==200)throw new Error('Search source unavailable');
  return JSON.parse(r.text).results?.map(x=>({title:x.title,url:canonicalURL(x.url),snippet:x.content||'',source:'SearXNG'})).filter(x=>x.url)||[];
}
// Optional eBay official API; the zero-cost discovery path does not require it.
async function ebaySearch(query,country){
  const id=process.env.EBAY_CLIENT_ID,secret=process.env.EBAY_CLIENT_SECRET;if(!id||!secret)return [];
  const auth=await fetch('https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',signal:AbortSignal.timeout(8000)});
  if(!auth.ok)throw new Error('eBay credentials unavailable');const token=(await auth.json()).access_token;
  const markets={US:'EBAY_US',GB:'EBAY_GB',CA:'EBAY_CA',AU:'EBAY_AU',DE:'EBAY_DE',FR:'EBAY_FR'};
  const u=new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');u.searchParams.set('q',query);u.searchParams.set('limit','20');u.searchParams.set('sort','price');u.searchParams.set('filter','buyingOptions:{FIXED_PRICE},deliveryCountry:'+country);
  const r=await fetch(u,{headers:{Authorization:'Bearer '+token,'X-EBAY-C-MARKETPLACE-ID':markets[country]||'EBAY_US'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('eBay search unavailable');
  return ((await r.json()).itemSummaries||[]).filter(p=>productMatch(p.title,query)>=0.6).map(p=>{
    const ship=p.shippingOptions?.find(s=>s.shippingCost?.currency===p.price?.currency)?.shippingCost?.value;
    const shipping=ship==null?null:Number(ship);const price=Number(p.price.value);
    return {id:p.itemId,title:p.title,url:canonicalURL(p.itemWebUrl),image:canonicalURL(p.image?.imageUrl),merchant:'eBay · '+(p.seller?.username||'seller'),price,currency:p.price.currency,shipping,total:shipping===null?null:price+shipping,condition:/new/i.test(p.condition)?'new':/refurb/i.test(p.condition)?'refurbished':'used',availability:'in_stock',verification:'seller_api',checkedAt:new Date().toISOString(),match:productMatch(p.title,query),source:'eBay API'};
  }).filter(p=>p.url&&Number.isFinite(p.price)&&p.price>0);
}
async function allowedByRobots(url){
  const origin=new URL(url).origin;const cached=robotsCache.get(origin);if(cached&&cached.until>Date.now())return cached.parser?.isAllowed(url,'ENowBot')!==false;
  try{const r=await getText(origin+'/robots.txt',{timeout:2000,maxBytes:400000});
    if(r.status===401||r.status===403||r.status===429||r.status>=500)return false;
    const parser=r.status===200?robotsParser(origin+'/robots.txt',r.text):null;
    if(robotsCache.size>250)robotsCache.clear();robotsCache.set(origin,{parser,until:Date.now()+3600000});return parser?.isAllowed(url,'ENowBot')!==false;
  }catch{return false;}
}
export async function checkListing(link,query,country){
  if(gated.test(new URL(link.url).hostname))return {products:[],reason:'restricted'};
  if(!await allowedByRobots(link.url))return {products:[],reason:'unavailable'};
  try{const r=await getText(link.url,{timeout:6000});if([404,410].includes(r.status))return {products:[],reason:'gone'};if(r.status!==200||!/html|json/i.test(r.headers['content-type']||''))return {products:[],reason:'unavailable'};
    return {products:extractProducts(r.text,r.url,{query,country,source:link.source}),links:extractSellerLinks(r.text,r.url,query),images:extractProductImages(r.text,r.url,query),reason:'checked'};
  }catch{return {products:[],reason:'unavailable'};}
}
async function mapLimit(items,n,fn){const out=[];let i=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const index=i++;out[index]=await fn(items[index]);}}));return out;}
export async function discover(query,country,{extraQueries=[],searcher,listingChecker=checkListing,catalogSearch=shopSavvySearch}={}){
  const sourceStatus=[];const links=[];const products=[];const marketStatus=[];
  const indexedSearch=async phrase=>{if(searcher)return searcher(phrase);try{return await freeSerpSearch(phrase);}catch{if(process.env.SEARXNG_URL)return searxSearch(phrase);if(process.env.ENABLE_DUCKDUCKGO==='1')return duckSearch(phrase,country);throw new Error('Discovery unavailable');}};
  const run=async(name,fn)=>{try{const data=await fn();sourceStatus.push({name,status:data.length?'ok':'empty',count:data.length});return data;}catch{sourceStatus.push({name,status:'unavailable',count:0});return [];}};
  const jobs=[run('FreeSerp web index',()=>indexedSearch(query+' buy price')).then(x=>links.push(...x)),
    run('FreeSerp seller discovery',()=>indexedSearch(query+' buy "in stock" -review -reviews')).then(x=>links.push(...x)),
    run('ShopSavvy price index',async()=>{const found=await catalogSearch(query,country);links.push(...found.leads);return found.products;}).then(x=>products.push(...x))];
  if(process.env.EBAY_CLIENT_ID&&process.env.EBAY_CLIENT_SECRET)jobs.push(run('eBay API',()=>ebaySearch(query,country)).then(x=>products.push(...x)));
  if(process.env.SEARXNG_URL)jobs.push(run('SearXNG',()=>searxSearch(query+' buy')).then(x=>links.push(...x)));
  if(process.env.ENABLE_DUCKDUCKGO==='1')jobs.push(run('DuckDuckGo',()=>duckSearch(query+' buy price',country)).then(x=>links.push(...x)));
  jobs.push(mapLimit(marketplaceQueries(query),6,async market=>{
    let found=[],status='no_indexed_listings';
    try{found=(await indexedSearch(market.query)).filter(l=>belongsToMarket(l.url,market));if(found.length)status='discovered';}catch{status='unavailable';}
    links.push(...found.map(l=>({...l,marketplace:market.name})));
    marketStatus.push({id:market.id,name:market.name,status,discovered:found.length,url:market.url,restricted:Boolean(market.restricted)});
  }));
  // Use a safe alternate only as additional discovery; verification uses the original query.
  const alternate=extraQueries.find(q=>typeof q==='string'&&q.length<240&&productMatch(q,query)>=.8);
  if(alternate)jobs.push(run('Alternate product discovery',()=>indexedSearch(alternate+' buy price')).then(x=>links.push(...x)));
  await Promise.all(jobs);
  // Price feeds and open web discovery both supply candidates; no store allowlist.
  links.unshift(...products.map(p=>({title:p.title,url:p.sourceURL||p.url,source:p.source,snippet:''})),...products.map(p=>({title:p.title,url:p.url,source:p.source,snippet:''})));
  const editorial=l=>/\/reviews?\/|\/news\/|\/blog\/|vs[.-]|\/face-off\/|\/headset-comparison\//i.test(l.url)||/\breviews?\b|black friday|cyber monday|lowest price ever/i.test(l.title)?1:0;
  links.sort((a,b)=>editorial(a)-editorial(b));
  const seen=new Set();const candidates=selectCandidates(links.filter(l=>{if(!l.url)return false;const host=new URL(l.url).hostname;return !excluded.test(host)&&!seen.has(l.url)&&seen.add(l.url);}));
  const checked=await mapLimit(candidates,12,l=>listingChecker(l,query,country));
  const follow=checked.flatMap(x=>x.links||[]).filter(x=>!seen.has(x.url)&&seen.add(x.url)).slice(0,10);
  if(follow.length){candidates.push(...follow);checked.push(...await mapLimit(follow,10,l=>listingChecker(l,query,country)));}
  checked.forEach(r=>products.unshift(...r.products));
  const gone=new Set(candidates.filter((_,i)=>checked[i]?.reason==='gone').map(l=>l.url));
  for(let i=products.length-1;i>=0;i--)if(gone.has(products[i].url))products.splice(i,1);
  // Catalog pictures are attached only from the exact price record's product page.
  for(const p of products){if(!p.image&&p.sourceURL){const ix=candidates.findIndex(c=>c.url===p.sourceURL);const photo=checked[ix]?.images?.find(x=>productMatch(p.title,x.title)>=.6);if(photo){p.image=photo.image;p.imageSource='catalog';}}}
  // Fresh seller observations replace index prices even when the new price is higher.
  const fresh=new Set(products.filter(p=>p.verification!=='price_index').map(p=>p.url));
  for(let i=products.length-1;i>=0;i--)if(products[i].verification==='price_index'&&fresh.has(products[i].url))products.splice(i,1);
  for(const market of marketStatus){const definition=marketplaces.find(m=>m.id===market.id);
    market.checked=candidates.filter((l,i)=>belongsToMarket(l.url,definition)&&checked[i]?.reason==='checked').length;
    market.offers=products.filter(p=>belongsToMarket(p.url,definition)).length;
    if(market.offers)market.status='offers_found';else if(market.checked)market.status='no_verified_price';
  }
  const offerURLs=new Set(products.map(p=>p.url));
  const leads=candidates.filter((l,i)=>!offerURLs.has(l.url)).map(l=>({...l,status:gated.test(new URL(l.url).hostname)?'restricted':'price_unverified'}));
  const marketLeads=marketplaceQueries(query).map(m=>({title:'Search '+m.name,url:m.url,source:m.name,status:m.restricted?'restricted':'marketplace_search'}));
  return {products,leads:[...marketLeads,...leads],coverage:{marketplaces:marketStatus.sort((a,b)=>marketplaces.findIndex(m=>m.id===a.id)-marketplaces.findIndex(m=>m.id===b.id)),sources:sourceStatus,discovered:candidates.length,checked:checked.filter(x=>x.reason==='checked').length,restricted:checked.filter(x=>x.reason==='restricted').length,scope:'discoverable_web',exhaustive:false}};
}

