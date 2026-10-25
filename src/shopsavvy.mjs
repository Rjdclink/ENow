import {createHash} from 'node:crypto';
import {canonicalURL,productMatch,priceNumber} from './products.mjs';
import {consumeLimit} from './storage.mjs';

let cooldown=0;
async function call(name,args){
  if(Date.now()<cooldown||!await consumeLimit('shopsavvy-minute',8,60)||!await consumeLimit('shopsavvy-hour',80,3600))throw new Error('Price source busy');
  const r=await fetch('https://api.shopsavvy.com/mcp',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}),signal:AbortSignal.timeout(18000)});
  if(r.status===429){cooldown=Date.now()+60000;throw new Error('Price source busy');}if(!r.ok)throw new Error('Price source unavailable');
  const reader=r.body.getReader();let bytes=0,text='';const decoder=new TextDecoder();while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2000000){await reader.cancel();throw new Error('Response too large');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
  const data=JSON.parse(text.startsWith('event:')||text.startsWith('data:')?text.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join(''):text);
  if(data.error||data.result?.isError)throw new Error('Price source unavailable');return (data.result?.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');
}
export function parseCatalog(text,query){
  return [...text.matchAll(/^### \d+\. (.+)\n([\s\S]*?)(?=^### |\*\*Usage:|(?![\s\S]))/gm)].map(m=>({title:m[1],identifier:m[2].match(/^- Path: (products\/[^\s]+)/m)?.[1]})).filter(p=>p.identifier&&productMatch(p.title,query)>=.6);
}
export function parseOffers(text,query,{now=Date.now()}={}){
  const title=text.match(/^## .+? Current Offers for (.+)$/m)?.[1]||'';
  const match=productMatch(title,query);if(match<.6)return {products:[],leads:[]};
  const sourceURL=canonicalURL(text.match(/\*\*Source:\*\*[^\n]*(https:\/\/shopsavvy\.com\/[^\s]+)/)?.[1]);
  const records=[...text.matchAll(/^\d+\. \*\*(.+?)\*\* - \$([\d,.]+)\n([\s\S]*?)(?=^\d+\. \*\*|^\*\*Source:|(?![\s\S]))/gm)].map(m=>{
    const block=m[3];return {retailer:m[1],price:priceNumber(m[2]),url:canonicalURL(block.match(/\[View Offer\]\((https:[^\n]+)\)/)?.[1]),stock:block.match(/- Availability: ([^\n]+)/)?.[1],condition:block.match(/- Condition: ([^\n]+)/)?.[1],seller:block.match(/- Seller: ([^\n]+)/)?.[1],checkedAt:block.match(/- Last checked: ([^\n]+)/)?.[1]};
  }).filter(p=>p.url&&p.price&&Number.isFinite(Date.parse(p.checkedAt))&&Date.parse(p.checkedAt)<=now+300000);
  // Keep the latest observation per seller+condition, including stock-out observations.
  records.sort((a,b)=>Date.parse(b.checkedAt)-Date.parse(a.checkedAt));const seen=new Set();const latest=records.filter(p=>{const k=p.url+'|'+(p.seller||'')+'|'+p.condition;return !seen.has(k)&&seen.add(k);});
  const products=[],leads=[];
  for(const p of latest){if(p.stock!=='in')continue;const age=now-Date.parse(p.checkedAt);
    if(age>7*86400000){if(age<30*86400000)leads.push({title,url:p.url,snippet:'Older price record; needs a live check',source:'ShopSavvy'});continue;}
    products.push({id:createHash('sha256').update(p.url+'|'+p.seller+'|'+p.condition).digest('hex').slice(0,16),title,url:p.url,image:null,merchant:p.retailer+(p.seller?' · '+p.seller:''),price:p.price,currency:'USD',shipping:null,total:null,condition:['new','used','refurbished'].includes(p.condition)?p.condition:'unspecified',availability:'in_stock',verification:'price_index',checkedAt:p.checkedAt,source:'ShopSavvy',sourceURL,match});
  }return {products,leads};
}
export async function shopSavvySearch(query,country){
  // The free MCP's documented prices are US dollars; do not imply local delivery elsewhere.
  if(country!=='US')return {products:[],leads:[]};
  const catalog=parseCatalog(await call('product_search',{query,limit:5}),query).slice(0,3);
  const results=await Promise.allSettled(catalog.map(p=>call('product_offers',{identifier:p.identifier}).then(t=>parseOffers(t,query))));
  return results.reduce((out,r)=>{if(r.status==='fulfilled'){out.products.push(...r.value.products);out.leads.push(...r.value.leads);}return out;},{products:[],leads:[]});
}
