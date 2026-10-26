import test from 'node:test';
import assert from 'node:assert/strict';
import {productMatch,discoveryMatches,extractProducts} from '../src/products.mjs';
import {searchPhrases} from '../src/search-language.mjs';
import {parseCatalog} from '../src/shopsavvy.mjs';
import {discover} from '../src/providers.mjs';

test('singular and plural product names find the same category',()=>{
  assert.equal(productMatch('FLEX FXM401-2A 4 Tool Combo Kit, Drill Driver, Impact Driver','flex tools'),1);
  assert.equal(productMatch('Coffee Table with Hidden Storage Compartment','hidden compartments'),1);
  assert.equal(productMatch('Wall shelf with concealed cubbies','hidden cubby'),1);
  assert.equal(productMatch('Red tool boxes','red tool box'),1);
});
test('related wording does not drop hidden storage or confuse tool brands and types',()=>{
  assert.equal(productMatch('Secret compartment floating shelf','hidden cubby'),1);
  assert.equal(productMatch('Open cubby storage organizer','hidden cubby'),0);
  assert.equal(productMatch('Toy storage with hidden wheels and 5 open cubbies','hidden cubby'),0);
  assert.equal(productMatch('WEN Rotary Tool with Flex Shaft','FLEX tools'),0);
  assert.ok(productMatch('FLEX 24V Brushless Circular Saw','FLEX tools')>=.6);
  assert.ok(productMatch('FLEX 24V Brushless Circular Saw','FLEX drill')<.6);
});
test('exact identifiers remain mandatory rather than matching part of another model',()=>{
  assert.equal(productMatch('FLEX FX1171T Drill','FLEX FX1171'),0);
  assert.equal(productMatch('Sony WH-1000XM4 Headphones','Sony WH-1000XM5'),0);
  assert.equal(productMatch('Nike Air Force 11','Nike Air Force 1'),0);
  assert.ok(productMatch('Sony WH-1000XM5 Headphones','Sony WH1000XM5')>=.6);
});
test('plurals do not turn window blinds into blind-box toys',()=>{
  assert.equal(productMatch('Labubu blind box toy','blinds'),0);
});
test('related search wording works without an AI planner and preserves model constraints',()=>{
  assert.ok(searchPhrases('hidden cubby').includes('concealed storage'));
  assert.ok(searchPhrases('hidden compartments').includes('hidden compartment'));
  assert.ok(searchPhrases('FLEX tools').includes('FLEX power tools'));
  assert.ok(!searchPhrases('Sony WH-1000XM5',['Sony WH-1000XM4']).includes('Sony WH-1000XM4'));
});
test('real catalog responses with singular titles survive matching',()=>{
  const text='### 1. Flex FXM401-2A 4 Tool Combo Kit, Drill Driver\n- ASIN: N/A\n- Path: products/flex-kit\n\n### 2. WEN Rotary Tool with Flex Shaft\n- ASIN: B0784JHFKD\n- Path: products/wrong-brand\n\n**Usage:** free';
  assert.deepEqual(parseCatalog(text,'FLEX tools').map(p=>p.identifier),['products/flex-kit']);
});
test('seller metadata using a synonym produces a real priced offer',()=>{
  const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Floating shelf with secret compartment',offers:{price:29.99,priceCurrency:'USD'}})+'</script>';
  assert.equal(extractProducts(html,'https://shop.example.com/shelf',{query:'hidden cubby'})[0].price,29.99);
});
test('unpriced matching listings stay discoverable without invented prices',()=>{
  const leads=[{title:'FLEX 24V Drill Driver',url:'https://shop.example.com/products/drill',source:'Web',status:'price_unverified'}, {title:'WEN Rotary Tool with Flex Shaft',url:'https://shop.example.com/other'}, {title:'Search Amazon',url:'https://www.amazon.com/s?k=FLEX',status:'marketplace_search'}];
  const matches=discoveryMatches(leads,'FLEX tools');
  assert.equal(matches.length,1);assert.equal(matches[0].price,null);assert.equal(matches[0].checkedAt,null);
  assert.equal(discoveryMatches(leads,'FLEX tools',{excludeURLs:[leads[0].url]}).length,0);
});
test('catalog items with seller search links survive seller-page failures',async()=>{
  const listing={title:'FLEX FXM401-2A 4 Tool Combo Kit',url:'https://www.google.com/search?tbm=shop&q=FLEX+FXM401-2A',source:'ShopSavvy catalog',status:'catalog_search'};
  const seen=[];
  const r=await discover('FLEX tools','US',{searcher:async q=>{seen.push(q);return [];},catalogSearch:async()=>({products:[],leads:[listing]}),listingChecker:async()=>({reason:'unavailable',products:[]})});
  assert.equal(discoveryMatches(r.leads,'FLEX tools')[0].verification,'catalog_search');
  assert.ok(seen.some(q=>q.toLowerCase()==='flex tool'));assert.ok(seen.includes('FLEX power tools'));
});

test('shopping discovery excludes software, case studies, and unrelated flex-head tools',()=>{
 const leads=[
  {title:'Flex tool time stretching in Logic Pro for Mac - Apple Support',url:'https://support.apple.com/guide/logicpro/123'},
  {title:'FLEX Tools | Storyblok Case Study',url:'https://www.storyblok.com/cs/flex-tools'},
  {title:'Flex Head Metric Wrenches - The Home Depot',url:'https://www.homedepot.com/b/Tools/Wrenches'},
  {title:'FLEX Power Tools',url:'https://www.lowes.com/b/flex-power-tools'}
 ];
 assert.deepEqual(discoveryMatches(leads,'FLEX tools').map(p=>p.title),['FLEX Power Tools']);
});
