export const donationMethods = [
  {id:'cash',name:'Cash App',handle:'$rjdclink',symbol:'$',color:'#00a64f',url:'https://cash.app/$rjdclink'},
  {id:'venmo',name:'Venmo',handle:'@Rjdclink',symbol:'V',color:'#0082d1',url:'https://venmo.com/Rjdclink'},
  {id:'chime',name:'Chime',handle:'$Rjdclink',symbol:'c',color:'#198359',url:'https://app.chime.com/login'},
  {id:'paypal',name:'PayPal',handle:'brclink1985@gmail.com',symbol:'P',color:'#164da3',url:'https://www.paypal.com/myaccount/transfer/'}
];
const key='enow-donation-return';
export const remainingSeconds=(deadline,now=Date.now())=>Math.max(0,Math.ceil((deadline-now)/1000));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};

export function initDonations(){
  const $=id=>document.getElementById(id),dialog=$('donation-dialog'),content=$('donation-content');
  let state=null,timer=null;
  const persist=()=>{try{state?sessionStorage.setItem(key,JSON.stringify(state)):sessionStorage.removeItem(key);}catch{}};
  const stop=()=>{clearInterval(timer);timer=null;};
  const cancel=()=>{stop();state=null;persist();};
  const show=()=>{if(!dialog.open)dialog.showModal();};
  function leave(){const url=safeURL(state?.url);cancel();dialog.close();if(url)window.location.assign(url);}
  function open(url,merchant){
    url=safeURL(url);if(!url)return;
    stop();state={url,merchant:String(merchant||'the store'),phase:'choose'};persist();
    content.innerHTML=`<div class="donation-emblem" aria-hidden="true">♡</div><p class="eyebrow small">A LITTLE SUPPORT. MORE GREAT FINDS.</p><h2 id="donation-title">Good finds.<br><span>Made possible by you.</span></h2><p class="donation-intro">Robert Clinkenbeard worked hard to make smarter shopping effortless. Give $3 or more to support his work and keep ENow running. Every contribution means a lot.</p><span class="suggested">Suggested donation: $3 or more</span><h3 class="donation-question">Choose a way to give.</h3><div class="donation-methods">${donationMethods.map(m=>`<button class="donation-method ${m.id}" data-donation="${m.id}"><span class="payment-icon" style="--payment-color:${m.color}">${m.symbol}</span><span><span class="payment-name">${m.name}</span><strong>${m.handle}</strong></span><span class="payment-arrow">↗</span></button>`).join('')}</div><button id="donation-skip" class="donation-skip">Continue without donating ↗</button><p class="donation-footnote">Optional support · Your purchase stays with the seller.</p>`;
    content.querySelectorAll('[data-donation]').forEach(b=>b.onclick=()=>choose(donationMethods.find(m=>m.id===b.dataset.donation)));
    $('donation-skip').onclick=leave;show();
  }
  function choose(method,resume=false){
    stop();if(!resume){state={...state,phase:'countdown',method:method.id,deadline:Date.now()+60000};persist();}
    content.innerHTML=`<div class="payment-icon payment-icon-large" style="--payment-color:${method.color}">${method.symbol}</div><p class="eyebrow small">SUPPORT ENOW WITH ${method.name.toUpperCase()}</p><h2 id="donation-title">A little kindness.<br><span>A big difference.</span></h2><p>Suggested donation: <strong>$3 or more</strong><br>Send to Robert Clinkenbeard at</p><div class="donation-handle ${method.id==='paypal'?'email':''}">${method.handle}</div><div class="payment-actions"><button id="copy-donation" class="copy-donation">Copy ${method.id==='paypal'?'email':'handle'} ⧉</button><a class="payment-open" href="${method.url}" target="_blank" rel="noopener noreferrer">Open ${method.name} ↗</a></div><p class="donation-memo">${method.id==='chime'?'In Chime, choose Pay Anyone and paste the handle.':method.id==='paypal'?'In PayPal, choose Send and paste the email.':'Memo, if needed: donation.'}</p><div class="donation-countdown"><div class="countdown-track"><span id="donation-progress"></span></div><p>Your find is waiting. Continuing in <strong id="donation-seconds">60</strong>s.</p></div><button id="donation-change" class="text-button">Choose another method</button><p class="donation-footnote">You send the donation yourself. ENow never charges you automatically.</p>`;
    $('copy-donation').onclick=async()=>{try{await navigator.clipboard.writeText(method.handle);if($('copy-donation'))$('copy-donation').textContent='Copied ✓';}catch{if($('copy-donation'))$('copy-donation').textContent='Press and hold the handle to copy';}};
    $('donation-change').onclick=()=>open(state.url,state.merchant);
    show();timer=setInterval(tick,250);tick();
  }
  function thank(resume=false){
    stop();if(!resume){state={...state,phase:'thanks',redirectAt:Date.now()+2800};persist();}
    content.innerHTML=`<div class="donation-emblem thank-emblem" aria-hidden="true">♡</div><p class="eyebrow small">YOU HELP KEEP THE FINDS COMING</p><h2 id="donation-title">Thank you for<br><span>your donation.</span></h2><p>Robert sincerely appreciates your support.</p><div class="seller-departure"><span class="spinner"></span> Taking you to ${esc(state.merchant)}…</div><button id="donation-continue" class="copy-donation">Continue to seller ↗</button><p class="donation-footnote">A thank-you message, not a payment receipt.</p>`;
    $('donation-continue').onclick=leave;show();timer=setInterval(tick,250);
  }
  function tick(){
    if(!state||!dialog.open)return;
    if(state.phase==='countdown'){
      const n=remainingSeconds(state.deadline);if($('donation-seconds'))$('donation-seconds').textContent=n;if($('donation-progress'))$('donation-progress').style.width=n/60*100+'%';
      if(n===0&&!document.hidden)thank();
    }else if(state.phase==='thanks'&&Date.now()>=state.redirectAt&&!document.hidden)leave();
  }
  $('donation-close').onclick=()=>{cancel();dialog.close();};
  dialog.addEventListener('cancel',cancel);dialog.addEventListener('close',()=>{if(!dialog.open)cancel();});
  document.addEventListener('visibilitychange',tick);window.addEventListener('pageshow',tick);
  try{const previous=JSON.parse(sessionStorage.getItem(key)||'null');if(previous&&safeURL(previous.url)&&Date.now()-(previous.deadline||previous.redirectAt||0)<3600000){state=previous;if(state.phase==='countdown'&&Number.isFinite(state.deadline)){const m=donationMethods.find(m=>m.id===state.method);if(m)choose(m,true);else cancel();}else if(state.phase==='thanks'&&Number.isFinite(state.redirectAt))thank(true);else cancel();}}catch{cancel();}
  return open;
}
