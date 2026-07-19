/* ============================================================
   T7 Academy — Challenges page script
   Page-specific glue for Challenges.html. Depends on the shared
   widget engine (t7-widget-engine.js) being loaded first.

     PANEL 1  Technikschule   -> T7.loadChallenges
     PANEL 2  Zertifikate     -> T7.loadCerts
     PANEL 3  Builder         -> dynamic challenge from Supabase filters
     PANEL 4  Challenge des Monats -> T7.loadMonats

   Also wires: tab switching, sidebar widgets, theme toggle.
============================================================ */

/* ============================================================
   PANEL 1: TECHNIKSCHULE
   Pulls all kind='challenge' modules from Supabase (modules +
   videos tables) and auto-mounts them into #ch-container.
   Add / reorder / edit modules in Supabase — no code change needed.
============================================================ */
T7.loadChallenges('ch-container');

/* ============================================================
   PANEL 2: ZERTIFIKATE
   Pulls all kind='certificate' modules from Supabase and
   auto-mounts them into #cert-container.
============================================================ */
T7.loadCerts('cert-container');

/* ============================================================
   PANEL 4: CHALLENGE DES MONATS
   Reads the current month's row from the Supabase `monthly_challenges`
   table and reuses the matching Supabase module for the drill list.
   To change the monthly challenge: use the Expert Admin panel
   (expert-admin.html) — no code or spreadsheet edits needed.
============================================================ */
T7.loadMonats('monats-container');


/* ============================================================
   PANEL 3: BUILDER - dynamic challenge from filters
   ============================================================
   - Loads distinct values for difficulty/category/player on init
   - User picks filters -> Supabase query -> count + preview
   - "Challenge starten" builds drills and mounts T7.challenge
     into #builder-container with moduleKey 'builder'
   - Re-building clears the container and overwrites the
     local 'builder' state in localStorage (intentional v1)
============================================================ */
(function Builder(){
  var SB_URL='https://qajjuhjmrtuomwrbxmpz.supabase.co';
  var SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';
  function hdr(){return{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY};}

  /* Selected filter state: each key holds a Set of selected values */
  var state={
    stars:new Set(),sevens:new Set(),position:new Set(),
    difficulty:new Set(),category:new Set(),player:new Set(),
    title:''
  };
  var lastMatches=[];  /* most recent fetched rows */

  /* Parse vid + hash from a row. The videos.vimeo_code column holds either
       "{id}"           - older rows, no hash (public video)
       "{id}/{hash}"    - unlisted videos, hash appended after slash
     vimeo_url is a secondary fallback. Returns {vid, hash}. */
  function parseVidHash(row){
    var vid='',hash='';
    var code=row && row.vimeo_code ? String(row.vimeo_code).trim() : '';
    if(code){
      var parts=code.split('/');
      vid=(parts[0]||'').trim();
      if(parts[1])hash=parts[1].trim();
    }
    /* If we still have no hash, try parsing from vimeo_url */
    if(!hash && row && row.vimeo_url){
      var url=String(row.vimeo_url);
      var m=url.match(/vimeo\.com\/(?:video\/)?\d+\/([a-zA-Z0-9]+)/);
      if(m)hash=m[1];
      else{
        m=url.match(/[?&]h=([a-zA-Z0-9]+)/);
        if(m)hash=m[1];
      }
    }
    /* If we have no vid yet but url contains the id, recover it */
    if(!vid && row && row.vimeo_url){
      var m2=String(row.vimeo_url).match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if(m2)vid=m2[1];
    }
    return{vid:vid,hash:hash};
  }

  /* Pretty-print difficulty / category strings */
  function clean(s){return (s==null?'':String(s)).trim();}

  /* Stable, order-independent signature for a set of picked video rows.
     Uses the videos-table id (falls back to vimeo_code), sorts, and hashes
     to a short base36 string. Same video set -> same signature -> same
     moduleKey, so a rebuilt challenge resumes and a different set is new. */
  function t7BuilderSig(rows){
    var ids=(rows||[]).map(function(r){
      return String((r&&(r.id!=null?r.id:r.vimeo_code))||'');
    }).filter(Boolean).sort();
    var s=ids.join(',');
    var h=0;
    for(var i=0;i<s.length;i++){ h=((h*31)+s.charCodeAt(i))|0; }
    return (h>>>0).toString(36);
  }

  /* Populate one filter row with pills */
  function fillPills(containerId, values, valueAsLabel){
    var el=document.getElementById(containerId);
    if(!el)return;
    if(!values.length){el.innerHTML='<span style="font-size:11px;color:var(--muted)">Keine Daten</span>';return;}
    el.innerHTML='';
    values.forEach(function(v){
      var b=document.createElement('button');
      b.type='button';b.className='bf-pill';b.dataset.val=v;
      b.textContent=valueAsLabel?v:v;
      b.addEventListener('click',function(){togglePill(b);});
      el.appendChild(b);
    });
  }

  /* Toggle pill, update state, refresh query */
  function togglePill(btn){
    var row=btn.parentElement;
    var field=row.dataset.field;
    var val=btn.dataset.val;
    if(!field||!val)return;
    var set=state[field];
    if(btn.classList.contains('active')){
      btn.classList.remove('active');
      set.delete(val);
    }else{
      btn.classList.add('active');
      set.add(val);
    }
    refresh();
  }

  /* Build PostgREST query string from filter state */
  function buildQuery(){
    var q=[];
    if(state.stars.size)q.push('stars=in.('+Array.from(state.stars).join(',')+')');
    if(state.sevens.size)q.push('sevens=in.('+Array.from(state.sevens).join(',')+')');
    /* position: each selected position is a column where value > 0; OR them */
    if(state.position.size){
      var orParts=Array.from(state.position).map(function(p){return p+'.gt.0';});
      q.push('or=('+orParts.join(',')+')');
    }
    if(state.difficulty.size){
      var diffs=Array.from(state.difficulty).map(function(v){return '"'+v+'"';}).join(',');
      q.push('difficulty=in.('+diffs+')');
    }
    if(state.category.size){
      var cats=Array.from(state.category).map(function(v){return '"'+v+'"';}).join(',');
      q.push('category=in.('+cats+')');
    }
    /* Player: search across player_1/2/3 */
    if(state.player.size){
      var pl=Array.from(state.player);
      var orPl=[];
      pl.forEach(function(p){
        var pe='"'+p+'"';
        orPl.push('player_1.eq.'+pe,'player_2.eq.'+pe,'player_3.eq.'+pe);
      });
      q.push('or=('+orPl.join(',')+')');
    }
    if(state.title.trim()){
      q.push('or=(title_DE.ilike.*'+encodeURIComponent(state.title.trim())+'*,title_EN.ilike.*'+encodeURIComponent(state.title.trim())+'*)');
    }
    /* Only videos that actually have a vimeo_code */
    q.push('vimeo_code=not.is.null');
    q.push('select=id,"title_DE","title_EN",vimeo_code,vimeo_url,stars,sevens,difficulty,category,player_1,player_2,player_3');
    q.push('limit=30');
    return q.join('&');
  }

  /* Has any filter at all? */
  function anyFilter(){
    return state.stars.size||state.sevens.size||state.position.size
      ||state.difficulty.size||state.category.size||state.player.size
      ||state.title.trim().length>0;
  }

  /* Re-query and update count + preview */
  function refresh(){
    var countEl=document.getElementById('bf-count');
    var btn=document.getElementById('bf-build');
    var prev=document.getElementById('bf-preview');
    if(!anyFilter()){
      countEl.innerHTML='&mdash; W&auml;hle Filter um Videos zu finden &mdash;';
      btn.disabled=true;
      prev.classList.remove('open');
      lastMatches=[];
      return;
    }
    countEl.textContent='Suche...';
    btn.disabled=true;
    fetch(SB_URL+'/rest/v1/videos?'+buildQuery(),{headers:hdr()})
      .then(function(r){return r.json();})
      .then(function(rows){
        lastMatches=Array.isArray(rows)?rows:[];
        if(!lastMatches.length){
          countEl.innerHTML='Keine Videos gefunden &mdash; passe deine Filter an';
          btn.disabled=true;
          prev.classList.remove('open');
          return;
        }
        countEl.innerHTML='<strong>'+lastMatches.length+'</strong> Video'+(lastMatches.length===1?'':'s')+' gefunden';
        btn.disabled=false;
        renderPreview(lastMatches);
      })
      .catch(function(e){
        console.warn('[Builder] query failed',e);
        countEl.textContent='Fehler beim Laden';
        btn.disabled=true;
      });
  }

  function renderPreview(rows){
    var grid=document.getElementById('bf-preview-grid');
    var prev=document.getElementById('bf-preview');
    grid.innerHTML='';
    rows.slice(0,12).forEach(function(r){
      var d=document.createElement('div');
      d.className='bf-vid';
      var title=clean(r.title_DE)||clean(r.title_EN)||'Untitled';
      var meta=[clean(r.difficulty),clean(r.category)].filter(Boolean).join(' · ');
      d.innerHTML='<div class="bf-vid-title">'+title+'</div><div class="bf-vid-meta">'+(meta||'&mdash;')+'</div>';
      grid.appendChild(d);
    });
    var ttl=document.getElementById('bf-preview-title');
    ttl.textContent='Gefundene Videos'+(rows.length>12?' (zeige erste 12 von '+rows.length+')':'');
    prev.classList.add('open');
  }

  /* Reset filters */
  document.getElementById('bf-reset').addEventListener('click',function(){
    state={stars:new Set(),sevens:new Set(),position:new Set(),difficulty:new Set(),category:new Set(),player:new Set(),title:''};
    document.querySelectorAll('.bf-pill.active').forEach(function(p){p.classList.remove('active');});
    document.getElementById('bf-title').value='';
    refresh();
  });

  /* Title search input */
  document.getElementById('bf-title').addEventListener('input',function(e){
    state.title=e.target.value||'';
    /* debounce a bit */
    clearTimeout(window.__bfTitleTimer);
    window.__bfTitleTimer=setTimeout(refresh,300);
  });

  /* Static "Position" pills wire up immediately (stars/sevens get wired by fillStarPills) */
  document.querySelectorAll('.bf-pills[data-field="position"] .bf-pill').forEach(function(p){
    p.addEventListener('click',function(){togglePill(p);});
  });

  /* "Challenge starten" - build drills + mount widget */
  document.getElementById('bf-build').addEventListener('click',function(){
    if(!lastMatches.length)return;
    var picked=lastMatches.slice(0,12);
    var nDrills=picked.length;
    var drills=picked.map(function(r,i){
      var title=clean(r.title_DE)||clean(r.title_EN)||('Video '+(i+1));
      var meta=[clean(r.difficulty),clean(r.category)].filter(Boolean).join(' - ')||'Custom Challenge';
      var vh=parseVidHash(r);
      if(!vh.vid||!vh.hash){console.warn('[Builder] Bad vimeo data for row:',r,'-> vid='+vh.vid+', hash='+vh.hash);}
      return{
        title:title,
        eye:'Challenge '+String(i+1).padStart(2,'0'),
        meta:meta,
        vid:vh.vid,
        hash:vh.hash,
        type:'rate',
        xp:10,
        /* star:1 keeps every drill open from the start. The engine only auto-locks
           drills with star>=2 behind completion of lower-star drills, which makes
           no sense for a self-chosen builder challenge. */
        star:1,
        next: i===nDrills-1?'Alle '+nDrills+' Challenges gemeistert!':'Weiter zur naechsten Challenge!'
      };
    });

    /* Differentiate each custom challenge by its OUTPUT — the exact set of
       videos it contains. moduleKey becomes 'builder_<sig>', so XP history
       and best-rating restore are tracked per unique challenge instead of
       colliding under one shared 'builder' key. Same video set resumes;
       a different set is treated as a new challenge. No localStorage wipe —
       each challenge keeps (and restores) its own progress. */
    var builderKey='builder_'+t7BuilderSig(picked);

    /* Fresh visible mount; the engine restores progress under builderKey. */
    var c=document.getElementById('builder-container');
    c.innerHTML='';

    T7.challenge({
      containerId:'builder-container',
      title:'Deine eigene Challenge',
      badge:'🔧',
      moduleKey:builderKey,
      heroText:drills.length+' Video'+(drills.length===1?'':'s')+' nach deinen Filtern. Schaffst du sie alle?',
      unlockMsg:'',
      drills:drills
    });

    /* Collapse the preview so the widget gets the spotlight */
    document.getElementById('bf-preview').classList.remove('open');

    /* Auto-expand the widget so the drill list is visible, but DON'T auto-open
       the first video - the player should pick which drill to start.
       The engine wires click handlers asynchronously (profile resolution etc),
       so poll briefly until the toggle button appears. */
    function autoOpen(){
      var c=document.getElementById('builder-container');
      if(!c)return;
      var crb=c.querySelector('[id^="t7a-crb-"]');
      if(crb)crb.click();
    }
    var tries=0;
    var poll=setInterval(function(){
      tries++;
      var c=document.getElementById('builder-container');
      var ready=c&&c.querySelector('[id^="t7a-crb-"]');
      if(ready){clearInterval(poll);autoOpen();}
      else if(tries>40){clearInterval(poll);}  /* give up after ~4s */
    },100);

    /* Smooth scroll to widget */
    setTimeout(function(){
      var el=document.getElementById('builder-container');
      if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
    },150);
  });

  /* Populate Stars, Sevens, difficulty, category, player from Supabase */
  function loadDistinct(){
    fetch(SB_URL+'/rest/v1/videos?select=stars,sevens,difficulty,category,player_1,player_2,player_3&vimeo_code=not.is.null',{headers:hdr()})
      .then(function(r){return r.json();})
      .then(function(rows){
        if(!Array.isArray(rows))return;
        var stars={},sevens={},diff={},cat={},pl={};
        rows.forEach(function(r){
          if(r.stars!=null) stars[String(r.stars)]=1;
          if(r.sevens!=null) sevens[String(r.sevens)]=1;
          var d=clean(r.difficulty);if(d)diff[d]=1;
          var c=clean(r.category);if(c)cat[c]=1;
          [r.player_1,r.player_2,r.player_3].forEach(function(p){var n=clean(p);if(n)pl[n]=1;});
        });
        var starSort=function(a,b){return Number(a)-Number(b);};
        fillStarPills('bf-stars',Object.keys(stars).sort(starSort),'⭐');
        fillStarPills('bf-sevens',Object.keys(sevens).sort(starSort),'7️⃣');
        fillPills('bf-diff',Object.keys(diff).sort(),true);
        fillPills('bf-cat',Object.keys(cat).sort(),true);
        fillPills('bf-player',Object.keys(pl).sort(),true);
      })
      .catch(function(e){
        console.warn('[Builder] distinct fetch failed',e);
        ['bf-stars','bf-sevens','bf-diff','bf-cat','bf-player'].forEach(function(id){
          var el=document.getElementById(id);
          if(el)el.innerHTML='<span style="font-size:11px;color:var(--muted)">Fehler beim Laden</span>';
        });
      });
  }

  /* Star-style pills: repeat the icon N times for value N (e.g. "*** 3") */
  function fillStarPills(containerId, values, icon){
    var el=document.getElementById(containerId);
    if(!el)return;
    if(!values.length){el.innerHTML='<span style="font-size:11px;color:var(--muted)">Keine Daten</span>';return;}
    el.innerHTML='';
    values.forEach(function(v){
      var b=document.createElement('button');
      b.type='button';b.className='bf-pill';b.dataset.val=v;
      var n=Math.min(7,Math.max(1,Number(v)||1));
      b.innerHTML=icon.repeat(n)+' '+v;
      b.addEventListener('click',function(){togglePill(b);});
      el.appendChild(b);
    });
  }

  loadDistinct();
})();

/* ============================================================
   TAB SWITCHING
============================================================ */
(function Tabs(){
  var grid=document.getElementById('catGrid');
  if(!grid)return;
  grid.addEventListener('click',function(ev){
    var btn=ev.target.closest('.ch-cat');
    if(!btn)return;
    var tab=btn.dataset.tab;
    if(!tab)return;
    /* toggle tab + panel */
    document.querySelectorAll('.ch-cat').forEach(function(c){c.classList.toggle('active',c===btn);});
    document.querySelectorAll('.ch-panel').forEach(function(p){
      p.classList.toggle('active',p.dataset.panel===tab);
    });
    /* scroll grid into view on mobile so the panel below is visible */
    if(window.innerWidth<880){
      setTimeout(function(){grid.scrollIntoView({behavior:'smooth',block:'start'});},50);
    }
  });
})();

/* ============================================================
   SIDEBAR + MOBILE SHEET + THEME TOGGLE (unchanged)
============================================================ */
T7Badge('badge-container');
T7Fortschritt('fortschritt-container');
T7Rangliste('rangliste-container');
T7MobileSheet();

(function(){
  var theme=localStorage.getItem('t7_theme')||'dark';
  document.documentElement.setAttribute('data-theme',theme);
  document.body.setAttribute('data-theme',theme);
  var MOON='&#9790;',SUN='&#9728;';
  var tog=document.getElementById('themeToggle');
  if(tog){
    tog.innerHTML=theme==='dark'?MOON:SUN;
    tog.onclick=function(){
      theme=theme==='dark'?'light':'dark';
      document.documentElement.setAttribute('data-theme',theme);
      document.body.setAttribute('data-theme',theme);
      localStorage.setItem('t7_theme',theme);
      tog.innerHTML=theme==='dark'?MOON:SUN;
    };
  }
  var adminBar=document.getElementById('wpadminbar');
  var nav=document.querySelector('.topnav');
  if(nav){
    function updateTop(){nav.style.top=adminBar?adminBar.offsetHeight+'px':'0';}
    updateTop();window.addEventListener('resize',updateTop);
    window.addEventListener('scroll',function(){if(window.scrollY>40)nav.classList.add('nav-shrunk');else nav.classList.remove('nav-shrunk');});
  }
})();
