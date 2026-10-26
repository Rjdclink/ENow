import test from 'node:test';
import assert from 'node:assert/strict';
import {discover} from '../src/providers.mjs';
import {marketplaces,selectCandidates} from '../src/marketplaces.mjs';
import {extractProducts,priceNumber,rankProducts,productMatch} from '../src/products.mjs';

test('blinds search checks every target and ranks $12 ahead of $160',async()=>{
  const calls=[],checks=[];
  const cheap={url:'https://www.walmart.com/ip/blinds',price:12,currency:'USD',total:null,match:1,title:'White mini blinds',verification:'seller_page'};
  const expensive={...cheap,url:'https://store.example.com/blinds',price:160};
  const found=await discover('blinds','US',{
    searcher:async q=>{calls.push(q);return [{url:cheap.url,title:cheap.title},{url:expensive.url,title:expensive.title}];},
    catalogSearch:async()=>({products:[{...expensive,verification:'price_index'}],leads:[]}),
    listingChecker:async l=>{checks.push(l.url);return {reason:'checked',products:l.url===cheap.url?[cheap]:[expensive]};}
  });
  for(const market of marketplaces)assert.ok(calls.some(q=>q.includes('site:'+market.domain)));
  assert.ok(checks.includes(cheap.url));
  assert.equal(rankProducts(found.products)[0].price,12);
  assert.equal(found.coverage.marketplaces.length,12);
  assert.equal(found.coverage.marketplaces.find(m=>m.id==='facebook').restricted,true);
  assert.ok(found.leads.some(l=>l.source==='Temu'&&l.status==='marketplace_search'));
});
test('a failed source is reported without inventing prices or coverage',async()=>{
  const found=await discover('blinds','US',{searcher:async()=>{throw Error('offline');},catalogSearch:async()=>({products:[],leads:[]})});
  assert.deepEqual(found.products,[]);assert.equal(found.coverage.exhaustive,false);
  assert.ok(found.coverage.marketplaces.every(m=>m.status==='unavailable'&&m.checked===0));
});
test('marketplace candidates are not crowded out by comparison catalogs',()=>{
  const links=Array.from({length:100},(_,i)=>({url:'https://catalog.example.com/'+i}));
  links.push({url:'https://www.temu.com/blinds-g-123.html'});
  assert.ok(selectCandidates(links).some(l=>l.url.includes('temu.com')));
});
test('ranges, multiple prices, negative prices and installment text cannot become a price',()=>{
  for(const text of ['$12 - $160','$12 to $160','$12 $160','-$12','4 payments of $40','12/month'])assert.equal(priceNumber(text),null,text);
  assert.equal(priceNumber('$12.00'),12);assert.equal(priceNumber('USD 160.00'),160);
});
test('seller microdata exposes inexpensive blinds without JSON-LD',()=>{
  const html='<div itemscope itemtype="https://schema.org/Product"><span itemprop="name">White mini blinds</span><div itemprop="offers" itemscope itemtype="https://schema.org/Offer"><meta itemprop="price" content="12.00"><meta itemprop="priceCurrency" content="USD"><link itemprop="availability" href="https://schema.org/InStock"></div></div>';
  assert.equal(extractProducts(html,'https://shop.example.com/blinds',{query:'blinds'})[0].price,12);
});
test('fresh seller price supersedes cheaper stale index observation',()=>{
  const p={url:'https://shop.example.com/blinds',title:'Blinds',currency:'USD',price:12,total:null,match:1,verification:'price_index'};
  assert.equal(rankProducts([p,{...p,price:160,verification:'seller_page'}])[0].price,160);
});
test('wholesale minimum quantities do not masquerade as a single-item price',()=>{
  const p={'@type':'Product',name:'Blinds',offers:{'@type':'Offer',price:12,priceCurrency:'USD',eligibleQuantity:{minValue:100}}};
  assert.deepEqual(extractProducts('<script type="application/ld+json">'+JSON.stringify(p)+'</script>','https://shop.example.com/blinds',{query:'blinds'}),[]);
});

test('blinds samples and swatches cannot outrank complete blinds',()=>{
  assert.equal(productMatch('Metallic Copperite Aluminum Mini-blinds swatch','blinds'),0);
  assert.equal(productMatch('White blinds sample','blinds'),0);
  assert.equal(productMatch('Mini blinds swatch','blinds swatch'),1);
});

test('blinds control switches do not masquerade as complete blinds',()=>{
  const title='Tubular Motor Ready WiFi Bluetooth Curtain Switch for Smart Roller Blinds';
  assert.equal(productMatch(title,'blinds'),0);
  assert.ok(productMatch(title,'blinds switch')>=.6);
  assert.equal(productMatch('Motorized smart roller blinds','blinds'),1);
});
