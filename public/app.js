import {initDonations} from './donation.js';
import {initInstall} from './install.js';
initInstall();
const $=id=>document.getElementById(id);
const api=window.EVERSE_API||window.ENOW_API||'';
// Copy a stable, public URL, without Facebook tracking parameters or app links.
$('copy-site-link').onclick=async()=>{
  const field=$('share-url');
  try{
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(field.value);
    $('share-status').textContent='Link copied. Paste it directly into your Facebook post or message.';
  }catch{
    field.focus();field.select();field.setSelectionRange(0,field.value.length);
    $('share-status').textContent='Select Copy from your browser, then paste this link into your post.';
  }
};
let controller=null,offers=[],expanded=false,photoToken=0;
let saved=[];try{saved=JSON.parse(localStorage.getItem('enow-saved')||'[]');if(!Array.isArray(saved))saved=[];}catch{}
const safeURL=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:null;}catch{return null;}};
const money=(n,c)=>new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(n);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(text,{busy=false,error=false}={}){$('status').hidden=!text;$('status').className='status'+(error?' error':'');$('status').replaceChildren();if(busy){const spin=document.createElement('span');spin.className='spinner';$('status').append(spin);}$('status').append(document.createTextNode(text));}
function saveState(){try{localStorage.setItem('enow-saved',JSON.stringify(saved.slice(0,60)));}catch{}$('saved-count').hidden=!saved.length;$('saved-count').textContent=saved.length?' · '+saved.length:'';}
function setBusy(busy){$('search-button').disabled=busy;$('photo-button').disabled=busy;$('cancel-search').hidden=!busy;$('search-form').setAttribute('aria-busy',String(busy));}
function card(p,index,{inSaved=false}={}){
  const url=safeURL(p.url);if(!url)return document.createDocumentFragment();
  const image=safeURL(p.image);const isSaved=saved.some(x=>x.id===p.id);
  const el=document.createElement('article');el.className='offer-card';
  const price=p.total??p.price;
  const shipping=p.shipping===0?'Free shipping':p.shipping!==null?money(p.shipping,p.currency)+' shipping included':'Shipping calculated by seller';
  const age=Math.max(0,Math.round((Date.now()-Date.parse(p.checkedAt))/60000));const when=(p.verification==='price_index'?'Source checked ':'Checked ')+(age<1?'just now':age<60?age+'m ago':new Date(p.checkedAt).toLocaleDateString());
  el.innerHTML=`<div class="offer-image">${image?`<img src="${escape(image)}" alt="${escape(p.title)}" loading="lazy" referrerpolicy="no-referrer">`:'<span class="image-fallback">e↗</span>'}${index===0&&!inSaved?'<span class="offer-rank">LOWEST PRICE FOUND</span>':''}<button class="save-button ${isSaved?'saved':''}" aria-label="${isSaved?'Unsave':'Save'} ${escape(p.title)}" aria-pressed="${isSaved}"><svg viewBox="0 0 24 24"><path d="m12 20-8-8a5 5 0 0 1 8-6 5 5 0 0 1 8 6Z"/></svg></button></div><div class="offer-body"><div class="merchant">${escape(p.merchant)}</div><h3 class="offer-title">${escape(p.title)}</h3><div class="price-row"><span class="price">${escape(money(price,p.currency))}</span><span class="price-note">${p.total===null?'item price':'with shipping'}</span></div><p class="shipping">${escape(shipping)} · before tax</p><a class="view-offer" href="${escape(url)}" target="_blank" rel="noopener noreferrer">See at store <span>↗</span></a><div class="offer-meta"><span>${escape(p.condition==='unspecified'?'Check condition':p.condition)}${p.availability==='unknown'?' · Check stock':''}</span><span>${escape(when)}</span></div>${p.sourceURL&&safeURL(p.sourceURL)?`<a class="source-credit" href="${escape(safeURL(p.sourceURL))}" target="_blank" rel="noopener noreferrer">Price source: ${escape(p.source)}</a>`:''}</div>`;
  el.querySelector('img')?.addEventListener('error',e=>{e.target.replaceWith(Object.assign(document.createElement('span'),{className:'image-fallback',textContent:'e↗'}));},{once:true});
  el.querySelector('.save-button').onclick=()=>{const ix=saved.findIndex(x=>x.id===p.id);if(ix>=0)saved.splice(ix,1);else saved.unshift(p);saveState();renderOffers();if(!$('saved-section').hidden)renderSaved();};
  el.querySelector('.view-offer').onclick=e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();openDonation(url,p.merchant);};
  el.addEventListener('click',e=>{if(e.target.closest('button,a'))return;openDonation(url,p.merchant);});
  return el;
}
function renderOffers(){$('offer-grid').replaceChildren(...offers.slice(0,expanded?12:3).map((p,i)=>card(p,i)));$('show-more').hidden=offers.length<=3||expanded;}
function renderSaved(){$('saved-grid').replaceChildren(...saved.filter(p=>safeURL(p.url)&&Number.isFinite(p.price)).map((p,i)=>card(p,i,{inSaved:true})));if(!saved.length)$('saved-grid').innerHTML='<p class="empty-state">A good find is worth keeping. Tap a heart to save it here.</p>';}
function showResults(data){
  offers=data.results||[];expanded=false;renderOffers();$('results').hidden=false;$('inspiration').hidden=offers.length>0;
  $('results-title').textContent=offers.length?'Your best matches.':'Let’s keep looking.';
  const count=offers.length;
  $('results-summary').textContent=count>=3?`The lowest ${Math.min(3,count)} matching prices found · ${data.options.currency}`:data.message;
  if(!count)$('offer-grid').innerHTML='<div class="empty-state">'+escape(data.coverage.discovered?'These stores may have it. Open Search details below.':'The search sources are temporarily unavailable. Try again shortly.')+'</div>';
  $('coverage-note').textContent=`${data.coverage.discovered} listings discovered; ${data.coverage.checked} pages checked. ${data.cached?'Results cached for up to five minutes. ':''}Coverage depends on public access. Price-index records may be up to seven days old; see each card’s source date. Prices exclude tax; unknown shipping is shown separately. Size, delivery eligibility, and final price should be checked at the store. ${data.coverage.restricted?'Some Marketplace listings require opening Facebook.':''}`;
  $('leads').replaceChildren();for(const item of data.leads||[]){const url=safeURL(item.url);if(!url)continue;const a=document.createElement('a');a.className='lead';a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=item.title;const note=document.createElement('span');note.textContent=new URL(url).hostname+' · '+(item.status==='restricted'?'Open Marketplace to check':'Price not verified');a.append(note);$('leads').append(a);}
  $('search-details').open=!count;
  status(count?'':data.message,{error:false});
  $('results').scrollIntoView({behavior:'smooth',block:'start'});
}
async function search(){
  const query=$('query').value.trim();if(query.length<2){$('query').focus();return;}
  controller?.abort();controller=new AbortController();const current=controller;const timer=setTimeout(()=>current.abort('timeout'),110000);
  setBusy(true);$('saved-section').hidden=true;status('Looking across stores for your best matches…',{busy:true});
  const [country,currency]=$('country').value.split('|');try{localStorage.setItem('enow-country',$('country').value);}catch{}
  try{
    const r=await fetch(api+'/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,country,currency,condition:$('condition').value,budget:$('budget').value||null}),signal:current.signal});
    const data=await r.json();if(!r.ok)throw new Error(data.error||'Search is unavailable right now.');if(current!==controller)return;showResults(data);
  }catch(e){if(current!==controller)return;status(e.name==='AbortError'||e.name==='TypeError'?(current.signal.reason==='timeout'?'The search took too long. Please try again.':current.signal.aborted?'Search cancelled.':'Could not connect. Please try again.'):e.message,{error:!current.signal.aborted});}
  finally{clearTimeout(timer);if(current===controller){controller=null;setBusy(false);}}
}
$('search-form').addEventListener('submit',e=>{e.preventDefault();search();});
$('query').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(!$('search-button').disabled)search();}});
$('cancel-search').onclick=()=>controller?.abort();
$('refine-toggle').onclick=()=>{const open=$('refine').hidden;$('refine').hidden=!open;$('refine-toggle').setAttribute('aria-expanded',String(open));};
$('show-more').onclick=()=>{expanded=true;renderOffers();};
$('new-search').onclick=()=>{$('query').focus();$('query').select();$('search-form').scrollIntoView({behavior:'smooth',block:'center'});};
document.querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>{$('query').value=b.dataset.query;$('budget').value='';search();});
$('saved-toggle').onclick=()=>{$('saved-section').hidden=false;$('results').hidden=true;$('inspiration').hidden=true;renderSaved();$('saved-section').scrollIntoView({behavior:'smooth'});};
$('saved-close').onclick=()=>{$('saved-section').hidden=true;$('results').hidden=!offers.length;$('inspiration').hidden=!!offers.length;};
function dialog(html){$('dialog-content').innerHTML=html;$('info-dialog').showModal();}
$('how-toggle').onclick=()=>dialog('<p class="eyebrow small">A LITTLE LESS EFFORT</p><h2>Find your thing.</h2><ol><li>Describe what you want, or add a photo.</li><li>We discover stores and check matching product offers.</li><li>Compare the lowest prices found, then buy directly from the store.</li></ol><p>Looking for something specific? Add its model, size, or color. Three offers are shown when three matching prices are available. Source check dates appear on every card.</p>');
$('privacy-toggle').onclick=()=>dialog('<h2>Clear search. Clear choices.</h2><p>Your photo is processed on your device. Its extracted text and description, and typed shopping requests, are sent to <a href="https://vireonix.ai/privacy" target="_blank" rel="noopener noreferrer">Vireonix</a> for interpretation. Vireonix may retain prompts and use them for model training. Avoid including private information.</p><p>Search phrases go to web search providers. Results are cached for up to five minutes in Neon. Saved finds stay in this browser. Rate limits keep the service free.</p><p>We search discoverable online stores, not every page on the internet. Access restrictions, stock changes, taxes, shipping destinations, and product variants can affect results. Prices come from seller pages, official retailer APIs, or ShopSavvy’s price index. Index prices retain their original check date and expire from our comparison after seven days. Source checking is not a seller trust endorsement.</p>');
$('dialog-close').onclick=()=>$('info-dialog').close();$('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog'))$('info-dialog').close();});
try{const c=localStorage.getItem('enow-country');if([...$('country').options].some(o=>o.value===c))$('country').value=c;}catch{}saveState();

// Photo processing stays in the browser. Only textual evidence goes to Vireonix.
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s);});}
async function imageData(file){
  let blob=file;if(/\.hei[cf]$/i.test(file.name)||/image\/hei[cf]/i.test(file.type)){
    if(!window.heic2any)await loadScript('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js');
    blob=await window.heic2any({blob:file,toType:'image/jpeg',quality:.85});if(Array.isArray(blob))blob=blob[0];
  }
  const url=URL.createObjectURL(blob);try{const img=new Image();img.src=url;await img.decode();if(img.width*img.height>80000000)throw new Error('Choose a smaller image.');const scale=Math.min(1,1400/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.88);}finally{URL.revokeObjectURL(url);}
}
async function photo(file){
  if(!file)return;if(file.size>15*1024*1024){status('Please choose an image smaller than 15 MB.',{error:true});return;}
  if(!/^image\/(jpeg|png|webp|gif|avif|heic|heif)$/i.test(file.type)&&!(/\.hei[cf]$/i.test(file.name)&&!file.type)){status('Choose a JPG, PNG, WebP, GIF, AVIF, or HEIC photo.',{error:true});return;}
  const token=++photoToken;setBusy(true);$('cancel-search').hidden=true;status('Reading your photo on this device…',{busy:true});
  try{
    const data=await imageData(file);if(token!==photoToken)return;$('photo-preview').hidden=false;$('photo-thumbnail').src=data;$('photo-name').textContent=file.name;
    if(!window.Tesseract)await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js');
    const ocr=await window.Tesseract.createWorker('eng');let text='';try{const result=await ocr.recognize(data);if(result.data.confidence>35)text=result.data.text.replace(/\s+/g,' ').trim().slice(0,1200);}finally{await ocr.terminate();}
    let caption='';if(text.length<8){status('Recognizing the item. The first photo loads a free vision model…',{busy:true});caption=await captionPhoto(data);}
    if(token!==photoToken)return;
    if(!caption&&!text)throw new Error('Add a few words about the item, then search.');
    const r=await fetch(api+'/api/photo-query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,caption}),signal:AbortSignal.timeout(20000)});const result=await r.json();if(!r.ok)throw new Error(result.error||'Add a few words about the item, then search.');
    $('query').value=result.query;status(result.confidence==='low'?'Looking for visually similar items. Add a brand or model for an exact match.':'Photo understood. Finding matching offers…');
    setBusy(false);await search();
  }catch(e){if(token===photoToken)status(e.message.includes('few words')?e.message:'Could not identify this photo. Add a few words about it, then search.',{error:true});}
  finally{if(token===photoToken)setBusy(false);}
}
function captionPhoto(data){return new Promise((resolve,reject)=>{const worker=new Worker(new URL('vision-worker.js',import.meta.url),{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(new Error('Vision timeout'));},150000);worker.onmessage=e=>{if(e.data.type==='result'){clearTimeout(timer);worker.terminate();resolve(e.data.caption);}if(e.data.type==='error'){clearTimeout(timer);worker.terminate();reject(new Error(e.data.error));}};worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(new Error('Vision unavailable'));};worker.postMessage({image:data});});}
$('photo-button').onclick=()=>$('photo-input').click();$('photo-input').onchange=()=>photo($('photo-input').files[0]);
$('remove-photo').onclick=()=>{photoToken++;$('photo-preview').hidden=true;$('photo-thumbnail').removeAttribute('src');$('photo-input').value='';setBusy(false);status('');};
for(const event of ['dragenter','dragover'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.add('drag-over');});
for(const event of ['dragleave','drop'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.remove('drag-over');if(event==='drop'&&!$('photo-button').disabled)photo(e.dataTransfer.files[0]);});
document.addEventListener('paste',e=>{const file=[...e.clipboardData.items].find(x=>x.type.startsWith('image/'))?.getAsFile();if(file&&!$('photo-button').disabled){e.preventDefault();photo(file);}});


const openDonation=initDonations();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
