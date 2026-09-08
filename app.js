(()=>{"use strict";
const f=document.querySelector("#rentalBuilder"),STORE="bwrStorefrontV1",SUB="bwrSubmissionId";
if(!f)return;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const tables=f.tables,chairs=f.chairs,sub=$("#subtotal"),del=$("#delivery"),tot=$("#total"),review=$("#review"),reviewDetails=$("#reviewDetails"),confirm=$("#confirm"),success=$("#success"),leadRef=$("#leadRef");
let pkg=false,quote=null,sending=false; const attr=attribution();
restore(); update();

$("#menu")?.addEventListener("click",()=>{const n=$("#nav"),open=!n.classList.contains("open");n.classList.toggle("open",open);$("#menu").setAttribute("aria-expanded",open)});
$$("[data-open]").forEach(b=>b.onclick=()=>{open("items");$("#builder").scrollIntoView({behavior:"smooth"});$("#nav")?.classList.remove("open")});
$$("[data-add]").forEach(b=>b.onclick=()=>{const i=f[b.dataset.add];i.value=Math.max(1,+i.value||0);pkg=false;invalidate();update();open("items");$("#builder").scrollIntoView({behavior:"smooth"})});
$$("[data-package]").forEach(b=>b.onclick=()=>{tables.value=3;chairs.value=20;pkg=true;invalidate();update();open("items")});
$$("[data-qty]").forEach(b=>b.onclick=()=>{const i=f[b.dataset.qty];i.value=Math.max(0,Math.floor((+i.value||0)+(+b.dataset.delta)));pkg=false;invalidate();update()});
[tables,chairs].forEach(i=>i.oninput=()=>{i.value=Math.max(0,Math.floor(+i.value||0));pkg=false;invalidate();update()});
["address1","address2","city","state","zipCode"].forEach(n=>f[n].addEventListener("input",()=>{invalidate();update()}));
f.addEventListener("input",()=>{summaries();save()}); f.addEventListener("change",()=>{summaries();save()});
$$("[data-toggle]").forEach(b=>b.onclick=()=>open(b.dataset.toggle)); $$("[data-back]").forEach(b=>b.onclick=()=>open(b.dataset.back));
$$("[data-next]").forEach(b=>b.onclick=()=>{if(b.dataset.next==="when"&&!validItems())return;if(b.dataset.next==="where"&&!validWhen())return;open(b.dataset.next)});
$("#calcDelivery").onclick=calcDelivery; $("#reviewBtn").onclick=prepareReview; $("#again").onclick=reset; f.onsubmit=submit;

function pricing(){const t=+tables.value||0,c=+chairs.value||0;if(pkg&&t===3&&c===20)return{t,c,s:50,mode:"3 Tables + 20 Chairs package"};const bulk=t>=3&&c>=20;return{t,c,s:t*(bulk?6:8)+c*(bulk?1.5:2),mode:bulk?"Bulk pricing":"Standard pricing"}}
function money(v){return"$"+Number(v||0).toFixed(2)}
function update(){estimate();summaries();save()}
function invalidate(){quote=null;review.hidden=true;estimate()}
function estimate(){const p=pricing();sub.textContent=money(p.s);del.textContent=quote?money(quote.deliveryAmount):"—";tot.textContent=money(quote?quote.estimatedTotal:p.s)}
function summaries(){const p=pricing(),bits=[];if(p.t)bits.push(`${p.t} table${p.t===1?"":"s"}`);if(p.c)bits.push(`${p.c} chair${p.c===1?"":"s"}`);sum("items",bits.length?`${bits.join(" + ")} · ${money(p.s)}`:"Choose tables, chairs, or the package.");
sum("when",f.startDate.value&&f.startTime.value&&f.endDate.value&&f.endTime.value?`${fmt(f.startDate.value,f.startTime.value)} → ${fmt(f.endDate.value,f.endTime.value)}`:"Rental start and return timing.");
const a=address();sum("where",a.address1&&a.city&&a.zipCode?a.full:"Enter the delivery address.");sum("contact",f.name.value.trim()&&f.mobile.value.trim()?`${f.name.value.trim()} · ${f.mobile.value.trim()}`:"Big W will follow up by text.")}
function sum(n,v){const e=$(`[data-summary="${n}"]`);if(e)e.textContent=v}
function open(name){$$("[data-step]").forEach(s=>{const a=s.dataset.step===name;s.classList.toggle("open",a);s.querySelector(".content").hidden=!a});$(`[data-step="${name}"]`)?.scrollIntoView({behavior:"smooth",block:"center"})}
function err(id,msg){const e=$("#"+id);e.textContent=msg;e.hidden=false;e.scrollIntoView({behavior:"smooth",block:"nearest"});return false}
function clear(id){const e=$("#"+id);e.hidden=true;e.textContent=""}
function validItems(){clear("itemsError");const p=pricing();return(p.t||p.c)?true:err("itemsError","Choose at least one table or chair.")}
function validWhen(){clear("whenError");const a=f.startDate.value,b=f.startTime.value,c=f.endDate.value,d=f.endTime.value;if(!a||!b||!c||!d)return err("whenError","Enter the complete rental start and end date/time.");return new Date(`${c}T${d}`)>new Date(`${a}T${b}`)?true:err("whenError","The rental end must be after the rental start.")}
function validWhere(){clear("whereError");return f.address1.value.trim()&&f.city.value.trim()&&f.state.value.trim()&&/^\d{5}(?:-\d{4})?$/.test(f.zipCode.value.trim())?true:err("whereError","Enter the complete delivery address, including a valid ZIP code.")}
function validContact(){clear("contactError");if(!f.name.value.trim())return err("contactError","Enter your name.");if(!f.mobile.value.trim())return err("contactError","Enter the mobile number where Big W should text you.");return true}
function address(){const a={address1:f.address1.value.trim(),address2:f.address2.value.trim(),city:f.city.value.trim(),state:f.state.value.trim().toUpperCase(),zipCode:f.zipCode.value.trim()};a.full=[a.address1,a.address2,a.city?`${a.city}, ${a.state} ${a.zipCode}`:""].filter(Boolean).join(", ");return a}
function sig(){const p=pricing(),a=address();return JSON.stringify({t:p.t,c:p.c,pkg,address1:a.address1,address2:a.address2,city:a.city,state:a.state,zipCode:a.zipCode})}
async function post(body){const url=window.BWR_CONFIG?.leadApiUrl||"";if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url))throw Error("The Big W Rentals request service is not configured.");const r=await fetch(url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body),redirect:"follow"});return r.json()}
async function calcDelivery(){if(!validItems()||!validWhen()||!validWhere())return;const b=$("#calcDelivery"),old=b.textContent;b.disabled=true;b.textContent="Calculating…";clear("whereError");try{const p=pricing(),r=await post({action:"CALCULATE_DELIVERY",items:{tables:p.t,chairs:p.c,packageSelected:pkg},deliveryAddress:address()});if(!r.ok)throw Error(r.message||"Delivery could not be calculated.");quote={signature:sig(),distanceMiles:+r.distanceMiles,deliveryRatePerMile:+r.deliveryRatePerMile,deliveryAmount:+r.deliveryAmount,rentalSubtotal:+r.rentalSubtotal,estimatedTotal:+r.estimatedTotal,deliveryStatus:"CALCULATED"};update();open("contact")}catch(e){quote=null;estimate();err("whereError",e.message||"We could not calculate delivery for that address.")}finally{b.disabled=false;b.textContent=old}}
function prepareReview(){if(!validItems()||!validWhen()||!validWhere())return;if(!quote||quote.signature!==sig()){err("whereError","Delivery needs to be recalculated for this address.");open("where");return}if(!validContact())return;renderReview();review.hidden=false;review.scrollIntoView({behavior:"smooth",block:"center"})}
function renderReview(){const p=pricing(),a=address(),items=[p.t?`${p.t} table${p.t===1?"":"s"}`:"",p.c?`${p.c} chair${p.c===1?"":"s"}`:""].filter(Boolean).join(" + ");reviewDetails.innerHTML=line("Rental",`${esc(items)} · ${money(p.s)}`)+line("When",`${esc(fmt(f.startDate.value,f.startTime.value))}<br>to ${esc(fmt(f.endDate.value,f.endTime.value))}`)+line("Delivery",`${esc(a.full)}<br>${money(quote.deliveryAmount)}`)+line("Estimated total",money(quote.estimatedTotal))+line("Contact",`${esc(f.name.value.trim())}<br>${esc(f.mobile.value.trim())}`)}
function line(a,b){return`<div class="reviewline"><span>${a}</span><b>${b}</b></div>`}
function payload(){const p=pricing();return{clientSubmissionId:submissionId(),items:{tables:p.t,chairs:p.c,packageSelected:pkg,pricingMode:p.mode},rentalPeriod:{startDate:f.startDate.value,startTime:f.startTime.value,endDate:f.endDate.value,endTime:f.endTime.value},deliveryAddress:address(),estimate:{rentalSubtotal:p.s,deliveryDistanceMiles:quote?.distanceMiles??null,deliveryAmount:quote?.deliveryAmount??null,deliveryStatus:quote?"CALCULATED":"NOT_CALCULATED",estimatedTotal:quote?.estimatedTotal??null,deliveryRatePerMile:quote?.deliveryRatePerMile??1.5},name:f.name.value.trim(),mobile:f.mobile.value.trim(),notes:f.notes.value.trim(),attribution:attr}}
async function submit(e){e.preventDefault();if(sending||!validContact())return;if(!quote||quote.signature!==sig()){err("whereError","Delivery needs to be recalculated before confirming availability.");open("where");return}$("#submitError").hidden=true;setSending(true);try{const r=await post(payload());if(!r.ok)throw Error(r.message||"Your request could not be sent.");sessionStorage.removeItem(STORE);sessionStorage.removeItem(SUB);f.hidden=true;$(".builderintro").hidden=true;success.hidden=false;leadRef.textContent=r.leadId||"Received";success.scrollIntoView({behavior:"smooth",block:"center"})}catch(x){const e=$("#submitError");e.textContent=x.message||"Your request could not be sent.";e.hidden=false}finally{setSending(false)}}
function setSending(v){sending=v;confirm.disabled=v;const s=confirm.querySelectorAll("span");s[0].hidden=v;s[1].hidden=!v}
function save(){const vals={};new FormData(f).forEach((v,k)=>vals[k]=v);sessionStorage.setItem(STORE,JSON.stringify({pkg,vals,t:+tables.value||0,c:+chairs.value||0,quote}))}
function restore(){try{const s=JSON.parse(sessionStorage.getItem(STORE)||"null");if(!s)return;pkg=!!s.pkg;Object.entries(s.vals||{}).forEach(([k,v])=>{if(f[k])f[k].value=v});tables.value=s.t||0;chairs.value=s.c||0;quote=s.quote||null;if(quote&&quote.signature!==sig())quote=null}catch(_){quote=null}}
function reset(){f.reset();f.state.value="TX";tables.value=0;chairs.value=0;pkg=false;quote=null;sessionStorage.removeItem(STORE);sessionStorage.removeItem(SUB);$(".builderintro").hidden=false;f.hidden=false;success.hidden=true;review.hidden=true;update();open("items")}
function submissionId(){let id=sessionStorage.getItem(SUB);if(!id){id=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;sessionStorage.setItem(SUB,id)}return id}
function attribution(){const q=new URLSearchParams(location.search),r=document.referrer||"";let s=q.get("utm_source")||"";if(!s)s=/google\./i.test(r)?"Google":/facebook\.|fb\./i.test(r)?"Facebook":r?"Referral":"Direct";return{leadSource:s,sourceDetail:q.get("source_detail")||"",landingPage:location.href,referrer:r,utmSource:q.get("utm_source")||"",utmMedium:q.get("utm_medium")||"",utmCampaign:q.get("utm_campaign")||"",utmContent:q.get("utm_content")||"",utmTerm:q.get("utm_term")||""}}
function fmt(d,t){return new Date(`${d}T${t}:00`).toLocaleString([],{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"})}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
})();
