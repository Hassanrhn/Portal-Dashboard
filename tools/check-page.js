// Screenshot + console-error check. Usage: node tools/check-page.js <abs path to html> <out prefix> [dark|mobile|full|shot|wait:ms|click:sel|type:sel=text ...]
const {chromium,devices}=require('playwright');
const [,,file,out,...acts]=process.argv;
(async()=>{const b=await chromium.launch();const errs=[];
const mobile=acts.includes('mobile');
const c=await b.newContext(mobile?{...devices['iPhone 13'],deviceScaleFactor:1}:{viewport:{width:1440,height:900}});
const p=await c.newPage();
p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.text())});p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('file://'+file);await p.waitForTimeout(1300);
let n=0;
for(const a of acts){
  if(a==='dark'){await p.evaluate(()=>Portal.theme.set('dark',{animate:false}));}
  else if(a.startsWith('click:')){await p.click(a.slice(6));}
  else if(a.startsWith('wait:')){await p.waitForTimeout(+a.slice(5));}
  else if(a.startsWith('type:')){const [s,t]=a.slice(5).split('=');await p.fill(s,t);}
  else if(a==='shot'){await p.waitForTimeout(400);await p.screenshot({path:`${out}-${n++}.png`});}
}
await p.waitForTimeout(400);await p.screenshot({path:`${out}-${n}.png`,fullPage:acts.includes('full')});
console.log(errs.join('\n')||'no errors');await b.close();})();
