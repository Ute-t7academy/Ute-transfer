/* =========================================================================
   T7 Academy — shared video-gallery widget
   Powers the Sterne and Sevens pages from a single file.

   Usage (in the WordPress HTML block, after this script is loaded):

     T7Gallery.init({
       field: 'stars',                 // DB column + filter key ('stars' | 'sevens')
       emoji: '⭐',                     // repeated for the level label
       unit:  { one: 'Stern', many: 'Sterne' },
       order: 'stars.asc,nr.asc',      // Supabase ?order=
       grouping: 'value',              // 'value' (group by stars) | 'category'
       values: [1, 2, 3, 4, 5],        // value-grouping only
       cardHeader: 'category',         // card badge: 'category' | 'count'
       // category-grouping only:
       groupIcon: '⚽',
       categoryOrder: [...],           // fixed order; null/omitted = alphabetical
       categoryDisplay: { Sitdown: 'Sitdowns' },
       diffOrder: ['Einfach','Mittel','Schwierig']
     });

   The surrounding markup (nav, hero, controls, grid, modal) lives in the
   page and is identical across both pages.
   ========================================================================= */
(function (global) {
  'use strict';

  /* ---- Backend / asset endpoints (shared, identical on both pages) ------ */
  var SB_URL = 'https://qajjuhjmrtuomwrbxmpz.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';
  var ASSETS     = 'https://Ute-t7academy.github.io/Assets';
  var THUMB_BASE = ASSETS + '/thumbnails/';
  var THUMB_INDEX = ASSETS + '/thumbnail_index.json';

  /* ---- Icons ------------------------------------------------------------- */
  var ICON = {
    heart: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    bell:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
    moon:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    sun:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
  };

  /* ---- Small DOM / data helpers ----------------------------------------- */
  function $(id) { return document.getElementById(id); }

  function diffClass(d) {
    return d === 'Einfach' ? 'easy'
         : d === 'Mittel'  ? 'medium'
         : d === 'Schwierig' ? 'hard' : '';
  }

  // Normalise a JSONB value (array | JSON-string | scalar | null) to string[].
  function asArray(v) {
    if (v == null) return [];
    var arr = v;
    if (typeof v === 'string') {
      var t = v.trim();
      if (!t) return [];
      if (t.charAt(0) === '[' || t.charAt(0) === '{') {
        try { arr = JSON.parse(t); } catch (e) { arr = [t]; }
      } else { arr = [t]; }
    }
    if (!Array.isArray(arr)) arr = [arr];
    return arr
      .map(function (x) { return x == null ? '' : String(x).trim(); })
      .filter(function (x) { return x.length > 0; });
  }
  function firstOf(v) { var a = asArray(v); return a.length ? a[0] : ''; }

  // The "so_what → ultimate_goal" row, used on cards and in the modal.
  function subtitleHTML(v, cls) {
    var sw = firstOf(v.so_what), ug = firstOf(v.ultimate_goal), p = '';
    if (sw) p += '<span class="vsub-so-what">' + sw + '</span>';
    if (sw && ug) p += '<span class="vsub-arrow" aria-hidden="true">→</span>';
    if (ug) p += '<span class="vsub-goal">' + ug + '</span>';
    return '<div class="' + (cls || 'card-subtitles') + '">' + p + '</div>';
  }

  /* ---- Theme (dark/light) ----------------------------------------------- */
  function themeIcon(t) { return t === 'dark' ? ICON.moon : ICON.sun; }

  function initTheme() {
    var theme = localStorage.getItem('t7_theme') || 'dark';
    function apply(t) {
      document.documentElement.setAttribute('data-theme', t);
      document.body.setAttribute('data-theme', t);
    }
    apply(theme);
    var toggle = $('themeToggle');
    if (!toggle) return;
    toggle.innerHTML = themeIcon(theme);
    toggle.onclick = function () {
      theme = theme === 'dark' ? 'light' : 'dark';
      apply(theme);
      localStorage.setItem('t7_theme', theme);
      this.innerHTML = themeIcon(theme);
    };
  }

  /* ---- WordPress admin bar offset + nav shrink on scroll ---------------- */
  function initChrome() {
    var nav = document.querySelector('.topnav');
    if (!nav) return;
    var adminBar = $('wpadminbar');
    function updateNavTop() {
      nav.style.top = adminBar ? adminBar.offsetHeight + 'px' : '0px';
    }
    updateNavTop();
    global.addEventListener('resize', updateNavTop);
    global.addEventListener('scroll', function () {
      if (global.scrollY > 40) nav.classList.add('nav-shrunk');
      else nav.classList.remove('nav-shrunk');
    });
  }

  /* ======================================================================
     Gallery
     ====================================================================== */
  function initGallery(cfg) {
    var FIELD = cfg.field;
    var EMOJI = cfg.emoji;
    var GROUP_BY_CATEGORY = cfg.grouping === 'category';
    var CAT_DISPLAY = cfg.categoryDisplay || {};
    var CAT_ORDER = cfg.categoryOrder || null;

    function levelLabel(n) { return new Array(n + 1).join(EMOJI); }
    function unit(n) { return n > 1 ? cfg.unit.many : cfg.unit.one; }
    function levelText(n) { return levelLabel(n) + ' ' + n + ' ' + unit(n); }

    /* ---- State ---- */
    var allVideos = [], thumbnailIndex = {}, currentSearch = '';
    var currentFilter = 'all', currentDiff = 'all',
        currentCat = 'all', currentPersonal = 'all';
    var likedVideos       = JSON.parse(localStorage.getItem('t7_liked')     || '{}');
    var vorgemerkteVideos = JSON.parse(localStorage.getItem('t7_vormerken') || '{}');

    /* ---- Data loading ---- */
    fetch(THUMB_INDEX + '?v=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (idx) { thumbnailIndex = idx; load(); })
      .catch(function () { load(); });

    function load() {
      var url = SB_URL + '/rest/v1/videos?' + FIELD + '=not.is.null'
              + '&vimeo_code=not.is.null'
              + '&select=id,title_DE,vimeo_code,' + FIELD
              + ',category,difficulty,description,so_what,ultimate_goal'
              + '&order=' + cfg.order;
      fetch(url, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
        .then(function (r) { return r.json(); })
        .then(function (rows) { allVideos = rows || []; updateAvailableOptions(); render(); })
        .catch(function () {
          $('grid').innerHTML = '<div class="loading">Fehler beim Laden.</div>';
        });
    }

    /* ---- Personal filters (like / vormerken) ---- */
    global.toggleLike = function (id) {
      likedVideos[id] = !likedVideos[id];
      if (!likedVideos[id]) delete likedVideos[id];
      localStorage.setItem('t7_liked', JSON.stringify(likedVideos));
      var btn = document.querySelector('#card-' + id + ' .card-action-btn:first-child');
      if (btn) {
        btn.className = 'card-action-btn' + (likedVideos[id] ? ' liked' : '');
        btn.innerHTML = ICON.heart + ' Like';
      }
    };
    global.toggleVormerken = function (id) {
      vorgemerkteVideos[id] = !vorgemerkteVideos[id];
      if (!vorgemerkteVideos[id]) delete vorgemerkteVideos[id];
      localStorage.setItem('t7_vormerken', JSON.stringify(vorgemerkteVideos));
      var btn = document.querySelector('#card-' + id + ' .card-action-btn:last-child');
      if (btn) {
        btn.className = 'card-action-btn' + (vorgemerkteVideos[id] ? ' vorgemerkt' : '');
        btn.innerHTML = ICON.bell + ' Vormerken';
      }
    };

    /* ---- Rendering ---- */
    function makeCard(v, i) {
      var diff = diffClass(v.difficulty);
      var vimeoId  = v.vimeo_code ? v.vimeo_code.split('/')[0] : '';
      var thumbFile = (vimeoId && thumbnailIndex[vimeoId]) ? thumbnailIndex[vimeoId] : '';
      var thumbUrl = thumbFile ? THUMB_BASE + thumbFile.replace(/ /g, '%20') : '';
      var liked      = !!likedVideos[v.id];
      var vorgemerkt = !!vorgemerkteVideos[v.id];

      // Card badge: either the category, or the level count (stars/sevens).
      var badge = '';
      if (cfg.cardHeader === 'count') {
        if (v[FIELD]) badge = '<span class="card-cat">' + levelText(v[FIELD]) + '</span>';
      } else {
        if (v.category) badge = '<span class="card-cat">' + v.category + '</span>';
      }

      return '<div class="card" id="card-' + v.id + '">'
        + '<div class="card-thumb" onclick="openVideo(' + i + ')">'
        +   (thumbUrl ? '<img src="' + thumbUrl + '" alt="" onerror="this.remove()">' : '')
        +   '<div class="play-icon"></div>'
        + '</div>'
        + '<div class="card-title-bar" onclick="openVideo(' + i + ')">'
        +   '<div class="card-title-row">'
        +     '<div class="card-title">' + v.title_DE + '</div>'
        +     badge
        +   '</div>'
        +   '<div class="card-sub">'
        +     subtitleHTML(v, 'card-subtitles')
        +     (diff ? '<span class="card-diff-inline ' + diff + '">' + v.difficulty + '</span>' : '')
        +   '</div>'
        + '</div>'
        + '<div class="card-actions">'
        +   '<button class="card-action-btn' + (liked ? ' liked' : '') + '" onclick="toggleLike(\'' + v.id + '\')">' + ICON.heart + ' Like</button>'
        +   '<button class="card-action-btn' + (vorgemerkt ? ' vorgemerkt' : '') + '" onclick="toggleVormerken(\'' + v.id + '\')">' + ICON.bell + ' Vormerken</button>'
        + '</div>'
      + '</div>';
    }

    function groupBlock(titleHTML, items, filtered) {
      var html = '<div class="star-group"><div class="star-group-title">' + titleHTML
               + '</div><div class="star-group-grid">';
      items.forEach(function (v) { html += makeCard(v, filtered.indexOf(v)); });
      return html + '</div></div>';
    }

    // Order the categories present in `filtered` (fixed order + extras, or alpha).
    function orderedCategories(list) {
      var present = [];
      if (CAT_ORDER) {
        CAT_ORDER.forEach(function (c) {
          if (list.some(function (v) { return v.category === c; })) present.push(c);
        });
        list.forEach(function (v) {
          if (v.category && CAT_ORDER.indexOf(v.category) === -1
              && present.indexOf(v.category) === -1) present.push(v.category);
        });
      } else {
        list.forEach(function (v) {
          if (v.category && present.indexOf(v.category) === -1) present.push(v.category);
        });
        present.sort();
      }
      return present;
    }

    function render() {
      var filtered = allVideos.filter(function (v) {
        if (currentFilter !== 'all' && v[FIELD] != currentFilter) return false;
        if (currentDiff !== 'all' && v.difficulty !== currentDiff) return false;
        if (currentPersonal === 'liked' && !likedVideos[v.id]) return false;
        if (currentPersonal === 'vorgemerkt' && !vorgemerkteVideos[v.id]) return false;
        if (currentCat !== 'all' && v.category !== currentCat) return false;
        if (currentSearch &&
            v.title_DE.toLowerCase().indexOf(currentSearch.toLowerCase()) < 0) return false;
        return true;
      });

      // Category grouping needs an explicit sort; value grouping relies on
      // the query order (stars.asc, nr.asc).
      if (GROUP_BY_CATEGORY) {
        var diffOrder = cfg.diffOrder || [];
        filtered.sort(function (a, b) {
          var ca = CAT_ORDER ? CAT_ORDER.indexOf(a.category) : 0;
          var cb = CAT_ORDER ? CAT_ORDER.indexOf(b.category) : 0;
          if (ca === -1) ca = 999; if (cb === -1) cb = 999;
          if (ca !== cb) return ca - cb;
          var da = diffOrder.indexOf(a.difficulty), db = diffOrder.indexOf(b.difficulty);
          if (da === -1) da = 999; if (db === -1) db = 999;
          return da - db;
        });
      }

      global._filteredVideos = filtered;
      if (!filtered.length) {
        $('grid').innerHTML = '<div class="no-results">Keine Videos gefunden.</div>';
        return;
      }

      var html = '';
      if (GROUP_BY_CATEGORY) {
        orderedCategories(filtered).forEach(function (cat) {
          var group = filtered.filter(function (v) { return v.category === cat; });
          if (!group.length) return;
          var title = '<span class="title-stars">' + (cfg.groupIcon || '') + '</span> '
                    + (CAT_DISPLAY[cat] || cat);
          html += groupBlock(title, group, filtered);
        });
      } else {
        cfg.values.forEach(function (s) {
          var group = filtered.filter(function (v) { return v[FIELD] == s; });
          if (!group.length) return;
          var title = '<span class="title-stars">' + levelLabel(s) + '</span> '
                    + s + ' ' + unit(s);
          html += groupBlock(title, group, filtered);
        });
      }
      $('grid').innerHTML = html;
    }

    /* ---- Filter pills ---- */
    function updateAvailableOptions() {
      var levels = allVideos.map(function (v) { return v[FIELD]; });
      var diffs  = allVideos.map(function (v) { return v.difficulty; });

      // Rebuild category dropdown.
      var cats = orderedCategories(allVideos);
      var drop = $('pillDrop2');
      drop.querySelectorAll('[data-cat]:not([data-cat="all"])').forEach(function (b) { b.remove(); });
      cats.forEach(function (c) {
        var btn = document.createElement('button');
        btn.className = 'pill-option';
        btn.dataset.cat = c;
        btn.textContent = c;
        drop.appendChild(btn);
      });

      // Hide level/difficulty options that have no matching videos.
      document.querySelectorAll('#pillDrop1 .pill-option[data-level]').forEach(function (btn) {
        var s = btn.dataset.level, d = btn.dataset.diff;
        if (s === 'all' && d === 'all') return;
        var hasMatch = (s !== 'all' && d === 'all') ? levels.indexOf(parseInt(s, 10)) >= 0
                     : (s === 'all' && d !== 'all') ? diffs.indexOf(d) >= 0
                     : false;
        btn.style.display = hasMatch ? '' : 'none';
      });

      // Hide dividers whose whole section is now hidden.
      document.querySelectorAll('.pill-dropdown').forEach(function (dd) {
        dd.querySelectorAll('.pill-divider').forEach(function (div) {
          var next = div.nextElementSibling, allHidden = true;
          while (next && !next.classList.contains('pill-divider')) {
            if (next.style.display !== 'none') { allHidden = false; break; }
            next = next.nextElementSibling;
          }
          div.style.display = allHidden ? 'none' : '';
        });
      });
    }

    function setPillLabel(id, label, isDefault) {
      var t = $(id);
      t.innerHTML = label + ' <span class="pill-arrow"></span>';
      t.classList.toggle('has-active', !isDefault);
    }
    function closePills() {
      document.querySelectorAll('.pill-wrap').forEach(function (w) { w.classList.remove('open'); });
    }

    document.querySelectorAll('.pill-wrap').forEach(function (wrap) {
      wrap.querySelector('.pill-toggle').addEventListener('click', function (e) {
        e.stopPropagation();
        var wasOpen = wrap.classList.contains('open');
        closePills();
        if (!wasOpen) wrap.classList.add('open');
      });
    });
    document.addEventListener('click', closePills);
    document.querySelectorAll('.pill-dropdown').forEach(function (d) {
      d.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    // Level + difficulty
    $('pillDrop1').addEventListener('click', function (e) {
      var btn = e.target.closest('.pill-option'); if (!btn) return;
      document.querySelectorAll('#pillDrop1 .pill-option')
        .forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.dataset.level;
      currentDiff   = btn.dataset.diff;
      var isDefault = currentFilter === 'all' && currentDiff === 'all';
      setPillLabel('pillToggle1', isDefault ? 'Schwierigkeitsgrad' : btn.textContent.trim(), isDefault);
      closePills(); render();
    });
    // Category
    $('pillDrop2').addEventListener('click', function (e) {
      var btn = e.target.closest('.pill-option'); if (!btn) return;
      document.querySelectorAll('#pillDrop2 .pill-option')
        .forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      var isDefault = currentCat === 'all';
      setPillLabel('pillToggle2', isDefault ? 'Kategorien' : btn.textContent.trim(), isDefault);
      closePills(); render();
    });
    // Personal
    $('pillDrop3').addEventListener('click', function (e) {
      var btn = e.target.closest('.pill-option'); if (!btn) return;
      document.querySelectorAll('#pillDrop3 .pill-option')
        .forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentPersonal = btn.dataset.personal;
      var isDefault = currentPersonal === 'all';
      var toggle = $('pillToggle3');
      toggle.innerHTML = (isDefault ? 'Persönliche Filter' : btn.textContent.trim())
                       + ' <span class="pill-arrow"></span>';
      toggle.classList.remove('has-active', 'has-personal');
      if (!isDefault) toggle.classList.add('has-personal');
      closePills(); render();
    });

    $('searchInput').addEventListener('input', function () {
      currentSearch = this.value; render();
    });

    /* ---- Modal ---- */
    global.openVideo = function (idx) {
      var v = (global._filteredVideos || allVideos)[idx]; if (!v) return;
      var modal = $('modal');
      $('modalTitle').textContent = v.title_DE;

      // so_what → ultimate_goal row
      var subsEl = $('modalSubtitles');
      var sw = firstOf(v.so_what), ug = firstOf(v.ultimate_goal);
      if (sw || ug) {
        var sp = '';
        if (sw) sp += '<span class="vsub-so-what">' + sw + '</span>';
        if (sw && ug) sp += '<span class="vsub-arrow" aria-hidden="true">→</span>';
        if (ug) sp += '<span class="vsub-goal">' + ug + '</span>';
        subsEl.innerHTML = sp; subsEl.style.display = '';
      } else {
        subsEl.innerHTML = ''; subsEl.style.display = 'none';
      }

      // Vimeo embed
      var videoEl = $('modalVideo');
      if (v.vimeo_code) {
        var parts = v.vimeo_code.split('/');
        videoEl.innerHTML = '<iframe src="https://player.vimeo.com/video/' + parts[0]
          + (parts[1] ? '?h=' + parts[1] : '')
          + '" allow="autoplay; fullscreen" allowfullscreen></iframe>';
        videoEl.style.display = 'block';
      } else {
        videoEl.style.display = 'none'; videoEl.innerHTML = '';
      }

      // Meta tags
      var meta = '';
      if (v[FIELD])      meta += '<span class="meta-tag meta-stars">' + levelText(v[FIELD]) + '</span>';
      if (v.category)    meta += '<span class="meta-tag meta-cat">' + v.category + '</span>';
      if (v.difficulty)  meta += '<span class="meta-tag meta-diff">' + v.difficulty + '</span>';
      $('modalMeta').innerHTML = meta;

      // Description steps (Ablauf)
      var descEl = $('modalDesc');
      descEl.innerHTML = '';
      if (v.description) {
        try {
          var steps = typeof v.description === 'string' ? JSON.parse(v.description) : v.description;
          if (Array.isArray(steps) && steps.length) {
            descEl.innerHTML = '<div class="desc-section"><div class="desc-title">Ablauf</div><ul class="desc-list">'
              + steps.map(function (s) { return '<li>' + s + '</li>'; }).join('')
              + '</ul></div>';
          }
        } catch (e) { /* leave empty on malformed JSON */ }
      }

      modal.classList.add('open');
      modal.scrollTop = 0;
      document.body.style.overflow = 'hidden';
    };

    $('modalBack').onclick = function () {
      $('modal').classList.remove('open');
      $('modalVideo').innerHTML = '';
      document.body.style.overflow = '';
    };
  }

  /* ---- Public entry point ----------------------------------------------- */
  var started = false;
  function start(cfg) {
    if (started || !cfg) return;   // guard against double-init / missing config
    started = true;
    initTheme();
    initChrome();
    initGallery(cfg);
  }

  // Explicit API (optional): T7Gallery.init({ ... })
  global.T7Gallery = { init: start };

  // Preferred: the page sets `window.T7_CONFIG = { ... }` BEFORE this file
  // loads, and we boot once the DOM is ready. This is independent of script
  // order, so async/deferred loading (e.g. WordPress optimisers) can't break it.
  function boot() { start(global.T7_CONFIG); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
