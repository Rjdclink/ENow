export const donationMethods = [
  {id:'cash',name:'Cash App',handle:'$rjdclink',symbol:'$',color:'#00a64f',url:'https://cash.app/$rjdclink/3',manualAmount:true,instructions:'Send $3 to this $Cashtag. If Cash App leaves the amount blank, enter or paste 3.00. Memo: donation.'},
  {id:'venmo',name:'Venmo',handle:'@Rjdclink',symbol:'V',color:'#0082d1',url:'https://account.venmo.com/payment-link?amount=3&note=donation&recipients=Rjdclink&txn=pay',instructions:'Your Venmo payment link includes the recipient, $3 and the note donation.'},
  {id:'chime',name:'Chime',handle:'$Rjdclink',symbol:'c',color:'#198359',url:'https://app.chime.com/login',manualAmount:true,instructions:'In the Chime app, open Pay → Pay Anyone, search $Rjdclink, and enter $3. Add donation as the note. Chime requires you to enter the amount.'},
  {id:'paypal',name:'PayPal',handle:'brclink1985@gmail.com',symbol:'P',color:'#164da3',url:'https://www.paypal.com/donate/?business=brclink1985%40gmail.com&currency_code=USD&amount=3&item_name=donation',instructions:'Your PayPal donation form includes the recipient and a suggested $3 donation.'}
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
    content.innerHTML=`<div class="donation-emblem" aria-hidden="true">♡</div><p class="eyebrow small">A LITTLE SUPPORT. MORE GREAT FINDS.</p><h2 id="donation-title">Good finds.<br><span>Made possible by you.</span></h2><p class="donation-intro">Robert Clinkenbeard worked hard to make smarter shopping effortless. Give $3 or more to support his work and keep e-verse running. Every contribution means a lot.</p><span class="suggested">Suggested donation: $3 or more</span><h3 class="donation-question">Choose a way to give.</h3><div class="donation-methods">${donationMethods.map(m=>`<a class="donation-method ${m.id}" data-donation="${m.id}" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" aria-label="Donate with ${m.name}"><span class="payment-icon" style="--payment-color:${m.color}">${m.symbol}</span><span><span class="payment-name">${m.name}</span><strong>${m.handle}</strong></span><span class="payment-arrow">↗</span></a>`).join('')}</div><button id="donation-skip" class="donation-skip">Continue without donating ↗</button><p class="donation-footnote">Opens your payment provider · Optional support.</p>`;
    content.querySelectorAll('[data-donation]').forEach(b=>b.onclick=()=>choose(donationMethods.find(m=>m.id===b.dataset.donation)));
    $('donation-skip').onclick=leave;show();
  }
  function choose(method,resume=false){
    stop();if(!resume){state={...state,phase:'countdown',method:method.id,deadline:Date.now()+60000};persist();}
    content.innerHTML=`<div class="payment-icon payment-icon-large" style="--payment-color:${method.color}">${method.symbol}</div><p class="eyebrow small">SUPPORT E-VERSE WITH ${method.name.toUpperCase()}</p><h2 id="donation-title">A little kindness.<br><span>A big difference.</span></h2><p>Suggested donation: <strong>$<span id="donation-amount">3.00</span> or more</strong><br>Send to Robert Clinkenbeard at</p><a class="donation-handle ${method.id==='paypal'?'email':''}" href="${esc(method.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${method.name} for ${esc(method.handle)}">${method.handle}</a><div class="payment-actions"><button id="copy-donation" class="copy-donation">Copy ${method.id==='paypal'?'email':'handle'} ⧉</button>${method.manualAmount?'<button id="copy-donation-amount" class="copy-donation">Copy $3 amount ⧉</button>':''}<a class="payment-open" href="${esc(method.url)}" target="_blank" rel="noopener noreferrer">Open ${method.name} ↗</a></div><p class="donation-memo">${esc(method.instructions)}</p><div class="donation-countdown"><div class="countdown-track"><span id="donation-progress"></span></div><p>Your find is waiting. Continuing in <strong id="donation-seconds">60</strong>s.</p></div><button id="donation-change" class="text-button">Choose another method</button><p class="donation-footnote">You send the donation yourself. e-verse never charges you automatically.</p>`;
    $('copy-donation').onclick=async()=>{try{await navigator.clipboard.writeText(method.handle);if($('copy-donation'))$('copy-donation').textContent='Copied ✓';}catch{if($('copy-donation'))$('copy-donation').textContent='Press and hold the handle to copy';}};
    if($('copy-donation-amount'))$('copy-donation-amount').onclick=async()=>{try{await navigator.clipboard.writeText('3.00');if($('copy-donation-amount'))$('copy-donation-amount').textContent='Copied 3.00 ✓';}catch{const range=document.createRange();range.selectNodeContents($('donation-amount'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);if($('copy-donation-amount'))$('copy-donation-amount').textContent='Amount selected · copy';}};
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
