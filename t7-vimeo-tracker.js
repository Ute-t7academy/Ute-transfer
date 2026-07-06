/* ============================================================
   T7 Academy - Vimeo Watch-Time Tracker
   ============================================================
   Drop this script on any page with Vimeo iframes. It will:
     1. Auto-detect every <iframe src="https://player.vimeo.com/video/...">
     2. Inject the Vimeo Player SDK if not already loaded
     3. Track real watch time (not seeks) and last position
     4. POST aggregated progress to Supabase video_progress

   Requirements:
     - window.T7_PROFILE_ID must be set (the player_profiles UUID)
     - Iframe src must contain /video/{vimeo_id}
     - Each iframe needs allow="autoplay; fullscreen; picture-in-picture"
       (this is Vimeo's default embed; no action needed for standard embeds)

   The tracker is idempotent and safe to load multiple times.
============================================================ */
(function(){
  if(window.__T7_VIMEO_TRACKER_LOADED__)return;
  window.__T7_VIMEO_TRACKER_LOADED__=true;

  /* Use the engine's Supabase constants if loaded; otherwise hardcode. */
  var SB_URL=window.T7_SB_URL||'https://qajjuhjmrtuomwrbxmpz.supabase.co';
  var SB_KEY=window.T7_SB_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';
  var SDK_SRC='https://player.vimeo.com/api/player.js';

  /* Tunables */
  var FLUSH_INTERVAL_MS=15000;   // periodic flush while playing
  var MAX_TIMEUPDATE_DELTA=2;    // seconds; bigger gaps treated as seeks
  var MIN_DELTA_TO_SEND=2;       // don't bother POSTing <2s of accumulated time

  var profileId=null;
  var sdkReady=false;
  var sdkQueue=[];
  var cache={};   // vimeo_id -> {total_seconds, last_position}
  var trackers={}; // iframe element -> Player + state

  function hdr(extra){
    var h={'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json'};
    if(extra)Object.keys(extra).forEach(function(k){h[k]=extra[k];});
    return h;
  }

  /* ---- Identity ---- */
  function resolveProfile(cb){
    /* Prefer existing T7Identity from engine; fall back to direct global read. */
    if(window.T7Identity&&typeof T7Identity.resolve==='function'){
      T7Identity.resolve(function(id){cb(id||null);});
    }else{
      cb(window.T7_PROFILE_ID?String(window.T7_PROFILE_ID):null);
    }
  }

  /* ---- Cache preload (one fetch for all videos on page) ---- */
  function preloadCache(cb){
    fetch(SB_URL+'/rest/v1/video_progress?profile_id=eq.'+encodeURIComponent(profileId)+'&select=vimeo_id,total_seconds,last_position',{headers:hdr()})
      .then(function(r){return r.json();})
      .then(function(rows){
        (rows||[]).forEach(function(r){
          cache[r.vimeo_id]={total_seconds:Number(r.total_seconds||0),last_position:Number(r.last_position||0)};
        });
        cb();
      }).catch(function(){cb();});
  }

  /* ---- SDK loader (load once, queue calls) ---- */
  function loadSDK(){
    if(sdkReady)return;
    if(window.Vimeo&&window.Vimeo.Player){sdkReady=true;drainQueue();return;}
    if(document.querySelector('script[src="'+SDK_SRC+'"]'))return; // already loading
    var s=document.createElement('script');
    s.src=SDK_SRC;s.async=true;
    s.onload=function(){sdkReady=true;drainQueue();};
    document.head.appendChild(s);
  }
  function whenSDK(fn){if(sdkReady)fn();else sdkQueue.push(fn);}
  function drainQueue(){while(sdkQueue.length)sdkQueue.shift()();}

  /* ---- Vimeo ID extraction ---- */
  function vimeoIdFrom(iframe){
    var src=iframe.getAttribute('src')||'';
    var m=src.match(/player\.vimeo\.com\/video\/(\d+)/);
    return m?m[1]:null;
  }

  /* ---- Flush watch delta to Supabase ---- */
  function flush(vimeoId,deltaSeconds,lastPos){
    if(!profileId||!vimeoId)return;
    if(deltaSeconds<MIN_DELTA_TO_SEND&&!lastPos)return;
    var cur=cache[vimeoId]||{total_seconds:0,last_position:0};
    var newTotal=cur.total_seconds+Math.max(0,Math.round(deltaSeconds));
    var newPos=Math.max(0,Math.round(lastPos||cur.last_position||0));
    cache[vimeoId]={total_seconds:newTotal,last_position:newPos};
    var body={
      profile_id:profileId,
      vimeo_id:vimeoId,
      total_seconds:newTotal,
      last_position:newPos,
      last_viewed_at:new Date().toISOString()
    };
    var url=SB_URL+'/rest/v1/video_progress';
    /* sendBeacon for unload, fetch otherwise */
    var useBeacon=arguments[3]===true;
    if(useBeacon&&navigator.sendBeacon){
      try{
        var blob=new Blob([JSON.stringify(body)],{type:'application/json'});
        /* sendBeacon can't set headers, so we use a fetch with keepalive as a fallback */
        fetch(url,{method:'POST',headers:hdr({'Prefer':'resolution=merge-duplicates'}),body:JSON.stringify(body),keepalive:true}).catch(function(){});
      }catch(e){}
    }else{
      fetch(url,{method:'POST',headers:hdr({'Prefer':'resolution=merge-duplicates'}),body:JSON.stringify(body)}).catch(function(){});
    }
  }

  /* ---- Attach to a single iframe ---- */
  function attach(iframe){
    if(trackers[iframe._t7trackerKey])return;
    var vimeoId=vimeoIdFrom(iframe);
    if(!vimeoId)return;
    /* Stable key per iframe so we don't double-attach */
    var key='t7v_'+vimeoId+'_'+Math.random().toString(36).slice(2,8);
    iframe._t7trackerKey=key;

    whenSDK(function(){
      var player;
      try{player=new Vimeo.Player(iframe);}catch(e){return;}

      var state={
        playing:false,
        lastTime:0,
        accumulated:0,    // seconds since last flush
        flushTimer:null
      };
      trackers[key]={player:player,state:state,vimeoId:vimeoId};

      function flushNow(useBeacon){
        if(state.accumulated>=MIN_DELTA_TO_SEND||useBeacon){
          flush(vimeoId,state.accumulated,state.lastTime,useBeacon);
          state.accumulated=0;
        }
      }
      function startFlushTimer(){
        if(state.flushTimer)return;
        state.flushTimer=setInterval(function(){if(state.playing)flushNow(false);},FLUSH_INTERVAL_MS);
      }
      function stopFlushTimer(){
        if(state.flushTimer){clearInterval(state.flushTimer);state.flushTimer=null;}
      }

      player.on('play',function(d){
        state.playing=true;
        state.lastTime=(d&&typeof d.seconds==='number')?d.seconds:0;
        startFlushTimer();
      });
      player.on('timeupdate',function(d){
        if(!state.playing||!d||typeof d.seconds!=='number')return;
        var delta=d.seconds-state.lastTime;
        if(delta>0&&delta<=MAX_TIMEUPDATE_DELTA){
          state.accumulated+=delta;
        }
        state.lastTime=d.seconds;
      });
      player.on('seeked',function(d){
        /* Reset reference time after a seek so we don't count the jump */
        if(d&&typeof d.seconds==='number')state.lastTime=d.seconds;
      });
      player.on('pause',function(d){
        state.playing=false;
        if(d&&typeof d.seconds==='number')state.lastTime=d.seconds;
        stopFlushTimer();
        flushNow(false);
      });
      player.on('ended',function(){
        state.playing=false;
        stopFlushTimer();
        flushNow(false);
      });
    });
  }

  /* ---- Find iframes and attach (initial + DOM mutations) ---- */
  function scanIframes(){
    var ifs=document.querySelectorAll('iframe[src*="player.vimeo.com"]');
    for(var i=0;i<ifs.length;i++)attach(ifs[i]);
  }
  function observeMutations(){
    if(!window.MutationObserver)return;
    var obs=new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var added=muts[i].addedNodes;
        for(var j=0;j<added.length;j++){
          var n=added[j];
          if(n.nodeType!==1)continue;
          if(n.tagName==='IFRAME'&&/player\.vimeo\.com/.test(n.src||''))attach(n);
          else if(n.querySelectorAll){
            var sub=n.querySelectorAll('iframe[src*="player.vimeo.com"]');
            for(var k=0;k<sub.length;k++)attach(sub[k]);
          }
        }
      }
    });
    obs.observe(document.body,{childList:true,subtree:true});
  }

  /* ---- Final flush on page unload ---- */
  function setupUnloadFlush(){
    function fa(){
      Object.keys(trackers).forEach(function(k){
        var t=trackers[k];
        if(t.state.accumulated>=MIN_DELTA_TO_SEND){
          flush(t.vimeoId,t.state.accumulated,t.state.lastTime,true);
          t.state.accumulated=0;
        }
      });
    }
    window.addEventListener('pagehide',fa);
    window.addEventListener('beforeunload',fa);
    document.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='hidden')fa();
    });
  }

  /* ---- Boot ---- */
  function boot(){
    resolveProfile(function(id){
      if(!id){
        console.warn('[T7 Vimeo Tracker] No T7_PROFILE_ID \u2014 watch time will not be recorded.');
        return;
      }
      profileId=id;
      preloadCache(function(){
        loadSDK();
        scanIframes();
        observeMutations();
        setupUnloadFlush();
      });
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();

  /* Public hook for manual attachment (rarely needed) */
  window.T7VimeoTracker={attach:attach,scan:scanIframes};
})();
