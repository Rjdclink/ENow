const PUBLIC_URL='https://e-verse.eager-guppy-9296.chatgpt.site/';

export function installGuide({userAgent='',platform='',maxTouchPoints=0,standalone=false}={}){
  const ios=/iPhone|iPad|iPod/i.test(userAgent)||(platform==='MacIntel'&&maxTouchPoints>1);
  if(standalone||/(?:e-verse|ENow)\//i.test(userAgent))return {id:'installed',title:'e-verse is installed.',steps:['Open e-verse from your home screen, Dock or apps list whenever you want to shop.']};
  if(/FBAN|FBAV|Instagram|TikTok|\bwv\b|; wv\)/i.test(userAgent))return {id:'embedded',title:'Open in your browser to install.',steps:['Open this app’s menu and choose Open in browser'+(ios?' or Open in Safari.':'.'),'Then tap Install app on e-verse.'],copyLink:true};
  if(ios)return {id:'ios',title:'Add e-verse to your Home Screen.',steps:['Open e-verse in Safari.','Tap Share, then Add to Home Screen.','Turn on Open as Web App if shown, then tap Add.']};
  if(/Android/i.test(userAgent))return {id:'android',title:'Install e-verse on your phone.',steps:['Open your browser’s menu (⋮).','Choose Install app or Add to Home screen.','Choose Install when offered, then confirm.'],note:'If this browser does not offer installation, open e-verse in Chrome.'};
  if(/Mac/i.test(platform+' '+userAgent)&&/Safari/i.test(userAgent)&&!/Chrome|Chromium|Edg|OPR/i.test(userAgent))return {id:'mac-safari',title:'Add e-verse to your Dock.',steps:['In Safari, choose File → Add to Dock.','Name it e-verse and select Add.'],note:'Requires macOS Sonoma 14 or later. Chrome and Edge also support installation on Mac.'};
  if(/Edg\//i.test(userAgent))return {id:'edge',title:'Install e-verse on your computer.',steps:['Select the app-install icon in the address bar.','Choose Install to add e-verse to your apps.'],note:'You can also find installation under the browser’s Apps menu.'};
  if(/Chrome|Chromium/i.test(userAgent))return {id:'chrome',title:'Install e-verse on your computer.',steps:['Select the install icon in the address bar.','Choose Install. e-verse will open in its own app window.'],note:'Or open the browser menu → Cast, save and share → Install page as app.'};
  return {id:'other',title:'Install e-verse on your device.',steps:['Open e-verse in Chrome or Edge on a computer, Chrome on Android, or Safari on iPhone, iPad or Mac.','Tap Install app again, or use the browser’s Add to Home Screen / Add to Dock option.'],copyLink:true};
}

export function initInstall(){
  const button=document.getElementById('install-app'),dialog=document.getElementById('install-dialog'),content=document.getElementById('install-content');
  if(!button||!dialog||!content)return;
  let pending=null,installedHere=false;
  const installed=()=>installedHere||navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches||/(?:e-verse|ENow)\//i.test(navigator.userAgent);
  const guide=()=>installGuide({userAgent:navigator.userAgent,platform:navigator.platform,maxTouchPoints:navigator.maxTouchPoints,standalone:installed()});
  function updateButton(){const label=button.querySelector('[data-install-label]');label.textContent=installed()?'App installed':'Install app';button.setAttribute('aria-label',installed()?'e-verse app installed':'Install e-verse app');}
  function showGuide(){
    const g=guide();content.replaceChildren();
    const icon=document.createElement('img');icon.src='icon192.png';icon.alt='';icon.className='install-logo';content.append(icon);
    const title=document.createElement('h2');title.id='install-title';title.textContent=g.title;content.append(title);
    const steps=document.createElement('ol');for(const step of g.steps){const li=document.createElement('li');li.textContent=step;steps.append(li);}content.append(steps);
    if(g.note){const p=document.createElement('p');p.textContent=g.note;content.append(p);}
    if(g.copyLink){
      const field=document.createElement('input');field.type='url';field.readOnly=true;field.value=PUBLIC_URL;field.setAttribute('aria-label','e-verse install link');field.className='install-link';content.append(field);
      const copy=document.createElement('button');copy.type='button';copy.className='copy-donation';copy.textContent='Copy app link';copy.onclick=async()=>{try{await navigator.clipboard.writeText(PUBLIC_URL);copy.textContent='Copied ✓';}catch{field.focus();field.select();copy.textContent='Select Copy to copy the link';}};content.append(copy);
    }
    const note=document.createElement('p');note.className='install-note';note.textContent='Free to install. Live shopping searches need an internet connection.';content.append(note);
    if(!dialog.open)dialog.showModal();
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pending=event;updateButton();});
  window.addEventListener('appinstalled',()=>{pending=null;installedHere=true;updateButton();if(dialog.open)dialog.close();});
  button.onclick=async()=>{
    if(!pending||installed()){showGuide();return;}
    const prompt=pending;pending=null;
    try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome!=='accepted')showGuide();}
    catch{showGuide();}
  };
  document.getElementById('install-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  updateButton();
}
