import test from 'node:test';
import assert from 'node:assert/strict';
import {extractProducts,rankProducts,productMatch,priceNumber,canonicalURL,parseQuery} from '../src/products.mjs';
import {publicAddress,publicURL} from '../src/network.mjs';
import {parseDuck} from '../src/providers.mjs';
import {extractJSON,planSearch,reviewMatches} from '../src/ai.mjs';
import app from '../src/index.mjs';

const page=product=>'<script type="application/ld+json">'+JSON.stringify(product)+'</script>';
const base={name:'Sony WH-1000XM5 Black Headphones','@type':'Product',image:'https://shop.example.com/product.jpg',offers:{'@type':'Offer',price:'199.99',priceCurrency:'USD',availability:'https://schema.org/InStock',itemCondition:'https://schema.org/NewCondition',url:'https://shop.example.com/sony'}};
test('offers require a current numeric price, currency and matching product',()=>{
  assert.equal(extractProducts(page(base),'https://shop.example.com/sony',{query:'Sony WH-1000XM5'}).length,1);
  for(const patch of [{price:'not listed'},{priceCurrency:undefined},{availability:'https://schema.org/OutOfStock'},{priceValidUntil:'2020-01-01'}])assert.equal(extractProducts(page({...base,offers:{...base.offers,...patch}}),'https://shop.example.com/sony',{query:'Sony WH-1000XM5'}).length,0);
});
test('aggregate lowPrice cannot masquerade as an actual purchasable offer',()=>{
  assert.deepEqual(extractProducts(page({...base,offers:{'@type':'AggregateOffer',lowPrice:19,priceCurrency:'USD'}}),'https://shop.example.com/sony',{query:'Sony WH-1000XM5'}),[]);
});
test('does not confuse models, accessories or broken items with the item',()=>{
  assert.equal(productMatch('Sony WH-1000XM4 Headphones','Sony WH-1000XM5'),0);
  assert.equal(productMatch('Case for Sony WH-1000XM5','Sony WH-1000XM5'),0);
  assert.equal(productMatch('Sony WH-1000XM5 broken for parts','Sony WH-1000XM5'),0);
  assert.ok(productMatch('Case for Sony WH-1000XM5','Sony WH-1000XM5 case')>.9);
});
test('shipping is counted only for the selected destination and currency',()=>{
  const product={...base,offers:{...base.offers,shippingDetails:{shippingDestination:{addressCountry:'US'},shippingRate:{value:5,currency:'USD'}}}};
  const us=extractProducts(page(product),'https://shop.example.com/sony',{query:'Sony WH-1000XM5',country:'US'})[0];assert.equal(us.total,204.99);
  const gb=extractProducts(page(product),'https://shop.example.com/sony',{query:'Sony WH-1000XM5',country:'GB'})[0];assert.equal(gb.shipping,null);assert.equal(gb.total,null);
});
test('ranking deduplicates listings and never compares different currencies',()=>{
  const p={url:'https://shop.example.com/a',price:20,currency:'USD',shipping:null,total:null,condition:'new',match:1};
  const r=rankProducts([p,p,{...p,url:'https://shop.example.com/b',price:1,currency:'EUR'},{...p,url:'https://shop.example.com/c',price:25},{...p,url:'https://shop.example.com/d',price:5,condition:'used'}],{currency:'USD',condition:'new',budget:22});assert.deepEqual(r,[p]);
});
test('parses money and separates natural-language budget from model search',()=>{
  assert.equal(priceNumber('1,299.95'),1299.95);assert.equal(priceNumber('1.299,95'),1299.95);assert.equal(priceNumber('0'),null);
  assert.deepEqual(parseQuery('Find me Sony WH-1000XM5 under $250'),{query:'Sony WH-1000XM5',budget:250});
});
test('only public HTTPS URLs can be fetched or presented',()=>{
  for(const u of ['http://shop.com','https://127.0.0.1/a','https://10.0.0.1/','https://169.254.169.254/','https://user:pass@shop.com','https://shop.com:8443','https://localhost/','file:///tmp/a','javascript:alert(1)'])assert.throws(()=>publicURL(u));
  for(const ip of ['::1','::ffff:127.0.0.1','fe80::1','10.1.1.1','172.16.1.1','192.168.0.1','100.64.0.1'])assert.equal(publicAddress(ip),false);
  assert.equal(publicAddress('8.8.8.8'),true);assert.equal(canonicalURL('https://shop.com/item?utm_source=x&size=9#price'),'https://shop.com/item?size=9');
});
test('search parser unwraps engine links but preserves direct seller evidence',()=>{
  const r=parseDuck('<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fshop.example.com%2Fp">A product</a><a class="result__snippet">A matching listing</a></div>');assert.equal(r[0].url,'https://shop.example.com/p');assert.equal(r[0].source,'DuckDuckGo');assert.ok(!('price' in r[0]));
});
test('AI planning cannot replace the original requested product',async()=>{
  const fetcher=async()=>Response.json({choices:[{message:{content:JSON.stringify({query:'wrong product',alternates:['Sony WH-1000XM5 sale']})}}]});const r=await planSearch('Sony WH-1000XM5',{fetcher});assert.equal(r.query,'Sony WH-1000XM5');assert.equal(r.status,'active');
});
test('AI review can reject evidence, but cannot create offers or alter prices',async()=>{
  const products=[{id:'one',price:100,title:'A'},{id:'two',price:200,title:'B'}];
  const fetcher=async()=>Response.json({choices:[{message:{content:'{"reject_ids":["two","invented"],"price":1}'}}]});const r=await reviewMatches('A',products,{fetcher});assert.deepEqual(r.products,[products[0]]);
});
test('API rejects oversized and malformed queries',async()=>{
  let r=await app.fetch(new Request('https://e-verse.example.com/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'x'.repeat(241)})}));assert.equal(r.status,400);
  r=await app.fetch(new Request('https://e-verse.example.com/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:'a'.repeat(16001)}));assert.equal(r.status,400);
});
test('JSON worker output handles fences without executing text',()=>{assert.deepEqual(extractJSON('```json\n{"query":"shoes"}\n```'),{query:'shoes'});assert.throws(()=>extractJSON('not JSON'));});
