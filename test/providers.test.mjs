import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCatalog,parseOffers} from '../src/shopsavvy.mjs';
import {extractProducts,extractSellerLinks,sellerURL,productMatch} from '../src/products.mjs';
import {parseFreeSerp} from '../src/providers.mjs';

test('catalog parser preserves identifiers and ignores accessories',()=>{
 const text='### 1. Sony WH-1000XM5 Headphones with Carrying Case\n- Brand: Sony\n- Path: products/actual\n\n### 2. Case for Sony WH-1000XM5\n- Path: products/accessory\n\n**Usage:** free';
 assert.deepEqual(parseCatalog(text,'Sony WH-1000XM5').map(p=>p.identifier),['products/actual']);
 assert.equal(productMatch('Nike Air Force 2','Nike Air Force 1'),0);
});
test('price-index observations retain dates, reject stale prices and honor latest stock',()=>{
 const record=(n,price,date,stock='in')=>`${n}. **Store** - $${price}\n   - Availability: ${stock}\n   - Condition: new\n   - Last checked: ${date}\n   - [View Offer](https://store.example.com/item)\n\n`;
 const header='## 💰 Current Offers for Sony WH-1000XM5 Headphones\n\n';
 const now=Date.parse('2026-10-25T12:00:00Z');
 let r=parseOffers(header+record(1,'200','2026-10-25T00:00:00Z')+record(2,'100','2026-10-01T00:00:00Z'),'Sony WH-1000XM5',{now});
 assert.equal(r.products.length,1);assert.equal(r.products[0].price,200);assert.equal(r.products[0].verification,'price_index');assert.equal(r.products[0].shipping,null);
 r=parseOffers(header+record(1,'200','2026-10-25T00:00:00Z','out')+record(2,'100','2026-10-24T00:00:00Z'),'Sony WH-1000XM5',{now});assert.equal(r.products.length,0);
 assert.equal(parseOffers(header+record(1,'100','2026-10-01T00:00:00Z'),'Sony WH-1000XM5',{now}).products.length,0);
});
test('comparison pages discover sellers without falsely refreshing their prices',()=>{
 const link='https://shopsavvy.com/redirect?url='+encodeURIComponent('https://store.example.com/item');
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Sony WH-1000XM5',offers:{'@type':'Offer',url:link,price:99,priceCurrency:'USD'}})+'</script>';
 assert.equal(sellerURL(link),'https://store.example.com/item');
 assert.deepEqual(extractProducts(html,'https://shopsavvy.com/product',{query:'Sony WH-1000XM5'}),[]);
 assert.equal(extractSellerLinks(html,'https://shopsavvy.com/product','Sony WH-1000XM5')[0].url,'https://store.example.com/item');
 const misleading=html+'<meta property="og:type" content="product"><meta property="og:title" content="Sony WH-1000XM5"><meta property="product:price:amount" content="12"><meta property="product:price:currency" content="USD">';
 assert.deepEqual(extractProducts(misleading,'https://shopsavvy.com/product',{query:'Sony WH-1000XM5'}),[]);
 assert.deepEqual(extractProducts(misleading,'https://comparison.example.com/product',{query:'Sony WH-1000XM5'}),[]);
});
test('web-index fallback is never represented as a full web search',()=>{
 assert.throws(()=>parseFreeSerp({ok:true,index:'sites',engine_fallback:true,results:[]}));
 assert.deepEqual(parseFreeSerp({ok:true,index:'web',results:[{title:'A',url:'javascript:alert(1)'}]}),[]);
});
