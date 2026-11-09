const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const KEY = "namefinder_v1";
const defaults = {records:[], favorites:[], settings:{discordEndpoint:"",minecraftEndpoint:""}};
let db = loadDB(), platform="discord", length=2, job=null, scanTimer=null;
function loadDB(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return structuredClone(defaults)}}
function saveDB(){localStorage.setItem(KEY,JSON.stringify(db))}
function id(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"_"+Math.random()}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2300)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function platformLabel(p){return p==="discord"?"Discord":"Minecraft"}
function minLen(){return platform==="discord"?2:3}
function renderLengths(){const min=minLen();if(length<min)length=min;$("#lengthHint").textContent=`${min}–16 znaków`;$ ("#lengthGrid").innerHTML=Array.from({length:17-min},(_,i)=>i+min).map(n=>`<button class="length-btn ${n===length?"selected":""}" data-length="${n}">${n}</button>`).join("");$$(".length-btn").forEach(b=>b.onclick=()=>{length=+b.dataset.length;renderLengths()})}
function setPlatform(p){platform=p;$$(".segment").forEach(b=>b.classList.toggle("selected",b.dataset.platform===p));renderLengths()}
$("#platforms").addEventListener("click",e=>{const b=e.target.closest("[data-platform]");if(b)setPlatform(b.dataset.platform)});
$("#amount").oninput=()=>$("#amountLabel").textContent=Number($("#amount").value).toLocaleString("pl-PL");
function getCharset(){return $('input[name="charset"]:checked').value}

function makeName(len,charset){
  const letters="abcdefghijklmnopqrstuvwxyz";
  const digits="0123456789";
  const underscore="_";

  let pool=letters;

  if(charset==="mixed"){
    pool=letters+digits;
  }

  if(charset==="full"){
    pool=letters+digits+underscore;
  }

  let out="";

  for(let i=0;i<len;i++){
    out+=pool[Math.floor(Math.random()*pool.length)];
  }

  return out;
}

function statusLabel(s){return s==="free"?"Wolna":s==="taken"?"Zajęta":"Niewiadomo"}
function statusClass(s){return s==="free"?"tag-free":s==="taken"?"tag-taken":"tag-unknown"}
function getEndpoint(p){return p==="discord"?db.settings.discordEndpoint:db.settings.minecraftEndpoint}

async function checkName(name,p){
  if(p==="minecraft"){
    try{
      const res=await fetch("/.netlify/functions/minecraft-check",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({username:name})
      });

      if(!res.ok)return "unknown";

      const data=await res.json();

      if(data.status==="taken" || data.available===false)
        return "taken";

      if(data.status==="free" && data.available===true)
        return "free";

      return "unknown";
    }catch{
      return "unknown";
    }
  }

  const endpoint=getEndpoint(p);
  if(!endpoint)return "unknown";

  try{
    const u=new URL(endpoint);
    if(u.protocol!=="https:")return "unknown";

    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),9000);

    try{
      const res=await fetch(u,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({username:name,platform:p}),
        signal:controller.signal
      });

      if(!res.ok)return "unknown";

      const data=await res.json();

      if(data.available===true)return "free";
      if(data.available===false)return "taken";
      return "unknown";
    }finally{
      clearTimeout(timer);
    }
  }catch{
    return "unknown";
  }
}

function recordResult(name,p,len,status,source){
  const now=new Date().toISOString();let r=db.records.find(x=>x.name===name&&x.platform===p&&x.length===len);
  if(r){r.previousStatus=r.status;r.status=status;r.checkedAt=now;r.checks=(r.checks||0)+1;r.lastSource=source}
  else db.records.push({id:id(),name,platform:p,length:len,status,previousStatus:null,checkedAt:now,checks:1,lastSource:source});
  saveDB();return db.records.find(x=>x.name===name&&x.platform===p&&x.length===len)
}
function favoriteKey(r){return `${r.platform}|${r.length}|${r.name}`}
function isFav(r){return db.favorites.includes(favoriteKey(r))}
function toggleFav(r){const k=favoriteKey(r);db.favorites=isFav(r)?db.favorites.filter(x=>x!==k):[...db.favorites,k];saveDB();renderAll();toast(isFav(r)?"Dodano do ulubionych":"Usunięto z ulubionych")}
async function copyName(name){try{await navigator.clipboard.writeText(name);toast(`Skopiowano: ${name}`)}catch{toast("Nie udało się skopiować. Sprawdź uprawnienia Safari.")}}
function resultHTML(r){return `<div class="result-item"><div class="result-main"><div class="result-name">${esc(r.name)}</div><div class="result-meta">${platformLabel(r.platform)} · ${r.length} znaki · ${new Date(r.checkedAt).toLocaleString("pl-PL")} · ${r.checks||1} sprawdzeń</div></div><span class="status-tag ${statusClass(r.status)}">${statusLabel(r.status)}</span><button class="star-btn ${isFav(r)?"on":""}" data-fav="${esc(favoriteKey(r))}" aria-label="Ulubione">${isFav(r)?"★":"☆"}</button><button class="copy-btn" data-copy="${esc(r.name)}" aria-label="Kopiuj">▢</button></div>`}
function bindResultActions(root){root.querySelectorAll("[data-fav]").forEach(b=>b.onclick=()=>{const r=db.records.find(x=>favoriteKey(x)===b.dataset.fav);if(r)toggleFav(r)});root.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>copyName(b.dataset.copy))}
function renderRecent(){const list=[...db.records].sort((a,b)=>b.checkedAt.localeCompare(a.checkedAt)).slice(0,5);$("#recentResults").classList.toggle("empty-state",!list.length);$("#recentResults").innerHTML=list.length?list.map(resultHTML).join(""):"Wyniki pojawią się tutaj po skanowaniu.";bindResultActions($("#recentResults"))}
function renderResults(){let a=[...db.records],f=$("#resultStatus").value,s=$("#resultSort").value;if(f!=="all")a=a.filter(r=>r.status===f);if(s==="name")a.sort((x,y)=>x.name.localeCompare(y.name));else if(s==="free")a.sort((x,y)=>({free:0,taken:1,unknown:2}[x.status]-({free:0,taken:1,unknown:2}[y.status])));else a.sort((x,y)=>y.checkedAt.localeCompare(x.checkedAt));$("#resultTotal").textContent=`${a.length} wyników`;$("#allResults").classList.toggle("empty-state",!a.length);$("#allResults").innerHTML=a.length?a.map(resultHTML).join(""):"Brak wyników.";bindResultActions($("#allResults"))}
function renderFavorites(){const p=$("#favoritePlatform").value,l=$("#favoriteLength").value;let a=db.records.filter(isFav);if(p!=="all")a=a.filter(r=>r.platform===p);if(l!=="all")a=a.filter(r=>r.length===+l);$("#favoriteList").classList.toggle("empty-state",!a.length);$("#favoriteList").innerHTML=a.length?a.sort((x,y)=>x.name.localeCompare(y.name)).map(resultHTML).join(""):"Nie masz jeszcze ulubionych.";bindResultActions($("#favoriteList"))}
function renderHistory(){const p=$("#historyPlatform").value,l=$("#historyLength").value;let a=[...db.records];if(p!=="all")a=a.filter(r=>r.platform===p);if(l!=="all")a=a.filter(r=>r.length===+l);a.sort((x,y)=>y.checkedAt.localeCompare(x.checkedAt));$("#historyTotal").textContent=`${a.length} nazw`;$("#historyList").classList.toggle("empty-state",!a.length);$("#historyList").innerHTML=a.length?a.map(resultHTML).join(""):"Historia jest pusta.";bindResultActions($("#historyList"))}
function fillLengthFilters(){for(const id of ["favoriteLength","historyLength"]){const sel=$( "#"+id),old=sel.value;sel.innerHTML='<option value="all">Każda długość</option>'+Array.from({length:15},(_,i)=>i+2).map(n=>`<option value="${n}">${n} znaków</option>`).join("");sel.value=old||"all"}}
function renderAll(){renderRecent();renderResults();renderFavorites();renderHistory();fillLengthFilters()}
function updateJobUI(){if(!job)return;const done=job.index,total=job.total,pct=total?Math.floor(done/total*100):0;$("#progressText").textContent=`${done} / ${total}`;$("#progressPercent").textContent=pct+"%";$("#progressBar").style.width=pct+"%";$("#freeCount").textContent=job.free;$("#takenCount").textContent=job.taken;$("#unknownCount").textContent=job.unknown;$("#checkedCount").textContent=done;$("#historyProgress").textContent=`${job.historyIndex} / ${job.historyItems.length}`;$("#newProgress").textContent=`${job.newIndex} / ${job.newItems.length}`;$("#currentName").textContent=job.current||"Oczekiwanie…";$("#scanState").textContent=job.state==="paused"?"PAUZA":job.state==="done"?"ZAKOŃCZONO":job.state==="stopped"?"ZATRZYMANO":"W TRAKCIE";$("#scanState").className="status-pill "+(job.state==="paused"?"paused":job.state==="done"||job.state==="stopped"?"done":"running");$("#pauseBtn").textContent=job.state==="paused"?"▶ Wznów":"Ⅱ Pauza";$("#pauseBtn").disabled=["done","stopped"].includes(job.state)}
function persistJob(){try{localStorage.setItem("namefinder_job",JSON.stringify(job))}catch{}}
function makeQueue(p,len,amount,charset){
  const old=db.records.filter(r=>r.platform===p&&r.length===len).sort((a,b)=>a.checkedAt.localeCompare(b.checkedAt));
  const historyItems=old.slice(0,amount).map(r=>r.name),remaining=Math.max(0,amount-historyItems.length),used=new Set(old.map(r=>r.name)),newItems=[];
  const maxSpace=charset==="letters"?26**len:36**len;
  const target=Math.min(remaining,maxSpace-used.size);
  let attempts=0;while(newItems.length<target&&attempts<target*20+100){attempts++;const n=makeName(len,charset);if(!used.has(n)){used.add(n);newItems.push(n)}}
  return {historyItems,newItems};
}
function startScan(){if(job&&job.state==="paused"){resumeScan();return}if(job&&job.state==="running"){toast("Skanowanie już trwa.");return}
  const amount=+$("#amount").value,charset=getCharset(),q=makeQueue(platform,length,amount,charset),total=q.historyItems.length+q.newItems.length;
  if(!total){toast("Nie udało się utworzyć kolejki nazw.");return}
  job={platform,length,total,index:0,free:0,taken:0,unknown:0,historyItems:q.historyItems,newItems:q.newItems,historyIndex:0,newIndex:0,current:"Przygotowywanie…",state:"running",charset,startedAt:new Date().toISOString()};
  $("#scanPanel").classList.remove("hidden");$("#scanTitle").textContent=`Skanowanie ${platformLabel(platform)} · ${length} znaków`;updateJobUI();persistJob();runNext();
}
async function runNext(){
  if(!job||job.state!=="running")return;
  if(job.index>=job.total){job.state="done";job.current="Skanowanie zakończone";updateJobUI();persistJob();renderAll();toast("Skanowanie zakończone.");return}
  const fromHistory=job.historyIndex<job.historyItems.length;
  const name=fromHistory?job.historyItems[job.historyIndex]:job.newItems[job.newIndex];job.current=name;updateJobUI();
  const status=await checkName(name,job.platform);
  if(!job||job.state!=="running")return;
  const record=recordResult(name,job.platform,job.length,status,fromHistory?"history":"new");
  if(status==="free")job.free++;else if(status==="taken")job.taken++;else job.unknown++;
  if(fromHistory)job.historyIndex++;else job.newIndex++;
  job.index++;updateJobUI();persistJob();renderRecent();
  scanTimer=setTimeout(
  runNext,
  job.platform==="minecraft"?1250:250
);
}
function pauseScan(){if(!job)return;if(job.state==="running"){job.state="paused";clearTimeout(scanTimer);updateJobUI();persistJob()}else if(job.state==="paused")resumeScan()}
function resumeScan(){if(!job||job.state!=="paused")return;job.state="running";updateJobUI();persistJob();runNext()}
function stopScan(){if(!job||["done","stopped"].includes(job.state))return;clearTimeout(scanTimer);job.state="stopped";job.current="Skanowanie zatrzymane";updateJobUI();persistJob();renderAll()}
$("#startBtn").onclick=startScan;$("#pauseBtn").onclick=pauseScan;$("#stopBtn").onclick=stopScan;
$("#resultStatus").onchange=renderResults;$("#resultSort").onchange=renderResults;$("#favoritePlatform").onchange=renderFavorites;$("#favoriteLength").onchange=renderFavorites;$("#historyPlatform").onchange=renderHistory;$("#historyLength").onchange=renderHistory;
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
function csv(rows){const keys=["name","platform","length","status","previousStatus","checkedAt","checks"];return [keys.join(","),...rows.map(r=>keys.map(k=>'"'+String(r[k]??"").replaceAll('"','""')+'"').join(","))].join("\n")}
$("#exportResults").onclick=()=>download("name-finder-wyniki.csv",csv(db.records),"text/csv;charset=utf-8");
$("#exportFavorites").onclick=()=>download("name-finder-ulubione.csv",csv(db.records.filter(isFav)),"text/csv;charset=utf-8");
$("#clearHistory").onclick=()=>{if(confirm("Usunąć całą historię skanowania? Ulubione również zostaną usunięte, jeśli ich nicki nie będą już w historii.")){db.records=[];db.favorites=[];saveDB();renderAll();toast("Historia wyczyszczona.")}};
$("#settingsBtn").onclick=()=>showView("settingsView");
$("#saveSettings").onclick=()=>{db.settings.discordEndpoint=$("#discordEndpoint").value.trim();db.settings.minecraftEndpoint=$("#minecraftEndpoint").value.trim();saveDB();toast("Ustawienia zapisane.")};
$("#discordEndpoint").value=db.settings.discordEndpoint||"";$("#minecraftEndpoint").value=db.settings.minecraftEndpoint||"";
$("#backupData").onclick=()=>download("name-finder-backup.json",JSON.stringify(db,null,2),"application/json");
$("#resetData").onclick=()=>{if(confirm("Na pewno usunąć historię, ulubione i ustawienia?")){localStorage.removeItem(KEY);localStorage.removeItem("namefinder_job");db=structuredClone(defaults);job=null;saveDB();location.reload()}};
function showView(id){$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===id));if(id==="resultsView")renderResults();if(id==="favoritesView")renderFavorites();if(id==="historyView")renderHistory();if(id==="settingsView"){$("#discordEndpoint").value=db.settings.discordEndpoint||"";$("#minecraftEndpoint").value=db.settings.minecraftEndpoint||""}window.scrollTo(0,0)}
$$("[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));$$("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go==="results"?"resultsView":b.dataset.go));
function restoreJob(){try{const raw=localStorage.getItem("namefinder_job");if(!raw)return;const saved=JSON.parse(raw);if(saved&&["paused","running"].includes(saved.state)){saved.state="paused";job=saved;$("#scanPanel").classList.remove("hidden");updateJobUI();toast("Przywrócono przerwane skanowanie. Możesz je wznowić.")}}catch{}}
setPlatform("discord");$("#amount").dispatchEvent(new Event("input"));fillLengthFilters();renderAll();restoreJob();
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
