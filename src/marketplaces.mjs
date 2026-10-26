// Each marketplace gets its own discovery query and reserved verification slots.
export const marketplaces = [
  {id:'facebook',name:'Facebook Marketplace',domain:'facebook.com',path:'/marketplace/item/',search:q=>'https://www.facebook.com/marketplace/search/?query='+q,restricted:true},
  {id:'temu',name:'Temu',domain:'temu.com',search:q=>'https://www.temu.com/search_result.html?search_key='+q},
  {id:'alibaba',name:'Alibaba',domain:'alibaba.com',discoveryPath:'/product-detail/',search:q=>'https://www.alibaba.com/trade/search?SearchText='+q},
  {id:'ebay',name:'eBay',domain:'ebay.com',discoveryPath:'/itm/',search:q=>'https://www.ebay.com/sch/i.html?_nkw='+q+'&_sop=15'},
  {id:'amazon',name:'Amazon',domain:'amazon.com',discoveryPath:'/dp/',search:q=>'https://www.amazon.com/s?k='+q},
  {id:'google',name:'Google Shopping',domain:'google.com',path:'/shopping',search:q=>'https://www.google.com/search?tbm=shop&q='+q},
  {id:'walmart',name:'Walmart',domain:'walmart.com',discoveryPath:'/ip/',search:q=>'https://www.walmart.com/search?q='+q},
  {id:'target',name:'Target',domain:'target.com',discoveryPath:'/p/',search:q=>'https://www.target.com/s?searchTerm='+q},
  {id:'homedepot',name:'Home Depot',domain:'homedepot.com',discoveryPath:'/p/',search:q=>'https://www.homedepot.com/s/'+q},
  {id:'lowes',name:'Lowe’s',domain:'lowes.com',discoveryPath:'/pd/',search:q=>'https://www.lowes.com/search?searchTerm='+q},
  {id:'aliexpress',name:'AliExpress',domain:'aliexpress.com',search:q=>'https://www.aliexpress.com/w/wholesale-'+q+'.html'},
  {id:'wayfair',name:'Wayfair',domain:'wayfair.com',search:q=>'https://www.wayfair.com/keyword.php?keyword='+q}
];
export function belongsToMarket(url,market){
  try{const u=new URL(url);return (u.hostname===market.domain||u.hostname.endsWith('.'+market.domain))&&(!market.path||u.pathname.startsWith(market.path));}catch{return false;}
}
export function marketplaceQueries(query){return marketplaces.map(m=>({...m,query:query+' price site:'+m.domain,url:m.search(encodeURIComponent(query))}));}
export function selectCandidates(links,limit=60){
  const seen=new Set(),out=[],counts=new Map();
  const add=l=>{if(!l?.url||seen.has(l.url)||out.length>=limit)return;const market=marketplaces.find(m=>belongsToMarket(l.url,m));if(market&&(counts.get(market.id)||0)>=5)return;if(market)counts.set(market.id,(counts.get(market.id)||0)+1);seen.add(l.url);out.push(l);};
  // Round-robin prevents a large comparison feed from crowding out cheap retailers.
  for(let slot=0;slot<3;slot++)for(const market of marketplaces)add(links.filter(l=>belongsToMarket(l.url,market))[slot]);
  links.forEach(add);return out;
}
