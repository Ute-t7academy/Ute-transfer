/* ============================================================
   T7 ACADEMY -- WIDGET FRAMEWORK
   Version 2.0 -- Modular / Multi-instance
   ============================================================ */

var T7_SB_URL='https://qajjuhjmrtuomwrbxmpz.supabase.co';
var T7_SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';

/* === SHARED IDENTITY MODULE ===
   The WordPress integration sets window.T7_PROFILE_ID (the player_profiles.id UUID)
   before this script loads. We read it, fetch first_name from player_profiles,
   and broadcast (id, firstName) to every widget on the page. */
var T7Identity=(function(){
  var _id=null,_name=null,_done=false,_going=false,_q=[];
  function _hdr(){return{'apikey':T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY};}
  function _fire(id,nm){
    _id=id;_name=nm;_done=true;
    var label=(nm||'?').trim();
    var parts=label.split(/\s+/);
    var ini=parts.length>=2?(parts[0][0]+parts[parts.length-1][0]).toUpperCase():label.slice(0,2).toUpperCase();
    var av=document.getElementById('navAvatar');if(av)av.textContent=ini;
    _q.forEach(function(cb){cb(id,nm);});_q=[];
  }
  function _readGlobalId(){
    // Check current window + parent + top for the WP-injected profile id
    var ws=[window];
    try{if(window.parent&&window.parent!==window)ws.push(window.parent);}catch(e){}
    try{if(window.top&&window.top!==window&&window.top!==window.parent)ws.push(window.top);}catch(e){}
    for(var i=0;i<ws.length;i++){
      try{if(ws[i].T7_PROFILE_ID)return String(ws[i].T7_PROFILE_ID);}catch(e){}
    }
    return null;
  }
  function _fetchName(id,cb){
    fetch(T7_SB_URL+'/rest/v1/player_profiles?id=eq.'+encodeURIComponent(id)+'&select=first_name&limit=1',{headers:_hdr()})
    .then(function(r){return r.json();}).then(function(rows){
      cb(rows&&rows.length&&rows[0].first_name?rows[0].first_name:'Spieler');
    }).catch(function(){cb('Spieler');});
  }
  function _go(){
    var id=_readGlobalId();
    if(!id){
      console.warn('[T7] window.T7_PROFILE_ID not set \u2014 widgets cannot identify the player.');
      _done=true;_q.forEach(function(cb){cb(null,null);});_q=[];
      return;
    }
    _fetchName(id,function(nm){_fire(id,nm);});
  }
  return{
    resolve:function(cb){
      if(_done){cb(_id,_name);return;}
      _q.push(cb);if(!_going){_going=true;_go();}
    },
    fire:function(id,nm){_fire(id,nm);},
    get:function(){return _done?{id:_id,name:_name}:null;}
  };
})();

/* === SUPABASE HELPERS ===
   All XP and stars live in `player_stats`, keyed by `id` (FK -> player_profiles.id).
   first_name is read via PostgREST embedded select (player_profiles!inner). */
var T7SB={
  _hdr:function(extra){return Object.assign({'apikey':T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY,'Content-Type':'application/json'},extra||{});},
  getTotalXP:function(id,cb){
    fetch(T7_SB_URL+'/rest/v1/player_stats?id=eq.'+encodeURIComponent(id)+'&select=total_xp',{headers:this._hdr()})
    .then(function(r){return r.json();}).then(function(rows){cb(rows&&rows.length&&typeof rows[0].total_xp==='number'?rows[0].total_xp:0);}).catch(function(){cb(0);});
  },
  getStats:function(id,cb){
    fetch(T7_SB_URL+'/rest/v1/player_stats?id=eq.'+encodeURIComponent(id)+'&select=total_xp,stars,stars_awarded_at,player_profiles(first_name)',{headers:this._hdr()})
    .then(function(r){return r.json();}).then(function(rows){
      var row=rows&&rows.length?rows[0]:null;
      cb(row?{
        total_xp:Number(row.total_xp||0),
        stars:row.stars||null,
        stars_awarded_at:row.stars_awarded_at||null,
        first_name:(row.player_profiles&&row.player_profiles.first_name)||null
      }:null);
    }).catch(function(){cb(null);});
  },
  getStars:function(id,cb){
    fetch(T7_SB_URL+'/rest/v1/player_stats?id=eq.'+encodeURIComponent(id)+'&select=stars,stars_awarded_at',{headers:this._hdr()})
    .then(function(r){return r.json();}).then(function(rows){cb(rows&&rows.length&&rows[0].stars?rows[0]:null);}).catch(function(){cb(null);});
  },
  /* Adds xpDelta to total_xp. Race-safe enough for this volume:
     client computes newTotal from curTotal, upsert merges on PK. */
  addXP:function(id,xpDelta,curTotal){
    if(!id||!xpDelta)return;
    var newTotal=(curTotal||0)+xpDelta;
    fetch(T7_SB_URL+'/rest/v1/player_stats',{method:'POST',headers:this._hdr({'Prefer':'resolution=merge-duplicates'}),
      body:JSON.stringify({id:id,total_xp:newTotal,updated_at:new Date().toISOString()})}).catch(function(){});
  },
  /* Sets stars only if it's higher than the current value. */
  setStars:function(id,stars){
    if(!id||!stars)return;
    var self=this;
    this.getStars(id,function(cur){
      if(cur&&cur.stars>=stars)return;
      fetch(T7_SB_URL+'/rest/v1/player_stats',{method:'POST',headers:self._hdr({'Prefer':'resolution=merge-duplicates'}),
        body:JSON.stringify({id:id,stars:stars,stars_awarded_at:new Date().toISOString(),updated_at:new Date().toISOString()})}).catch(function(){});
    });
  },
  /* Top N players ordered by total_xp; joins first_name from player_profiles. */
  getLeaderboard:function(limit,cb){
    fetch(T7_SB_URL+'/rest/v1/player_stats?select=id,total_xp,stars,player_profiles!inner(first_name)&order=total_xp.desc&limit='+(limit||20),{headers:this._hdr()})
    .then(function(r){return r.json();}).then(function(rows){
      cb((rows||[]).map(function(r){return{
        id:r.id,
        xp:Number(r.total_xp||0),
        stars:r.stars||null,
        name:(r.player_profiles&&r.player_profiles.first_name)||'Spieler'
      };}));
    }).catch(function(){cb([]);});
  },
  /* Append-only event. One row per rating submission. */
  recordAttempt:function(profileId,moduleKey,drillIdx,rating,xp){
    if(!profileId||!moduleKey)return;
    fetch(T7_SB_URL+'/rest/v1/drill_attempts',{method:'POST',headers:this._hdr(),
      body:JSON.stringify({profile_id:profileId,module_key:moduleKey,drill_idx:drillIdx,rating:rating,xp:xp||0,attempted_at:new Date().toISOString()})}).catch(function(){});
  },
  /* Returns the best rating + xp per drill_idx for one module. */
  getBestRatings:function(profileId,moduleKey,cb){
    fetch(T7_SB_URL+'/rest/v1/drill_attempts?profile_id=eq.'+encodeURIComponent(profileId)+'&module_key=eq.'+encodeURIComponent(moduleKey)+'&select=drill_idx,rating,xp&order=rating.desc',{headers:this._hdr()})
    .then(function(r){return r.json();}).then(function(rows){
      var best={};(rows||[]).forEach(function(r){
        var i=r.drill_idx;
        if(!(i in best)||r.rating>best[i].rating)best[i]={rating:r.rating,xp:r.xp};
      });
      cb(best);
    }).catch(function(){cb({});});
  },
  /* Returns all attempts as [{attempted_at, xp, module_key, drill_idx, rating}]
     for streak / weekly / cross-module aggregation. */
  getAllAttempts:function(profileId,cb){
    fetch(T7_SB_URL+'/rest/v1/drill_attempts?profile_id=eq.'+encodeURIComponent(profileId)+'&select=attempted_at,xp,module_key,drill_idx,rating&order=attempted_at.asc',{headers:this._hdr()})
    .then(function(r){return r.json();}).then(function(rows){cb(rows||[]);}).catch(function(){cb([]);});
  }
};

/* ===========================================================
   TYPE A ENGINE -- T7Challenge
   Skill challenges with 4-step flow (Watch->Practice->Rate->Outcome)
   Unlock tiers: star:1 = always open; star:3 = needs star:1 rated >=4
   =========================================================== */
function T7Challenge(cfg){
  var uid=(Math.random().toString(36)+'00000').slice(2,7);
  var drills=cfg.drills||[];var nd=drills.length;
  var XMUL=[0,.2,.4,.6,.8,1];
  function aXP(r,max){return Math.round((XMUL[r]||0)*max);}
  function cXP(r,max){return r<4?0:Math.round((XMUL[r]||0)*max);}
  var S={expanded:false,drill:-1,rate:0,hits:0,ratings:drills.map(function(){return 0;}),bestHits:drills.map(function(){return 0;}),scXP:drills.map(function(){return 0;}),cumXP:0,cat:{},sk:'t7_'+cfg.moduleKey+'_g',ms:null,mr:null,ch:[],rec:false,inited:false,name:'Spieler',sbTotal:null,id:null};
  function isDone(i){var d=drills[i];return d.type==='hits'?(S.bestHits[i]||0)>=(d.maxHits||1):(S.ratings[i]||0)>=4;}
  function hXP(hits,d){return Math.min(d.xp,Math.round(((hits||0)/(d.maxHits||1))*d.xp));}
  var cont=document.getElementById(cfg.containerId||'ch-container');if(!cont)return;
  cont.insertAdjacentHTML('beforeend',_html());
  function el(id){return document.getElementById('t7a-'+id+'-'+uid);}
  function sv(){var e=el('cr');if(e)e.scrollIntoView({behavior:'smooth',block:'nearest'});}
  // Storage
  function save(){try{localStorage.setItem(S.sk,JSON.stringify({r:S.ratings,s:S.scXP,c:S.cumXP,at:S.cat,bh:S.bestHits}));}catch(e){}}
  function load(u){
    S.sk='t7_'+cfg.moduleKey+'_'+(u||'g').replace(/\s+/g,'_').toLowerCase();
    try{var raw=localStorage.getItem(S.sk);if(raw){var d=JSON.parse(raw);if(d.r)S.ratings=d.r;if(d.bh)S.bestHits=d.bh;if(d.s)S.scXP=d.s;else for(var i=0;i<nd;i++)S.scXP[i]=drills[i].type==='hits'?hXP(S.bestHits[i],drills[i]):cXP(S.ratings[i]||0,drills[i].xp);if(typeof d.c==='number')S.cumXP=d.c;if(d.at)S.cat=d.at;}}catch(e){}
    updXP();updProg();refresh();
  }
  // XP & progress
  function modXP(){var t=0;for(var i=0;i<nd;i++)t+=S.scXP[i];return t;}
  function updXP(){el('xp').textContent=modXP()+' XP';el('xpt').textContent=(typeof S.sbTotal==='number'?S.sbTotal:0)+' XP';}
  function updProg(){var done=0;for(var i=0;i<nd;i++)if(isDone(i))done++;el('pf').style.width=Math.round(done/nd*100)+'%';el('pl').textContent=done+' / '+nd;}
  // Unlock logic
  function canOpen(idx){
    if(!drills[idx]||drills[idx].star<=1)return true;
    for(var i=0;i<nd;i++){if(i!==idx&&drills[i].star<drills[idx].star&&!isDone(i))return false;}
    return true;
  }
  function refresh(){
    for(var i=0;i<nd;i++){
      var row=el('row-'+i),badge=el('badge-'+i),d=drills[i],lk=!canOpen(i);
      if(lk){row.className='prow plocked';badge.className='pbadge b-locked';badge.textContent='\uD83D\uDD12 Gesperrt';}
      else if(d.type==='hits'){
        var bh=S.bestHits[i]||0;
        if(bh===0){row.className='prow';badge.className='pbadge b-new';badge.textContent='Neu';}
        else if(bh<(d.maxHits||1)){row.className='prow';badge.className='pbadge b-retry';badge.textContent=bh+'x \u2197';}
        else{row.className='prow pdone';badge.className='pbadge b-done';badge.textContent='\u2605 Ziel!';}
      }else{
        var r=S.ratings[i];
        if(r===0){row.className='prow';badge.className='pbadge b-new';badge.textContent='Neu';}
        else if(r<=3){row.className='prow';badge.className='pbadge b-retry';badge.textContent='\u21A9 Verbessern';}
        else if(r===4){row.className='prow pdone';badge.className='pbadge b-inprog';badge.textContent='\u2713 Gut';}
        else{row.className='prow pdone';badge.className='pbadge b-done';badge.textContent='\u2605 Perfekt';}
      }
    }
    var allOpen=true;for(var i=0;i<nd;i++){if(!canOpen(i)){allOpen=false;break;}}
    el('unlock').style.display=allOpen?'none':'flex';
    updProg();
  }
  // Navigation
  function toggle(){
    S.expanded=!S.expanded;var cr=el('cr'),panel=el('panel');
    if(S.expanded){cr.classList.add('open');panel.classList.add('open');el('crb').textContent='Schlie\xdfen \u25b2';}
    else{cr.classList.remove('open');panel.classList.remove('open');el('crb').textContent='Starten \u25bc';goTrack();}
  }
  function goTrack(){el('embed').src='';el('drill').classList.remove('open');show('track');stopCam();refresh();sv();}
  function openDrill(idx){
    if(!canOpen(idx))return;
    S.drill=idx;S.rate=0;S.hits=0;var d=drills[idx];
    el('deye').textContent=d.eye;el('dh').textContent=d.title;el('dmeta').textContent=d.meta;
    el('embed').src='https://player.vimeo.com/video/'+d.vid+'?h='+d.hash+'&color=00E5FF&title=0&byline=0&portrait=0&dnt=1';
    [1,2,3,4,5].forEach(function(v){el('r'+v).className='rate-opt';});
    hide('rconf');resetCam();hide('track');el('drill').classList.add('open');goStep(1);sv();
  }
  function goStep(n){
    ['s1','s2','s3','s4'].forEach(function(id,i){el(id).style.display=(i===n-1)?'block':'none';});
    [1,2,3,4].forEach(function(i){var dot=el('d'+i);dot.className='step-dot';if(i<n)dot.classList.add('done-s');else if(i===n)dot.classList.add('curr-s');});
    if(n===3){
      var d=drills[S.drill];
      if(d.type==='hits'){
        el('hitsec').style.display='block';el('ratesec').style.display='none';
        var inp=el('hinp');inp.value=S.hits||0;
        el('htgt').textContent='Ziel: '+d.maxHits+'x f\xfcr volle '+d.xp+' XP';
        updHitXP();
      }else{el('hitsec').style.display='none';el('ratesec').style.display='block';}
    }
    if(n===4)showOut();
  }
  function show(id){var e=el(id);if(e)e.style.display='block';}
  function hide(id){var e=el(id);if(e)e.style.display='none';}
  // Rating & outcome
  function selRate(v){S.rate=v;[1,2,3,4,5].forEach(function(i){el('r'+i).className='rate-opt'+(i===v?' sel-'+v:'');});el('rconf').style.display='flex';}
  function updHitXP(){var d=drills[S.drill],h=parseInt(el('hinp').value)||0,xp=hXP(h,d),full=h>=(d.maxHits||1);var prev=el('hxprev');prev.textContent=xp+' XP';prev.className='hit-xp-prev'+(full?' full':'');}
  function showOut(){
    var d=drills[S.drill],idx=S.drill;
    var isHits=d.type==='hits';
    var earned,done;
    if(isHits){
      var h=parseInt(el('hinp').value)||0;S.hits=h;
      earned=hXP(h,d);done=h>=(d.maxHits||1);
      if(h>(S.bestHits[idx]||0)){S.bestHits[idx]=h;var newS=earned;if(newS>(S.scXP[idx]||0))S.scXP[idx]=newS;}
      if(done&&!S.cat[idx])S.cat[idx]=Date.now();
      var rateEq=done?5:h>0?3:1;
      if(S.id){T7SB.addXP(S.id,earned,S.sbTotal);T7SB.recordAttempt(S.id,cfg.moduleKey,idx,rateEq,earned);}
    }else{
      earned=aXP(S.rate,d.xp);done=S.rate>=4;
      var prev=S.ratings[idx]||0,prevS=S.scXP[idx]||0,newS=cXP(S.rate,d.xp);
      if(newS>prevS)S.scXP[idx]=newS;
      if(S.rate>prev){S.ratings[idx]=S.rate;if(!S.cat[idx])S.cat[idx]=Date.now();}
      if(S.id){T7SB.addXP(S.id,earned,S.sbTotal);T7SB.recordAttempt(S.id,cfg.moduleKey,idx,S.rate,earned);}
    }
    S.cumXP+=earned;updXP();save();
    if(S.id)setTimeout(function(){T7SB.getTotalXP(S.id,function(t){S.sbTotal=t;updXP();});try{window.dispatchEvent(new CustomEvent('t7xpupdate'));}catch(e){}},1500);
    var box=el('obox'),icon=el('oicon'),title=el('otitle'),sub=el('osub'),btns=el('obtns');
    el('oxp').textContent='+'+earned+' XP';el('oxpt').textContent='Gesamt: '+(typeof S.sbTotal==='number'?S.sbTotal:S.cumXP)+' XP';
    var ni=S.drill+1;
    if(isHits){
      var h2=S.hits,max=d.maxHits||1;
      if(h2>=max){box.className='outcome out-high';icon.textContent='\uD83E\uDD29';title.textContent='Ziel erreicht!';sub.textContent=d.next||'Challenge abgeschlossen!';}
      else if(h2>0){box.className='outcome out-mid';icon.textContent='\uD83D\uDE04';title.textContent=h2+'x geschafft!';sub.textContent='Noch '+( max-h2)+'x f\xfcr das volle Ziel!';}
      else{box.className='outcome out-low';icon.textContent='\uD83D\uDCAA';title.textContent='Weiter k\xe4mpfen!';sub.textContent='Probiere nochmal \u2014 du schaffst es!';}
    }else{
      if(S.rate<=3){box.className='outcome out-low';icon.textContent=S.rate<=2?'\uD83D\uDCAA':'\uD83E\uDD14';title.textContent=S.rate<=2?'Weiter k\xe4mpfen!':'Ganz gut!';sub.textContent='Noch ein Versuch f\xfcr Bewertung 4 oder 5!';}
      else{box.className=S.rate===5?'outcome out-high':'outcome out-mid';icon.textContent=S.rate===5?'\uD83E\uDD29':'\uD83D\uDE04';title.textContent=S.rate===5?'Perfekt!':'Richtig gut!';sub.textContent=(d.next||'Challenge abgeschlossen!');}
    }
    btns.innerHTML='';
    var nb=document.createElement('button');nb.className='btn btn-sm '+(done?'btn-acc':'');
    if(done&&ni<nd&&canOpen(ni)){nb.textContent='N\xe4chste \u2192';nb.onclick=function(){openDrill(ni);};}
    else{nb.textContent='Zur\xfcck zur Liste';nb.onclick=goTrack;}
    btns.appendChild(nb);
    refresh();
  }
  // Camera
  function startCam(){
    navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(function(s){
      S.ms=s;var v=el('camv');v.srcObject=s;v.play();hide('camcard');el('camlive').style.display='block';hide('skiprow');
    }).catch(function(e){var er=el('camerr');if(er){er.style.display='block';er.textContent='Kamera: '+e.message;}});
  }
  function stopCam(){if(S.ms){S.ms.getTracks().forEach(function(t){t.stop();});S.ms=null;}if(S.mr&&S.mr.state!=='inactive')try{S.mr.stop();}catch(e){}S.mr=null;S.ch=[];S.rec=false;}
  function resetCam(){stopCam();var v=el('camv');if(v)v.srcObject=null;el('camlive').style.display='none';var pw=el('prevw');if(pw)pw.style.display='none';var pv=el('prev');if(pv){pv.pause();pv.src='';}show('camcard');el('skiprow').style.display='flex';}
  function toggleRec(){
    if(!S.ms)return;
    if(!S.rec){
      S.ch=[];var opt=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].filter(function(t){return MediaRecorder.isTypeSupported(t);})[0]||'';
      S.mr=new MediaRecorder(S.ms,opt?{mimeType:opt}:{});
      S.mr.ondataavailable=function(e){if(e.data&&e.data.size>0)S.ch.push(e.data);};
      S.mr.onstop=function(){var blob=new Blob(S.ch,{type:S.mr.mimeType||'video/webm'});var pv=el('prev');pv.src=URL.createObjectURL(blob);pv.load();el('camlive').style.display='none';el('prevw').style.display='block';hide('skiprow');stopCam();};
      S.mr.start();S.rec=true;el('recbtn').textContent='\u2B1B Stopp';el('recbtn').style.background='#DC2626';el('rectim').style.display='block';
    }else{if(S.mr&&S.mr.state!=='inactive')S.mr.stop();S.rec=false;el('recbtn').textContent='\u25CF Aufnahme';el('rectim').style.display='none';}
  }
  // Init player
  function initPlayer(id,name){
    S.id=id;S.inited=true;
    var parts=(name||'Spieler').trim().split(/\s+/);
    var ini=parts.length>=2?(parts[0][0]+parts[parts.length-1][0]).toUpperCase():(name||'?').slice(0,2).toUpperCase();
    el('av').textContent=ini;S.name=parts[0]||'Spieler';
    load(name);
    if(id){
      T7SB.getTotalXP(id,function(t){S.sbTotal=t;updXP();});
      T7SB.getBestRatings(id,cfg.moduleKey,function(best){
        var changed=false;
        Object.keys(best).forEach(function(i){
          var idx=parseInt(i),b=best[i];
          if(b.rating>=(S.ratings[idx]||0)){
            S.ratings[idx]=b.rating;
            S.scXP[idx]=cXP(b.rating,drills[idx]?drills[idx].xp:10);
            changed=true;
          }
        });
        if(changed){save();updXP();updProg();refresh();}
      });
    }
    var ht=el('ht');if(ht&&cfg.heroText)ht.textContent='Hey '+S.name+'! '+cfg.heroText;
  }
  // Wire events
  function wire(){
    el('cr').addEventListener('click',toggle);
    el('crb').addEventListener('click',function(e){e.stopPropagation();toggle();});
    for(var i=0;i<nd;i++){(function(idx){var row=el('row-'+idx);if(row)row.addEventListener('click',function(){openDrill(idx);});})(i);}
    el('back').addEventListener('click',goTrack);
    el('s1next').addEventListener('click',function(){goStep(2);});
    el('s2next').addEventListener('click',function(){goStep(3);});
    el('skip').addEventListener('click',function(){goStep(3);});
    [1,2,3,4,5].forEach(function(v){el('r'+v).addEventListener('click',function(){selRate(v);});});
    el('rconfbtn').addEventListener('click',function(){if(S.rate)goStep(4);});
    // Hit counter
    el('hminus').addEventListener('click',function(){var inp=el('hinp');inp.value=Math.max(0,(parseInt(inp.value)||0)-1);updHitXP();});
    el('hplus').addEventListener('click',function(){var inp=el('hinp');inp.value=(parseInt(inp.value)||0)+1;updHitXP();});
    el('hinp').addEventListener('input',updHitXP);
    el('hconfirm').addEventListener('click',function(){goStep(4);});
    el('camopen').addEventListener('click',startCam);
    el('recbtn').addEventListener('click',toggleRec);
    el('camstop').addEventListener('click',function(){resetCam();el('skiprow').style.display='flex';show('camcard');});
    el('retrycam').addEventListener('click',resetCam);
    window.addEventListener('t7xpupdate',function(){if(S.id)T7SB.getTotalXP(S.id,function(t){S.sbTotal=t;updXP();});});
  }
  // Build HTML
  function _html(){
    var rows=drills.map(function(d,i){
      var lk=d.star>1;
      return '<div class="prow'+(lk?' plocked':'')+'" id="t7a-row-'+i+'-'+uid+'"><div class="prow-num">'+(i<9?'0':'')+(i+1)+'</div><div class="prow-body"><div class="prow-title">'+d.title+'</div><div class="prow-meta">'+d.meta+'</div></div><span class="pbadge '+(lk?'b-locked':'b-new')+'" id="t7a-badge-'+i+'-'+uid+'">'+(lk?'\uD83D\uDD12 Gesperrt':'Neu')+'</span></div>';
    }).join('');
    var steps=['Anschauen','Üben','Bewerten','Ergebnis'].map(function(n,i){
      return '<div class="step"><div class="step-dot" id="t7a-d'+(i+1)+'-'+uid+'">'+(i+1)+'</div><span class="step-name">'+n+'</span></div>'+(i<3?'<div class="step-line"></div>':'');
    }).join('');
    var rOpts=[['😩','Kaum'],['🤔','Fast'],['🙂','OK'],['😄','Gut'],['🤩','Perfekt']].map(function(r,i){
      return '<div class="rate-opt" id="t7a-r'+(i+1)+'-'+uid+'"><div class="rate-emoji">'+r[0]+'</div><div class="rate-text">'+r[1]+'</div></div>';
    }).join('');
    return '<div class="t7w t7a-wrap">'+
      '<div class="cr" id="t7a-cr-'+uid+'">'+
        '<div class="cr-badge">'+(cfg.badge||'\u26bd')+'</div>'+
        '<div class="cr-body"><div class="cr-title">'+(cfg.title||'Challenge')+'</div>'+
          '<div class="cr-sub"><span>Technik Challenge</span><div class="cr-prog"><div class="cr-prog-fill" id="t7a-pf-'+uid+'" style="width:0%"></div></div><span class="cr-prog-label" id="t7a-pl-'+uid+'">0 / '+nd+'</span></div></div>'+
        '<div class="cr-player"><div class="cr-avatar" id="t7a-av-'+uid+'">?</div>'+
          '<span class="cr-xp" id="t7a-xp-'+uid+'">0 XP</span><span class="cr-xp-total" id="t7a-xpt-'+uid+'">0 XP</span>'+
          '<button class="cr-btn" id="t7a-crb-'+uid+'">Starten \u25bc</button></div>'+
      '</div>'+
      '<div class="t7-panel" id="t7a-panel-'+uid+'">'+
        '<div id="t7a-track-'+uid+'">'+
          '<div class="ph"><div class="ph-title">'+(cfg.title||'Challenge')+'</div><div class="ph-body" id="t7a-ht-'+uid+'">'+(cfg.heroText||'')+'</div></div>'+
          '<div class="plist"><div class="plabel">Technik \xdcbungen</div>'+rows+'</div>'+
          '<div class="unlock-banner" id="t7a-unlock-'+uid+'" style="display:none"><div class="ub-icon">\u26a1</div><div><div class="ub-title">Weitere Challenges freischalten</div><div class="ub-body">'+(cfg.unlockMsg||'Erreiche Bewertung 4 oder 5 f\xfcr weitere Challenges!')+'</div></div></div>'+
        '</div>'+
        '<div class="drill-screen" id="t7a-drill-'+uid+'">'+
          '<button class="back-btn" id="t7a-back-'+uid+'">\u2190 Zur\xfcck</button>'+
          '<div class="steps">'+steps+'</div>'+
          '<div class="drill-eye" id="t7a-deye-'+uid+'"></div><div class="drill-h" id="t7a-dh-'+uid+'"></div><div class="drill-meta" id="t7a-dmeta-'+uid+'"></div>'+
          '<div id="t7a-s1-'+uid+'">'+
            '<div class="embed-wrap"><iframe id="t7a-embed-'+uid+'" src="" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>'+
            '<div class="nudge"><div class="nudge-t">Schau zuerst das ganze Video</div><div class="nudge-s">Achte auf Fu\xdfstellung, K\xf6rperhaltung und Rhythmus.</div></div>'+
            '<div class="btn-row"><button class="btn btn-white" id="t7a-s1next-'+uid+'">Angeschaut \u2014 weiter \u2192</button></div>'+
          '</div>'+
          '<div id="t7a-s2-'+uid+'" style="display:none">'+
            '<div class="nudge"><div class="nudge-t">Leg das Handy weg und \xfcb!</div><div class="nudge-s">Probiere mehrmals. Dann filme einen Versuch und schau ihn dir an.</div></div>'+
            '<div class="try-card" id="t7a-camcard-'+uid+'"><div class="try-icon">\uD83D\uDCF9</div><div class="try-title">Filme deinen Versuch</div><div class="try-sub">Nichts wird gespeichert oder hochgeladen.</div><button class="btn btn-sm btn-acc" id="t7a-camopen-'+uid+'">Kamera \xf6ffnen</button><div id="t7a-camerr-'+uid+'" style="display:none;margin-top:10px;font-size:11px;color:#FF3B3B"></div></div>'+
            '<div id="t7a-camlive-'+uid+'" style="display:none;margin-bottom:14px"><video id="t7a-camv-'+uid+'" autoplay playsinline muted></video><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn btn-sm" id="t7a-recbtn-'+uid+'" style="background:#DC2626;color:#fff;border-color:#DC2626">\u25cf Aufnahme</button><button class="btn btn-sm" id="t7a-camstop-'+uid+'">Abbrechen</button></div><div id="t7a-rectim-'+uid+'" style="display:none;text-align:center;font-size:11px;font-weight:800;color:#FF3B3B;margin-top:8px;text-transform:uppercase">\u23fa Aufnahme l\xe4uft\u2026</div></div>'+
            '<div id="t7a-prevw-'+uid+'" style="display:none;margin-bottom:14px"><video id="t7a-prev-'+uid+'" controls playsinline></video><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-sm" id="t7a-retrycam-'+uid+'">\uD83D\uDCF9 Nochmal</button><button class="btn btn-sm btn-acc" id="t7a-s2next-'+uid+'">Jetzt bewerten \u2192</button></div></div>'+
            '<div class="btn-row" id="t7a-skiprow-'+uid+'" style="display:flex"><button class="btn btn-sm" id="t7a-skip-'+uid+'">Ohne Aufnahme bewerten \u2192</button></div>'+
          '</div>'+
          '<div id="t7a-s3-'+uid+'" style="display:none">'+
            '<div id="t7a-hitsec-'+uid+'" style="display:none">'+
              '<div class="nudge"><div class="nudge-t">Gib deine beste Anzahl ein</div><div class="nudge-s">Sei ehrlich \u2014 jeder Versuch z\xe4hlt!</div></div>'+
              '<div class="hit-card">'+
                '<div class="hit-title">Wie viele Male hast du es geschafft?</div>'+
                '<div class="hit-sub" id="t7a-hsub-'+uid+'"></div>'+
                '<div class="hit-row"><button class="hit-btn" id="t7a-hminus-'+uid+'">&#8722;</button><input class="hit-input" type="number" min="0" max="999" value="0" id="t7a-hinp-'+uid+'"><button class="hit-btn" id="t7a-hplus-'+uid+'">&#43;</button></div>'+
                '<div class="hit-target" id="t7a-htgt-'+uid+'"></div>'+
                '<div class="hit-xp-prev" id="t7a-hxprev-'+uid+'">0 XP</div>'+
              '</div>'+
              '<div class="btn-row"><button class="btn btn-acc" id="t7a-hconfirm-'+uid+'">Best\xe4tigen \u2192</button></div>'+
            '</div>'+
            '<div id="t7a-ratesec-'+uid+'" style="display:none">'+
              '<div class="nudge"><div class="nudge-t">Sei ehrlich zu dir selbst</div><div class="nudge-s">4 oder 5 schaltet die Challenge frei und bringt dir Score-XP!</div></div>'+
              '<div class="rate-intro">Wie lief dein Versuch?</div>'+
              '<div class="rate-opts">'+rOpts+'</div>'+
              '<div class="btn-row" id="t7a-rconf-'+uid+'" style="display:none"><button class="btn btn-acc" id="t7a-rconfbtn-'+uid+'">Bewertung best\xe4tigen \u2192</button></div>'+
            '</div>'+
          '</div>'+
          '<div id="t7a-s4-'+uid+'" style="display:none">'+
            '<div class="outcome out-low" id="t7a-obox-'+uid+'"><div class="outcome-icon" id="t7a-oicon-'+uid+'"></div><div class="outcome-title" id="t7a-otitle-'+uid+'"></div><div class="outcome-sub" id="t7a-osub-'+uid+'"></div><div><span class="xp-pill" id="t7a-oxp-'+uid+'"></span></div><div><span class="xp-total-pill" id="t7a-oxpt-'+uid+'"></span></div></div>'+
            '<div class="btn-row-c" id="t7a-obtns-'+uid+'"></div>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }
  wire();
  T7Identity.resolve(function(id,name){if(id)initPlayer(id,name);});
}

/* ===========================================================
   TYPE B ENGINE -- T7Cert
   Star certificates: 5 drills, then upload final video via
   T7CertUpload (Supabase). All drills must be rated >=4
   to unlock the submission row.
   =========================================================== */
function T7Cert(cfg){
  var uid=(Math.random().toString(36)+'00000').slice(2,7);
  var drills=cfg.drills||[];var nd=drills.length;
  var XMUL=[0,.2,.4,.6,.8,1];
  function aXP(r,max){return Math.round((XMUL[r]||0)*max);}
  function cXP(r,max){return r<4?0:Math.round((XMUL[r]||0)*max);}
  var S={expanded:false,drill:-1,rate:0,ratings:drills.map(function(){return 0;}),scXP:drills.map(function(){return 0;}),cumXP:0,cat:{},sk:'t7_'+cfg.instanceKey+'_g',ms:null,mr:null,ch:[],rec:false,inited:false,name:'Spieler',sbTotal:null,id:null,submitted:false};
  var cont=document.getElementById(cfg.containerId||'cert-container');if(!cont)return;
  cont.insertAdjacentHTML('beforeend',_html());
  function el(id){return document.getElementById('t7b-'+id+'-'+uid);}
  function sv(){var e=el('cr');if(e)e.scrollIntoView({behavior:'smooth',block:'nearest'});}
  function show(id){var e=el(id);if(e)e.style.display='block';}
  function hide(id){var e=el(id);if(e)e.style.display='none';}
  // Storage
  function save(){try{localStorage.setItem(S.sk,JSON.stringify({r:S.ratings,s:S.scXP,c:S.cumXP,at:S.cat,sub:S.submitted}));}catch(e){}}
  function load(u){
    S.sk='t7_'+cfg.instanceKey+'_'+(u||'g').replace(/\s+/g,'_').toLowerCase();
    try{var raw=localStorage.getItem(S.sk);if(raw){var d=JSON.parse(raw);if(d.r)S.ratings=d.r;if(d.s)S.scXP=d.s;else for(var i=0;i<nd;i++)S.scXP[i]=cXP(S.ratings[i]||0,drills[i].xp);if(typeof d.c==='number')S.cumXP=d.c;if(d.at)S.cat=d.at;if(d.sub)S.submitted=d.sub;}}catch(e){}
    updXP();updProg();refresh();
  }
  function modXP(){var t=0;for(var i=0;i<nd;i++)t+=S.scXP[i];return t;}
  function updXP(){el('xp').textContent=modXP()+' XP';el('xpt').textContent=(typeof S.sbTotal==='number'?S.sbTotal:0)+' XP';}
  function updProg(){var done=S.ratings.filter(function(r){return r>=4;}).length;el('pf').style.width=Math.round(done/nd*100)+'%';el('pl').textContent=done+' / '+nd;}
  function allDone(){return S.ratings.filter(function(r){return r>=4;}).length===nd;}
  function refresh(){
    for(var i=0;i<nd;i++){
      var row=el('row-'+i),badge=el('badge-'+i),r=S.ratings[i];
      row.className='prow'+(r>=4?' pdone':'');
      if(r===0){badge.className='pbadge b-new';badge.textContent='Neu';}
      else if(r<=3){badge.className='pbadge b-retry';badge.textContent='\u21a9 Verbessern';}
      else if(r===4){badge.className='pbadge b-inprog';badge.textContent='\u2713 Gut';}
      else{badge.className='pbadge b-done';badge.textContent='\u2605 Perfekt';}
    }
    var fr=el('rowfinal'),fb=el('badfinal'),done=allDone();
    if(done){fr.classList.remove('plocked');fb.className='pbadge '+(S.submitted?'b-done':'b-submit');fb.textContent=S.submitted?'\u2713 Eingereicht':'\u2605 Einreichen';}
    else{fr.classList.add('plocked');fb.className='pbadge b-locked';fb.textContent='\uD83D\uDD12 Gesperrt';}
    updProg();
  }
  // Navigation
  function toggle(){
    S.expanded=!S.expanded;var cr=el('cr'),panel=el('panel');
    if(S.expanded){cr.classList.add('open');panel.classList.add('open');el('crb').textContent='Schlie\xdfen \u25b2';}
    else{cr.classList.remove('open');panel.classList.remove('open');el('crb').textContent='Starten \u25bc';goTrack();}
  }
  function goTrack(){el('embed').src='';el('drill').classList.remove('open');show('track');stopCam();refresh();sv();}
  function openDrill(idx){
    S.drill=idx;S.rate=0;var d=drills[idx];
    el('deye').textContent=d.eye;el('dh').textContent=d.title;el('dmeta').textContent=d.meta;
    el('embed').src='https://player.vimeo.com/video/'+d.vid+'?h='+d.hash+'&color=FFD700&title=0&byline=0&portrait=0&dnt=1';
    [1,2,3,4,5].forEach(function(v){el('r'+v).className='rate-opt';});
    hide('rconf');resetCam();hide('track');el('drill').classList.add('open');goStep(1);sv();
  }
  function openSubmit(){
    if(!allDone())return;
    if(typeof window.T7CertUpload==='function'){
      window.T7CertUpload(cfg.stars);
    }else{
      alert('Upload-Widget nicht geladen. Bitte Seite neu laden.');
    }
  }
  function goStep(n){
    ['s1','s2','s3','s4'].forEach(function(id,i){el(id).style.display=(i===n-1)?'block':'none';});
    [1,2,3,4].forEach(function(i){var dot=el('d'+i);dot.className='step-dot';if(i<n)dot.classList.add('done-s');else if(i===n)dot.classList.add('curr-s');});
    if(n===4)showOut();
  }
  // Rating & outcome
  function selRate(v){S.rate=v;[1,2,3,4,5].forEach(function(i){el('r'+i).className='rate-opt'+(i===v?' sel-'+v:'');});el('rconf').style.display='flex';}
  function showOut(){
    var d=drills[S.drill],idx=S.drill,prev=S.ratings[idx]||0;
    var earned=aXP(S.rate,d.xp),prevS=S.scXP[idx]||0,newS=cXP(S.rate,d.xp);
    S.cumXP+=earned;if(newS>prevS)S.scXP[idx]=newS;
    if(S.rate>prev){S.ratings[idx]=S.rate;if(!S.cat[idx])S.cat[idx]=Date.now();}
    if(S.id){T7SB.addXP(S.id,earned,S.sbTotal);T7SB.recordAttempt(S.id,cfg.instanceKey,idx,S.rate,earned);}
    updXP();save();
    if(S.id)setTimeout(function(){T7SB.getTotalXP(S.id,function(t){S.sbTotal=t;updXP();});try{window.dispatchEvent(new CustomEvent('t7xpupdate'));}catch(e){}},1500);
    var box=el('obox'),icon=el('oicon'),title=el('otitle'),sub=el('osub'),btns=el('obtns');
    el('oxp').textContent='+'+earned+' XP';el('oxpt').textContent='Gesamt: '+(typeof S.sbTotal==='number'?S.sbTotal:S.cumXP)+' XP';
    var ni=idx+1,ad=allDone();
    if(S.rate<=3){box.className='outcome out-low';icon.textContent=S.rate<=2?'\uD83D\uDCAA':'\uD83E\uDD14';title.textContent=S.rate<=2?'Weiter k\xe4mpfen!':'Ganz gut!';sub.textContent='Noch ein Versuch f\xfcr Bewertung 4 oder 5!';}
    else{box.className=S.rate===5?'outcome out-high':'outcome out-mid';icon.textContent=S.rate===5?'\uD83E\uDD29':'\uD83D\uDE04';title.textContent=S.rate===5?'Perfekt!':'Richtig gut!';sub.textContent=ad?'Alle Challenges abgeschlossen! Jetzt einreichen!':(drills[idx].next||'Weiter so!');}
    btns.innerHTML='';
    if(ad&&S.rate>=4){var sb=document.createElement('button');sb.className='btn btn-gold';sb.textContent='\u2605 Zertifikat einreichen';sb.onclick=openSubmit;btns.appendChild(sb);}
    var nb=document.createElement('button');nb.className='btn btn-sm';
    if(ni<nd){nb.textContent='N\xe4chste \u2192';nb.onclick=function(){openDrill(ni);};}
    else{nb.textContent='Zur\xfcck zur Liste';nb.onclick=goTrack;}
    btns.appendChild(nb);
    refresh();
  }
  // Drill camera
  function startCam(){navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(function(s){S.ms=s;var v=el('camv');v.srcObject=s;v.play();hide('camcard');el('camlive').style.display='block';hide('skiprow');}).catch(function(e){var er=el('camerr');if(er){er.style.display='block';er.textContent='Kamera: '+e.message;}});}
  function stopCam(){if(S.ms){S.ms.getTracks().forEach(function(t){t.stop();});S.ms=null;}if(S.mr&&S.mr.state!=='inactive')try{S.mr.stop();}catch(e){}S.mr=null;S.ch=[];S.rec=false;}
  function resetCam(){stopCam();var v=el('camv');if(v)v.srcObject=null;el('camlive').style.display='none';var pw=el('prevw');if(pw)pw.style.display='none';var pv=el('prev');if(pv){pv.pause();pv.src='';}show('camcard');el('skiprow').style.display='flex';}
  function toggleRec(){
    if(!S.ms)return;
    if(!S.rec){S.ch=[];var opt=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].filter(function(t){return MediaRecorder.isTypeSupported(t);})[0]||'';S.mr=new MediaRecorder(S.ms,opt?{mimeType:opt}:{});S.mr.ondataavailable=function(e){if(e.data&&e.data.size>0)S.ch.push(e.data);};S.mr.onstop=function(){var blob=new Blob(S.ch,{type:S.mr.mimeType||'video/webm'});var pv=el('prev');pv.src=URL.createObjectURL(blob);pv.load();el('camlive').style.display='none';el('prevw').style.display='block';hide('skiprow');stopCam();};S.mr.start();S.rec=true;el('recbtn').textContent='\u2B1B Stopp';el('recbtn').style.background='#DC2626';el('rectim').style.display='block';}
    else{if(S.mr&&S.mr.state!=='inactive')S.mr.stop();S.rec=false;el('recbtn').textContent='\u25cf Aufnahme';el('rectim').style.display='none';}
  }
  // Final-video submission is handled entirely by T7CertUpload (see t7-cert-upload.js).
  // No in-engine recording or email path remains.
  // Init player
  function initPlayer(id,name){
    S.id=id;S.inited=true;
    var parts=(name||'Spieler').trim().split(/\s+/);
    var ini=parts.length>=2?(parts[0][0]+parts[parts.length-1][0]).toUpperCase():(name||'?').slice(0,2).toUpperCase();
    el('av').textContent=ini;S.name=parts[0]||'Spieler';
    load(name);
    if(id){
      T7SB.getTotalXP(id,function(t){S.sbTotal=t;updXP();});
      T7SB.getBestRatings(id,cfg.instanceKey,function(best){
        var changed=false;
        Object.keys(best).forEach(function(i){
          var idx=parseInt(i),b=best[i];
          if(b.rating>=(S.ratings[idx]||0)){
            S.ratings[idx]=b.rating;
            S.scXP[idx]=cXP(b.rating,drills[idx]?drills[idx].xp:10);
            changed=true;
          }
        });
        if(changed){save();updXP();updProg();refresh();}
      });
      T7SB.getStars(id,function(cert){
        if(cert&&cert.stars&&parseInt(cert.stars,10)>=parseInt(cfg.stars,10)){
          var wrap=document.querySelector('.t7b-wrap[data-uid="'+uid+'"]');if(wrap)wrap.classList.add('certified');
          S.submitted=true;save();refresh();
        }
      });
    }
    var ht=el('ht');if(ht&&cfg.heroText)ht.textContent='Hey '+S.name+'! '+cfg.heroText;
  }
  // Wire events
  function wire(){
    el('cr').addEventListener('click',toggle);
    el('crb').addEventListener('click',function(e){e.stopPropagation();toggle();});
    for(var i=0;i<nd;i++){(function(idx){var row=el('row-'+idx);if(row)row.addEventListener('click',function(){openDrill(idx);});})(i);}
    el('rowfinal').addEventListener('click',function(){if(allDone())openSubmit();});
    el('back').addEventListener('click',goTrack);
    el('s1next').addEventListener('click',function(){goStep(2);});
    el('s2next').addEventListener('click',function(){goStep(3);});
    el('skip').addEventListener('click',function(){goStep(3);});
    [1,2,3,4,5].forEach(function(v){el('r'+v).addEventListener('click',function(){selRate(v);});});
    el('rconfbtn').addEventListener('click',function(){if(S.rate)goStep(4);});
    el('camopen').addEventListener('click',startCam);el('recbtn').addEventListener('click',toggleRec);
    el('camstop').addEventListener('click',function(){resetCam();el('skiprow').style.display='flex';show('camcard');});
    el('retrycam').addEventListener('click',resetCam);
    // Final-video submission: T7CertUpload fires 't7cert-submitted' on successful upload.
    window.addEventListener('t7cert-submitted',function(ev){
      if(ev&&ev.detail&&parseInt(ev.detail.stars,10)===parseInt(cfg.stars,10)){
        S.submitted=true;save();refresh();
        if(S.id)T7SB.setStars(S.id,parseInt(cfg.stars,10));
      }
    });
    window.addEventListener('t7xpupdate',function(){if(S.id)T7SB.getTotalXP(S.id,function(t){S.sbTotal=t;updXP();});});
  }
  // Build HTML
  function _html(){
    var rows=drills.map(function(d,i){
      return '<div class="prow" id="t7b-row-'+i+'-'+uid+'"><div class="prow-num">'+(i<9?'0':'')+(i+1)+'</div><div class="prow-body"><div class="prow-title">'+d.title+'</div><div class="prow-meta">'+d.meta+'</div></div><span class="pbadge b-new" id="t7b-badge-'+i+'-'+uid+'">Neu</span></div>';
    }).join('');
    var steps=['Anschauen','Üben','Bewerten','Ergebnis'].map(function(n,i){
      return '<div class="step"><div class="step-dot" id="t7b-d'+(i+1)+'-'+uid+'">'+(i+1)+'</div><span class="step-name">'+n+'</span></div>'+(i<3?'<div class="step-line"></div>':'');
    }).join('');
    var rOpts=[['😩','Kaum'],['🤔','Fast'],['🙂','OK'],['😄','Gut'],['🤩','Perfekt']].map(function(r,i){
      return '<div class="rate-opt" id="t7b-r'+(i+1)+'-'+uid+'"><div class="rate-emoji">'+r[0]+'</div><div class="rate-text">'+r[1]+'</div></div>';
    }).join('');
    return '<div class="t7w t7b-wrap" data-uid="'+uid+'">'+
      '<div class="cr" id="t7b-cr-'+uid+'">'+
        '<div class="cr-badge"><span>'+(cfg.badge||'\u2b50')+'</span></div>'+
        '<div class="cr-body"><div class="cr-title">'+(cfg.title||'Zertifikat')+'</div>'+
          '<div class="cr-sub"><span>Stern Zertifikat</span><div class="cr-prog"><div class="cr-prog-fill" id="t7b-pf-'+uid+'" style="width:0%"></div></div><span class="cr-prog-label" id="t7b-pl-'+uid+'">0 / '+nd+'</span></div></div>'+
        '<div class="cr-player"><div class="cr-avatar" id="t7b-av-'+uid+'">?</div>'+
          '<span class="cr-xp" id="t7b-xp-'+uid+'">0 XP</span><span class="cr-xp-total" id="t7b-xpt-'+uid+'">0 XP</span>'+
          '<span class="cr-certified" id="t7b-certbdg-'+uid+'">\u2b50 Zertifiziert</span>'+
          '<button class="cr-btn" id="t7b-crb-'+uid+'">Starten \u25bc</button></div>'+
      '</div>'+
      '<div class="t7-panel" id="t7b-panel-'+uid+'">'+
        '<div id="t7b-track-'+uid+'">'+
          '<div class="ph"><div class="ph-title">'+(cfg.title||'Zertifikat')+'</div><div class="ph-body" id="t7b-ht-'+uid+'">'+(cfg.heroText||'')+'</div></div>'+
          '<div class="plist"><div class="plabel">Technik Challenges</div>'+rows+
            '<div class="prow plocked" id="t7b-rowfinal-'+uid+'"><div class="prow-num">\uD83C\uDFAC</div><div class="prow-body"><div class="prow-title">Final-Video einreichen</div><div class="prow-meta">Alle 5 Challenges meistern -> Zertifikat erhalten</div></div><span class="pbadge b-locked" id="t7b-badfinal-'+uid+'">\uD83D\uDD12 Gesperrt</span></div>'+
          '</div>'+
        '</div>'+
        '<div class="drill-screen" id="t7b-drill-'+uid+'">'+
          '<button class="back-btn" id="t7b-back-'+uid+'">\u2190 Zur\xfcck</button>'+
          '<div class="steps">'+steps+'</div>'+
          '<div class="drill-eye" id="t7b-deye-'+uid+'"></div><div class="drill-h" id="t7b-dh-'+uid+'"></div><div class="drill-meta" id="t7b-dmeta-'+uid+'"></div>'+
          '<div id="t7b-s1-'+uid+'"><div class="embed-wrap"><iframe id="t7b-embed-'+uid+'" src="" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div><div class="nudge"><div class="nudge-t">Schau zuerst das ganze Video</div><div class="nudge-s">Achte auf Fu\xdfstellung, K\xf6rperhaltung und Rhythmus.</div></div><div class="btn-row"><button class="btn btn-white" id="t7b-s1next-'+uid+'">Angeschaut \u2014 weiter \u2192</button></div></div>'+
          '<div id="t7b-s2-'+uid+'" style="display:none"><div class="nudge"><div class="nudge-t">Leg das Handy weg und \xfcb!</div><div class="nudge-s">Probiere mehrmals. Dann filme einen Versuch.</div></div><div class="try-card" id="t7b-camcard-'+uid+'"><div class="try-icon">\uD83D\uDCF9</div><div class="try-title">Filme deinen Versuch</div><div class="try-sub">Nichts wird gespeichert oder hochgeladen.</div><button class="btn btn-sm btn-acc" id="t7b-camopen-'+uid+'">Kamera \xf6ffnen</button><div id="t7b-camerr-'+uid+'" style="display:none;margin-top:10px;font-size:11px;color:#FF3B3B"></div></div><div id="t7b-camlive-'+uid+'" style="display:none;margin-bottom:14px"><video id="t7b-camv-'+uid+'" autoplay playsinline muted></video><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn btn-sm" id="t7b-recbtn-'+uid+'" style="background:#DC2626;color:#fff;border-color:#DC2626">\u25cf Aufnahme</button><button class="btn btn-sm" id="t7b-camstop-'+uid+'">Abbrechen</button></div><div id="t7b-rectim-'+uid+'" style="display:none;text-align:center;font-size:11px;font-weight:800;color:#FF3B3B;margin-top:8px;text-transform:uppercase">\u23fa L\xe4uft\u2026</div></div><div id="t7b-prevw-'+uid+'" style="display:none;margin-bottom:14px"><video id="t7b-prev-'+uid+'" controls playsinline></video><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-sm" id="t7b-retrycam-'+uid+'">\uD83D\uDCF9 Nochmal</button><button class="btn btn-sm btn-acc" id="t7b-s2next-'+uid+'">Jetzt bewerten \u2192</button></div></div><div class="btn-row" id="t7b-skiprow-'+uid+'" style="display:flex"><button class="btn btn-sm" id="t7b-skip-'+uid+'">Ohne Aufnahme \u2192</button></div></div>'+
          '<div id="t7b-s3-'+uid+'" style="display:none"><div class="nudge"><div class="nudge-t">Sei ehrlich zu dir selbst</div><div class="nudge-s">4 oder 5 z\xe4hlt f\xfcr das Zertifikat!</div></div><div class="rate-intro">Wie lief dein Versuch?</div><div class="rate-opts">'+rOpts+'</div><div class="btn-row" id="t7b-rconf-'+uid+'" style="display:none"><button class="btn btn-acc" id="t7b-rconfbtn-'+uid+'">Best\xe4tigen \u2192</button></div></div>'+
          '<div id="t7b-s4-'+uid+'" style="display:none"><div class="outcome out-low" id="t7b-obox-'+uid+'"><div class="outcome-icon" id="t7b-oicon-'+uid+'"></div><div class="outcome-title" id="t7b-otitle-'+uid+'"></div><div class="outcome-sub" id="t7b-osub-'+uid+'"></div><div><span class="xp-pill" id="t7b-oxp-'+uid+'"></span></div><div><span class="xp-total-pill" id="t7b-oxpt-'+uid+'"></span></div></div><div class="btn-row-c" id="t7b-obtns-'+uid+'"></div></div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }
  wire();
  T7Identity.resolve(function(id,name){if(id)initPlayer(id,name);});
}

/* === SIDEBAR: FORTSCHRITT ===
   Total XP + stars from player_stats; streak + weekly XP from drill_attempts. */
function T7Fortschritt(containerId){
  var cont=document.getElementById(containerId);
  if(!cont)return;
  cont.innerHTML='<div class="t7f-loading">Lade\u2026</div>';
  function getWeekKey(date){
    var d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
    var day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);
    var yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var week=Math.ceil((((d-yearStart)/86400000)+1)/7);
    return d.getUTCFullYear()+'-W'+week;
  }
  function computeStreak(attempts){
    var weekSet={};
    (attempts||[]).forEach(function(row){
      var ts=row.attempted_at?new Date(row.attempted_at).getTime():0;
      if(ts)weekSet[getWeekKey(new Date(ts))]=true;
    });
    var weeks=Object.keys(weekSet).sort().reverse();
    if(!weeks.length)return 0;
    var thisW=getWeekKey(new Date()),lastW=getWeekKey(new Date(Date.now()-7*86400000));
    if(weeks[0]!==thisW&&weeks[0]!==lastW)return 0;
    var streak=1;
    for(var i=1;i<weeks.length;i++){
      var py=parseInt(weeks[i-1].split('-W')[0]),pw=parseInt(weeks[i-1].split('-W')[1]);
      var cy=parseInt(weeks[i].split('-W')[0]),cw=parseInt(weeks[i].split('-W')[1]);
      if((py===cy&&pw-cw===1)||(py-cy===1&&pw===1&&cw>=52))streak++;else break;
    }
    return streak;
  }
  function getWeeklyXP(attempts){
    var now=new Date();
    var startOfWeek=new Date(now);startOfWeek.setHours(0,0,0,0);
    startOfWeek.setDate(now.getDate()-((now.getDay()+6)%7));
    var t0=startOfWeek.getTime(),tw=0;
    (attempts||[]).forEach(function(row){
      var ts=row.attempted_at?new Date(row.attempted_at).getTime():0;
      if(ts>=t0)tw+=Number(row.xp||0);
    });
    return tw;
  }
  function render(id){
    Promise.all([
      new Promise(function(res){T7SB.getStats(id,res);}),
      new Promise(function(res){T7SB.getAllAttempts(id,res);})
    ]).then(function(out){
      var stats=out[0],attempts=out[1]||[];
      if(!stats){cont.innerHTML='<div class="t7f-empty">Profil noch nicht angelegt.</div>';return;}
      var dispName=stats.first_name||'Spieler';
      var ini=dispName.slice(0,2).toUpperCase();
      var weekXP=getWeeklyXP(attempts);
      var streak=computeStreak(attempts);
      var daysHtml='';
      for(var d=0;d<8;d++)daysHtml+='<div class="t7f-streak-day'+(d<streak?' on':'')+'"></div>';
      cont.innerHTML=
        '<div class="t7f-hero">'+
          '<div class="t7f-hero-top">'+
            '<div class="t7f-avatar">'+ini+'</div>'+
            '<div><div class="t7f-pname">'+dispName+'</div><div class="t7f-sub">Mein Fortschritt</div></div>'+
          '</div>'+
        '</div>'+
        '<div class="t7f-stat-row">'+
          '<div class="t7f-stat-card"><div class="t7f-stat-num">'+stats.total_xp.toLocaleString('de-AT')+'</div><div class="t7f-stat-label">Gesamt XP</div></div>'+
          '<div class="t7f-stat-card"><div class="t7f-stat-num">+'+weekXP+'</div><div class="t7f-stat-label">Diese Woche</div></div>'+
        '</div>'+
        '<div class="t7f-streak"><div class="t7f-streak-val">'+streak+' Woche'+(streak===1?'':'n')+' Streak</div><div class="t7f-streak-days">'+daysHtml+'</div></div>';
    });
  }
  T7Identity.resolve(function(id){
    if(!id){cont.innerHTML='<div class="t7f-empty">Kein Spieler erkannt.</div>';return;}
    render(id);
  });
  window.addEventListener('t7xpupdate',function(){var info=T7Identity.get();if(info&&info.id)render(info.id);});
}

/* === SIDEBAR: RANGLISTE ===
   Top players by total_xp from player_stats (first_name joined from player_profiles). */
function T7Rangliste(containerId){
  var cont=document.getElementById(containerId);if(!cont)return;
  var LIMIT=20,AC=[['#003d5c','#00E5FF'],['#064e3b','#34d399'],['#3b1e5f','#c4b5fd'],['#1e3a5f','#93c5fd'],['#7f1d1d','#fca5a5'],['#1c3a2e','#86efac'],['#4a1d2f','#f9a8d4'],['#1e3a1e','#bbf7d0'],['#2d2000','#fde68a'],['#1a1a3e','#a5b4fc']];
  var allP=[];
  function ini(n){if(!n)return'?';return n.split(/\s+/).map(function(w){return w[0];}).join('').toUpperCase().slice(0,2);}
  function ai(n){return n?(n.charCodeAt(0)+n.length)%AC.length:0;}
  cont.innerHTML='<div id="t7rl-list-'+containerId+'"><div class="rl-loading">Lade\u2026</div></div>';
  var listEl=document.getElementById('t7rl-list-'+containerId);
  function renderList(){
    var med=['\uD83E\uDD47','\uD83E\uDD48','\uD83E\uDD49'];
    listEl.innerHTML='<div class="rank-list">'+allP.map(function(p,i){
      var r=i+1,c=AC[ai(p.name)],val=(p.xp||0).toLocaleString('de-AT')+' XP';
      var starsBadge=p.stars?' <span style="margin-left:6px">\u2b50'+p.stars+'</span>':'';
      return '<div class="rank-row"><div class="rank-num" style="color:'+(r===1?'#00E5FF':r===2?'rgba(200,200,220,.75)':r===3?'#FF9500':'rgba(255,255,255,.18)')+'">'+(r<=3?med[r-1]:r)+'</div><div class="r-avatar" style="background:'+c[0]+';color:'+c[1]+';border:2px solid '+(r===1?'#00E5FF':r===2?'rgba(200,200,220,.55)':r===3?'rgba(255,149,0,.55)':c[1]+'55')+'">'+ini(p.name)+'</div><div class="rank-name">'+p.name+starsBadge+'</div><div class="rank-val">'+val+'</div></div>';
    }).join('')+'</div>';
  }
  function load(){
    T7SB.getLeaderboard(LIMIT,function(rows){
      allP=rows;
      if(!allP.length){listEl.innerHTML='<div class="rl-loading">Noch keine Eintr\xe4ge.</div>';return;}
      renderList();
    });
  }
  load();
  window.addEventListener('t7xpupdate',load);
  setInterval(load,60000);
}

/* === SIDEBAR: BADGE (Sterne Zertifikat) === */
function T7Badge(containerId){
  var cont=document.getElementById(containerId);if(!cont)return;
  cont.innerHTML='<div class="t7f-loading">Lade\u2026</div>';
  function starsHtml(){return '\u2b50';}
  function fmtDate(ts){if(!ts)return'';var d=new Date(typeof ts==='number'?ts:parseInt(ts));return d.toLocaleDateString('de-AT',{day:'2-digit',month:'long',year:'numeric'});}
  function showBadge(n,at,nm){
    cont.innerHTML='<div class="t7-cert">'+
      '<div class="t7-cert-top"></div>'+
      '<div class="t7-cert-bottom"></div>'+
      '<div class="t7-cert-brand">T7 Academy Zertifikat</div>'+
      '<div class="t7-cert-line"></div>'+
        '<div class="t7-cert-star-block">'+
        (n>1?'<div class="t7-cert-num">'+n+'</div>':'')+
        '<div class="t7-cert-stars">'+starsHtml()+'</div>'+
      '</div>'+
      '<div class="t7-cert-line"></div>'+
      (nm?'<div class="t7-cert-name">'+nm+'</div>':'')+
      '<div class="t7-cert-official">Zertifiziert von <strong>T7 Academy Expert</strong>'+(at?' \u00b7 '+fmtDate(at):'')+'</div>'+
    '</div>';
  }
  function fetchBadge(id){
    T7SB.getStats(id,function(s){
      if(s&&s.stars)showBadge(s.stars,s.stars_awarded_at,s.first_name);
      else cont.innerHTML='<div class="t7f-empty">Noch kein Zertifikat.</div>';
    });
  }
  T7Identity.resolve(function(id){if(id)fetchBadge(id);else cont.innerHTML='<div class="t7f-empty">Kein Spieler erkannt.</div>';});
  window.addEventListener('t7xpupdate',function(){var info=T7Identity.get();if(info&&info.id)fetchBadge(info.id);});
}

/* === MOBILE BOTTOM SHEET (FAB + Fortschritt/Rangliste/Zertifikat) === */
function T7MobileSheet(){
  if(document.getElementById('t7-fab'))return; // already injected
  var sheetHTML=
    '<button id="t7-fab" type="button">'+
      '<span id="t7-fab-stars" style="display:none">\u2b50<span id="t7-fab-stars-num"></span></span>'+
      '<span id="t7-fab-stars-sep" style="display:none;opacity:.5"> | </span>'+
      '<span>\u26a1</span>'+
      '<span id="t7-fab-xp">0 XP</span>'+
      '<span style="opacity:.5"> | </span>'+
      '<span id="t7-fab-streak">0 Wochen</span>'+
    '</button>'+
    '<div id="t7-sheet-overlay"></div>'+
    '<div id="t7-sheet">'+
      '<div class="t7-sheet-handle"></div>'+
      '<div class="t7-sheet-header">'+
        '<div class="t7-sheet-title" id="t7-sheet-title">Mein Fortschritt</div>'+
        '<button class="t7-sheet-close" id="t7-sheet-close" type="button">\u2715</button>'+
      '</div>'+
      '<div class="t7-sheet-tabs">'+
        '<button class="t7-sheet-tab active" id="t7-tab-fort" type="button">\ud83d\udcca Fortschritt</button>'+
        '<button class="t7-sheet-tab" id="t7-tab-rang" type="button">\ud83c\udfc6 Rangliste</button>'+
        '<button class="t7-sheet-tab" id="t7-tab-cert" type="button">\u2b50 Zertifikat</button>'+
      '</div>'+
      '<div class="t7-sheet-content" id="t7-sheet-content"><div class="t7m-loading">Lade\u2026</div></div>'+
    '</div>';
  var wrap=document.createElement('div');wrap.innerHTML=sheetHTML;
  while(wrap.firstChild)document.body.appendChild(wrap.firstChild);

  var st={open:false,tab:'fort',id:null,name:'Spieler',totalXP:0,weekXP:0,streak:0,stars:0,starsAt:null,players:[],fortLoaded:false,rangLoaded:false,certLoaded:false};
  function $(id){return document.getElementById(id);}
  function ini(n){if(!n)return'?';return n.split(/\s+/).map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase();}
  function getWeekKey(d){var x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));var day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);var ys=new Date(Date.UTC(x.getUTCFullYear(),0,1));return x.getUTCFullYear()+'-W'+Math.ceil((((x-ys)/86400000)+1)/7);}
  function calcStreak(att){
    var wk={};(att||[]).forEach(function(a){var ts=a.attempted_at?new Date(a.attempted_at).getTime():0;if(ts)wk[getWeekKey(new Date(ts))]=true;});
    var weeks=Object.keys(wk).sort().reverse();if(!weeks.length)return 0;
    var thisW=getWeekKey(new Date()),lastW=getWeekKey(new Date(Date.now()-7*86400000));
    if(weeks[0]!==thisW&&weeks[0]!==lastW)return 0;
    var s=1;
    for(var i=1;i<weeks.length;i++){
      var py=parseInt(weeks[i-1].split('-W')[0]),pw=parseInt(weeks[i-1].split('-W')[1]);
      var cy=parseInt(weeks[i].split('-W')[0]),cw=parseInt(weeks[i].split('-W')[1]);
      if((py===cy&&pw-cw===1)||(py-cy===1&&pw===1&&cw>=52))s++;else break;
    }
    return s;
  }
  function calcWeekXP(att){
    var now=new Date(),sw=new Date(now);sw.setHours(0,0,0,0);sw.setDate(now.getDate()-((now.getDay()+6)%7));
    var t0=sw.getTime(),xp=0;
    (att||[]).forEach(function(a){var ts=a.attempted_at?new Date(a.attempted_at).getTime():0;if(ts>=t0)xp+=Number(a.xp||0);});
    return xp;
  }

  function loadFort(){
    Promise.all([
      new Promise(function(res){T7SB.getStats(st.id,res);}),
      new Promise(function(res){T7SB.getAllAttempts(st.id,res);})
    ]).then(function(out){
      var s=out[0],att=out[1]||[];
      if(s){st.totalXP=s.total_xp;st.stars=s.stars||0;st.starsAt=s.stars_awarded_at;if(s.first_name)st.name=s.first_name;}
      st.weekXP=calcWeekXP(att);st.streak=calcStreak(att);
      st.fortLoaded=true;st.certLoaded=true;updateFAB();
      if(st.open&&st.tab==='fort')$('t7-sheet-content').innerHTML=renderFort();
      if(st.open&&st.tab==='cert')$('t7-sheet-content').innerHTML=renderCert();
    });
  }
  function loadRang(){
    T7SB.getLeaderboard(20,function(rows){
      st.players=rows;st.rangLoaded=true;
      if(st.open&&st.tab==='rang')$('t7-sheet-content').innerHTML=renderRang();
    });
  }
  function updateFAB(){
    $('t7-fab-xp').textContent=st.totalXP.toLocaleString('de-AT')+' XP';
    $('t7-fab-streak').textContent=st.streak+' Woche'+(st.streak===1?'':'n');
    if(st.stars){$('t7-fab-stars-num').textContent=st.stars;$('t7-fab-stars').style.display='inline';$('t7-fab-stars-sep').style.display='inline';}
    else{$('t7-fab-stars').style.display='none';$('t7-fab-stars-sep').style.display='none';}
  }
  function renderFort(){
    if(!st.fortLoaded)return '<div class="t7m-loading">Lade\u2026</div>';
    var days='';
    for(var i=0;i<8;i++)days+='<div class="t7f-streak-day'+(i<st.streak?' on':'')+'"></div>';
    return '<div class="t7f-stat-row">'+
      '<div class="t7f-stat-card"><div class="t7f-stat-num">'+st.totalXP.toLocaleString('de-AT')+'</div><div class="t7f-stat-label">Gesamt XP</div></div>'+
      '<div class="t7f-stat-card"><div class="t7f-stat-num">+'+st.weekXP+'</div><div class="t7f-stat-label">Diese Woche</div></div>'+
    '</div>'+
    '<div class="t7f-streak"><div class="t7f-streak-val">'+st.streak+' Woche'+(st.streak===1?'':'n')+' Streak</div><div class="t7f-streak-days">'+days+'</div></div>';
  }
  function renderRang(){
    if(!st.rangLoaded)return '<div class="t7m-loading">Lade\u2026</div>';
    if(!st.players.length)return '<div class="t7m-empty">Noch keine Eintr\xe4ge.</div>';
    var med=['\ud83e\udd47','\ud83e\udd48','\ud83e\udd49'];
    var rows=st.players.map(function(p,i){
      var r=i+1,isMe=st.id&&p.id===st.id;
      var val=p.xp.toLocaleString('de-AT')+' XP';
      var posCls=r===1?' gold':r===2?' silver':r===3?' bronze':'';
      return '<div class="t7m-rank'+(isMe?' me':'')+'"><div class="t7m-rank-pos'+posCls+'">'+(r<=3?med[r-1]:r)+'</div><div class="t7m-rank-av'+(isMe?' me':'')+'">'+ini(p.name)+'</div><div class="t7m-rank-name">'+p.name+'</div><div class="t7m-rank-val">'+val+'</div></div>';
    }).join('');
    return '<div>'+rows+'</div>';
  }
  function renderCert(){
    if(!st.certLoaded)return '<div class="t7m-loading">Lade\u2026</div>';
    if(!st.stars)return '<div class="t7m-empty">Noch kein Zertifikat. \u00dcbe weiter und reiche dein Final-Video ein!</div>';
    function starsHtml(){return '\u2b50';}
    function fmtDate(ts){if(!ts)return'';var d=new Date(typeof ts==='number'?ts:Date.parse(ts));return d.toLocaleDateString('de-AT',{day:'2-digit',month:'long',year:'numeric'});}
    return '<div class="t7-cert">'+
      '<div class="t7-cert-top"></div><div class="t7-cert-bottom"></div>'+
      '<div class="t7-cert-brand">T7 Academy Zertifikat</div>'+
      '<div class="t7-cert-line"></div>'+
      '<div class="t7-cert-star-block">'+
        '<div class="t7-cert-num">'+st.stars+'</div>'+
        '<div class="t7-cert-stars">'+starsHtml()+'</div>'+
      '</div>'+
      '<div class="t7-cert-line"></div>'+
      '<div class="t7-cert-name">'+(st.name||'Spieler')+'</div>'+
      '<div class="t7-cert-official">Zertifiziert von <strong>T7 Academy Expert</strong>'+(st.starsAt?' \u00b7 '+fmtDate(st.starsAt):'')+'</div>'+
    '</div>';
  }

  function openSheet(){st.open=true;$('t7-sheet').classList.add('open');$('t7-sheet-overlay').classList.add('open');renderActive();}
  function closeSheet(){st.open=false;$('t7-sheet').classList.remove('open');$('t7-sheet-overlay').classList.remove('open');}
  function switchTab(t){
    st.tab=t;
    $('t7-tab-fort').className='t7-sheet-tab'+(t==='fort'?' active':'');
    $('t7-tab-rang').className='t7-sheet-tab'+(t==='rang'?' active':'');
    $('t7-tab-cert').className='t7-sheet-tab'+(t==='cert'?' active':'');
    $('t7-sheet-title').textContent=t==='fort'?'Mein Fortschritt':t==='rang'?'Rangliste':'Mein Zertifikat';
    renderActive();
  }
  function renderActive(){
    if(st.tab==='fort'){if(!st.fortLoaded&&st.id)loadFort();$('t7-sheet-content').innerHTML=renderFort();}
    else if(st.tab==='rang'){if(!st.rangLoaded)loadRang();$('t7-sheet-content').innerHTML=renderRang();}
    else{if(!st.certLoaded&&st.id)loadFort();$('t7-sheet-content').innerHTML=renderCert();}
  }

  $('t7-fab').onclick=openSheet;
  $('t7-sheet-close').onclick=closeSheet;
  $('t7-sheet-overlay').onclick=closeSheet;
  $('t7-tab-fort').onclick=function(){switchTab('fort');};
  $('t7-tab-rang').onclick=function(){switchTab('rang');};
  $('t7-tab-cert').onclick=function(){switchTab('cert');};
  var ts=0,sheet=$('t7-sheet');
  sheet.addEventListener('touchstart',function(e){ts=e.touches[0].clientY;},{passive:true});
  sheet.addEventListener('touchend',function(e){if(e.changedTouches[0].clientY-ts>80)closeSheet();},{passive:true});

  T7Identity.resolve(function(id,name){
    if(!id)return;
    st.id=id;st.name=name||'Spieler';
    loadFort();
  });
  window.addEventListener('t7xpupdate',function(){if(st.id){st.fortLoaded=false;st.certLoaded=false;loadFort();if(st.rangLoaded){st.rangLoaded=false;loadRang();}}});
}


/* ===========================================================
   DYNAMIC LOADERS
   T7LoadChallenges  — mounts all kind='challenge' modules from Supabase
   T7LoadCerts       — mounts all kind='certificate' modules from Supabase
   T7LoadMonats      — mounts the monthly challenge from a Google Sheet

   Replaces hard-coded T7.challenge() / T7.certificate() blocks in
   Challenges.html and absorbs what loadMonats.js used to do.
   =========================================================== */

/* --- Shared fetch cache (one round-trip for both loaders) --- */
var _T7Cache={modules:null,videos:null,_cbs:null};
function _T7FetchAll(cb){
  if(_T7Cache.modules&&_T7Cache.videos){cb(_T7Cache.modules,_T7Cache.videos);return;}
  if(_T7Cache._cbs){_T7Cache._cbs.push(cb);return;}
  _T7Cache._cbs=[cb];
  function hdr(){return{'apikey':T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY};}
  Promise.all([
    fetch(T7_SB_URL+'/rest/v1/modules?published=eq.true&order=sort_order.asc'
      +'&select=key,label,icon,challenges,kind,stars,hero_text,unlock_msg,progressive',
      {headers:hdr()}).then(function(r){return r.json();}),
    fetch(T7_SB_URL+'/rest/v1/videos?vimeo_code=not.is.null'
      +'&select=title_DE,title_EN,vimeo_code,difficulty,category,challenge_module',
      {headers:hdr()}).then(function(r){return r.json();})
  ]).then(function(out){
    _T7Cache.modules=Array.isArray(out[0])?out[0]:[];
    _T7Cache.videos =Array.isArray(out[1])?out[1]:[];
    var cbs=_T7Cache._cbs;_T7Cache._cbs=null;
    cbs.forEach(function(fn){fn(_T7Cache.modules,_T7Cache.videos);});
  }).catch(function(e){
    console.error('[T7] module/video fetch failed',e);
    var cbs=_T7Cache._cbs||[];_T7Cache._cbs=null;
    cbs.forEach(function(fn){fn([],[]);});
  });
}

/* --- Title normalisation & similarity score (drill title → video title) ---
   Handles German umlauts, compound words, and word-order differences.
   Exact word match = 2pts, substring match = 1pt.
   Greedy best-match then picks the highest-scoring video from the pool. */
function _T7Norm(s){
  return(s||'').toLowerCase()
    .replace(/ü/g,'u').replace(/ö/g,'o').replace(/ä/g,'a')
    .replace(/ß/g,'ss').replace(/[^a-z0-9\s]/g,'')
    .split(/\s+/).filter(function(w){return w.length>1;});
}
function _T7Score(challengeTitle,de,en){
  var cw=_T7Norm(challengeTitle),dw=_T7Norm(de).concat(_T7Norm(en)),s=0;
  cw.forEach(function(c){dw.forEach(function(d){
    if(c===d){s+=2;}
    else if(c.length>2&&d.indexOf(c)>=0){s+=1;}
    else if(d.length>2&&c.indexOf(d)>=0){s+=1;}
  });});
  return s;
}

/* --- Build the drills array for one module + the full video pool ---
   progressive=true  → each drill unlocks the next  (star = idx+1)
   progressive=false → all drills open from the start (star = 1)   */
function _T7BuildDrills(mod,allVideos){
  var key=mod.key;
  /* Videos that list this module key in their (comma-separated) challenge_module */
  var pool=allVideos.filter(function(v){
    if(!v.challenge_module)return false;
    return v.challenge_module.split(',').map(function(k){return k.trim();}).indexOf(key)>=0;
  });
  var challenges=[];
  try{challenges=(typeof mod.challenges==='string'
    ?JSON.parse(mod.challenges):(mod.challenges||[]));}catch(e){}
  challenges=challenges.slice().sort(function(a,b){return a.idx-b.idx;});
  var used=[];
  return challenges.map(function(drill,i){
    /* Greedy: highest score wins; shorter video title breaks ties */
    var best=null,bestSc=-1,bestLen=99999;
    pool.forEach(function(v,vi){
      if(used.indexOf(vi)>=0)return;
      var sc=_T7Score(drill.title,v.title_DE,v.title_EN);
      var ln=(v.title_DE||v.title_EN||'').length;
      if(sc>bestSc||(sc===bestSc&&ln<bestLen)){bestSc=sc;bestLen=ln;best={v:v,vi:vi};}
    });
    var vid='',hash='';
    if(best){
      used.push(best.vi);
      var pts=(best.v.vimeo_code||'').split('/');
      vid=(pts[0]||'').trim();hash=(pts[1]||'').trim();
    }
    var bv=best?best.v:{};
    var meta=[(bv.difficulty||''),(bv.category||'')].filter(Boolean).join(' – ')||'Challenge';
    var star=mod.progressive?(i+1):1;
    var nd=challenges.length,last=(i===nd-1);
    var next=last?('Alle '+nd+' Challenges abgeschlossen!'):
      (mod.progressive?('Challenge '+(i+2)+' ist jetzt offen!'):('Weiter so!'));
    return{title:drill.title,eye:'Challenge '+String(i+1).padStart(2,'0'),
      meta:meta,vid:vid,hash:hash,type:'rate',xp:drill.xp||10,star:star,next:next};
  });
}

/* === T7LoadChallenges ===
   Fetches all published modules where kind='challenge', builds drills from
   the videos table, and mounts each as a T7Challenge widget into containerId. */
function T7LoadChallenges(containerId){
  var cont=document.getElementById(containerId);if(!cont)return;
  cont.innerHTML='<div style="padding:28px;text-align:center;color:var(--muted);font-size:13px">Lade Challenges…</div>';
  _T7FetchAll(function(modules,videos){
    cont.innerHTML='';
    var list=modules.filter(function(m){return m.kind==='challenge';});
    if(!list.length){
      cont.innerHTML='<div style="padding:20px;color:var(--muted)">Keine Challenges gefunden.</div>';
      return;
    }
    list.forEach(function(mod){
      var drills=_T7BuildDrills(mod,videos);
      if(!drills.length)return;
      T7.challenge({containerId:containerId,title:mod.label,badge:mod.icon||'⚽',
        moduleKey:mod.key,heroText:mod.hero_text||'',unlockMsg:mod.unlock_msg||'',
        drills:drills});
    });
  });
}

/* === T7LoadCerts ===
   Fetches all published modules where kind='certificate', builds drills from
   the videos table, and mounts each as a T7Cert widget into containerId. */
function T7LoadCerts(containerId){
  var cont=document.getElementById(containerId);if(!cont)return;
  cont.innerHTML='<div style="padding:28px;text-align:center;color:var(--muted);font-size:13px">Lade Zertifikate…</div>';
  _T7FetchAll(function(modules,videos){
    cont.innerHTML='';
    var list=modules.filter(function(m){return m.kind==='certificate';});
    if(!list.length){
      cont.innerHTML='<div style="padding:20px;color:var(--muted)">Keine Zertifikate gefunden.</div>';
      return;
    }
    list.forEach(function(mod){
      var drills=_T7BuildDrills(mod,videos);
      if(!drills.length)return;
      T7.certificate({containerId:containerId,title:mod.label,badge:mod.icon||'⭐',
        instanceKey:mod.key,stars:mod.stars||1,heroText:mod.hero_text||'',
        drills:drills});
    });
  });
}

/* ============================================================
   T7LoadMonats — Supabase edition (replaces the Google Sheets version)
   ------------------------------------------------------------
   HOW TO INSTALL
   1. In t7-widget-engine.js, replace the whole existing
      `function T7LoadMonats(containerId, sheetsUrl){ ... }`
      with the function below.
   2. In Challenges.html, change the call from:
         T7.loadMonats('monats-container', 'https://docs.google.com/.../pubhtml?...');
      to simply:
         T7.loadMonats('monats-container');
   3. Run monthly_challenges.sql once in Supabase.
   No other changes needed — it reuses _T7FetchAll, _T7BuildDrills,
   T7_SB_URL/T7_SB_KEY and T7.challenge exactly like before.
============================================================ */
/* ============================================================
   T7LoadMonats — curated-drills edition (robust month matching)
   ------------------------------------------------------------
   Builds the Challenge des Monats from the current month's row in
   monthly_challenges, using its hand-picked `drills` array
   ({title, vid, hash, meta, xp}) curated in the Expert Admin.

   Month resolution is forgiving: the canonical key is YYYY-MM, but
   older rows may store the German month name ("Juli"), "Juli 2026",
   "072026", etc. We fetch the table and match the current month
   across those formats so a data-entry slip never blanks the panel.

   If the matched row has no curated drills but still carries a
   legacy module_key, we fall back to the old module-based build.
============================================================ */
function T7LoadMonats(containerId){
  var cont=document.getElementById(containerId);if(!cont)return;
  var MONTHS=['Januar','Februar','M\xe4rz','April','Mai','Juni',
               'Juli','August','September','Oktober','November','Dezember'];
  var now=new Date();
  var monthIdx=now.getMonth();
  var year=now.getFullYear();
  var mk=year+'-'+String(monthIdx+1).padStart(2,'0');
  var ml=MONTHS[monthIdx]+' '+year;
  /* Set month label immediately so the tab chip is always current */
  var elLabel=document.getElementById('monatsLabel');
  if(elLabel)elLabel.textContent=ml;
  cont.innerHTML='<div style="padding:28px;text-align:center;color:var(--muted);font-size:13px">Lade Challenge des Monats…</div>';
  function hdr(){return{'apikey':T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY};}
  function hint(msg){return '<div class="monats-hint">'+msg+'</div>';}

  /* Does a stored month value refer to the current calendar month? */
  function matchesCurrentMonth(raw){
    var rm=String(raw==null?'':raw).toLowerCase().trim();
    if(!rm)return false;
    if(rm===mk)return true;                        /* 2026-07            */
    if(rm.indexOf(mk+'-')===0)return true;         /* 2026-07-01 (ISO)   */
    var g=MONTHS[monthIdx].toLowerCase();          /* "juli" / "märz" */
    var gs=g.replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u');
    if(rm===g||rm===gs)return true;                /* "Juli"             */
    if(rm===g+' '+year||rm===gs+' '+year)return true;   /* "Juli 2026"   */
    if(rm===g+year||rm===gs+year)return true;
    var digits=rm.replace(/[^0-9]/g,'');
    if(digits){
      var y=String(year), m2=String(monthIdx+1).padStart(2,'0'), yy=y.slice(2);
      var cand=[y+m2, m2+y, m2+yy, yy+m2];         /* 202607 / 072026 …  */
      if(cand.indexOf(digits)>=0)return true;
    }
    return false;
  }

  /* Build + mount from a curated drills array. */
  function mountCurated(row,name,badge,heroText,unlockMsg){
    var raw=row.drills, curated=[];
    try{curated=(typeof raw==='string'?JSON.parse(raw):(raw||[]));}catch(e){curated=[];}
    if(!Array.isArray(curated)||!curated.length)return false;
    var nd=curated.length;
    var drills=curated.map(function(d,i){
      var last=(i===nd-1);
      return{
        title:(d.title||('Video '+(i+1))),
        eye:'Challenge '+String(i+1).padStart(2,'0'),
        meta:(d.meta||'Challenge des Monats'),
        vid:String(d.vid||''),
        hash:String(d.hash||''),
        type:'rate',
        xp:(typeof d.xp==='number'?d.xp:10),
        star:1,   /* every curated drill open from the start */
        next:last?('Alle '+nd+' Challenges abgeschlossen!'):'Weiter zur n\xe4chsten Challenge!'
      };
    });
    cont.innerHTML='';
    T7.challenge({
      containerId:containerId,
      title:name,badge:badge,
      moduleKey:'monats_'+mk.replace('-','_'),
      heroText:heroText,unlockMsg:unlockMsg,
      drills:drills
    });
    return true;
  }

  /* Back-compat: mount from a legacy module_key. */
  function mountFromModule(modKey,name,badge,heroText,unlockMsg){
    _T7FetchAll(function(modules,videos){
      var mod=null;
      for(var i=0;i<modules.length;i++){if(modules[i].key===modKey){mod=modules[i];break;}}
      if(!mod){cont.innerHTML=hint('Modul <code>'+modKey+'</code> nicht in Supabase gefunden.');return;}
      var drills=_T7BuildDrills(mod,videos);
      cont.innerHTML='';
      T7.challenge({
        containerId:containerId,
        title:name||mod.label,
        badge:badge||mod.icon||'🔥',
        moduleKey:'monats_'+mk.replace('-','_'),
        heroText:heroText||mod.hero_text||'',
        unlockMsg:unlockMsg||mod.unlock_msg||'',
        drills:drills
      });
    });
  }

  /* One fetch, resolve the current-month row client-side (format-tolerant). */
  fetch(T7_SB_URL+'/rest/v1/monthly_challenges?select=*&order=month.desc',{headers:hdr()})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(rows){
      rows=Array.isArray(rows)?rows:[];
      var row=null;
      /* Prefer an exact canonical match, then any format that resolves to now. */
      for(var i=0;i<rows.length;i++){if(String(rows[i].month).trim()===mk){row=rows[i];break;}}
      if(!row){for(var j=0;j<rows.length;j++){if(matchesCurrentMonth(rows[j].month)){row=rows[j];break;}}}
      if(!row){
        cont.innerHTML=hint('Kein Eintrag f\xfcr <strong>'+ml+'</strong> gefunden.<br>'
          +'Lege den Monat im <strong>Challenge-des-Monats</strong>-Formular an.');
        return;
      }
      var name     =(row.name||'').trim()      ||'Challenge des Monats';
      var badge    =(row.badge||'').trim()     ||'🔥';
      var heroText =(row.hero_text||'').trim();
      var unlockMsg=(row.unlock_msg||'').trim();
      var elName=document.getElementById('monatsName');
      if(elName)elName.textContent=name;

      if(mountCurated(row,name,badge,heroText,unlockMsg))return;

      var modKey=(row.module_key||'').trim();
      if(!modKey){
        cont.innerHTML=hint('F\xfcr <strong>'+ml+'</strong> sind noch keine Videos ausgew\xe4hlt.<br>'
          +'\xd6ffne das <strong>Challenge-des-Monats</strong>-Formular und stelle die Challenge zusammen.');
        return;
      }
      mountFromModule(modKey,name,badge,heroText,unlockMsg);
    })
    .catch(function(e){
      console.error('[T7LoadMonats]',e);
      cont.innerHTML=hint('Fehler beim Laden der Challenge des Monats.<br>Details: '+e.message);
    });
}

/* ===========================================================
   T7 PUBLIC NAMESPACE  (RESTORED)
   ------------------------------------------------------------
   Challenges.html (and the dynamic loaders above) call the
   lowercase API: T7.loadChallenges / T7.loadCerts / T7.loadMonats
   / T7.challenge / T7.certificate.
   Without this object the page throws "T7 is not defined" on the
   first call and NOTHING on the Challenges page renders.
   =========================================================== */
window.T7 = {
  challenge:      T7Challenge,
  certificate:    T7Cert,
  loadChallenges: T7LoadChallenges,
  loadCerts:      T7LoadCerts,
  loadMonats:     T7LoadMonats
};
