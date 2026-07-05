/* T7 Minis page logic — load this after t7-widget-engine.js */
(function(){
var KID_MODULES = {
  st1: { tier:'base', label:'Keons Sitdowns', emoji:'⚽', num:'Station 1',
    drills:[
      {idx:0, title:'Ball hochhalten (sitzend)', emoji:'🐶', meta:'einfach',  vid:'1124934705', hash:'6a71a27daf', sticker:'🦄'},
      {idx:1, title:'Mit Fuss und Kopf', emoji:'⚽', meta:'einfach',  vid:'1124935347', hash:'c8977c5fb4', sticker:'🐆'}
    ]},
  st2: { tier:'base', label:'Keons Ballkontrolle', emoji:'🇧🇷', num:'Station 2',
    drills:[
      {idx:0, title:'V', emoji:'🐸', meta:'einfach', vid:'1110048776', hash:'3990db7901', sticker:'🌟'},
      {idx:1, title:'Sohle Links Rechts', emoji:'🦓', meta:'einfach', vid:'1111311105', hash:'b285a5a081', sticker:'🚀'}
    ]},
  st3: { tier:'base', label:'Cocos 1 gegen 1', emoji:'👣', num:'Station 3',
    drills:[
      {idx:0, title:'Drag Back', emoji:'🐢', meta:'mittel', vid:'1110029532', hash:'c98afbe376', sticker:'🔥'},
      {idx:1, title:'Übersteiger', emoji:'🐰', meta:'mittel', vid:'1110029715', hash:'8757b6279f', sticker:'🎈'}
    ]},
  st4: { tier:'base', label:'Cocos Dribbling', emoji:'✨', num:'Station 4',
    drills:[
      {idx:0, title:'La Croqueta', emoji:'🐙', meta:'mittel', vid:'1110029615', hash:'d558930be0', sticker:'🏆'},
      {idx:1, title:'Seven', emoji:'🦊', meta:'mittel', vid:'1110029615', hash:'d558930be0', sticker:'⚡'}
    ]},
  st5: { tier:'base', label:'Leyas Ballkontrolle', emoji:'🤹', num:'Station 5',
    drills:[
      {idx:0, title:'Spann Balancieren', emoji:'🐧', meta:'mittel', vid:'1110049131', hash:'0944817493', sticker:'👑'},
      {idx:1, title:'Jonglieren Freestyle', emoji:'🦄', meta:'schwierig', vid:'1125467352', hash:'30d35d6e70', sticker:'🎁'}
    ]},

  /* === STADIUM JOURNEY (unlocked after collecting all 10 base stickers) ===
     NOTE: vid/hash below are PLACEHOLDERS reusing the base-journey Vimeo videos.
     Swap in real 3⭐/4⭐ Vimeo IDs + hashes when the videos are uploaded. */
  sd1: { tier:'stadium', label:'BMO Field', city:'Toronto', country:'🇨🇦', emoji:'🍁', num:'Stadion 1',
    drills:[
      {idx:0, title:'Maple Sole Drag',     emoji:'🍁',  meta:'3 Sterne', vid:'1110029532', hash:'c98afbe376', sticker:'🍁'},
      {idx:1, title:'Toronto Twister',     emoji:'🌪️', meta:'4 Sterne', vid:'1110029715', hash:'8757b6279f', sticker:'🏟️'}
    ]},
  sd2: { tier:'stadium', label:'BC Place', city:'Vancouver', country:'🇨🇦', emoji:'🏔️', num:'Stadion 2',
    drills:[
      {idx:0, title:'Pacific Pull',        emoji:'🌊',  meta:'3 Sterne', vid:'1110048776', hash:'3990db7901', sticker:'🌊'},
      {idx:1, title:'Mountain Step-Over',  emoji:'⛰️', meta:'4 Sterne', vid:'1111311105', hash:'b285a5a081', sticker:'🏔️'}
    ]},
  sd3: { tier:'stadium', label:'Estadio Azteca', city:'Mexico City', country:'🇲🇽', emoji:'🌶️', num:'Stadion 3',
    drills:[
      {idx:0, title:'Azteca Roulette',     emoji:'🌶️', meta:'3 Sterne', vid:'1110029615', hash:'d558930be0', sticker:'🌶️'},
      {idx:1, title:'Pyramiden-Schuss',    emoji:'🏛️', meta:'4 Sterne', vid:'1110049131', hash:'0944817493', sticker:'🏛️'}
    ]},
  sd4: { tier:'stadium', label:'MetLife Stadium', city:'New York', country:'🇺🇸', emoji:'🗽', num:'Stadion 4',
    drills:[
      {idx:0, title:'Big Apple Bicycle',   emoji:'🍎',  meta:'3 Sterne', vid:'1124934705', hash:'6a71a27daf', sticker:'🍎'},
      {idx:1, title:'Final-Finisher',      emoji:'🗽',  meta:'4 Sterne', vid:'1125467352', hash:'30d35d6e70', sticker:'🏆'}
    ]},
  sd5: { tier:'stadium', label:'SoFi Stadium', city:'Los Angeles', country:'🇺🇸', emoji:'🌴', num:'Stadion 5',
    drills:[
      {idx:0, title:'Surfer Side-Step',    emoji:'🏄',  meta:'3 Sterne', vid:'1124935347', hash:'c8977c5fb4', sticker:'🏄'},
      {idx:1, title:'Hollywood Elastico',  emoji:'⭐',  meta:'4 Sterne', vid:'1110029532', hash:'c98afbe376', sticker:'🌟'}
    ]},

  /* === TRICK-PFAD JOURNEY (page 2: 10 unique stickers) ===
     Progressive milestones, easy → harder. vid/hash are placeholders; swap with Supabase
     ids later (you can extend hydrateDrillsFromSupabase to handle tier:'trickpath'). */
  tp1: { tier:'trickpath', label:'Aufwärmen', emoji:'🏃', num:'Stufe 1',
    drills:[
      {idx:0, title:'Knie-Hoch',       emoji:'🦘', meta:'1 Stern',  vid:'1124934705', hash:'6a71a27daf', sticker:'🦘'},
      {idx:1, title:'Beine-Strecken',  emoji:'🤸', meta:'1 Stern',  vid:'1124935347', hash:'c8977c5fb4', sticker:'🤸'}
    ]},
  tp2: { tier:'trickpath', label:'Ball-Freunde', emoji:'🤝', num:'Stufe 2',
    drills:[
      {idx:0, title:'Ball-Tippen',     emoji:'🐾', meta:'2 Sterne', vid:'1110048776', hash:'3990db7901', sticker:'🐾'},
      {idx:1, title:'Innen-Aussen',    emoji:'🔄', meta:'2 Sterne', vid:'1111311105', hash:'b285a5a081', sticker:'🔄'}
    ]},
  tp3: { tier:'trickpath', label:'Speed-Kick', emoji:'💨', num:'Stufe 3',
    drills:[
      {idx:0, title:'Slalom-Lauf',     emoji:'🐍', meta:'2 Sterne', vid:'1110029532', hash:'c98afbe376', sticker:'🐍'},
      {idx:1, title:'Sprint-Schuss',   emoji:'💨', meta:'3 Sterne', vid:'1110029715', hash:'8757b6279f', sticker:'💨'}
    ]},
  tp4: { tier:'trickpath', label:'Geheimer Trick', emoji:'🎯', num:'Stufe 4',
    drills:[
      {idx:0, title:'Roulette',        emoji:'🌀', meta:'3 Sterne', vid:'1110029615', hash:'d558930be0', sticker:'🌀'},
      {idx:1, title:'Sohle-Drag',      emoji:'👟', meta:'2 Sterne', vid:'1110029615', hash:'d558930be0', sticker:'👟'}
    ]},
  tp5: { tier:'trickpath', label:'Champion-Finale', emoji:'🌈', num:'Stufe 5',
    drills:[
      {idx:0, title:'Kombi-Magie',     emoji:'🎩', meta:'3 Sterne', vid:'1110049131', hash:'0944817493', sticker:'🎩'},
      {idx:1, title:'Mega-Power',      emoji:'🦁', meta:'4 Sterne', vid:'1125467352', hash:'30d35d6e70', sticker:'🦁'}
    ]}
};
var STATION_ORDER   = ['st1','st2','st3','st4','st5'];
var TRICKPATH_ORDER = ['tp1','tp2','tp3','tp4','tp5'];
var STADIUM_ORDER   = ['sd1','sd2','sd3','sd4','sd5'];
var STATION_COLORS = {
  st1: ['#00E5FF','#0080FF'],
  st2: ['#FFD700','#FF8C00'],
  st3: ['#E4002B','#A30025'],
  st4: ['#3B82F6','#1E3A8A'],
  st5: ['#22C55E','#006847'],
  tp1: ['#00E5FF','#0080FF'],
  tp2: ['#FFD700','#FF8C00'],
  tp3: ['#E4002B','#A30025'],
  tp4: ['#3B82F6','#1E3A8A'],
  tp5: ['#22C55E','#006847'],
  sd1: ['#E4002B','#A30025'],
  sd2: ['#00E5FF','#0080FF'],
  sd3: ['#22C55E','#006847'],
  sd4: ['#3B82F6','#1E3A8A'],
  sd5: ['#FFD700','#FF8C00']
};
var TOTAL_STICKERS = 10;
var TOTAL_STADIUM_STICKERS = 10;

/* STICKER_PAGES — page-by-page sticker collection. Add new pages here as new
   journeys ship. Each page contributes its own 10 stickers; no overall cap. */
var STICKER_PAGES = [
  { id:'base',      label:'Spielplatz', stations: STATION_ORDER,    total: TOTAL_STICKERS },
  { id:'trickpath', label:'Trick-Pfad', stations: TRICKPATH_ORDER,  total: TOTAL_STICKERS },
  { id:'stadium',   label:'Stadien',    stations: STADIUM_ORDER,    total: TOTAL_STADIUM_STICKERS }
];
var STATE = { email:null, name:'Champion', ratings:{}, gold:{}, completions:{}, curMod:null, curDrill:null, curStation:null, muted:false, totalXP:0, weekXP:0, avatar:'keon', stickerPage:0 };
try { STATE.muted = localStorage.getItem('t7kid_muted') === '1'; } catch(e){}
try { var savedAv = localStorage.getItem('t7kid_avatar'); if (savedAv && ['keon','coco','leya'].indexOf(savedAv) >= 0) STATE.avatar = savedAv; } catch(e){}

/* --- AVATARS --- */
var AVATARS = {
  keon:  { name:'Keon',  emoji:'🐆', species:'Der Gepard', img:'https://ute-t7academy.github.io/Assets/Keon_Avatar.png',  alt:'Keon der Gepard' },
  coco:  { name:'Coco',  emoji:'🦎', species:'Der Gecko',  img:'https://ute-t7academy.github.io/Assets/Coco_Avatar.png',  alt:'Coco der Gecko' },
  leya: { name:'Leya', emoji:'🐈‍⬛', species:'Der Panther',  img:'https://ute-t7academy.github.io/Assets/Leya_Avatar.png', alt:'Leya der Panther' }
};
function applyAvatar(key){
  var a = AVATARS[key]; if (!a) return;
  STATE.avatar = key;
  try { localStorage.setItem('t7kid_avatar', key); } catch(e){}
  // text nodes
  document.querySelectorAll('[data-av-name]').forEach(function(el){ el.textContent = a.name; });
  document.querySelectorAll('[data-av-emoji]').forEach(function(el){ el.textContent = a.emoji; });
  // images
  document.querySelectorAll('.av-img').forEach(function(img){ img.src = a.img; img.alt = a.alt; });
  // sidebar switcher selected state
  document.querySelectorAll('.av-opt[data-av-pick]').forEach(function(btn){
    var on = btn.dataset.avPick === key;
    btn.classList.toggle('selected', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

/* --- AUDIO --- */
var audioCtx = null;
function getCtx(){ if(!audioCtx){try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}} return audioCtx; }
function beep(freq, duration, type, gain){
  if (STATE.muted) return;
  var ctx = getCtx(); if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  var osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type || 'triangle'; osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(gain || 0.18, ctx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + duration);
}
function playFanfare(){
  [523, 659, 784, 1047, 1319].forEach(function(f, i){
    setTimeout(function(){ beep(f, 0.2, 'triangle', 0.2); }, i * 90);
  });
}
function playTap(){}

/* --- THEME + MUTE --- */
(function(){
  var theme='dark'; try{theme=localStorage.getItem('t7_theme')||'dark';}catch(e){}
  document.body.setAttribute('data-theme', theme); document.documentElement.setAttribute('data-theme', theme);
  var tb = document.getElementById('themeToggle');
  tb.innerHTML = theme==='dark' ? '&#9790;' : '&#9728;';
  tb.onclick = function(){
    theme = theme==='dark'?'light':'dark';
    document.body.setAttribute('data-theme',theme); document.documentElement.setAttribute('data-theme',theme);
    try{localStorage.setItem('t7_theme',theme);}catch(e){}
    tb.innerHTML = theme==='dark' ? '&#9790;' : '&#9728;';
  };
  var mb = document.getElementById('muteBtn');
  function syncMute(){ mb.textContent = STATE.muted ? '🔇' : '🔊'; mb.classList.toggle('muted', STATE.muted); }
  syncMute();
  mb.onclick = function(){ STATE.muted=!STATE.muted; try{localStorage.setItem('t7kid_muted',STATE.muted?'1':'0');}catch(e){} syncMute(); };
})();

/* === VIEW NAVIGATION === */
function showView(viewName, opts){
  document.querySelectorAll('.view').forEach(function(v){ v.classList.remove('active'); });
  var view = document.getElementById('view-' + viewName);
  if (view) view.classList.add('active');
  if (viewName === 'station' && opts && opts.station) {
    renderStationView(opts.station);
    STATE.curStation = opts.station;
  }
  // smooth scroll to top of view container
  try {
    var section = document.querySelector('.ch-section');
    if (section) {
      var y = section.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  } catch(e){}
}

// Wire up all [data-goto] elements
document.querySelectorAll('[data-goto]').forEach(function(el){
  var handler = function(e){
    e.preventDefault();
    e.stopPropagation();
    showView(el.dataset.goto);
    playTap();
  };
  el.addEventListener('click', handler);
  el.addEventListener('keydown', function(e){
    if (e.key === 'Enter' || e.key === ' ') handler(e);
  });
});

// Wire up station tiles AND stadium cards → open station focused view
document.querySelectorAll('[data-station]').forEach(function(btn){
  btn.addEventListener('click', function(){
    showView('station', { station: btn.dataset.station });
    playTap();
  });
});

// Station back button: route to Stadien for stadium stations, Spielplatz for base stations.
// Uses live STATE.curStation rather than a DOM attribute, so cache/timing can't break it.
(function(){
  var backBtn = document.getElementById('view-back-station');
  if (!backBtn) return;
  function go(e){
    e.preventDefault();
    e.stopPropagation();
    var mk = STATE.curStation;
    var isStadium = mk && KID_MODULES[mk] && KID_MODULES[mk].tier === 'stadium';
    showView(isStadium ? 'stadien' : 'spielplatz');
    playTap();
  }
  backBtn.addEventListener('click', go);
  backBtn.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') go(e); });
})();

// Wire up sidebar avatar switcher
document.querySelectorAll('.av-opt[data-av-pick]').forEach(function(btn){
  btn.addEventListener('click', function(e){
    e.preventDefault();
    applyAvatar(btn.dataset.avPick);
    playTap();
  });
});

// Apply avatar on initial load (uses saved choice if any, otherwise default 'keon')
applyAvatar(STATE.avatar);

// On small screens, move the avatar picker above the hero pic; restore on wider screens.
// Note: nested ifs are used instead of && because some WordPress setups re-encode && as &#038;&#038;
(function setupResponsiveAvatarCard(){
  var yipCard  = document.querySelector('.sb-card.yip-card');
  var hero     = document.querySelector('.hero');
  var sidebar  = document.querySelector('.ch-sidebar');
  if (!yipCard) return;
  if (!hero) return;
  if (!sidebar) return;
  var BREAK = 960;
  function layout(){
    var isSmall = window.innerWidth <= BREAK;
    var inSidebar = sidebar.contains(yipCard);
    if (isSmall) {
      if (inSidebar) {
        yipCard.classList.add('is-mobile-top');
        hero.parentNode.insertBefore(yipCard, hero);
      }
    } else {
      if (!inSidebar) {
        yipCard.classList.remove('is-mobile-top');
        sidebar.insertBefore(yipCard, sidebar.firstChild);
      }
    }
  }
  layout();
  var t; window.addEventListener('resize', function(){ clearTimeout(t); t=setTimeout(layout, 120); });
})();

/* === RENDER: STATION FOCUSED VIEW === */
function renderStationView(modKey){
  var mod = KID_MODULES[modKey];
  if (!mod) return;
  var colors = STATION_COLORS[modKey] || ['#FFD700','#FF8C00'];
  var done = countDone(modKey), total = mod.drills.length;
  var isStadium = (mod.tier === 'stadium');

  // Back button: stadium stations return to Stadien, base stations to Spielplatz.
  // (Actual navigation is wired below via #view-back-station — we only update the label here.)
  var backBtn = document.getElementById('view-back-station');
  if (backBtn) backBtn.textContent = isStadium ? '← Zu den Stadien' : '← Zum Spielplatz';

  var hero = document.getElementById('station-hero');
  hero.style.background = 'linear-gradient(135deg,' + colors[0] + ',' + colors[1] + ')';
  var ownerKey = ({st1:'keon', st2:'keon', st3:'coco', st4:'coco', st5:'leya'})[modKey] || 'keon';
  var ownerAv = AVATARS[ownerKey];
  var stImg = document.getElementById('station-emoji');
  if (isStadium) {
    // For stadiums, swap the avatar img for a big emoji "badge"
    stImg.style.display = 'none';
    var stadiumBadge = document.getElementById('station-stadium-badge');
    if (!stadiumBadge) {
      stadiumBadge = document.createElement('div');
      stadiumBadge.id = 'station-stadium-badge';
      stadiumBadge.className = 'station-stadium-badge';
      stImg.parentNode.insertBefore(stadiumBadge, stImg);
    }
    stadiumBadge.textContent = mod.emoji;
    stadiumBadge.style.display = 'flex';
  } else {
    stImg.style.display = '';
    stImg.src = ownerAv.img; stImg.alt = ownerAv.alt;
    var stadiumBadgeHide = document.getElementById('station-stadium-badge');
    if (stadiumBadgeHide) stadiumBadgeHide.style.display = 'none';
  }
  document.getElementById('station-num').textContent = mod.num;
  document.getElementById('station-title').textContent = mod.label + (isStadium && mod.city ? ' · ' + mod.city : '');
  document.getElementById('station-count').textContent = done + '/' + total + ' geschafft';
  document.getElementById('station-trickcount').textContent = total + ' Tricks';

  renderStationDrills(modKey);
}

function renderStationDrills(modKey){
  var mod = KID_MODULES[modKey];
  if (!mod) return;
  var container = document.getElementById('drills-list-target');
  container.innerHTML = mod.drills.map(function(d){
    var rating = STATE.ratings[modKey + '_' + d.idx] || 0;
    var done = rating >= 4;
    var badge = done ? (rating === 5 ? '🌟' : '✅') : '▶️';
    return '<div class="prow' + (done ? ' pdone' : '') + '" data-mod="' + modKey + '" data-idx="' + d.idx + '"><div class="prow-emoji">' + d.emoji + '</div><div class="prow-body"><div class="prow-title">' + d.title + '</div><div class="prow-meta">' + d.meta + '</div></div><div class="prow-badge">' + badge + '</div></div>';
  }).join('');
  container.querySelectorAll('.prow').forEach(function(row){
    row.addEventListener('click', function(){ openDrill(row.dataset.mod, parseInt(row.dataset.idx, 10)); });
  });
}

function updatePlaygroundStation(modKey){
  var mod = KID_MODULES[modKey];
  var done = countDone(modKey), total = mod.drills.length;
  var label = document.querySelector('[data-proglabel="' + modKey + '"]');
  if (label) label.textContent = done + '/' + total;
}

function countDone(modKey){ var c=0; KID_MODULES[modKey].drills.forEach(function(d){ if((STATE.ratings[modKey+'_'+d.idx]||0)>=4) c++; }); return c; }

/* === STICKERS === */

/* Per-page tab metadata (icon + short label + color shown in the tab UI).
   Colors map to the same red/blue/green identities used on the landing cards.
   Falls back to p.label if a page id isn't listed here. */
var STICKER_TAB_META = {
  base:      { icon:'⚽',  short:'Spielplatz', color:'red'   },
  trickpath: { icon:'🏁',  short:'Trick-Pfad', color:'blue'  },
  stadium:   { icon:'🏟️', short:'Stadien',    color:'green' }
};

function countPageEarned(page){
  var n = 0;
  page.stations.forEach(function(mk){
    var mod = KID_MODULES[mk]; if (!mod) return;
    mod.drills.forEach(function(d){
      if ((STATE.ratings[mk + '_' + d.idx] || 0) >= 4) n++;
    });
  });
  return Math.min(n, page.total);
}

function renderStickerPager(){
  var pager = document.getElementById('sticker-pager');
  if (!pager) return;
  var cur = STATE.stickerPage || 0;
  if (cur >= STICKER_PAGES.length) cur = 0;

  var html = '';
  STICKER_PAGES.forEach(function(p, idx){
    var active = (idx === cur);
    var meta   = STICKER_TAB_META[p.id] || { icon:'⭐', short:p.label, color:'blue' };
    var earned = countPageEarned(p);
    html += '<button class="sp-tab' + (active ? ' is-active' : '') + '"' +
            ' data-color="' + meta.color + '"' +
            ' data-page="' + idx + '" type="button" role="tab"' +
            ' aria-selected="' + (active ? 'true' : 'false') + '"' +
            ' aria-label="' + p.label + ' (' + earned + ' von ' + p.total + ')">' +
              '<span class="sp-tab-icon">' + meta.icon + '</span>' +
              '<span class="sp-tab-label">' + meta.short + '</span>' +
              '<span class="sp-tab-count">' + earned + '/' + p.total + '</span>' +
            '</button>';
  });
  pager.innerHTML = html;

  // Bind clicks on the freshly rendered tabs
  pager.querySelectorAll('[data-page]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var idx = parseInt(btn.dataset.page, 10);
      if (isNaN(idx) || idx === STATE.stickerPage) return;
      STATE.stickerPage = idx;
      renderStickers();
      playTap();
    });
  });
}

function renderStickers(){
  if (!STICKER_PAGES.length) return;
  if (STATE.stickerPage == null || STATE.stickerPage >= STICKER_PAGES.length) STATE.stickerPage = 0;
  var page = STICKER_PAGES[STATE.stickerPage];

  renderStickerPager();

  var grid    = document.getElementById('sticker-grid');
  var countEl = document.getElementById('sticker-count');

  // Build the new HTML + count for this page
  var html = '', earnedCount = 0, goldCount = 0, slot = 0;
  page.stations.forEach(function(mk){
    var mod = KID_MODULES[mk];
    if (!mod) return;
    mod.drills.forEach(function(d){
      if (slot >= page.total) return;
      slot++;
      var key    = mk + '_' + d.idx;
      var rating = STATE.ratings[key] || 0;
      var earned = rating >= 4;
      var gold   = !!(STATE.gold && STATE.gold[key]);
      if (earned) earnedCount++;
      if (gold)   goldCount++;
      var cls = 'sticker' + (earned ? ' earned' : '') + (gold ? ' gold' : '');
      html += '<div class="' + cls + '">' +
              (earned ? d.sticker : '<span style="opacity:.3;font-size:18px">?</span>') +
              '</div>';
    });
  });
  while (slot < page.total) {
    html += '<div class="sticker"><span style="opacity:.3;font-size:18px">?</span></div>';
    slot++;
  }

  grid.innerHTML = html;
  var goldSuffix = goldCount > 0 ? '  ·  ' + goldCount + ' ⭐ Gold' : '';
  countEl.textContent = earnedCount + ' / ' + page.total + ' Sticker' + goldSuffix;

  // Reveal/hide the Champion certificate button in the sidebar
  refreshChampionBadge();
  // Sync the hero "Sticker gesammelt" stat (x / 30 across all pages)
  updateHeroStickerCount();
}

function countBaseStickers(){
  var c = 0;
  STATION_ORDER.forEach(function(mk){
    KID_MODULES[mk].drills.forEach(function(d){
      if ((STATE.ratings[mk + '_' + d.idx] || 0) >= 4) c++;
    });
  });
  return c;
}

function isStadiumUnlocked(){ return countBaseStickers() >= TOTAL_STICKERS; }

/* === CHAMPION + GOLD MODE ===
   - Earned sticker  = rating >= 4   (existing — first-round earn)
   - GOLD mastery    = a SECOND rating of 5 on an already-earned drill
                       (see resolveOutcome). First-round 5 still earns blue.
   - Champion        = earned all stickers across all STICKER_PAGES
   The ceremony fires once per kid (keyed by name), tracked in localStorage. */
function countAllEarned(){
  var c = 0;
  STICKER_PAGES.forEach(function(p){
    p.stations.forEach(function(mk){
      var mod = KID_MODULES[mk]; if (!mod) return;
      mod.drills.forEach(function(d){
        if ((STATE.ratings[mk + '_' + d.idx] || 0) >= 4) c++;
      });
    });
  });
  return c;
}
function countAllGold(){
  var c = 0;
  STICKER_PAGES.forEach(function(p){
    p.stations.forEach(function(mk){
      var mod = KID_MODULES[mk]; if (!mod) return;
      mod.drills.forEach(function(d){
        if (STATE.gold && STATE.gold[mk + '_' + d.idx]) c++;
      });
    });
  });
  return c;
}
function totalStickersAcrossPages(){
  var t = 0; STICKER_PAGES.forEach(function(p){ t += p.total; }); return t;
}
function isChampion(){ return countAllEarned() >= totalStickersAcrossPages(); }
function isGoldChampion(){ return countAllGold() >= totalStickersAcrossPages(); }

function championStorageKey(){ return 't7kid_champion_' + (STATE.name || 'guest').toLowerCase(); }
function hasSeenChampion(){ try { return localStorage.getItem(championStorageKey()) === '1'; } catch(e){ return false; } }
function markChampionSeen(){ try { localStorage.setItem(championStorageKey(), '1'); } catch(e){} }

/* Deterministic reward code derived from email+name. Same kid always gets the
   same code so it can be redeemed (and validated server-side later). */
function generateRewardCode(){
  var str = (STATE.email || '') + '|' + (STATE.name || 'CHAMPION');
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  var s = Math.abs(hash).toString(36).toUpperCase();
  while (s.length < 8) s = '0' + s;
  s = s.slice(-8);
  return 'T7-' + s.slice(0, 4) + '-' + s.slice(4, 8);
}

function refreshChampionBadge(){
  var row = document.getElementById('kf-champion-row');
  if (!row) return;
  row.style.display = isChampion() ? '' : 'none';
}

function maybeShowChampion(){
  var kmodal  = document.getElementById('kmodal');
  var cmodal  = document.getElementById('champion-modal');
  if (kmodal && kmodal.classList.contains('open')) return;
  if (cmodal && cmodal.classList.contains('open')) return;
  if (isChampion() && !hasSeenChampion()) showChampionCeremony();
}

function showChampionCeremony(){
  var modal = document.getElementById('champion-modal');
  if (!modal) return;
  document.getElementById('champion-name').textContent = STATE.name || 'Champion';
  document.getElementById('champion-code').textContent = generateRewardCode();
  modal.classList.add('open');
  confettiBurst();
  setTimeout(confettiBurst, 600);
  setTimeout(confettiBurst, 1200);
  playFanfare();
  setTimeout(playFanfare, 800);
}
function hideChampionCeremony(){
  var modal = document.getElementById('champion-modal');
  if (modal) modal.classList.remove('open');
}

function formatCertDate(){
  var d = new Date();
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  return dd + '.' + mm + '.' + d.getFullYear();
}

function populateCertStickerWall(){
  var wall = document.getElementById('cert-sticker-wall');
  if (!wall) return;
  var html = '', earned = 0, total = 0;
  STICKER_PAGES.forEach(function(p){
    var slot = 0;
    p.stations.forEach(function(mk){
      var mod = KID_MODULES[mk]; if (!mod) return;
      mod.drills.forEach(function(d){
        if (slot >= p.total) return;
        slot++; total++;
        var key    = mk + '_' + d.idx;
        var rating = STATE.ratings[key] || 0;
        if (rating >= 4) {
          earned++;
          var cls = 'cert-st earned' + ((STATE.gold && STATE.gold[key]) ? ' gold' : '');
          html += '<div class="' + cls + '">' + d.sticker + '</div>';
        } else {
          // Not earned yet — show a placeholder "?"
          html += '<div class="cert-st todo">?</div>';
        }
      });
    });
    // Pad the page out to its declared total with "?" placeholders.
    while (slot < p.total){ slot++; total++; html += '<div class="cert-st todo">?</div>'; }
  });
  wall.innerHTML = html;
  var countEl = document.getElementById('cert-count');
  if (countEl) countEl.textContent = earned + ' von ' + total + ' Stickern gesammelt';
}

/* Keep the hero "Sticker gesammelt" stat in sync (x / 30 across all pages). */
function updateHeroStickerCount(){
  var el = document.getElementById('hero-sticker-count');
  if (!el) return;
  el.textContent = countAllEarned() + ' / ' + totalStickersAcrossPages();
}

function showCertificate(){
  var modal = document.getElementById('certificate-modal');
  if (!modal) return;
  document.getElementById('cert-name').textContent = STATE.name || 'Champion';
  document.getElementById('cert-date').textContent = formatCertDate();
  document.getElementById('cert-code').textContent = generateRewardCode();
  populateCertStickerWall();
  modal.classList.add('open');
}
function hideCertificate(){
  var modal = document.getElementById('certificate-modal');
  if (modal) modal.classList.remove('open');
}

/* === CERTIFICATE DOWNLOAD (PDF) ===
   Renders the certificate to a PDF the child/parent can save and print from
   their own machine — far more reliable than printing an embedded widget.
   Libraries are lazy-loaded from a CDN the first time only. If they can't be
   reached (e.g. a strict CSP), we fall back to the browser print dialog. */
var _pdfLibsPromise = null;
function _loadScript(src){
  return new Promise(function(resolve, reject){
    var s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = function(){ resolve(); };
    s.onerror = function(){ reject(new Error('Failed to load ' + src)); };
    document.head.appendChild(s);
  });
}
function ensurePdfLibs(){
  if (window.html2canvas && window.jspdf) return Promise.resolve();
  if (_pdfLibsPromise) return _pdfLibsPromise;
  _pdfLibsPromise = Promise.all([
    window.html2canvas ? Promise.resolve() : _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
    window.jspdf       ? Promise.resolve() : _loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  ]);
  return _pdfLibsPromise;
}
function downloadCertificate(){
  var frame = document.getElementById('cert-frame');
  if (!frame) return;
  var btn = document.getElementById('cert-print-btn');
  var oldLabel = btn ? btn.textContent : '';
  if (btn){ btn.disabled = true; btn.textContent = 'Wird erstellt …'; }

  var wrap = null;
  ensurePdfLibs()
    .then(function(){ return (document.fonts && document.fonts.ready) ? document.fonts.ready : null; })
    .then(function(){
      // Off-screen, fixed-width clone → consistent output regardless of screen size.
      var W = 760;
      wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + (W + 48) + 'px;padding:24px;background:#ffffff;';
      var clone = frame.cloneNode(true);
      clone.removeAttribute('id');
      clone.style.width = W + 'px';
      clone.style.maxWidth = 'none';
      clone.style.margin = '0';
      wrap.appendChild(clone);
      document.body.appendChild(wrap);
      // html2canvas doesn't support CSS aspect-ratio — pin each sticker tile to a
      // real square using its laid-out width so the grid doesn't collapse.
      clone.querySelectorAll('.cert-st').forEach(function(t){
        var w = t.getBoundingClientRect().width;
        t.style.aspectRatio = 'auto';
        t.style.height = w + 'px';
      });
      return window.html2canvas(wrap, { scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false });
    })
    .then(function(canvas){
      if (wrap && wrap.parentNode){ wrap.parentNode.removeChild(wrap); wrap = null; }
      var img = canvas.toDataURL('image/png');
      var JsPDF = window.jspdf.jsPDF;
      var pxW = canvas.width, pxH = canvas.height;
      var pdf = new JsPDF({ orientation: pxH >= pxW ? 'portrait' : 'landscape', unit: 'pt', format: 'a4' });
      var pageW = pdf.internal.pageSize.getWidth();
      var pageH = pdf.internal.pageSize.getHeight();
      var margin = 28;
      var ratio  = Math.min((pageW - margin * 2) / pxW, (pageH - margin * 2) / pxH);
      var drawW  = pxW * ratio, drawH = pxH * ratio;
      pdf.addImage(img, 'PNG', (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH);
      var nm = (STATE.name || 'Champion').replace(/[^\w\-]+/g, '_');
      pdf.save('T7-Zertifikat-' + nm + '.pdf');
    })
    .catch(function(err){
      if (wrap && wrap.parentNode){ wrap.parentNode.removeChild(wrap); }
      console.warn('[T7] PDF-Download fehlgeschlagen — Druckdialog als Fallback.', err);
      try { window.print(); } catch(e){}
    })
    .then(function(){
      if (btn){ btn.disabled = false; btn.textContent = oldLabel || '⬇️ Zertifikat herunterladen'; }
    });
}

/* === TRICKPFAD === */
function renderTrickpfad(){
  var path = document.getElementById('tp-path');
  if (!path) return;
  var nodes = [];
  TRICKPATH_ORDER.forEach(function(mk){
    KID_MODULES[mk].drills.forEach(function(d){ nodes.push({mod:mk, drill:d}); });
  });
  var nextIdx = -1;
  for (var i = 0; i < nodes.length; i++){
    var r = STATE.ratings[nodes[i].mod + '_' + nodes[i].drill.idx] || 0;
    if (r < 4){ nextIdx = i; break; }
  }
  path.innerHTML = nodes.map(function(n, i){
    var rating = STATE.ratings[n.mod + '_' + n.drill.idx] || 0;
    var done = rating >= 4;
    var star = rating === 5;
    var side = (i % 2 === 0) ? 'tp-left' : 'tp-right';
    var stateCls = star ? 'tp-star' : (done ? 'tp-done' : '');
    if (i === nextIdx) stateCls += ' tp-next';
    var badge = star ? '★' : (done ? '✓' : (i + 1));
    return '<div class="tp-node ' + side + ' ' + stateCls + '" data-mod="' + n.mod + '" data-idx="' + n.drill.idx + '"><div class="tp-emoji">' + n.drill.emoji + '</div><div class="tp-body"><div class="tp-title">' + n.drill.title + '</div><div class="tp-meta">' + n.drill.meta + '</div></div><div class="tp-badge">' + badge + '</div></div>';
  }).join('');
  path.querySelectorAll('.tp-node').forEach(function(node){
    node.addEventListener('click', function(){ openDrill(node.dataset.mod, parseInt(node.dataset.idx, 10)); });
  });
  var tpEnd = document.getElementById('tp-end');
  if (tpEnd) tpEnd.classList.toggle('tp-end-done', nextIdx === -1);
}

/* === MODAL FLOW === */
function openDrill(modKey, idx){
  STATE.curMod = modKey; STATE.curDrill = idx;
  var d = KID_MODULES[modKey].drills.find(function(x){ return x.idx === idx; });
  if (!d) return;
  document.getElementById('kmodal-title').textContent = d.title;
  document.getElementById('kembed').src = 'https://player.vimeo.com/video/' + d.vid + '?h=' + d.hash + '&color=FFD700&title=0&byline=0&portrait=0';
  showStep('watch');
  document.getElementById('kmodal').classList.add('open');
  playTap();
}
function closeModal(){ document.getElementById('kmodal').classList.remove('open'); document.getElementById('kembed').src = ''; }
function showStep(name){
  ['watch','rate','success','tryagain'].forEach(function(s){ document.getElementById('kstep-' + s).classList.toggle('active', s === name); });
  if (name === 'rate') document.querySelectorAll('.krate').forEach(function(r){ r.className = 'krate'; });
}
document.getElementById('kmodal-close').onclick = closeModal;
document.getElementById('kmodal').addEventListener('click', function(e){ if (e.target.id === 'kmodal') closeModal(); });
document.getElementById('kbtn-tried').onclick = function(){ showStep('rate'); playTap(); };
document.querySelectorAll('.krate').forEach(function(r){
  r.addEventListener('click', function(){
    var rating = parseInt(r.dataset.rate, 10);
    document.querySelectorAll('.krate').forEach(function(x){ x.className = 'krate'; });
    var clsMap = {2:'sel-thumbsdown', 3:'sel-thinking', 4:'sel-thumbsup', 5:'sel-star'};
    r.className = 'krate sel ' + clsMap[rating];
    playTap();
    setTimeout(function(){ resolveOutcome(rating); }, 600);
  });
});
function resolveOutcome(rating){
  var modKey = STATE.curMod, idx = STATE.curDrill;
  var d = KID_MODULES[modKey].drills.find(function(x){ return x.idx === idx; });
  if (!d) return;
  var key = modKey + '_' + idx;
  var prev = STATE.ratings[key] || 0;
  var completionsBefore = STATE.completions[key] || 0;
  if (rating > prev) STATE.ratings[key] = rating;
  // Bump the completion counter on every successful run-through
  if (rating >= 4) STATE.completions[key] = completionsBefore + 1;

  // GOLD MASTERY: requires that this drill has already been completed AT LEAST
  // ONCE before this current rating, and the current rating is 5 ("Super!").
  // First-round 5-ratings just earn the regular blue sticker — gold has to be
  // earned by coming back to the drill and rating it 5 a second time.
  var newGold = false;
  if (completionsBefore >= 1 && rating === 5 && !STATE.gold[key]) {
    STATE.gold[key] = true;
    newGold = true;
  }
  saveLocal();
  if (STATE.email && window.T7SB) {
    var moduleLabel = KID_MODULES[modKey].label;
    var XP_BY_RATING = {2:4, 3:6, 4:8, 5:10};
    var xp = XP_BY_RATING[rating] || 0;
    T7SB.upsert(STATE.email, STATE.name, modKey, moduleLabel, idx, rating, xp, Date.now(), null);
    try { window.dispatchEvent(new CustomEvent('t7xpupdate')); } catch(e){}
    setTimeout(refreshFortschritt, 1500);
  }
  if (rating >= 4) {
    var wasNew = completionsBefore === 0;
    document.getElementById('ksticker-reveal').textContent = d.sticker;
    if (wasNew && isChampion() && !hasSeenChampion()) {
      document.getElementById('ksuccess-title').textContent = '🏆 CHAMPION! 🏆';
      document.getElementById('ksuccess-msg').textContent = 'Du hast ALLE 30 Sticker gesammelt! Wahnsinn!';
    } else if (newGold) {
      document.getElementById('ksuccess-title').textContent = '⭐ GOLD-STICKER! ⭐';
      document.getElementById('ksuccess-msg').textContent = 'Du hast diesen Trick gemeistert! Gold ist deins! 🌟';
    } else {
      document.getElementById('ksuccess-title').textContent = rating === 5 ? 'WOW! Perfekt!' : 'Super gemacht!';
      document.getElementById('ksuccess-msg').textContent = wasNew ? 'Du hast einen neuen Sticker bekommen! 🌟' : 'Du wirst immer besser! 🎉';
    }
    showStep('success'); confettiBurst();
    if (wasNew || newGold) playFanfare();
  } else {
    showStep('tryagain');
  }
  // Refresh all UI that depends on ratings
  updatePlaygroundStation(modKey);
  if (STATE.curStation === modKey) renderStationView(modKey);
  renderStickers();
  renderTrickpfad();
}
document.getElementById('kbtn-continue').onclick = function(){
  closeModal(); playTap();
  var mod = KID_MODULES[STATE.curMod];
  var nextIdx = STATE.curDrill + 1;
  var next = mod.drills.find(function(x){ return x.idx === nextIdx; });
  if (next) setTimeout(function(){ openDrill(STATE.curMod, nextIdx); }, 400);
  else      setTimeout(maybeShowChampion, 600);
};
document.getElementById('kbtn-retry').onclick = function(){ showStep('watch'); playTap(); };
document.getElementById('kbtn-skip').onclick = function(){
  closeModal(); playTap();
  setTimeout(maybeShowChampion, 600);
};

/* Champion ceremony + certificate button wiring */
(function(){
  var champClose = document.getElementById('champion-close');
  var champGo    = document.getElementById('champion-cta-go');
  var champCert  = document.getElementById('champion-cta-cert');
  var certBack   = document.getElementById('cert-back-btn');
  var certPrint  = document.getElementById('cert-print-btn');
  var kfChamp    = document.getElementById('kf-champion-btn');
  var certOpen   = document.getElementById('cert-open-btn');
  if (champClose) champClose.onclick = function(){ hideChampionCeremony(); markChampionSeen(); playTap(); };
  if (champGo)    champGo.onclick    = function(){ hideChampionCeremony(); markChampionSeen(); playTap(); };
  if (champCert)  champCert.onclick  = function(){ markChampionSeen(); showCertificate(); playTap(); };
  if (certBack)   certBack.onclick   = function(){ hideCertificate(); playTap(); };
  if (certPrint)  certPrint.onclick  = function(){ downloadCertificate(); };
  if (kfChamp)    kfChamp.onclick    = function(){ showCertificate(); playTap(); };
  // Certificate is available at ANY time from the sidebar card (not gated on champion status).
  if (certOpen)   certOpen.onclick   = function(){ showCertificate(); playTap(); };
  // Click-outside-to-close on the certificate overlay.
  var certOv = document.getElementById('certificate-modal');
  if (certOv) certOv.addEventListener('click', function(e){
    if (e.target.id === 'certificate-modal') hideCertificate();
  });
  // Click-outside-to-close on champion overlay (but keep certificate explicit)
  var champOv = document.getElementById('champion-modal');
  if (champOv) champOv.addEventListener('click', function(e){
    if (e.target.id === 'champion-modal') { hideChampionCeremony(); markChampionSeen(); }
  });
})();

function confettiBurst(){
  var colors = ['#00E5FF','#0080FF','#FFD700','#E4002B','#22C55E','#FFFFFF'];
  var container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  for (var i = 0; i < 60; i++) {
    var p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDelay = Math.random() * 0.4 + 's';
    p.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
    p.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
    container.appendChild(p);
  }
  setTimeout(function(){ container.remove(); }, 3500);
}

function saveLocal(){ try{ var key='t7kid_'+(STATE.name||'guest').toLowerCase(); localStorage.setItem(key, JSON.stringify({v:2, r:STATE.ratings, g:STATE.gold, c:STATE.completions})); }catch(e){} }
function loadLocal(){ try{
  var key = 't7kid_' + (STATE.name || 'guest').toLowerCase();
  var raw = localStorage.getItem(key);
  if (!raw) return;
  var d = JSON.parse(raw);
  if (d.r) STATE.ratings = d.r;
  /* Gold + completions only honoured from v2 onwards. Older saves had a buggy
     gold rule (rating===5 instantly counted), so we drop those flags on
     upgrade and let kids re-earn gold properly with the new replay logic. */
  if (d.v === 2) {
    if (d.g) STATE.gold        = d.g;
    if (d.c) STATE.completions = d.c;
  }
}catch(e){} }

function hydrateFromSupabase(){
  if (!STATE.email || !window.T7SB) return;
  Object.keys(KID_MODULES).forEach(function(mk){
    T7SB.getModuleXP(STATE.email, mk, function(rows){
      var changed = false;
      rows.forEach(function(r){
        var key = mk + '_' + r.challenge_idx;
        if ((r.rating || 0) > (STATE.ratings[key] || 0)) { STATE.ratings[key] = r.rating; changed = true; }
      });
      if (changed) {
        saveLocal();
        updatePlaygroundStation(mk);
        if (STATE.curStation === mk) renderStationView(mk);
        renderStickers();
        renderTrickpfad();
      }
    });
  });
}

function refreshFortschritt(){
  if (!STATE.email) return;
  if (window.T7SB) {
    T7SB.getTotalXP(STATE.email, function(total){
      STATE.totalXP = total || 0;
      document.getElementById('kf-total').textContent = STATE.totalXP.toLocaleString('de-AT');
    });
  }
  var SB_URL = 'https://qajjuhjmrtuomwrbxmpz.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';
  fetch(SB_URL+'/rest/v1/attempts?player_email=eq.'+encodeURIComponent(STATE.email)+'&select=attempted_at,xp',{headers:{apikey:SB_KEY,'Authorization':'Bearer '+SB_KEY}})
  .then(function(r){return r.json();}).then(function(rows){
    var now=new Date(),sw=new Date(now);sw.setHours(0,0,0,0);sw.setDate(now.getDate()-((now.getDay()+6)%7));
    var t0=sw.getTime(),xp=0;
    (rows||[]).forEach(function(a){var ts=typeof a.attempted_at==='number'?a.attempted_at:parseInt(a.attempted_at)||0; if(ts>=t0)xp+=Number(a.xp||0);});
    STATE.weekXP=xp;
    document.getElementById('kf-week').textContent = xp;
  }).catch(function(){});
}

function hydrateDrillsFromSupabase(){
  // Pulls Vimeo links from the `videos` table in Supabase.
  // Schema:
  //   - stars      (int2): difficulty rating
  //   - vimeo_url  (text): full Vimeo URL (e.g. https://vimeo.com/1124934705/6a71a27daf)
  // For stadium drills (sd1-sd5), ONLY uses videos where stars === 3 or stars === 4.
  // Each stadium drill's `meta` ('3 Sterne' / '4 Sterne') decides which star pool it draws from.
  // The curated drill `title` from KID_MODULES is kept — only vid + hash are updated.
  var SB_URL = 'https://qajjuhjmrtuomwrbxmpz.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';
  // Filter server-side so 1⭐/2⭐/5⭐ rows never reach the browser.
  var URL = SB_URL + '/rest/v1/videos?select=stars,vimeo_url&stars=in.(3,4)';

  // Parse any Vimeo URL into {vid, hash}. Handles:
  //   https://vimeo.com/{id}
  //   https://vimeo.com/{id}/{hash}
  //   https://vimeo.com/{id}?h={hash}
  //   https://player.vimeo.com/video/{id}
  //   https://player.vimeo.com/video/{id}?h={hash}
  function parseVimeoUrl(url){
    if (!url) return null;
    var idM = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (!idM) return null;
    var vid = idM[1], hash = '';
    var pathM  = String(url).match(/vimeo\.com\/(?:video\/)?\d+\/([a-zA-Z0-9]+)/);
    var queryM = String(url).match(/[?&]h=([a-zA-Z0-9]+)/);
    if (pathM)  hash = pathM[1];
    else if (queryM) hash = queryM[1];
    return { vid: vid, hash: hash };
  }

  fetch(URL, { headers: { apikey: SB_KEY, 'Authorization': 'Bearer ' + SB_KEY } })
  .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(function(rows){
    if (!Array.isArray(rows) || !rows.length) {
      console.warn('[T7] videos table returned no 3⭐/4⭐ rows — stadium drills will keep placeholders.');
      return;
    }
    try { console.log('[T7] videos columns:', Object.keys(rows[0]), '| pool size:', rows.length); } catch(e){}

    // Build 3⭐ and 4⭐ pools of parsed {vid, hash} objects, skipping unparseable URLs.
    var pool3 = [], pool4 = [];
    rows.forEach(function(r){
      var parsed = parseVimeoUrl(r.vimeo_url);
      if (!parsed) return;
      if (r.stars === 3) pool3.push(parsed);
      else if (r.stars === 4) pool4.push(parsed);
    });

    // Deterministic assignment: walk stadium drills in order, draw the next
    // unused video from the matching star pool.
    var i3 = 0, i4 = 0, changed = false;
    STADIUM_ORDER.forEach(function(mk){
      var mod = KID_MODULES[mk];
      if (!mod) return;
      mod.drills.forEach(function(d){
        var wantsThree = (d.meta && d.meta.indexOf('3') !== -1);
        var pool = wantsThree ? pool3 : pool4;
        var idx  = wantsThree ? i3 : i4;
        if (idx >= pool.length) return; // pool exhausted, keep placeholder
        var pick = pool[idx];
        if (wantsThree) i3++; else i4++;
        if (pick.vid  && pick.vid  !== d.vid)  { d.vid  = pick.vid;  changed = true; }
        if (pick.hash !== d.hash) { d.hash = pick.hash; changed = true; }
        // Title is intentionally kept from KID_MODULES (the curated German drill names).
      });
    });

    if (changed && STATE.curStation) renderStationView(STATE.curStation);
  })
  .catch(function(err){ console.warn('[T7] hydrateDrillsFromSupabase failed', err); });
}

function boot(email, name){
  STATE.email = email;
  STATE.name = (name || '').split(' ')[0] || 'Champion';
  document.getElementById('kid-name').textContent = STATE.name;
  var kfNameEl = document.getElementById('kf-name');
  if (kfNameEl) kfNameEl.textContent = STATE.name;
  loadLocal();
  Object.keys(KID_MODULES).forEach(updatePlaygroundStation);
  renderStickers();
  updateHeroStickerCount();
  renderTrickpfad();
  hydrateDrillsFromSupabase();
  hydrateFromSupabase();
  refreshFortschritt();
  refreshChampionBadge();
  // Returning champions who haven't seen the ceremony yet get it on load.
  setTimeout(maybeShowChampion, 1200);
}

if (window.T7Identity) { T7Identity.resolve(function(email, name){ boot(email, name); }); }
else { setTimeout(function(){ if (window.T7Identity) T7Identity.resolve(function(email, name){ boot(email, name); }); else boot(null, null); }, 1500); }
})();

/* === PAGE-LEVEL LISTENERS ===
   Extracted from the inline <script> in Minis.html — these hook document-level
   events that aren't specific to the module closure above. */

// Escape closes the drill/video modal. Delegates to the existing close
// button so the engine's cleanup (pause iframe, reset step) still runs.
document.addEventListener('keydown', function(e){
  if (e.key !== 'Escape' && e.keyCode !== 27) return;
  // Certificate modal closes first if it's open.
  var cert = document.getElementById('certificate-modal');
  if (cert && cert.classList.contains('open')) { cert.classList.remove('open'); return; }
  var overlay = document.getElementById('kmodal');
  if (!overlay || !overlay.classList.contains('open')) return;
  var closeBtn = document.getElementById('kmodal-close');
  if (closeBtn) { closeBtn.click(); } else { overlay.classList.remove('open'); }
});

// Sync the station-hero bar with each playground station's actual color.
// t7-minis.js sets hero.style.background = STATION_COLORS[key][1] when a
// station opens. We hook the click in CAPTURE phase so we update that map
// before the engine reads it — using getComputedStyle so we always pick up
// the right color for the current theme (dark or light).
(function(){
  // Which stations need dark text on a light background. The Brazil-yellow
  // station (st2) is currently the only one; extend this set if the palette
  // changes.
  var DARK_TEXT_STATIONS = { st2: true };

  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('[data-station]');
    if (!btn) return;
    var key = btn.dataset.station;
    if (!key) return;

    // Read the station's actual rendered background and push it into the
    // engine's color map so the bar matches.
    var bg = getComputedStyle(btn).backgroundColor;
    if (window.STATION_COLORS && window.STATION_COLORS[key] && bg) {
      window.STATION_COLORS[key] = [bg, bg];
    }

    // Flag dark text for light-background stations so the bar stays readable.
    var hero = document.getElementById('station-hero');
    if (hero) {
      if (DARK_TEXT_STATIONS[key]) hero.setAttribute('data-st-text', 'dark');
      else hero.removeAttribute('data-st-text');
    }
  }, true); // capture phase — runs before the engine's bubble handler
})();
