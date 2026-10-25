import { load } from 'cheerio/slim';
import { createHash } from 'node:crypto';
import { publicURL } from './network.mjs';

const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
export function priceNumber(value) {
  if(typeof value==='number')return Number.isFinite(value)&&value>0?value:null;
  let s=String(value??'').replace(/[^\d.,]/g,'');
  if(!s)return null;
  if(s.includes(',')&&s.includes('.')) s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(/,\d{2}$/.test(s))s=s.replace(',','.');else s=s.replace(/,/g,'');
  const n=Number(s);return Number.isFinite(n)&&n>0?n:null;
}
export function canonicalURL(value,base) {
  try{const u=publicURL(new URL(value,base).href);u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|gclid|fbclid|ref$|ref_|tag$|campid|mkcid|mkevt)/i.test(k))u.searchParams.delete(k);return u.href;}catch{return null;}
}
export function sellerURL(value,base){
  const cleaned=canonicalURL(value,base);if(!cleaned)return null;const u=new URL(cleaned);
  if(/(^|\.)shopsavvy\.com$/i.test(u.hostname)&&u.pathname==='/redirect')return canonicalURL(u.searchParams.get('url'));
  return cleaned;
}
export function productMatch(title,query) {
  const normalize=s=>s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu,'');
  const ts=normalize(title);
  const tokens=query.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu)||[];
  const ignore=new Set(['i','a','an','the','for','to','buy','find','me','want','looking','please','cheap','cheapest','price','online','new','used','refurbished','under','less','than','with','and']);
  const significant=tokens.filter(x=>(x.length>1||/\d/.test(x))&&!ignore.has(x));
  if(!significant.length)return 0;
  const model=significant.filter(x=>/\d/.test(x));
  if(model.some(x=>!ts.includes(normalize(x))))return 0;
  if(/\b(for parts|broken|not working)\b/i.test(title)&&!/\b(parts|broken)\b/i.test(query))return 0;
  if(/(?:^(?:\w+\s+){0,2}(?:case|cover|earpads|protector|skin|manual|strap|adapter)\b|\b(?:case|cover|earpads|replacement|protector|skin|manual|strap|adapter)\s+(?:for|compatible|fits)\b)/i.test(title)&&!/\b(case|cover|earpads|replacement|protector|parts|skin|manual|strap|adapter)\b/i.test(query))return 0;
  return significant.filter(x=>ts.includes(normalize(x))).length/significant.length;
}
function flatten(value,out=[],depth=0) {
  if(depth>10||!value||typeof value!=='object')return out;
  if(Array.isArray(value)){for(const x of value)flatten(x,out,depth+1);return out;}
  const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];
  if(types.some(t=>/^(Product|ProductGroup)$/i.test(t||'')))out.push(value);
  for(const [k,v] of Object.entries(value))if(['@graph','itemListElement','item','mainEntity','hasVariant'].includes(k))flatten(v,out,depth+1);
  return out;
}
function currency(value){const s=clean(value).toUpperCase();return /^[A-Z]{3}$/.test(s)?s:null;}
export function extractProductImages(html,url,query){
  const $=load(html),products=[];
  $('script[type="application/ld+json"]').each((i,e)=>{try{flatten(JSON.parse($(e).text()),products);}catch{}});
  return products.filter(p=>productMatch(clean(p.name),query)>=.6).map(p=>{
    const value=Array.isArray(p.image)?p.image[0]:p.image;
    return {title:clean(p.name),image:canonicalURL(value?.url||value||$('meta[property="og:image"]').attr('content'),url)};
  }).filter(p=>p.image);
}
export function extractSellerLinks(html,url,query){
  const $=load(html),products=[],links=[];
  $('script[type="application/ld+json"]').each((i,e)=>{try{flatten(JSON.parse($(e).text()),products);}catch{}});
  for(const p of products){if(productMatch(clean(p.name),query)<.6)continue;
    const offers=[p.offers].flat().filter(Boolean).flatMap(o=>o['@type']==='AggregateOffer'?[o.offers].flat():[o]);
    for(const o of offers){const link=sellerURL(o?.url,url);if(link&&new URL(link).hostname!==new URL(url).hostname)links.push({title:clean(p.name),url:link,snippet:'Seller discovered through a comparison page',source:'Web discovery'});}
  }return links;
}
function shippingCost(offer,country,money){
  const details=Array.isArray(offer.shippingDetails)?offer.shippingDetails:[offer.shippingDetails];
  for(const d of details){if(!d)continue;const places=[d.shippingDestination].flat().filter(Boolean);if(!places.some(p=>[p.addressCountry?.name||p.addressCountry].flat().includes(country)))continue;
    const rate=d.shippingRate;if(rate && (!rate.currency||rate.currency===money)&&rate.value!==undefined){const n=Number(rate.value);if(Number.isFinite(n)&&n>=0)return n;}
  }return null;
}
export function extractProducts(html,url,{query,country='US',source='seller'}={}) {
  // ShopSavvy is a price index, never a seller. Its metadata may describe a range or accessory.
  if(/(^|\.)shopsavvy\.com$/i.test(new URL(url).hostname))return [];
  const $=load(html);const products=[];
  $('script[type="application/ld+json"]').each((i,e)=>{try{flatten(JSON.parse($(e).text()),products);}catch{}});
  const results=[];const checkedAt=new Date().toISOString();
  for(const p of products){
    const title=clean(p.name);const match=productMatch(title,query);if(match<0.6)continue;
    let offers=Array.isArray(p.offers)?p.offers:[p.offers];
    offers=offers.flatMap(o=>o?.['@type']==='AggregateOffer'?(Array.isArray(o.offers)?o.offers:[]):[o]);
    for(const o of offers){if(!o)continue;
      const price=priceNumber(o.price??o.priceSpecification?.price);const money=currency(o.priceCurrency??o.priceSpecification?.priceCurrency);
      if(!price||!money||/OutOfStock|SoldOut|Discontinued/i.test(o.availability||''))continue;
      if(o.priceValidUntil&&Date.parse(o.priceValidUntil)<Date.now()-86400000)continue;
      const link=sellerURL(o.url||p.url||url,url);if(!link)continue;
      // A comparison page is discovery evidence, not a fresh seller observation.
      if(new URL(link).hostname.replace(/^www\./,'')!==new URL(url).hostname.replace(/^www\./,''))continue;
      const condition=/Used/i.test(o.itemCondition||p.itemCondition||'')?'used':/Refurbished/i.test(o.itemCondition||p.itemCondition||'')?'refurbished':/New/i.test(o.itemCondition||p.itemCondition||'')?'new':'unspecified';
      const shipping=shippingCost(o,country,money);
      const image=canonicalURL((Array.isArray(p.image)?p.image[0]:p.image)?.url||(Array.isArray(p.image)?p.image[0]:p.image)||$('meta[property="og:image"]').attr('content'),url);
      results.push({id:createHash('sha256').update(link+title+price).digest('hex').slice(0,16),title,url:link,image,merchant:clean(o.seller?.name)||new URL(link).hostname.replace(/^www\./,''),price,currency:money,shipping,total:shipping===null?null:Math.round((price+shipping)*100)/100,condition,availability:/InStock|LimitedAvailability/i.test(o.availability||'')?'in_stock':'unknown',match,verification:'seller_page',checkedAt,source});
    }
  }
  // OpenGraph product offers are used only when product name and currency are present.
  if(!results.length&&!products.length&&$('meta[property="og:type"]').attr('content')==='product'){
    const title=clean($('meta[property="og:title"]').attr('content')||$('h1').first().text());
    const price=priceNumber($('meta[property="product:price:amount"],meta[property="og:price:amount"]').attr('content'));
    const money=currency($('meta[property="product:price:currency"],meta[property="og:price:currency"]').attr('content'));
    const stock=$('meta[property="product:availability"]').attr('content')||'';
    if(price&&money&&productMatch(title,query)>=0.6&&!/out of stock|outofstock|sold.?out/i.test(stock))results.push({id:createHash('sha256').update(url).digest('hex').slice(0,16),title,url:canonicalURL(url),image:canonicalURL($('meta[property="og:image"]').attr('content'),url),merchant:new URL(url).hostname.replace(/^www\./,''),price,currency:money,shipping:null,total:null,condition:'unspecified',availability:/in.?stock/i.test(stock)?'in_stock':'unknown',match:productMatch(title,query),verification:'seller_page',checkedAt,source});
  }return results;
}
export function rankProducts(products,{currency='USD',condition='any',budget=null}={}){
  const seen=new Set();return products.filter(p=>p.currency===currency&&(!budget||(p.total??p.price)<=budget)&&(condition==='any'||p.condition===condition)&&!seen.has(p.url)&&seen.add(p.url))
  .sort((a,b)=>(a.total??a.price)-(b.total??b.price)||b.match-a.match).slice(0,30);
}
export function parseQuery(input){
  const raw=clean(input).slice(0,240);
  const m=raw.match(/(?:under|below|less than|up to|budget(?: of)?)\s*[$€£]?\s*(\d+(?:\.\d{1,2})?)/i);
  const query=raw.replace(/^(?:please\s+)?(?:i(?:'m| am)?\s+(?:looking for|want(?: to buy)?|need)|find me|find|show me)\s+/i,'').replace(/(?:under|below|less than|up to|budget(?: of)?)\s*[$€£]?\s*\d+(?:\.\d{1,2})?/i,'').trim();
  return {query,budget:m?Number(m[1]):null};
}
