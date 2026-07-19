/* ============================================================
   T7 ACADEMY — t7-home.js
   ------------------------------------------------------------
   Single home-page script.

   CLOUD (Supabase) — unchanged from before:
     - Identity (T7Identity)
     - Progress: Sevens / Sterne video watch counts
     - Challenges progress + XP        (player_stats.xp)
     - Sterne-Zertifikat (star count)  (player_stats.stars)
     - Avatar URL                      (player_profiles.avatar_url)

   LOCAL ONLY (GDPR — never leaves the device):
     - Diary entries           → localStorage
     - Player video uploads    → IndexedDB
     - With download / upload backup for switching devices.
     - Both live behind a teaser card on the home page; the full
       feature (repository / journal + archiving controls) only
       renders once the card is opened in its modal.

   Vimeo watch-time tracking still lives in its own file
   (t7-vimeo-tracker.js).

   ────────────────────────────────────────────────────────────
   REQUIRED SUPABASE CHANGE
   Just one column — the diary and clips tables are GONE.
   ────────────────────────────────────────────────────────────

     alter table player_profiles
       add column if not exists avatar_url text;

   STORAGE BUCKET (one):
     - "player-avatars"  → public read, authenticated write.
       Storage policy:

         create policy "avatars_self_write" on storage.objects for insert
           with check (
             bucket_id = 'player-avatars'
             and split_part(name, '.', 1) = auth.uid()::text
           );

   That's it for backend.  Diary + clips never touch the network.
   ============================================================ */

(function(){
  if (window.__T7_HOME_LOADED__) return;
  window.__T7_HOME_LOADED__ = true;


  /* ============================================================
     CONSTANTS
  ============================================================ */
  var SB_URL = window.T7_SB_URL || 'https://qajjuhjmrtuomwrbxmpz.supabase.co';
  var SB_KEY = window.T7_SB_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';

  var AVATAR_BUCKET = 'player-avatars';

  /* Local storage keys & IDB names — namespaced per profile so two
     players on the same device don't see each other's data. */
  var DIARY_KEY_PREFIX = 't7_diary_v1__';   // + profileId (or 'anon')
  var GOALS_KEY_PREFIX = 't7_goals_v1__';   // + profileId (or 'anon')
  var IDB_NAME         = 't7-academy';
  var IDB_VERSION      = 2;
  var CLIPS_STORE      = 'clips';           // keyPath 'id'; index 'profile_id'
  var DIARY_AUDIO_STORE = 'diary_audio';    // keyPath 'id'  (voice notes)

  /* Watch-time threshold for "Video gesehen" tile */
  var SEEN_THRESHOLD_SEC = 30;

  /* Module metadata — must mirror the Challenges page configs */
  var CHALLENGE_MODULES = [
    { key: 'jong',  label: 'Jonglierschule',  total: 4 },
    { key: 'ft1',   label: 'First Touch',     total: 5 },
    { key: 'fta1',  label: 'First Touch Air', total: 6 },
    { key: 'gc0',   label: 'Ginga Basic',     total: 5 },
    { key: 'gc1',   label: 'Ginga Advanced',  total: 5 },
    { key: 'jong2', label: 'Ball in der Luft',total: 4 }
  ];
  var CERT_MODULES = [
    { key: 'sz1', label: '1 Stern',  stars: 1, total: 5 },
    { key: 'sz2', label: '2 Sterne', stars: 2, total: 5 },
    { key: 'sz3', label: '3 Sterne', stars: 3, total: 5 },
    { key: 'sz4', label: '4 Sterne', stars: 4, total: 5 },
    { key: 'sz5', label: '5 Sterne', stars: 5, total: 5 }
  ];

  var NEWS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHWaswAJIeuF1xBh_yBGIDKcB58lya5y6NEJ-rLS_3pJ-7mEZruDXjo7uOj5s5DwtXSEuH7-iq-kYk/pub?output=csv';


  /* ============================================================
     GENERIC HELPERS
  ============================================================ */
  function $(id){ return document.getElementById(id); }

  function sbHeaders(extra){
    var h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
    if (extra) Object.keys(extra).forEach(function(k){ h[k] = extra[k]; });
    return h;
  }

  function sbGet(path){
    return fetch(SB_URL + '/rest/v1/' + path, { headers: sbHeaders() })
      .then(function(r){ return r.ok ? r.json() : []; })
      .catch(function(){ return []; });
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  function todayISO(){
    var d = new Date();
    var pad = function(n){ return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function fmtWatchTime(seconds){
    var min = Math.round(seconds / 60);
    if (min < 60) return min + ' Min';
    return Math.floor(min / 60) + 'h ' + (min % 60) + 'm';
  }

  function renderEmpty(el, msg){
    el.innerHTML = '<div class="po-empty">' + esc(msg) + '</div>';
  }

  function uuid(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /* Download a JS object as a JSON file */
  function downloadJson(data, filename){
    var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
  }

  /* Read an uploaded File as JSON */
  function readJsonFile(file){
    return new Promise(function(resolve, reject){
      var r = new FileReader();
      r.onload  = function(){ try { resolve(JSON.parse(r.result)); } catch(e){ reject(e); } };
      r.onerror = function(){ reject(r.error); };
      r.readAsText(file);
    });
  }

  /* Set transient status text on an action-row span */
  function setStatus(el, msg, cls){
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'home-actions-status' + (cls ? ' ' + cls : '');
    if (msg) {
      clearTimeout(el.__t7statusTimer);
      el.__t7statusTimer = setTimeout(function(){
        el.textContent = '';
        el.className = 'home-actions-status';
      }, 3500);
    }
  }


  /* ============================================================
     THEME + NAV (was inline)
  ============================================================ */
  function initThemeAndNav(){
    var theme = localStorage.getItem('t7_theme') || 'dark';
    var MOON = '\u263E', SUN = '\u2600';
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    var tog = $('themeToggle');
    if (tog) {
      tog.innerHTML = theme === 'dark' ? MOON : SUN;
      tog.onclick = function(){
        theme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('t7_theme', theme);
        tog.innerHTML = theme === 'dark' ? MOON : SUN;
      };
    }
    var nav = document.querySelector('.topnav');
    if (nav) {
      var adminBar = $('wpadminbar');
      var updateTop = function(){ nav.style.top = adminBar ? adminBar.offsetHeight + 'px' : '0'; };
      updateTop();
      window.addEventListener('resize', updateTop);
      window.addEventListener('scroll', function(){
        if (window.scrollY > 40) nav.classList.add('nav-shrunk');
        else nav.classList.remove('nav-shrunk');
      });
    }
  }


  /* ============================================================
     HOME CARD MODALS — "Meine Aufnahmen" and "Mein Tagebuch"
     stay collapsed as a teaser card on the home page and open
     into a full-feature modal on click.  Archiving controls
     (Sichern / Wiederherstellen) only live inside the modal
     body, so they only become visible once a card is open.
  ============================================================ */
  var openHomeModalEl = null;

  function openHomeModal(id){
    var modal = $(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('home-modal-open');
    openHomeModalEl = modal;
    var closeBtn = modal.querySelector('.home-modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeHomeModal(modal){
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('home-modal-open');
    if (openHomeModalEl === modal) openHomeModalEl = null;
    /* Never leave the mic live in the background — stopping keeps
       whatever was recorded so far as an unsaved preview. */
    if (modal.id === 'diaryModal') {
      ['good', 'watch'].forEach(function(c){
        var r = diaryRecorders[c];
        if (r && r.btn && r.btn.classList.contains('recording')) diaryVoiceStop(r);
      });
    }
  }

  function initHomeModals(){
    Array.prototype.forEach.call(document.querySelectorAll('.home-modal'), function(modal){
      Array.prototype.forEach.call(modal.querySelectorAll('[data-modal-close]'), function(el){
        el.addEventListener('click', function(){ closeHomeModal(modal); });
      });
    });
    var myvidsOpen = $('myvidsCardOpen');
    if (myvidsOpen) myvidsOpen.addEventListener('click', function(){ openHomeModal('myvidsModal'); });
    var diaryOpen = $('diaryCardOpen');
    if (diaryOpen) diaryOpen.addEventListener('click', function(){ openHomeModal('diaryModal'); });
    var goalsOpen = $('goalsCardOpen');
    if (goalsOpen) goalsOpen.addEventListener('click', function(){ openHomeModal('goalsModal'); });

    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && openHomeModalEl) closeHomeModal(openHomeModalEl);
    });
  }


  /* ============================================================
     IDENTITY
  ============================================================ */
  function whenIdentity(cb){
    function go(){ T7Identity.resolve(function(id){ cb(id || null); }); }
    if (window.T7Identity) go();
    else setTimeout(function(){
      if (window.T7Identity) go();
      else cb(null);
    }, 1500);
  }


  /* ============================================================
     AVATAR (cloud) — sidebar uploader + nav thumb
     Stored at  player-avatars/{profile_id}.{ext}
     URL kept on player_profiles.avatar_url
  ============================================================ */
  function applyAvatar(url){
    var img   = $('avatarSideImg');
    var navAv = $('navAvatar');
    if (url) {
      if (img) {
        img.style.backgroundImage = "url('" + url + "')";
        img.classList.add('has-photo');
      }
      if (navAv) {
        navAv.style.backgroundImage = "url('" + url + "')";
        navAv.classList.add('has-photo');
      }
    } else {
      if (img) {
        img.style.backgroundImage = '';
        img.classList.remove('has-photo');
      }
      if (navAv) {
        navAv.classList.remove('has-photo');
        navAv.style.backgroundImage = '';
        navAv.textContent = '?';
      }
    }
  }

  function initAvatar(profileId){
    var side  = $('avatarSide');
    var cta   = $('avatarSideCta');
    var input = $('avatarInput');
    if (!side || !input) return;

    var openPicker = function(){ if (profileId) input.click(); };
    side.addEventListener('click', openPicker);
    side.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
    });
    if (cta) {
      cta.addEventListener('click', function(e){
        /* The CTA is inside the slot — stop the slot click from
           firing the picker twice. */
        e.stopPropagation();
        openPicker();
      });
    }

    if (!profileId) {
      applyAvatar(null);
      if (cta) { cta.disabled = true; cta.textContent = 'Anmelden zum Hochladen'; }
      return;
    }

    /* Pull existing avatar URL */
    sbGet('player_profiles?id=eq.' + encodeURIComponent(profileId) + '&select=avatar_url')
      .then(function(rows){ applyAvatar(rows && rows[0] && rows[0].avatar_url); });

    /* Upload on file pick */
    input.addEventListener('change', function(){
      var file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        alert('Das Bild ist zu groß (max. 8 MB).');
        input.value = '';
        return;
      }
      side.classList.add('uploading');

      var ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
      var path = profileId + '.' + ext;
      var uploadUrl = SB_URL + '/storage/v1/object/' + AVATAR_BUCKET + '/' + path;

      fetch(uploadUrl, {
        method: 'POST',
        headers: {
          apikey: SB_KEY,
          Authorization: 'Bearer ' + SB_KEY,
          'Content-Type': file.type || 'image/jpeg',
          'x-upsert': 'true'
        },
        body: file
      }).then(function(r){
        if (!r.ok) throw new Error('upload failed (' + r.status + ')');
        var publicUrl = SB_URL + '/storage/v1/object/public/' + AVATAR_BUCKET + '/' + path + '?t=' + Date.now();
        return fetch(SB_URL + '/rest/v1/player_profiles?id=eq.' + encodeURIComponent(profileId), {
          method: 'PATCH',
          headers: sbHeaders({ Prefer: 'return=minimal' }),
          body: JSON.stringify({ avatar_url: publicUrl })
        }).then(function(r2){
          if (!r2.ok) console.warn('[T7 Home] avatar uploaded but PATCH player_profiles failed (' + r2.status + '). Did you add the avatar_url column?');
          return publicUrl;
        });
      }).then(function(publicUrl){
        applyAvatar(publicUrl);
      }).catch(function(err){
        console.error('[T7 Home] avatar upload', err);
        alert('Upload fehlgeschlagen. Bitte später erneut versuchen.');
      }).then(function(){
        side.classList.remove('uploading');
        input.value = '';
      });
    });
  }


  /* ============================================================
     PROGRESS CARDS (cloud, unchanged in shape)
     Sevens + Sterne render their own video-watch stats.
     Challenges + Zertifikate render module progress.
     Certs also feeds the hero Sterne-Zertifikat badge.
  ============================================================ */
  function renderVideoCard(el, profileId, kind){
    if (!profileId) { renderEmpty(el, 'Anmelden, um Fortschritt zu sehen.'); return; }

    var videoFilter = kind === 'sevens' ? 'sevens=not.is.null' : 'stars=not.is.null';
    var numCls = kind === 'sterne' ? ' gold' : '';

    Promise.all([
      sbGet('videos?' + videoFilter + '&select=vimeo_code'),
      sbGet('video_progress?profile_id=eq.' + encodeURIComponent(profileId) + '&select=vimeo_id,total_seconds')
    ]).then(function(res){
      var videos = res[0] || [], progress = res[1] || [];
      /* videos.vimeo_code can be "{id}/{hash}" for unlisted videos, but
         video_progress.vimeo_id is just the bare numeric id — normalise both
         to the numeric id so watch-time actually matches. */
      function bareId(x){ return String(x == null ? '' : x).split('/')[0].trim(); }
      var ids = {};
      videos.forEach(function(v){ var vid = bareId(v.vimeo_code); if (vid) ids[vid] = true; });
      var totalVideos = Object.keys(ids).length;

      var seen = 0, seconds = 0;
      progress.forEach(function(p){
        if (!ids[bareId(p.vimeo_id)]) return;
        var s = Number(p.total_seconds || 0);
        seconds += s;
        if (s >= SEEN_THRESHOLD_SEC) seen++;
      });

      el.innerHTML =
        '<div class="po-stats-row">' +
          '<div class="po-stat-tile">' +
            '<div class="po-stat-num' + numCls + '">' + seen +
              (totalVideos ? '<span style="opacity:.4;font-weight:500">/' + totalVideos + '</span>' : '') +
            '</div>' +
            '<div class="po-stat-label">Videos gesehen</div>' +
          '</div>' +
          '<div class="po-stat-tile">' +
            '<div class="po-stat-num' + numCls + '">' + fmtWatchTime(seconds) + '</div>' +
            '<div class="po-stat-label">Watch Time</div>' +
          '</div>' +
        '</div>';

      /* Feed hero stats */
      cumulativeHeroStats.seenVideos += seen;
      cumulativeHeroStats.seconds    += seconds;
      flushHeroStats();
    }).catch(function(){ renderEmpty(el, 'Fehler beim Laden.'); });
  }

  /* ---- Challenge des Monats helpers ----
     The monthly module_key is always 'monats_<currentYYYY_MM>' (built from
     today's date on the Challenges page, independent of how the row stores
     its month). We only read the monthly_challenges row for the drill TOTAL
     and its display name. */
  function currentMonthKey(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function monatsModuleKey(){
    return 'monats_' + currentMonthKey().replace('-', '_');
  }
  function monthMatchesNow(raw){
    var mk = currentMonthKey();
    var rm = String(raw == null ? '' : raw).toLowerCase().trim();
    if (!rm) return false;
    if (rm === mk) return true;
    if (rm.indexOf(mk + '-') === 0) return true;
    var digits = rm.replace(/[^0-9]/g, '');
    if (digits) {
      var d = new Date(), y = String(d.getFullYear()),
          m = String(d.getMonth() + 1).padStart(2, '0'), yy = y.slice(2);
      if ([y + m, m + y, m + yy, yy + m].indexOf(digits) >= 0) return true;
    }
    return false;
  }
  function monatsDrillTotal(row){
    if (!row) return 0;
    var raw = row.drills, arr = [];
    try { arr = (typeof raw === 'string' ? JSON.parse(raw) : (raw || [])); } catch (e) { arr = []; }
    return Array.isArray(arr) ? arr.length : 0;
  }

  /* ---- Dynamic module list (mirrors the Challenges page) ----
     Loads the `modules` table so the home cards never drift from Supabase.
     Totals come from each module's `challenges` array. Falls back to the
     hardcoded CHALLENGE_MODULES / CERT_MODULES if the fetch fails. */
  var _modCache = null;
  function countChallenges(raw){
    var arr = [];
    try { arr = (typeof raw === 'string' ? JSON.parse(raw) : (raw || [])); } catch (e) { arr = []; }
    return Array.isArray(arr) ? arr.length : 0;
  }
  function loadModules(cb){
    if (_modCache) { cb(_modCache); return; }
    sbGet('modules?published=eq.true&order=sort_order.asc&select=key,label,kind,stars,challenges')
      .then(function(rows){
        rows = rows || [];
        var ch = [], ce = [];
        rows.forEach(function(m){
          var total = countChallenges(m.challenges);
          if (!total) return;
          if (m.kind === 'certificate') ce.push({ key: m.key, label: m.label, stars: Number(m.stars || 0), total: total });
          else if (m.kind === 'challenge') ch.push({ key: m.key, label: m.label, total: total });
        });
        _modCache = { challenges: ch.length ? ch : CHALLENGE_MODULES, certs: ce.length ? ce : CERT_MODULES };
        cb(_modCache);
      })
      .catch(function(){ cb({ challenges: CHALLENGE_MODULES, certs: CERT_MODULES }); });
  }

  /* ---- Small render helpers for the challenge cards ---- */
  function xpHeader(xp){
    return '<div class="po-xp">⚡ ' + (xp || 0) + ' XP</div>';
  }
  function barRow(nameHtml, done, total, color){
    var hasTotal = (typeof total === 'number' && total > 0);
    var pct = hasTotal ? Math.round(done / total * 100) : 0;
    return '<div>' +
      '<div class="po-mod-row"><span class="po-mod-name">' + nameHtml + '</span>' +
        '<span class="po-mod-stat">' + done + '/' + total + '</span></div>' +
      '<div class="po-bar"><div class="po-bar-fill ' + color + '" style="width:' + pct + '%"></div></div>' +
    '</div>';
  }

  /* ============================================================
     CHALLENGE CARDS — four separate cards, each with its own XP:
       Technik (po-technik-body), Zertifikate (po-certs-body),
       Eigene Challenges (po-builder-body), Challenge des Monats
       (po-monats-body). XP per card = sum of that category's
       drill_attempts.xp, so the four add up to the hero total.
     Also feeds the hero Sterne-Zertifikat badge + total XP.
  ============================================================ */
  function renderChallengeCards(profileId){
    var elTech = $('po-technik-body'), elCert = $('po-certs-body'),
        elBuild = $('po-builder-body'), elMon = $('po-monats-body');
    var cards = [elTech, elCert, elBuild, elMon];
    if (!profileId) { cards.forEach(function(e){ if (e) renderEmpty(e, 'Anmelden, um Fortschritt zu sehen.'); }); return; }

    loadModules(function(mods){
      Promise.all([
        sbGet('drill_attempts?profile_id=eq.' + encodeURIComponent(profileId) + '&select=module_key,drill_idx,rating,xp'),
        sbGet('monthly_challenges?select=*&order=month.desc'),
        sbGet('player_stats?id=eq.' + encodeURIComponent(profileId) + '&select=stars,total_xp')
      ]).then(function(res){
        var attempts = res[0] || [], monthly = res[1] || [], statsRow = (res[2] || [])[0] || {};

        /* Feed hero: stars + total XP */
        var earnedStars = Number(statsRow.stars || 0);
        renderHeroStars(earnedStars);
        if (typeof statsRow.total_xp === 'number') { cumulativeHeroStats.xp = statsRow.total_xp; flushHeroStats(); }

        /* best rating per drill + summed xp per module key */
        var best = {}, xpByKey = {};
        attempts.forEach(function(a){
          if (!best[a.module_key]) best[a.module_key] = {};
          var cur = best[a.module_key][a.drill_idx] || 0;
          if (a.rating > cur) best[a.module_key][a.drill_idx] = a.rating;
          xpByKey[a.module_key] = (xpByKey[a.module_key] || 0) + Number(a.xp || 0);
        });
        function doneCount(key){
          var mb = best[key] || {};
          return Object.keys(mb).filter(function(k){ return mb[k] >= 4; }).length;
        }
        function catXP(pred){
          var t = 0;
          Object.keys(xpByKey).forEach(function(k){ if (pred(k)) t += xpByKey[k]; });
          return t;
        }
        var challengeKeys = {}, certKeys = {};
        mods.challenges.forEach(function(m){ challengeKeys[m.key] = 1; });
        mods.certs.forEach(function(m){ certKeys[m.key] = 1; });
        var isBuilder = function(k){ return k === 'builder' || k.indexOf('builder_') === 0; };
        var isMonats  = function(k){ return k.indexOf('monats_') === 0; };

        /* --- Technik --- */
        if (elTech) {
          elTech.innerHTML = xpHeader(catXP(function(k){ return challengeKeys[k]; })) +
            mods.challenges.map(function(m){ return barRow(esc(m.label), doneCount(m.key), m.total, 'cyan'); }).join('');
        }

        /* --- Zertifikate --- */
        if (elCert) {
          elCert.innerHTML = xpHeader(catXP(function(k){ return certKeys[k]; })) +
            mods.certs.map(function(m){
              var star = earnedStars >= m.stars ? ' <span style="color:var(--lp-gold);font-weight:800">★</span>' : '';
              return barRow(esc(m.label) + star, doneCount(m.key), m.total, 'gold');
            }).join('');
        }

        /* --- Eigene Challenges (Builder) --- */
        if (elBuild) {
          var builtKeys = {}, mastered = 0;
          Object.keys(best).forEach(function(k){
            if (isBuilder(k)) { builtKeys[k] = 1; var db = best[k]; Object.keys(db).forEach(function(d){ if (db[d] >= 4) mastered++; }); }
          });
          elBuild.innerHTML = xpHeader(catXP(isBuilder)) +
            '<div class="po-mod-row"><span class="po-mod-name">🔧 Challenges gebaut</span><span class="po-mod-stat">' + Object.keys(builtKeys).length + '</span></div>' +
            '<div class="po-mod-row"><span class="po-mod-name">★ Drills gemeistert</span><span class="po-mod-stat">' + mastered + '</span></div>';
        }

        /* --- Challenge des Monats --- */
        if (elMon) {
          var mRow = null;
          for (var i = 0; i < monthly.length; i++) { if (String(monthly[i].month).trim() === currentMonthKey()) { mRow = monthly[i]; break; } }
          if (!mRow) { for (var j = 0; j < monthly.length; j++) { if (monthMatchesNow(monthly[j].month)) { mRow = monthly[j]; break; } } }
          var mDone = doneCount(monatsModuleKey()), mTotal = monatsDrillTotal(mRow);
          var mName = (mRow && (mRow.name || '').trim()) || 'Challenge des Monats';
          elMon.innerHTML = xpHeader(catXP(isMonats)) +
            ((mTotal || mDone)
              ? barRow('🔥 ' + esc(mName), mDone, (mTotal || '?'), 'cyan')
              : '<div class="po-empty">Diesen Monat noch keine Challenge.</div>');
        }
      }).catch(function(){
        cards.forEach(function(e){ if (e) renderEmpty(e, 'Fehler beim Laden.'); });
      });
    });
  }


  /* ============================================================
     HERO — Sterne-Zertifikat badge (right column)
     Filled in by renderCerts above as soon as data arrives.
  ============================================================ */
  function renderHeroStars(stars){
    var num = $('hero-stars-num');
    var row = $('hero-stars-row');
    var sub = $('hero-stars-sub');
    var n = Math.max(0, Math.min(5, Number(stars || 0)));
    if (num) num.textContent = String(n);
    if (row) {
      var html = '';
      for (var i = 1; i <= 5; i++) {
        html += '<span class="s' + (i <= n ? ' earned' : '') + '">\u2605</span>';
      }
      row.innerHTML = html;
    }
    if (sub) {
      if (n === 0)      sub.textContent = 'Hol dir dein erstes Sterne-Zertifikat';
      else if (n === 5) sub.textContent = 'Vollständig — alle 5 Sterne erreicht';
      else              sub.textContent = 'Auf dem Weg zum ' + (n + 1) + '-Sterne-Zertifikat';
    }
  }


  /* ============================================================
     HERO STATS aggregator — fed by progress cards as they load.
  ============================================================ */
  var cumulativeHeroStats = { seenVideos: 0, seconds: 0, xp: null };

  function flushHeroStats(){
    var v = $('stat-videos'), w = $('stat-watchtime'), x = $('stat-xp');
    if (v) v.textContent = cumulativeHeroStats.seenVideos;
    if (w) w.textContent = fmtWatchTime(cumulativeHeroStats.seconds);
    if (x) x.textContent = cumulativeHeroStats.xp != null ? cumulativeHeroStats.xp : '—';
  }
  function resetHeroStats(){
    cumulativeHeroStats = { seenVideos: 0, seconds: 0, xp: null };
  }

  function initProgress(profileId){
    resetHeroStats();
    renderHeroStars(0);                  /* placeholder until renderCerts resolves */
    renderVideoCard($('po-sevens-body'),    profileId, 'sevens');
    renderVideoCard($('po-sterne-body'),    profileId, 'sterne');
    renderChallengeCards(profileId);

    window.addEventListener('t7xpupdate', function(){
      var info = window.T7Identity && T7Identity.get();
      if (info && info.id) {
        renderVideoCard($('po-sevens-body'), info.id, 'sevens');
        renderVideoCard($('po-sterne-body'), info.id, 'sterne');
        renderChallengeCards(info.id);
      }
    });
  }


  /* ============================================================
     ────────  LOCAL-ONLY STORAGE (GDPR)  ────────

     Diary entries and player video uploads live ONLY on the
     device.  Nothing in this section talks to the network.
  ============================================================ */


  /* ============================================================
     DIARY  →  localStorage
     Key:    t7_diary_v1__{profileId|anon}
     Shape:  [{ entry_date, good_text, watch_text, updated_at }, …]
  ============================================================ */
  function diaryKey(profileId){
    return DIARY_KEY_PREFIX + (profileId || 'anon');
  }
  function diaryRead(profileId){
    try { return JSON.parse(localStorage.getItem(diaryKey(profileId))) || []; }
    catch(e){ return []; }
  }
  function diaryWrite(profileId, entries){
    localStorage.setItem(diaryKey(profileId), JSON.stringify(entries));
  }
  function diaryUpsert(profileId, entry){
    var entries = diaryRead(profileId);
    var idx = -1;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].entry_date === entry.entry_date) { idx = i; break; }
    }
    if (idx >= 0) entries[idx] = entry;
    else entries.push(entry);
    entries.sort(function(a, b){ return (b.entry_date || '').localeCompare(a.entry_date || ''); });
    diaryWrite(profileId, entries);
  }
  function diaryGetByDate(profileId, isoDate){
    var entries = diaryRead(profileId);
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].entry_date === isoDate) return entries[i];
    }
    return null;
  }

  /* ---- Voice notes: audio blobs in IndexedDB (store 'diary_audio')
     so the browser's localStorage quota is never touched. ---- */
  function diaryAudioPut(record){
    return idbOpen().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(DIARY_AUDIO_STORE, 'readwrite');
        tx.objectStore(DIARY_AUDIO_STORE).put(record);
        tx.oncomplete = function(){ resolve(record); };
        tx.onerror    = function(){ reject(tx.error); };
      });
    });
  }
  function diaryAudioGet(id){
    return idbOpen().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(DIARY_AUDIO_STORE, 'readonly');
        var req = tx.objectStore(DIARY_AUDIO_STORE).get(id);
        req.onsuccess = function(){ resolve(req.result || null); };
        req.onerror   = function(){ reject(req.error); };
      });
    });
  }
  function diaryAudioDelete(id){
    return idbOpen().then(function(db){
      return new Promise(function(resolve){
        var tx = db.transaction(DIARY_AUDIO_STORE, 'readwrite');
        tx.objectStore(DIARY_AUDIO_STORE).delete(id);
        tx.oncomplete = function(){ resolve(); };
        tx.onerror    = function(){ resolve(); };
      });
    }).catch(function(){});
  }

  /* Object-URL lifecycle for audio shown in the feed */
  var diaryAudioUrls = {};
  function freeDiaryAudioUrls(){
    Object.keys(diaryAudioUrls).forEach(function(k){ URL.revokeObjectURL(diaryAudioUrls[k]); });
    diaryAudioUrls = {};
  }
  function loadDiaryAudioUrls(ids){
    var uniq = {};
    ids.forEach(function(id){ if (id) uniq[id] = true; });
    return Promise.all(Object.keys(uniq).map(function(id){
      return diaryAudioGet(id).then(function(rec){
        if (rec && rec.blob) diaryAudioUrls[id] = URL.createObjectURL(rec.blob);
      }).catch(function(){});
    })).then(function(){ return diaryAudioUrls; });
  }


  /* ---- Recorder widgets (one per column: good / watch) ---- */
  var diaryRecorders = {};
  var diaryVoiceSupported = !!(navigator.mediaDevices &&
                               navigator.mediaDevices.getUserMedia &&
                               window.MediaRecorder);

  function fmtRecTime(ms){
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }
  function stopStream(rec){
    if (rec.stream) { rec.stream.getTracks().forEach(function(t){ t.stop(); }); rec.stream = null; }
  }
  function diaryVoiceSetPreview(rec, blob){
    if (rec.previewUrl) URL.revokeObjectURL(rec.previewUrl);
    rec.previewUrl = URL.createObjectURL(blob);
    rec.audioEl.src = rec.previewUrl;
    rec.playerEl.hidden = false;
    rec.txtEl.textContent = 'Neu aufnehmen';
  }
  function diaryVoiceClearPreview(rec){
    if (rec.previewUrl) { URL.revokeObjectURL(rec.previewUrl); rec.previewUrl = null; }
    rec.audioEl.removeAttribute('src');
    rec.playerEl.hidden = true;
    rec.txtEl.textContent = 'Sprachnotiz aufnehmen';
  }
  /* Pick a container/codec the browser can actually record.  Safari
     only supports audio/mp4 (AAC); Chrome/Edge/Firefox use WebM/Opus.
     Ordering mp4 first lets Safari succeed while others fall through. */
  function pickAudioMime(){
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    var cands = ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
    for (var i = 0; i < cands.length; i++) {
      try { if (MediaRecorder.isTypeSupported(cands[i])) return cands[i]; } catch(e){}
    }
    return '';
  }

  function diaryVoiceStart(rec){
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Aufnahme wird von diesem Browser nicht unterstützt. Bitte tippe deinen Eintrag.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream){
      rec.stream = stream;
      rec.chunks = [];
      var mime = pickAudioMime();
      var mr;
      try {
        mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch(e1){
        try { mr = new MediaRecorder(stream); }
        catch(e2){
          console.error('[T7 Home] MediaRecorder unsupported', e2);
          alert('Aufnahme wird von diesem Browser nicht unterstützt. Bitte tippe deinen Eintrag.');
          stopStream(rec);
          return;
        }
      }
      rec.mr = mr;
      rec.chosenMime = mime;
      mr.ondataavailable = function(e){ if (e.data && e.data.size) rec.chunks.push(e.data); };
      mr.onerror = function(ev){ console.error('[T7 Home] recorder error', ev && ev.error); };
      mr.onstop = function(){
        var type = (rec.mr && rec.mr.mimeType) ||
                   (rec.chunks[0] && rec.chunks[0].type) ||
                   rec.chosenMime || 'audio/mp4';
        var blob = new Blob(rec.chunks, { type: type });
        rec.pendingBlob = blob;
        rec.pendingMime = type;
        rec.removed = false;
        if (blob.size) diaryVoiceSetPreview(rec, blob);
        stopStream(rec);
      };
      /* A timeslice makes Safari emit data reliably. */
      try { mr.start(1000); } catch(e3){ try { mr.start(); } catch(e4){ console.error('[T7 Home] start', e4); } }
      rec.startTs = Date.now();
      rec.btn.classList.add('recording');
      rec.txtEl.textContent = 'Stopp';
      rec.timeEl.hidden = false;
      rec.timeEl.textContent = '0:00';
      rec.timer = setInterval(function(){
        rec.timeEl.textContent = fmtRecTime(Date.now() - rec.startTs);
        if (Date.now() - rec.startTs > 5 * 60 * 1000) diaryVoiceStop(rec);   /* 5-min cap */
      }, 250);
    }).catch(function(err){
      console.error('[T7 Home] mic', err);
      var name = err && err.name;
      var msg;
      if (name === 'NotAllowedError' || name === 'SecurityError')
        msg = 'Der Zugriff aufs Mikrofon wurde blockiert. Erlaube das Mikrofon in den Browser-Einstellungen (bei Safari: Einstellungen › Websites › Mikrofon) — oder tippe deinen Eintrag.';
      else if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
        msg = 'Es wurde kein Mikrofon gefunden. Bitte tippe deinen Eintrag.';
      else
        msg = 'Mikrofon nicht verfügbar. Bitte tippe deinen Eintrag.';
      alert(msg);
    });
  }
  function diaryVoiceStop(rec){
    if (rec.mr && rec.mr.state !== 'inactive') { try { rec.mr.stop(); } catch(e){} }
    rec.btn.classList.remove('recording');
    if (rec.timer) { clearInterval(rec.timer); rec.timer = null; }
    rec.timeEl.hidden = true;
  }
  function makeDiaryRecorder(col, profileId){
    var wrap = $(col === 'good' ? 'diaryVoiceGood' : 'diaryVoiceWatch');
    if (!wrap) return null;
    var rec = {
      col: col, wrap: wrap, profileId: profileId,
      btn:      wrap.querySelector('.diary-voice-btn'),
      txtEl:    wrap.querySelector('.diary-voice-txt'),
      timeEl:   wrap.querySelector('.diary-voice-time'),
      playerEl: wrap.querySelector('.diary-voice-player'),
      audioEl:  wrap.querySelector('.diary-voice-audio'),
      delEl:    wrap.querySelector('.diary-voice-del'),
      mr: null, chunks: [], stream: null, timer: null, startTs: 0, chosenMime: '',
      pendingBlob: null, pendingMime: '', audioId: null, removed: false, previewUrl: null
    };
    if (!diaryVoiceSupported) { wrap.hidden = true; return rec; }
    rec.btn.addEventListener('click', function(){
      if (rec.btn.classList.contains('recording')) diaryVoiceStop(rec);
      else diaryVoiceStart(rec);
    });
    rec.delEl.addEventListener('click', function(){
      if (rec.pendingBlob) {
        /* Unsaved take — just drop it. */
        rec.pendingBlob = null;
        rec.removed = false;
        diaryVoiceClearPreview(rec);
        return;
      }
      if (rec.audioId) {
        /* Already saved — delete now so it actually sticks, no
           separate save needed. */
        if (!confirm('Diese Aufnahme wirklich löschen?')) return;
        rec.audioId = null;
        rec.removed = false;
        diaryVoiceClearPreview(rec);
        removeDiaryAudioFromEntry(rec.profileId, todayISO(), rec.col);
      } else {
        diaryVoiceClearPreview(rec);
      }
    });
    return rec;
  }
  function diaryRecorderReset(rec){
    if (!rec) return;
    diaryVoiceStop(rec);
    stopStream(rec);
    rec.pendingBlob = null; rec.pendingMime = '';
    rec.audioId = null; rec.removed = false;
    diaryVoiceClearPreview(rec);
  }
  function diaryRecorderLoadExisting(rec, audioId){
    if (!rec || !audioId) return;
    rec.audioId = audioId;
    rec.removed = false;
    diaryAudioGet(audioId).then(function(recd){
      if (recd && recd.blob) diaryVoiceSetPreview(rec, recd.blob);
    }).catch(function(){});
  }
  /* Resolve which audio id to persist for a column at save time. */
  function diaryResolveColumnAudio(profileId, rec){
    if (!rec) return Promise.resolve(null);
    if (rec.pendingBlob) {
      var newId = uuid();
      var oldId = rec.audioId;
      return diaryAudioPut({
        id: newId, profile_id: profileId, blob: rec.pendingBlob,
        mime_type: rec.pendingMime || 'audio/webm', created_at: new Date().toISOString()
      }).then(function(){
        if (oldId && oldId !== newId) diaryAudioDelete(oldId);
        rec.audioId = newId; rec.pendingBlob = null; rec.removed = false;
        return newId;
      });
    }
    if (rec.removed) {
      var old = rec.audioId;
      rec.audioId = null; rec.removed = false;
      if (old) return diaryAudioDelete(old).then(function(){ return null; });
      return Promise.resolve(null);
    }
    return Promise.resolve(rec.audioId || null);
  }

  /* Remove a saved voice note from an entry immediately (used by the
     delete buttons in both the input area and the feed).  If the entry
     is left completely empty, it's dropped. */
  function removeDiaryAudioFromEntry(profileId, entryDate, col){
    var field = col === 'good' ? 'good_audio_id' : 'watch_audio_id';
    var entries = diaryRead(profileId);
    var delId = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].entry_date !== entryDate) continue;
      var e = entries[i];
      delId = e[field] || null;
      e[field] = null;
      e.updated_at = new Date().toISOString();
      var empty = !(e.good_text || '').trim() && !(e.watch_text || '').trim() &&
                  !e.good_audio_id && !e.watch_audio_id;
      if (empty) entries.splice(i, 1);
      break;
    }
    if (delId) diaryAudioDelete(delId);
    diaryWrite(profileId, entries);
    renderDiaryFeed(profileId);
  }


  function formatDiaryDate(s){
    if (!s) return { pretty: '', weekday: '' };
    var d = new Date(s + 'T00:00:00');
    if (isNaN(d)) return { pretty: s, weekday: '' };
    var months   = ['Jan.','Feb.','März','Apr.','Mai','Juni','Juli','Aug.','Sept.','Okt.','Nov.','Dez.'];
    var weekdays = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    return {
      pretty:  d.getDate() + '. ' + months[d.getMonth()] + ' ' + d.getFullYear(),
      weekday: weekdays[d.getDay()]
    };
  }

  /* Teaser subtitle on the collapsed home-page card — entry
     count + most recent date, so players see at a glance
     whether they've written today without opening the modal. */
  function updateDiaryTeaser(entries){
    var el = $('diaryTeaserSub');
    if (!el) return;
    if (!entries.length) {
      el.textContent = 'Noch keine Einträge — schreib deinen ersten.';
      return;
    }
    var latest = formatDiaryDate(entries[0].entry_date);  /* entries sorted newest first */
    el.textContent = entries.length + (entries.length === 1 ? ' Eintrag' : ' Einträge') +
      (latest.pretty ? ' · Zuletzt ' + latest.pretty : '');
  }

  function renderDiaryFeed(profileId){
    var feed = $('diaryFeed');
    if (!feed) return;
    var entries = diaryRead(profileId);
    updateDiaryTeaser(entries);
    var today = todayISO();
    var past  = entries.filter(function(e){ return e.entry_date !== today; });

    freeDiaryAudioUrls();
    if (!past.length) {
      feed.innerHTML = '<div class="diary-empty">Noch keine früheren Einträge. Fang heute an.</div>';
      return;
    }

    var ids = [];
    past.forEach(function(e){
      if (e.good_audio_id)  ids.push(e.good_audio_id);
      if (e.watch_audio_id) ids.push(e.watch_audio_id);
    });

    loadDiaryAudioUrls(ids).then(function(urls){
      feed.innerHTML = past.map(function(r){
        var d = formatDiaryDate(r.entry_date);
        return '' +
          '<div class="diary-entry">' +
            '<div class="diary-entry-date">' + esc(d.pretty) +
              '<span class="weekday">' + esc(d.weekday) + '</span>' +
            '</div>' +
            '<div class="diary-entry-cols">' +
              diaryEntryColHtml('Was lief gut',  'good',  r.good_text,  r.good_audio_id,  urls, r.entry_date) +
              diaryEntryColHtml('Worauf achten', 'watch', r.watch_text, r.watch_audio_id, urls, r.entry_date) +
            '</div>' +
          '</div>';
      }).join('');

      Array.prototype.forEach.call(feed.querySelectorAll('.diary-entry-audio-del'), function(b){
        b.addEventListener('click', function(){
          if (!confirm('Diese Aufnahme wirklich löschen?')) return;
          removeDiaryAudioFromEntry(profileId, b.dataset.date, b.dataset.col);
        });
      });
    });
  }

  function diaryEntryColHtml(label, cls, text, audioId, urls, entryDate){
    var t = (text || '').trim();
    var hasAudio = !!(audioId && urls[audioId]);
    var audio = hasAudio
      ? '<div class="diary-entry-audio-wrap">' +
          '<audio class="diary-entry-audio" controls preload="metadata" src="' + esc(urls[audioId]) + '"></audio>' +
          '<button type="button" class="diary-entry-audio-del" data-date="' + esc(entryDate) + '" data-col="' + esc(cls) + '" title="Aufnahme löschen" aria-label="Aufnahme löschen">✕</button>' +
        '</div>'
      : '';
    var textHtml;
    if (t)             textHtml = '<div class="diary-entry-col-text">' + esc(t) + '</div>';
    else if (hasAudio) textHtml = '';   /* audio-only entry — no placeholder needed */
    else               textHtml = '<div class="diary-entry-col-text empty">— kein Eintrag —</div>';
    return '<div class="diary-entry-col ' + cls + '">' +
        '<div class="diary-entry-col-label">' + esc(label) + '</div>' +
        textHtml + audio +
      '</div>';
  }

  function loadTodayDiary(profileId){
    /* Clean slate — clears text and recorder state (e.g. after import). */
    if ($('diaryGood'))  $('diaryGood').value  = '';
    if ($('diaryWatch')) $('diaryWatch').value = '';
    diaryRecorderReset(diaryRecorders.good);
    diaryRecorderReset(diaryRecorders.watch);

    var today = diaryGetByDate(profileId, todayISO());
    if (!today) return;
    if (today.good_text)  $('diaryGood').value  = today.good_text;
    if (today.watch_text) $('diaryWatch').value = today.watch_text;
    if (today.good_audio_id)  diaryRecorderLoadExisting(diaryRecorders.good,  today.good_audio_id);
    if (today.watch_audio_id) diaryRecorderLoadExisting(diaryRecorders.watch, today.watch_audio_id);
  }

  function saveDiary(profileId){
    var btn    = $('diarySave');
    var status = $('diarySaveStatus');
    var good   = $('diaryGood').value.trim();
    var watch  = $('diaryWatch').value.trim();
    var gRec   = diaryRecorders.good;
    var wRec   = diaryRecorders.watch;

    var gRecording = !!(gRec && gRec.btn && gRec.btn.classList.contains('recording'));
    var wRecording = !!(wRec && wRec.btn && wRec.btn.classList.contains('recording'));
    var hasGoodAudio  = !!(gRec && (gRec.pendingBlob || gRecording || (gRec.audioId && !gRec.removed)));
    var hasWatchAudio = !!(wRec && (wRec.pendingBlob || wRecording || (wRec.audioId && !wRec.removed)));

    if (!good && !watch && !hasGoodAudio && !hasWatchAudio) {
      status.textContent = 'Schreib oder sprich zuerst etwas auf.';
      status.classList.add('show', 'error');
      setTimeout(function(){ status.classList.remove('show', 'error'); }, 2200);
      return;
    }

    /* If a recording is still running, stop it so its audio is captured. */
    if (gRecording) diaryVoiceStop(gRec);
    if (wRecording) diaryVoiceStop(wRec);

    btn.disabled = true;
    status.classList.remove('error');
    status.textContent = 'Speichere…';
    status.classList.add('show');

    /* Small delay lets a just-stopped recorder assemble its blob. */
    setTimeout(function(){
      Promise.all([
        diaryResolveColumnAudio(profileId, gRec),
        diaryResolveColumnAudio(profileId, wRec)
      ]).then(function(ids){
        diaryUpsert(profileId, {
          entry_date:     todayISO(),
          good_text:      good  || null,
          watch_text:     watch || null,
          good_audio_id:  ids[0] || null,
          watch_audio_id: ids[1] || null,
          updated_at:     new Date().toISOString()
        });
        status.textContent = 'Gespeichert.';
        setTimeout(function(){ status.classList.remove('show'); }, 1800);
        renderDiaryFeed(profileId);
      }).catch(function(err){
        console.error('[T7 Home] diary save', err);
        status.textContent = 'Speichern fehlgeschlagen.';
        status.classList.add('error');
      }).then(function(){ btn.disabled = false; });
    }, (gRecording || wRecording) ? 180 : 0);
  }

  /* Export / Import — bundles the voice notes as base64 so a backup
     is self-contained and can be moved to another device. */
  function diaryExport(profileId){
    var entries = diaryRead(profileId);
    var uniq = {};
    entries.forEach(function(e){
      if (e.good_audio_id)  uniq[e.good_audio_id]  = true;
      if (e.watch_audio_id) uniq[e.watch_audio_id] = true;
    });
    return Promise.all(Object.keys(uniq).map(function(id){
      return diaryAudioGet(id).then(function(rec){
        if (!rec || !rec.blob) return null;
        return blobToB64(rec.blob).then(function(b64){
          return { id: id, mime_type: rec.mime_type || 'audio/webm', b64: b64 };
        });
      }).catch(function(){ return null; });
    })).then(function(audioList){
      var data = {
        kind:        't7-academy-diary',
        version:     2,
        exported_at: new Date().toISOString(),
        entries:     entries,
        audio:       audioList.filter(Boolean)
      };
      downloadJson(data, 't7-tagebuch-' + todayISO() + '.json');
      return entries.length;
    });
  }

  function diaryImport(profileId, file){
    return readJsonFile(file).then(function(data){
      if (!data || data.kind !== 't7-academy-diary' || !Array.isArray(data.entries)) {
        throw new Error('invalid file');
      }
      /* Restore voice notes first so entries that reference them work. */
      var audioArr = Array.isArray(data.audio) ? data.audio : [];
      return Promise.all(audioArr.map(function(a){
        if (!a || !a.id || !a.b64) return null;
        var blob = b64ToBlob(a.b64, a.mime_type || 'audio/webm');
        return diaryAudioPut({
          id: a.id, profile_id: profileId, blob: blob,
          mime_type: a.mime_type || 'audio/webm', created_at: new Date().toISOString()
        });
      })).then(function(){
        /* Merge entries: newer updated_at wins; otherwise keep current. */
        var existing = diaryRead(profileId);
        var byDate = {};
        existing.forEach(function(e){ byDate[e.entry_date] = e; });
        data.entries.forEach(function(e){
          if (!e || !e.entry_date) return;
          var cur = byDate[e.entry_date];
          var incomingTime = e.updated_at || '';
          var currentTime  = cur && cur.updated_at || '';
          if (!cur || incomingTime > currentTime) byDate[e.entry_date] = e;
        });
        var merged = Object.keys(byDate).map(function(k){ return byDate[k]; })
          .sort(function(a, b){ return (b.entry_date || '').localeCompare(a.entry_date || ''); });
        diaryWrite(profileId, merged);
        return merged.length;
      });
    });
  }

  function initDiary(profileId){
    /* Build the voice recorders before loading today's entry. */
    diaryRecorders.good  = makeDiaryRecorder('good', profileId);
    diaryRecorders.watch = makeDiaryRecorder('watch', profileId);

    var dateEl = $('diaryDate');
    if (dateEl) {
      var d = formatDiaryDate(todayISO());
      dateEl.innerHTML = 'Heute · <span style="font-style:normal;font-family:Antonio,sans-serif;font-weight:500;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--lp-faint)">' + esc(d.pretty) + '</span>';
    }
    loadTodayDiary(profileId);
    renderDiaryFeed(profileId);
    $('diarySave').addEventListener('click', function(){ saveDiary(profileId); });

    /* Export / Import wiring */
    var status = $('diaryActionsStatus');
    $('diaryExportBtn').addEventListener('click', function(){
      var btn = $('diaryExportBtn');
      btn.disabled = true;
      setStatus(status, 'Sichere…');
      diaryExport(profileId).then(function(n){
        setStatus(status, n + ' Einträge gespeichert', 'ok');
      }).catch(function(e){
        console.error('[T7 Home] diary export', e);
        setStatus(status, 'Export fehlgeschlagen', 'error');
      }).then(function(){ btn.disabled = false; });
    });
    var importInput = $('diaryImportInput');
    $('diaryImportBtn').addEventListener('click', function(){ importInput.click(); });
    importInput.addEventListener('change', function(){
      var f = importInput.files && importInput.files[0];
      if (!f) return;
      diaryImport(profileId, f).then(function(n){
        setStatus(status, n + ' Einträge wiederhergestellt', 'ok');
        loadTodayDiary(profileId);
        renderDiaryFeed(profileId);
      }).catch(function(err){
        console.error('[T7 Home] diary import', err);
        setStatus(status, 'Ungültige Datei', 'error');
      }).then(function(){ importInput.value = ''; });
    });
  }


  /* ============================================================
     MEINE ZIELE  →  localStorage
     Key:    t7_goals_v1__{profileId|anon}
     Shape:  [{ id, goal_text, due_date, progress, created_at, updated_at }, …]
     Local-only — same GDPR treatment as the diary.  Three columns:
     Ziel / Bis wann / Fortschritt.  Each saved goal keeps an inline
     progress control so it can be updated over time.
  ============================================================ */
  function goalsKey(profileId){
    return GOALS_KEY_PREFIX + (profileId || 'anon');
  }
  function goalsRead(profileId){
    try { return JSON.parse(localStorage.getItem(goalsKey(profileId))) || []; }
    catch(e){ return []; }
  }
  function goalsWrite(profileId, goals){
    localStorage.setItem(goalsKey(profileId), JSON.stringify(goals));
  }
  /* Incomplete goals first (soonest deadline first), completed last. */
  function goalsSorted(goals){
    return goals.slice().sort(function(a, b){
      var ac = Number(a.progress || 0) >= 100;
      var bc = Number(b.progress || 0) >= 100;
      if (ac !== bc) return ac ? 1 : -1;
      var ad = a.due_date || '9999-12-31';
      var bd = b.due_date || '9999-12-31';
      if (ad !== bd) return ad < bd ? -1 : 1;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }
  function goalsAdd(profileId, goal){
    var goals = goalsRead(profileId);
    goals.push(goal);
    goalsWrite(profileId, goals);
  }
  function goalsSetProgress(profileId, id, progress){
    var goals = goalsRead(profileId);
    for (var i = 0; i < goals.length; i++) {
      if (goals[i].id === id) {
        goals[i].progress   = progress;
        goals[i].updated_at = new Date().toISOString();
        break;
      }
    }
    goalsWrite(profileId, goals);
  }
  function goalsDelete(profileId, id){
    goalsWrite(profileId, goalsRead(profileId).filter(function(g){ return g.id !== id; }));
  }

  function formatGoalDate(s){
    if (!s) return '';
    var d = new Date(s + 'T00:00:00');
    if (isNaN(d)) return s;
    var months = ['Jan.','Feb.','März','Apr.','Mai','Juni','Juli','Aug.','Sept.','Okt.','Nov.','Dez.'];
    return d.getDate() + '. ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* Teaser subtitle on the collapsed "Meine Ziele" card. */
  function updateGoalsTeaser(goals){
    var el = $('goalsTeaserSub');
    if (!el) return;
    if (!goals.length) {
      el.textContent = 'Noch keine Ziele — setz dir dein erstes.';
      return;
    }
    var done = goals.filter(function(g){ return Number(g.progress || 0) >= 100; }).length;
    el.textContent = goals.length + (goals.length === 1 ? ' Ziel' : ' Ziele') + ' · ' + done + ' erreicht';
  }

  var GOAL_STEPS = [0, 25, 50, 75, 100];
  function goalProgressSelect(id, current){
    var opts = GOAL_STEPS.map(function(v){
      return '<option value="' + v + '"' + (v === current ? ' selected' : '') + '>' + v + ' %</option>';
    }).join('');
    return '<select class="goal-prog-set" data-id="' + esc(id) + '" aria-label="Fortschritt ändern">' + opts + '</select>';
  }

  function renderGoalsFeed(profileId){
    var feed = $('goalsFeed');
    if (!feed) return;
    var goals = goalsSorted(goalsRead(profileId));
    updateGoalsTeaser(goals);

    if (!goals.length) {
      feed.innerHTML = '<div class="goals-empty">Noch keine Ziele. Setz dir dein erstes und verfolge, wie du näher kommst.</div>';
      return;
    }

    var today = todayISO();
    feed.innerHTML = goals.map(function(g){
      var progress = Math.max(0, Math.min(100, Number(g.progress || 0)));
      var done     = progress >= 100;
      var overdue  = g.due_date && g.due_date < today && !done;
      var whenText = g.due_date ? formatGoalDate(g.due_date) : '— offen —';
      var whenCls  = 'goal-when' + (g.due_date ? (overdue ? ' overdue' : '') : ' none');
      return '' +
        '<div class="goal-entry' + (done ? ' done' : '') + '" data-id="' + esc(g.id) + '">' +
          '<div class="goal-cell goal-cell-goal">' +
            '<div class="goal-cell-label">Ziel</div>' +
            '<div class="goal-text">' + (done ? '<span class="goal-check">\u2713</span>' : '') + esc(g.goal_text || '') + '</div>' +
          '</div>' +
          '<div class="goal-cell goal-cell-when">' +
            '<div class="goal-cell-label">Bis wann</div>' +
            '<div class="' + whenCls + '">' + esc(whenText) + (overdue ? ' \u26A0' : '') + '</div>' +
          '</div>' +
          '<div class="goal-cell goal-cell-prog">' +
            '<div class="goal-cell-label">Fortschritt</div>' +
            '<div class="goal-prog">' +
              '<div class="goal-prog-top">' +
                '<span class="goal-prog-pct">' + progress + ' %</span>' +
                goalProgressSelect(g.id, progress) +
              '</div>' +
              '<div class="po-bar"><div class="po-bar-fill green" style="width:' + progress + '%"></div></div>' +
            '</div>' +
          '</div>' +
          '<button class="goal-del" data-id="' + esc(g.id) + '" title="Ziel löschen">\u2715</button>' +
        '</div>';
    }).join('');

    Array.prototype.forEach.call(feed.querySelectorAll('.goal-prog-set'), function(sel){
      sel.addEventListener('change', function(){
        goalsSetProgress(profileId, sel.dataset.id, Number(sel.value));
        renderGoalsFeed(profileId);
      });
    });
    Array.prototype.forEach.call(feed.querySelectorAll('.goal-del'), function(b){
      b.addEventListener('click', function(){
        if (!confirm('Dieses Ziel wirklich löschen?')) return;
        goalsDelete(profileId, b.dataset.id);
        renderGoalsFeed(profileId);
      });
    });
  }

  function saveGoal(profileId){
    var btn    = $('goalSave');
    var status = $('goalSaveStatus');
    var text   = $('goalText').value.trim();
    var when   = $('goalWhen').value || null;
    var prog   = Number($('goalProgress').value || 0);
    if (!text) {
      status.textContent = 'Schreib zuerst ein Ziel auf.';
      status.classList.add('show', 'error');
      setTimeout(function(){ status.classList.remove('show', 'error'); }, 2200);
      return;
    }
    btn.disabled = true;
    status.classList.remove('error');
    status.textContent = 'Speichere…';
    status.classList.add('show');

    try {
      var now = new Date().toISOString();
      goalsAdd(profileId, {
        id:         uuid(),
        goal_text:  text,
        due_date:   when,
        progress:   prog,
        created_at: now,
        updated_at: now
      });
      $('goalText').value     = '';
      $('goalWhen').value     = '';
      $('goalProgress').value = '0';
      status.textContent = 'Hinzugefügt.';
      setTimeout(function(){ status.classList.remove('show'); }, 1800);
      renderGoalsFeed(profileId);
    } catch(err) {
      console.error('[T7 Home] goal save', err);
      status.textContent = 'Speichern fehlgeschlagen.';
      status.classList.add('error');
    }
    btn.disabled = false;
  }

  /* Export / Import */
  function goalsExport(profileId){
    var data = {
      kind:        't7-academy-goals',
      version:     1,
      exported_at: new Date().toISOString(),
      goals:       goalsRead(profileId)
    };
    downloadJson(data, 't7-ziele-' + todayISO() + '.json');
    return data.goals.length;
  }

  function goalsImport(profileId, file){
    return readJsonFile(file).then(function(data){
      if (!data || data.kind !== 't7-academy-goals' || !Array.isArray(data.goals)) {
        throw new Error('invalid file');
      }
      /* Merge by id: newer updated_at wins; unknown ids are added. */
      var existing = goalsRead(profileId);
      var byId = {};
      existing.forEach(function(g){ if (g && g.id) byId[g.id] = g; });
      data.goals.forEach(function(g){
        if (!g || !g.id) return;
        var cur = byId[g.id];
        var incomingTime = g.updated_at || '';
        var currentTime  = cur && cur.updated_at || '';
        if (!cur || incomingTime > currentTime) byId[g.id] = g;
      });
      var merged = Object.keys(byId).map(function(k){ return byId[k]; });
      goalsWrite(profileId, merged);
      return merged.length;
    });
  }

  function initGoals(profileId){
    renderGoalsFeed(profileId);
    var save = $('goalSave');
    if (save) save.addEventListener('click', function(){ saveGoal(profileId); });

    var status = $('goalsActionsStatus');
    var exportBtn = $('goalsExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', function(){
      try {
        var n = goalsExport(profileId);
        setStatus(status, n + (n === 1 ? ' Ziel gesichert' : ' Ziele gesichert'), 'ok');
      } catch(e) {
        console.error('[T7 Home] goals export', e);
        setStatus(status, 'Export fehlgeschlagen', 'error');
      }
    });
    var importInput = $('goalsImportInput');
    var importBtn   = $('goalsImportBtn');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', function(){ importInput.click(); });
      importInput.addEventListener('change', function(){
        var f = importInput.files && importInput.files[0];
        if (!f) return;
        goalsImport(profileId, f).then(function(n){
          setStatus(status, n + (n === 1 ? ' Ziel wiederhergestellt' : ' Ziele wiederhergestellt'), 'ok');
          renderGoalsFeed(profileId);
        }).catch(function(err){
          console.error('[T7 Home] goals import', err);
          setStatus(status, 'Ungültige Datei', 'error');
        }).then(function(){ importInput.value = ''; });
      });
    }
  }


  /* ============================================================
     CLIPS  →  IndexedDB
     DB:     t7-academy
     Store:  clips  (keyPath: 'id')
     Record: { id, profile_id, title, blob, mime_type, size_bytes, created_at }
  ============================================================ */
  function idbOpen(){
    return new Promise(function(resolve, reject){
      var req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = function(){
        var db = req.result;
        if (!db.objectStoreNames.contains(CLIPS_STORE)) {
          db.createObjectStore(CLIPS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(DIARY_AUDIO_STORE)) {
          db.createObjectStore(DIARY_AUDIO_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror   = function(){ reject(req.error); };
      req.onblocked = function(){ console.warn('[T7 Home] IndexedDB upgrade blocked — close other tabs.'); };
    });
  }

  function clipsList(profileId){
    return idbOpen().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(CLIPS_STORE, 'readonly');
        var req = tx.objectStore(CLIPS_STORE).getAll();
        req.onsuccess = function(){
          var rows = (req.result || []).filter(function(c){
            return c.profile_id === profileId;
          });
          rows.sort(function(a, b){ return (b.created_at || '').localeCompare(a.created_at || ''); });
          resolve(rows);
        };
        req.onerror = function(){ reject(req.error); };
      });
    });
  }

  function clipsPut(record){
    return idbOpen().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(CLIPS_STORE, 'readwrite');
        tx.objectStore(CLIPS_STORE).put(record);
        tx.oncomplete = function(){ resolve(record); };
        tx.onerror    = function(){ reject(tx.error); };
      });
    });
  }

  function clipsDelete(id){
    return idbOpen().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(CLIPS_STORE, 'readwrite');
        tx.objectStore(CLIPS_STORE).delete(id);
        tx.oncomplete = function(){ resolve(); };
        tx.onerror    = function(){ reject(tx.error); };
      });
    });
  }

  /* Map of clipId → object URL, kept alive while the list is rendered.
     We revoke them all before re-rendering. */
  var clipUrls = {};
  function freeClipUrls(){
    Object.keys(clipUrls).forEach(function(k){ URL.revokeObjectURL(clipUrls[k]); });
    clipUrls = {};
  }

  function fmtDateShort(s){
    if (!s) return '';
    var d = new Date(s);
    if (isNaN(d)) return s;
    return d.toLocaleDateString('de-AT', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* Teaser subtitle on the collapsed home-page card — clip
     count, so players see the size of their repository without
     opening the modal. */
  function updateMyvidsTeaser(count, profileId){
    var el = $('myvidsTeaserSub');
    if (!el) return;
    if (!profileId) {
      el.textContent = 'Anmelden, um eigene Videos zu sehen.';
      return;
    }
    el.textContent = count > 0
      ? (count + (count === 1 ? ' Video gespeichert' : ' Videos gespeichert'))
      : 'Noch keine Videos — jetzt das erste hochladen.';
  }

  function renderClips(profileId){
    var list = $('myvidsList');
    if (!list) return;
    if (!profileId) {
      list.innerHTML = '<div class="myvids-empty">Anmelden, um eigene Videos zu sehen.</div>';
      updateMyvidsTeaser(0, profileId);
      return;
    }
    freeClipUrls();
    clipsList(profileId).then(function(rows){
      updateMyvidsTeaser(rows.length, profileId);
      if (!rows.length) {
        list.innerHTML = '<div class="myvids-empty">Noch keine Videos. Lade dein erstes Match oder Training hoch.</div>';
        return;
      }
      list.innerHTML = rows.map(function(c){
        var url = URL.createObjectURL(c.blob);
        clipUrls[c.id] = url;
        return '' +
          '<div class="myvid-card" data-id="' + esc(c.id) + '">' +
            '<div class="myvid-thumb" data-id="' + esc(c.id) + '">' +
              '<video src="' + esc(url) + '#t=0.1" preload="metadata" muted playsinline></video>' +
              '<div class="myvid-play"></div>' +
            '</div>' +
            '<div class="myvid-meta">' +
              '<div class="myvid-title">' + esc(c.title || 'Eigenes Video') + '</div>' +
              '<div class="myvid-date">' + esc(fmtDateShort(c.created_at)) + '</div>' +
            '</div>' +
            '<button class="myvid-del" data-id="' + esc(c.id) + '" title="Löschen">✕ Löschen</button>' +
          '</div>';
      }).join('');

      Array.prototype.forEach.call(list.querySelectorAll('.myvid-thumb'), function(t){
        t.addEventListener('click', function(){
          var url = clipUrls[t.dataset.id];
          if (url) openClipPlayer(url);
        });
      });
      Array.prototype.forEach.call(list.querySelectorAll('.myvid-del'), function(b){
        b.addEventListener('click', function(){
          if (!confirm('Dieses Video wirklich löschen?')) return;
          clipsDelete(b.dataset.id).then(function(){ renderClips(profileId); });
        });
      });
    }).catch(function(err){
      console.error('[T7 Home] clips list', err);
      list.innerHTML = '<div class="myvids-empty">Fehler beim Laden der Videos.</div>';
    });
  }

  function openClipPlayer(url){
    var ov = document.createElement('div');
    ov.className = 'myvid-overlay';
    ov.innerHTML =
      '<button class="myvid-overlay-close" aria-label="Schließen">✕</button>' +
      '<video src="' + esc(url) + '" controls autoplay playsinline></video>';
    var close = function(){ document.body.removeChild(ov); };
    ov.addEventListener('click', function(e){ if (e.target === ov) close(); });
    ov.querySelector('.myvid-overlay-close').addEventListener('click', close);
    var escListener = function(e){ if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escListener); } };
    document.addEventListener('keydown', escListener);
    document.body.appendChild(ov);
  }

  function uploadClipLocal(profileId, file){
    var progressWrap = $('myvidsProgress');
    var progressFill = $('myvidsProgressFill');
    var progressLbl  = $('myvidsProgressLabel');
    progressWrap.hidden = false;
    progressFill.style.width = '100%';       /* IDB write is fast — no real progress to show */
    progressLbl.textContent = 'Speichere…';

    var title = file.name.replace(/\.[^.]+$/, '').slice(0, 80);
    var record = {
      id:          uuid(),
      profile_id:  profileId,
      title:       title,
      blob:        file,                     /* IDB stores Blobs natively */
      mime_type:   file.type || 'video/mp4',
      size_bytes:  file.size,
      created_at:  new Date().toISOString()
    };
    return clipsPut(record);
  }

  /* Export ALL clips for the current profile as one JSON file with
     base64-encoded blobs.  Note: this can be large — base64 inflates
     by ~33%, and the whole thing is held in memory during download. */
  function blobToB64(blob){
    return new Promise(function(resolve, reject){
      var r = new FileReader();
      r.onload  = function(){
        var s = r.result;
        resolve(s.slice(s.indexOf(',') + 1));
      };
      r.onerror = function(){ reject(r.error); };
      r.readAsDataURL(blob);
    });
  }
  function b64ToBlob(b64, mime){
    var bin   = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'video/mp4' });
  }

  function clipsExport(profileId){
    return clipsList(profileId).then(function(rows){
      if (!rows.length) {
        return { count: 0, data: null };
      }
      return Promise.all(rows.map(function(c){
        return blobToB64(c.blob).then(function(b64){
          return {
            id:         c.id,
            title:      c.title,
            mime_type:  c.mime_type,
            size_bytes: c.size_bytes,
            created_at: c.created_at,
            blob_b64:   b64
          };
        });
      })).then(function(serializable){
        var data = {
          kind:        't7-academy-clips',
          version:     1,
          exported_at: new Date().toISOString(),
          clips:       serializable
        };
        downloadJson(data, 't7-videos-' + todayISO() + '.json');
        return { count: rows.length, data: data };
      });
    });
  }

  function clipsImport(profileId, file){
    return readJsonFile(file).then(function(data){
      if (!data || data.kind !== 't7-academy-clips' || !Array.isArray(data.clips)) {
        throw new Error('invalid file');
      }
      return Promise.all(data.clips.map(function(c){
        if (!c.id || !c.blob_b64) return null;
        var blob = b64ToBlob(c.blob_b64, c.mime_type);
        return clipsPut({
          id:          c.id,
          profile_id:  profileId,    /* claim imported clips for current user */
          title:       c.title || 'Importiertes Video',
          blob:        blob,
          mime_type:   c.mime_type,
          size_bytes:  c.size_bytes || blob.size,
          created_at:  c.created_at  || new Date().toISOString()
        });
      })).then(function(){ return data.clips.length; });
    });
  }

  function initMyVideos(profileId){
    var input = $('myvidsInput');
    var wrap  = $('myvidsUpload');
    if (!input || !wrap) return;

    renderClips(profileId);

    if (!profileId) {
      wrap.style.opacity = .5;
      wrap.style.pointerEvents = 'none';
      $('clipsExportBtn').disabled = true;
      $('clipsImportBtn').disabled = true;
      return;
    }

    input.addEventListener('change', function(){
      var files = input.files ? Array.prototype.slice.call(input.files) : [];
      if (!files.length) return;

      var tooBig = files.filter(function(f){ return f.size > 200 * 1024 * 1024; });
      var toUpload = files.filter(function(f){ return f.size <= 200 * 1024 * 1024; });
      if (tooBig.length) {
        alert(tooBig.length === 1
          ? 'Ein Video ist zu groß (max. 200 MB) und wird übersprungen.'
          : tooBig.length + ' Videos sind zu groß (max. 200 MB) und werden übersprungen.');
      }
      if (!toUpload.length) { input.value = ''; return; }

      var progressWrap  = $('myvidsProgress');
      var progressLabel = $('myvidsProgressLabel');
      progressWrap.hidden = false;

      var i = 0;
      function next(){
        if (i >= toUpload.length) {
          progressWrap.hidden = true;
          input.value = '';
          renderClips(profileId);
          return;
        }
        progressLabel.textContent = toUpload.length > 1
          ? 'Speichere ' + (i + 1) + ' / ' + toUpload.length + '…'
          : 'Speichere…';
        uploadClipLocal(profileId, toUpload[i]).then(function(){
          i++;
          next();
        }).catch(function(err){
          console.error('[T7 Home] clip save', err);
          progressLabel.textContent = 'Speichern fehlgeschlagen.';
          setTimeout(function(){ i++; next(); }, 1200);
        });
      }
      next();
    });

    /* Export / Import wiring */
    var status = $('clipsActionsStatus');
    $('clipsExportBtn').addEventListener('click', function(){
      var btn = $('clipsExportBtn');
      btn.disabled = true;
      setStatus(status, 'Sichere…');
      clipsExport(profileId).then(function(res){
        if (!res.count) setStatus(status, 'Keine Videos zum Sichern', 'error');
        else            setStatus(status, res.count + ' Videos gesichert', 'ok');
      }).catch(function(err){
        console.error('[T7 Home] clips export', err);
        setStatus(status, 'Export fehlgeschlagen', 'error');
      }).then(function(){ btn.disabled = false; });
    });
    var importInput = $('clipsImportInput');
    $('clipsImportBtn').addEventListener('click', function(){ importInput.click(); });
    importInput.addEventListener('change', function(){
      var f = importInput.files && importInput.files[0];
      if (!f) return;
      var btn = $('clipsImportBtn');
      btn.disabled = true;
      setStatus(status, 'Wiederherstellen…');
      clipsImport(profileId, f).then(function(n){
        setStatus(status, n + ' Videos wiederhergestellt', 'ok');
        renderClips(profileId);
      }).catch(function(err){
        console.error('[T7 Home] clips import', err);
        setStatus(status, 'Ungültige Datei', 'error');
      }).then(function(){
        btn.disabled = false;
        importInput.value = '';
      });
    });
  }


  /* ============================================================
     NEWS FEED — Google Sheet CSV (absorbed from loadNews.js)
  ============================================================ */
  function parseCSV(text){
    var rows = [], row = [], field = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { inQ = false; }
        else { field += c; }
      } else {
        if (c === '"') { inQ = true; }
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c !== '\r') { field += c; }
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    var header = (rows.shift() || []).map(function(h){ return String(h).trim().toLowerCase(); });
    return rows
      .filter(function(r){ return r.some(function(v){ return v && String(v).trim(); }); })
      .map(function(r){
        var o = {};
        header.forEach(function(h, i){ o[h] = (r[i] == null ? '' : String(r[i])).trim(); });
        return o;
      });
  }

  function parseDateLoose(s){
    if (!s) return 0;
    s = String(s).trim();
    var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime();
    var de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (de) return new Date(+de[3], +de[2] - 1, +de[1]).getTime();
    var d = new Date(s);
    return isNaN(d) ? 0 : d.getTime();
  }

  function renderNewsCard(it){
    var dateText = '';
    if (it.date) {
      var t = parseDateLoose(it.date);
      dateText = t ? new Date(t).toLocaleDateString('de-AT', { day: '2-digit', month: 'short', year: 'numeric' }) : it.date;
    }
    var thumb = it.image
      ? '<div class="news-thumb"><img src="' + esc(it.image) + '" alt=""></div>'
      : '<div class="news-thumb">' + esc(it.emoji || '\u2728') + '</div>';
    return '<a href="' + esc(it.link || '#') + '" class="news-card">' +
        thumb +
        '<div class="news-body">' +
          '<div class="news-date">' + esc(dateText) + '</div>' +
          '<div class="news-title">' + esc(it.title) + '</div>' +
          (it.excerpt ? '<div class="news-excerpt">' + esc(it.excerpt) + '</div>' : '') +
        '</div>' +
      '</a>';
  }

  function renderNewsFallback(el){
    var items = [
      { date: '14. Mai 2026', title: 'Neue Challenges sind online!',  excerpt: 'Schau dir die brandneuen First Touch Air und Ginga Advanced Challenges an.', link: 'https://www.laureo.at/challenges/', emoji: '\u26A1' },
      { date: '10. Mai 2026', title: '1-Sterne Zertifikate verfügbar', excerpt: 'Vom 1-Stern bis zum 5-Sterne Zertifikat — zeige was du wirklich drauf hast.',   link: 'https://www.laureo.at/challenges/', emoji: '\u2B50' },
      { date: '5. Mai 2026',  title: 'Wochen-Streak Belohnungen',      excerpt: 'Sammle XP und steige in der Rangliste auf — jede Woche zählt.',                link: 'https://www.laureo.at/challenges/', emoji: '🔥' },
      { date: '1. Mai 2026',  title: 'Willkommen zur T7 Academy',      excerpt: 'Werde der beste Spieler, der du sein kannst — mit Plan und Leidenschaft.',    link: 'https://www.laureo.at/',           emoji: '⚽' }
    ];
    el.innerHTML = items.map(renderNewsCard).join('');
  }

  function loadNews(){
    var el = $('news-feed');
    if (!el) return;
    if (!NEWS_CSV_URL || NEWS_CSV_URL.indexOf('PASTE_') === 0) { renderNewsFallback(el); return; }
    var url = NEWS_CSV_URL + (NEWS_CSV_URL.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now();
    fetch(url).then(function(r){
      if (!r.ok) throw new Error('http ' + r.status);
      return r.text();
    }).then(function(csv){
      var items = parseCSV(csv)
        .filter(function(it){
          if (!it.title) return false;
          var p = (it.published || '').toLowerCase();
          return p !== 'no' && p !== 'false' && p !== '0';
        })
        .sort(function(a, b){ return parseDateLoose(b.date) - parseDateLoose(a.date); });
      if (!items.length) { renderNewsFallback(el); return; }
      el.innerHTML = items.map(renderNewsCard).join('');
    }).catch(function(){ renderNewsFallback(el); });
  }


  /* ============================================================
     BOOT
  ============================================================ */
  var currentProfileId = null;

  function boot(){
    initThemeAndNav();
    initHomeModals();
    loadNews();

    whenIdentity(function(profileId){
      currentProfileId = profileId;
      initAvatar(profileId);
      initProgress(profileId);
      initMyVideos(profileId);
      initDiary(profileId);
      initGoals(profileId);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Public hook for debugging / manual refresh */
  window.T7Home = {
    reloadProgress: function(){ if (currentProfileId) initProgress(currentProfileId); },
    reloadClips:    function(){ if (currentProfileId) renderClips(currentProfileId); },
    reloadDiary:    function(){ if (currentProfileId) renderDiaryFeed(currentProfileId); },
    reloadGoals:    function(){ if (currentProfileId) renderGoalsFeed(currentProfileId); },
    reloadNews:     loadNews
  };
})();
