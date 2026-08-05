/* ==========================================================================
   T7 Academy — OUTSIDE (pre-subscription) shared script
   --------------------------------------------------------------------------
   Powers the two outside landing pages:
     • T7-academy-home-outside  (marketing home)
     • Freemium                 (taster: stars + sevens 1-2 + skill-path)

   Sections:
     1. Early theme bootstrap  (runs synchronously, before DOMReady, to
                                avoid a flash-of-wrong-theme)
     2. Theme toggle           (used by BOTH outside pages)
     3. Freemium boot          (Supabase fetch, name + XP state, overview
                                card → section reveal, video modal, skill
                                path XP. Only runs if Freemium DOM exists.)

   Each block is feature-detected, so the same file is safe to include on
   any outside WordPress page — extra blocks are no-ops when their DOM
   isn't present.
   ========================================================================== */


/* ==========================================================================
   1. EARLY THEME BOOTSTRAP
   Applies the saved theme before DOMContentLoaded so WordPress or any
   downstream script can't trigger a flash. Wrapped in try/catch in case
   localStorage is unavailable (private browsing etc.).
   ========================================================================== */
(function () {
    try {
        var t = localStorage.getItem('t7_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', t);
        var setBody = function () {
            if (document.body) document.body.setAttribute('data-theme', t);
        };
        if (document.body) setBody();
        else document.addEventListener('DOMContentLoaded', setBody);
    } catch (e) { /* private mode etc. */ }
})();


(function () {
    'use strict';

    /* ======================================================================
       2. THEME TOGGLE (shared)
       Delegated capture-phase click handler. Works regardless of when the
       #themeToggle button is added to the DOM (e.g. lazy-rendered nav).
       ====================================================================== */
    function initThemeToggle() {
        var theme = (function () {
            try { return localStorage.getItem('t7_theme') || 'dark'; }
            catch (e) { return 'dark'; }
        })();

        var apply = function () {
            document.documentElement.setAttribute('data-theme', theme);
            if (document.body) document.body.setAttribute('data-theme', theme);
            var tog = document.getElementById('themeToggle');
            if (tog) tog.innerHTML = theme === 'dark' ? '☾' : '☀';
        };
        apply();

        document.addEventListener('click', function (e) {
            var t = e.target ? (e.target.closest ? e.target.closest('#themeToggle') : null) : null;
            if (!t) return;
            e.preventDefault();
            e.stopPropagation();
            theme = theme === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem('t7_theme', theme); } catch (err) { /* ignore */ }
            apply();
        }, true);
    }


    /* ======================================================================
       3. FREEMIUM PAGE LOGIC
       Self-contained. Only runs when Freemium-specific DOM is present (we
       look for #fmModal). Wrapped in its own initializer so the home-outside
       page never executes any of this.
       ====================================================================== */

    /* -- Configuration (Supabase) ------------------------------------------ */
    var SUPABASE_URL      = 'https://qajjuhjmrtuomwrbxmpz.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';

    /* -- localStorage keys ------------------------------------------------- */
    var KEY_NAME     = 't7_freemium_player_name';
    var KEY_XP       = 't7_freemium_xp';
    var KEY_PRACTICE = 't7_freemium_practice_counts';   /* { videoId: count } */
    var XP_PER_TRICK = 25;

    /* -- Player state (localStorage-backed) -------------------------------- */
    var State = {
        getName: function () { return localStorage.getItem(KEY_NAME) || ''; },
        setName: function (name) { localStorage.setItem(KEY_NAME, name); },
        clearName: function () { localStorage.removeItem(KEY_NAME); },
        getXP: function () { return parseInt(localStorage.getItem(KEY_XP) || '0', 10); },
        addXP: function (n) {
            var next = this.getXP() + n;
            localStorage.setItem(KEY_XP, String(next));
            return next;
        },
        getPracticeCounts: function () {
            try { return JSON.parse(localStorage.getItem(KEY_PRACTICE) || '{}'); }
            catch (e) { return {}; }
        },
        getPracticeCount: function (id) { return this.getPracticeCounts()[id] || 0; },
        incrementPractice: function (id) {
            var counts = this.getPracticeCounts();
            counts[id] = (counts[id] || 0) + 1;
            localStorage.setItem(KEY_PRACTICE, JSON.stringify(counts));
            return counts[id];
        }
    };

    /* -- Supabase client (only built if the SDK is loaded on the page) ----- */
    var sb = null;

    /* -- Mock data — used when Supabase isn't available -------------------- */
    var MOCK = {
        stars: [
            { id: 'm-s1', title_DE: 'Around the World', vimeo_code: '', stars: 1, sevens: null, category: 'Freestyle',  difficulty: 'Einfach' },
            { id: 'm-s2', title_DE: 'Toe Bounce',       vimeo_code: '', stars: 1, sevens: null, category: 'Freestyle',  difficulty: 'Einfach' },
            { id: 'm-s3', title_DE: 'Knee Catch',       vimeo_code: '', stars: 2, sevens: null, category: 'Freestyle',  difficulty: 'Mittel'  },
            { id: 'm-s4', title_DE: 'Hop the Ball',     vimeo_code: '', stars: 3, sevens: null, category: 'Freestyle',  difficulty: 'Mittel'  }
        ],
        sevens: [
            { id: 'm-v1', title_DE: 'Pass mit Innenseite',        vimeo_code: '', stars: null, sevens: 1, category: 'Passspiel',     difficulty: 'Einfach' },
            { id: 'm-v2', title_DE: 'Ballannahme & Mitnahme',    vimeo_code: '', stars: null, sevens: 1, category: 'Ballannahme',   difficulty: 'Einfach' },
            { id: 'm-v3', title_DE: 'Schussbewegung',             vimeo_code: '', stars: null, sevens: 2, category: 'Schusstechnik', difficulty: 'Mittel'  }
        ],
        challenges: [
            { id: 'm-c1', title_DE: 'Neckstall',           vimeo_code: '', stars: 3,    sevens: null, category: 'Freestyle',   difficulty: 'Mittel'    },
            { id: 'm-c2', title_DE: 'Elastico',            vimeo_code: '', stars: 3,    sevens: null, category: 'Freestyle',   difficulty: 'Mittel'    },
            { id: 'm-c3', title_DE: 'Hop Stepover',        vimeo_code: '', stars: 3,    sevens: null, category: 'Freestyle',   difficulty: 'Mittel'    },
            { id: 'm-c4', title_DE: 'Ronaldo Chop',        vimeo_code: '', stars: 4,    sevens: null, category: 'Freestyle',   difficulty: 'Schwierig' },
            { id: 'm-c5', title_DE: 'Kleine Pyramide',     vimeo_code: '', stars: 5,    sevens: null, category: 'Freestyle',   difficulty: 'Schwierig' },
            { id: 'm-c6', title_DE: 'Annahme Marcello',   vimeo_code: '', stars: null, sevens: 3,    category: 'Ballannahme', difficulty: 'Schwierig' }
        ]
    };

    /* -- Thumbnail index --------------------------------------------------- */
    var thumbnailIndex = {};
    var thumbReady = null;

    /* -- Per-section data fetch -------------------------------------------- *
     * Pulls the freemium-tagged videos from Supabase. Falls back to MOCK
     * when the Supabase SDK isn't loaded. Includes the three new JSONB cols:
     *   playerhint   — array of "Ablauf" step strings
     *   so_what      — short label  e.g. ["Ballkontrolle"]
     *   ultimate_goal— short label  e.g. ["Bewegung mit Ball"]
     * ---------------------------------------------------------------------- */
    function fetchSection(key) {
        if (!sb) return Promise.resolve(MOCK[key]);
        var cols = 'id,title_DE,title_EN,vimeo_code,stars,sevens,category,difficulty,nr,playerhint,so_what,ultimate_goal';
        var q = sb.from('videos').select(cols).eq('freemium', 1).not('vimeo_code', 'is', null);
        if (key === 'stars') {
            q = q.in('stars', [1, 2])
                 .order('stars',  { ascending: true })
                 .order('nr',     { ascending: true });
        } else if (key === 'sevens') {
            q = q.in('sevens', [1, 2])
                 .order('sevens', { ascending: true })
                 .order('nr',     { ascending: true });
        } else {
            q = q.or('stars.in.(3,4,5),sevens.eq.3')
                 .order('stars',  { ascending: true, nullsFirst: false })
                 .order('sevens', { ascending: true, nullsFirst: false });
        }
        return q.then(function (res) {
            if (res.error) throw res.error;
            return res.data || [];
        }).catch(function (err) {
            console.error('[freemium] supabase fetch failed for', key, err);
            return null;
        });
    }

    /* -- Helpers ----------------------------------------------------------- */
    function starsLabel(n) { return '⭐'.repeat(Math.max(0, Math.min(5, n || 0))); }
    function tagFor(v) {
        if (v.stars != null)  return starsLabel(v.stars) + ' ' + v.stars + ' Stern' + (v.stars > 1 ? 'e' : '');
        if (v.sevens != null) return '7️⃣ Sevens · Level ' + v.sevens;
        return '';
    }
    function titleOf(v) { return v.title_DE || v.title_EN || 'Ohne Titel'; }

    /* Convert a JSONB value into a clean array of non-empty strings.
       Defensive: supabase-js may return parsed arrays or strings. */
    function asArray(v) {
        if (v == null) return [];
        var arr = v;
        if (typeof v === 'string') {
            var trimmed = v.trim();
            if (!trimmed) return [];
            if (trimmed.charAt(0) === '[' || trimmed.charAt(0) === '{') {
                try { arr = JSON.parse(trimmed); }
                catch (e) { arr = [trimmed]; }
            } else {
                arr = [trimmed];
            }
        }
        if (!Array.isArray(arr)) arr = [arr];
        return arr
            .map(function (x) { return x == null ? '' : String(x).trim(); })
            .filter(function (x) { return x.length > 0; });
    }
    function firstOf(v) { var a = asArray(v); return a.length ? a[0] : ''; }

    function thumbUrlFor(v) {
        if (!v.vimeo_code) return '';
        var vimeoId = String(v.vimeo_code).split('/')[0];
        var file = thumbnailIndex[vimeoId];
        if (!file) return '';
        return 'https://ute-laureo.github.io/t7academy-widgets/Assets/thumbnails/' + file.replace(/ /g, '%20');
    }

    function escapeHTML(s) {
        return String(s)
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;')
            .replace(/'/g, '&#39;');
    }
    function setHTML(id, html) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }

    /* so_what + ultimate_goal subtitle row used in cards and the modal */
    function subtitleHTML(v, opts) {
        var sw = firstOf(v.so_what);
        var ug = firstOf(v.ultimate_goal);
        if (!sw && !ug) return '';
        var cls = (opts && opts.cls) || 'video-subtitles';
        var parts = [];
        if (sw) parts.push('<span class="vsub-so-what">' + escapeHTML(sw) + '</span>');
        if (sw && ug) parts.push('<span class="vsub-arrow" aria-hidden="true">→</span>');
        if (ug) parts.push('<span class="vsub-goal">' + escapeHTML(ug) + '</span>');
        return '<div class="' + cls + '">' + parts.join('') + '</div>';
    }

    /* -- Card HTML --------------------------------------------------------- */
    function videoCardHTML(v) {
        var thumb = thumbUrlFor(v);
        var thumbInner = thumb
            ? '<img src="' + thumb + '" alt="" loading="lazy" onerror="this.remove()">'
            : '<div class="video-thumb-placeholder">▶</div>';
        var safeTitle = titleOf(v).replace(/"/g, '&quot;');
        var subtitles = subtitleHTML(v, { cls: 'video-subtitles' });
        var tag = tagFor(v);
        return '' +
            '<div class="video-card">' +
                '<a class="video-thumb" href="#" data-vid="' + v.id + '" aria-label="' + safeTitle + '">' + thumbInner + '</a>' +
                '<div class="video-meta">' +
                    '<div class="video-title-row">' +
                        '<h3 class="video-title">' + titleOf(v) + '</h3>' +
                        (tag ? '<div class="video-tag">' + tag + '</div>' : '') +
                    '</div>' +
                    subtitles +
                '</div>' +
            '</div>';
    }

    function skillNodeHTML(v, idx, total) {
        var isLast = idx === total - 1;
        var thumb = thumbUrlFor(v);
        var count = State.getPracticeCount(v.id);
        var practicedClass = count > 0 ? ' practiced' : '';
        var thumbInner = thumb
            ? '<img src="' + thumb + '" alt="" loading="lazy" onerror="this.remove()">'
            : '<div class="skill-node-thumb-ph">▶</div>';
        var checkmark = count > 0 ? '<span class="skill-node-check">✓</span>' : '';
        var countLabel = count > 0 ? (count + '× geübt') : 'Noch nicht geübt';
        var subtitles = subtitleHTML(v, { cls: 'skill-node-subtitles' });
        var tag = tagFor(v);
        return '' +
            '<div class="skill-node' + practicedClass + '" data-id="' + v.id + '">' +
                '<div class="skill-node-rail">' +
                    '<div class="skill-node-marker">' +
                        '<span class="skill-node-num">' + (idx + 1) + '</span>' +
                        checkmark +
                    '</div>' +
                    (!isLast ? '<div class="skill-node-line"></div>' : '') +
                '</div>' +
                '<div class="skill-node-card">' +
                    '<div class="skill-node-thumb" data-vid="' + v.id + '">' +
                        thumbInner +
                        '<div class="skill-node-play-overlay"></div>' +
                    '</div>' +
                    '<div class="skill-node-content">' +
                        '<div class="skill-node-title-row">' +
                            '<h3 class="skill-node-title">' + titleOf(v) + '</h3>' +
                            (tag ? '<div class="skill-node-tag">' + tag + '</div>' : '') +
                        '</div>' +
                        subtitles +
                        '<div class="skill-node-actions">' +
                            '<button class="skill-btn skill-btn-watch" data-vid="' + v.id + '" type="button">▶ Ansehen</button>' +
                            '<button class="skill-btn skill-btn-xp" data-id="' + v.id + '" type="button">+' + XP_PER_TRICK + ' XP — Geübt!</button>' +
                            '<span class="skill-node-count" data-count="' + v.id + '">' + countLabel + '</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    /* -- Rendering --------------------------------------------------------- */
    var videoIndex = {};

    function renderGrid(key, gridId) {
        var grid = document.getElementById(gridId);
        if (!grid) return Promise.resolve();
        return thumbReady.then(function () { return fetchSection(key); }).then(function (videos) {
            if (videos === null) {
                grid.innerHTML = '<div class="grid-status error">Konnte Videos nicht laden. Bitte später erneut versuchen.</div>';
                return;
            }
            if (!videos.length) {
                grid.innerHTML = '<div class="grid-status">Noch keine Videos in dieser Sektion.</div>';
                return;
            }
            videos.forEach(function (v) { videoIndex[v.id] = v; });

            if (key === 'challenges') {
                grid.innerHTML = videos.map(function (v, i) { return skillNodeHTML(v, i, videos.length); }).join('');
                wireSkillPath(grid, videos);
                updateSkillProgress(videos);
                var progressEl = document.getElementById('skillProgress');
                if (progressEl) progressEl.hidden = false;
            } else {
                grid.innerHTML = videos.map(videoCardHTML).join('');
                grid.querySelectorAll('.video-thumb').forEach(function (a) {
                    a.addEventListener('click', function (e) {
                        e.preventDefault();
                        var id = a.dataset.vid;
                        if (videoIndex[id]) openVideo(videoIndex[id]);
                    });
                });
            }
        });
    }

    /* -- Skill-path wiring ------------------------------------------------- */
    function wireSkillPath(grid, videos) {
        grid.querySelectorAll('.skill-node-thumb').forEach(function (t) {
            t.addEventListener('click', function () {
                var id = t.dataset.vid;
                if (videoIndex[id]) openVideo(videoIndex[id]);
            });
        });
        grid.querySelectorAll('.skill-btn-watch').forEach(function (b) {
            b.addEventListener('click', function () {
                var id = b.dataset.vid;
                if (videoIndex[id]) openVideo(videoIndex[id]);
            });
        });
        grid.querySelectorAll('.skill-btn-xp').forEach(function (b) {
            b.addEventListener('click', function () { onSkillXp(b, videos); });
        });
    }

    var _xpCooldown = new WeakMap();
    function onSkillXp(btn, videos) {
        var now = Date.now();
        var last = _xpCooldown.get(btn) || 0;
        if (now - last < 350) return;
        _xpCooldown.set(btn, now);

        var id = btn.dataset.id;
        var count = State.incrementPractice(id);
        State.addXP(XP_PER_TRICK);

        flyXP(btn);
        updateXP(true);
        btn.classList.remove('bump');
        void btn.offsetWidth;
        btn.classList.add('bump');

        var countEl = document.querySelector('[data-count="' + id + '"]');
        if (countEl) countEl.textContent = count + '× geübt';
        var node = btn.closest('.skill-node');
        if (node && !node.classList.contains('practiced')) {
            node.classList.add('practiced');
            var marker = node.querySelector('.skill-node-marker');
            if (marker && !marker.querySelector('.skill-node-check')) {
                var check = document.createElement('span');
                check.className = 'skill-node-check';
                check.textContent = '✓';
                marker.appendChild(check);
            }
        }
        updateSkillProgress(videos);
    }

    function updateSkillProgress(videos) {
        var total = videos.length;
        var done = videos.filter(function (v) { return State.getPracticeCount(v.id) > 0; }).length;
        var doneEl  = document.getElementById('skillDone');
        var totalEl = document.getElementById('skillTotal');
        var fillEl  = document.getElementById('skillProgressFill');
        if (doneEl)  doneEl.textContent  = done;
        if (totalEl) totalEl.textContent = total;
        var pct = total ? (done / total) * 100 : 0;
        if (fillEl) fillEl.style.width = pct + '%';
    }

    function flyXP(originEl) {
        var fly = document.createElement('div');
        fly.className = 'xp-fly';
        fly.textContent = '+' + XP_PER_TRICK + ' XP';
        var r = originEl.getBoundingClientRect();
        fly.style.left = (r.left + r.width / 2) + 'px';
        fly.style.top  = (r.top - 6) + 'px';
        fly.style.transform = 'translate(-50%, 0)';
        fly.style.opacity = '1';
        document.body.appendChild(fly);
        requestAnimationFrame(function () {
            fly.style.transform = 'translate(-50%, -70px)';
            fly.style.opacity = '0';
        });
        setTimeout(function () { fly.remove(); }, 950);
    }

    /* -- Lazy section load (Minis-Stadien-style view switching) ------------ */
    var loadedSections = new Set();
    function activateSection(key) {
        var section = document.getElementById('section-' + key);
        if (!section) { console.warn('[freemium] no section for key:', key); return; }
        var overview = document.querySelector('.section-overview');
        if (overview) overview.hidden = true;
        document.querySelectorAll('section[id^="section-"]').forEach(function (s) {
            if (s !== section) { s.hidden = true; s.setAttribute('hidden', ''); }
        });
        section.hidden = false;
        section.removeAttribute('hidden');
        document.querySelectorAll('.overview-card').forEach(function (c) {
            c.classList.toggle('is-active', c.dataset.section === key);
        });
        requestAnimationFrame(function () {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        section.classList.add('section-reveal');
        setTimeout(function () { section.classList.remove('section-reveal'); }, 500);
        if (!loadedSections.has(key)) {
            loadedSections.add(key);
            renderGrid(key, 'grid-' + key).catch(function (err) {
                console.error('[freemium] renderGrid failed:', key, err);
            });
        }
    }

    function goToOverview() {
        document.querySelectorAll('section[id^="section-"]').forEach(function (s) {
            s.hidden = true;
            s.setAttribute('hidden', '');
        });
        var overview = document.querySelector('.section-overview');
        if (overview) {
            overview.hidden = false;
            overview.removeAttribute('hidden');
            overview.classList.add('section-reveal');
            setTimeout(function () { overview.classList.remove('section-reveal'); }, 500);
            requestAnimationFrame(function () {
                overview.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
        document.querySelectorAll('.overview-card').forEach(function (c) {
            c.classList.remove('is-active');
        });
        if (location.hash && /^#section-/.test(location.hash)) {
            history.replaceState(null, '', location.pathname + location.search);
        }
    }

    /* -- Video modal ------------------------------------------------------- */
    function openVideo(v) {
        var modal  = document.getElementById('fmModal');
        var wrap   = document.getElementById('fmModalVideo');
        var title  = document.getElementById('fmModalTitle');
        var subsEl = document.getElementById('fmModalSubtitles');
        var meta   = document.getElementById('fmModalMeta');
        var hintEl = document.getElementById('fmModalHint');
        if (!modal) return;

        title.textContent = titleOf(v);

        if (v.vimeo_code) {
            var parts = String(v.vimeo_code).split('/');
            var id   = parts[0];
            var hash = parts[1] ? '?h=' + parts[1] : '';
            wrap.innerHTML = '<iframe src="https://player.vimeo.com/video/' + id + hash +
                             '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
        } else {
            wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;color:#fff;height:100%;font-family:\'Open Sans\',sans-serif">Video noch nicht verfügbar</div>';
        }

        /* so_what + ultimate_goal as subtitles under the title */
        var sw = firstOf(v.so_what);
        var ug = firstOf(v.ultimate_goal);
        if (sw || ug) {
            var subParts = [];
            if (sw) subParts.push('<span class="vsub-so-what">' + escapeHTML(sw) + '</span>');
            if (sw && ug) subParts.push('<span class="vsub-arrow" aria-hidden="true">→</span>');
            if (ug) subParts.push('<span class="vsub-goal">' + escapeHTML(ug) + '</span>');
            subsEl.innerHTML = subParts.join('');
            subsEl.hidden = false;
        } else {
            subsEl.innerHTML = '';
            subsEl.hidden = true;
        }

        /* Meta tags (stars / sevens / category / difficulty) */
        var tags = [];
        if (v.stars != null)  tags.push('<span class="fm-meta-tag">' + starsLabel(v.stars) + ' ' + v.stars + ' Stern' + (v.stars > 1 ? 'e' : '') + '</span>');
        if (v.sevens != null) tags.push('<span class="fm-meta-tag">7️⃣ Sevens · Level ' + v.sevens + '</span>');
        if (v.category)       tags.push('<span class="fm-meta-tag">' + v.category + '</span>');
        if (v.difficulty)     tags.push('<span class="fm-meta-tag">' + v.difficulty + '</span>');
        meta.innerHTML = tags.join('');

        /* playerhint → Ablauf — one list-item per array entry */
        var hintItems = asArray(v.playerhint);
        if (hintItems.length) {
            var items = hintItems.map(function (s) { return '<li>' + escapeHTML(s) + '</li>'; }).join('');
            hintEl.innerHTML = '<div class="fm-hint-label">Ablauf</div><ul class="fm-hint-list">' + items + '</ul>';
            hintEl.hidden = false;
        } else {
            hintEl.innerHTML = '';
            hintEl.hidden = true;
        }

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeVideo() {
        var modal = document.getElementById('fmModal');
        if (!modal) return;
        var v = document.getElementById('fmModalVideo');
        if (v) v.innerHTML = '';
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }

    /* -- Name-driven copy (changes hero + section subs based on user name) - */
    function applyNameTemplates() {
        var raw = State.getName();
        var hasName = !!raw;
        var n = hasName ? escapeHTML(raw) : '';

        setHTML('t-stars-sub', hasName
            ? (n + ', starte mit den klassischen Freestyle-Moves. Zwei Sterne sind dein erstes Ziel.')
            : 'Starte mit den klassischen Freestyle-Moves. Zwei Sterne sind dein erstes Ziel.');
        setHTML('t-sevens-sub', hasName
            ? ('Pass, Schuss, Annahme — die Technik, die du jedes Spiel brauchst, ' + n + '.')
            : 'Pass, Schuss, Annahme — die Technik, die du jedes Spiel brauchst.');
        setHTML('t-challenge-title', hasName
            ? (n + 's erster <em class="challenge-word">Skill-Pfad</em>.')
            : 'Dein erster <em class="challenge-word">Skill-Pfad</em>.');
        setHTML('t-challenge-sub', hasName
            ? ('Jetzt wird\'s ernst, ' + n + '. 3-, 4- und 5-Sterne Freestyle plus Sevens Level 3. <strong>Jeder Übungs-Klick gibt dir +25 XP.</strong> Übe oft — XP gibt\'s immer wieder.')
            : 'Jetzt wird\'s ernst. 3-, 4- und 5-Sterne Freestyle plus Sevens Level 3. <strong>Jeder Übungs-Klick gibt dir +25 XP.</strong> Übe oft — XP gibt\'s immer wieder.');
        setHTML('t-closer-title', hasName
            ? (n + ', du hast die Basics drauf. Jetzt mit der <em class="gold">Academy</em> starten.')
            : 'Du hast die Basics drauf. Jetzt mit der <em class="gold">Academy</em> starten.');
    }

    function updateName() {
        var name      = State.getName();
        var setup     = document.getElementById('nameSetup');
        var stats     = document.getElementById('playerStats');
        var greetTail = document.getElementById('greetingName');
        var welcome   = document.getElementById('welcomeMsg');
        var display   = document.getElementById('nameDisplay');
        if (!setup || !stats) return;

        if (name) {
            setup.hidden = true;
            stats.hidden = false;
            if (greetTail) greetTail.textContent = ', ' + name + '!';
            if (welcome)   welcome.textContent   = 'Schön, dass du da bist.';
            if (display)   display.textContent   = name;
        } else {
            setup.hidden = false;
            stats.hidden = true;
            if (greetTail) greetTail.textContent = '!';
            if (welcome)   welcome.textContent   = 'Schön, dass du da bist. Wie heißt du?';
        }
        applyNameTemplates();
    }

    function updateXP(animate) {
        var el = document.getElementById('xpNum');
        if (!el) return;
        el.textContent = State.getXP();
        if (animate) {
            el.classList.remove('pop');
            void el.offsetWidth;
            el.classList.add('pop');
            setTimeout(function () { el.classList.remove('pop'); }, 280);
        }
    }

    /* -- Overview card clicks (delegated, capture phase) -------------------
       Capture phase intercepts the anchor's default href="#section-…" so we
       can stage the section reveal animation instead of the browser doing a
       hard-jump. */
    function initOverviewCards() {
        document.addEventListener('click', function (e) {
            var back = e.target.closest ? e.target.closest('.section-back') : null;
            if (back) {
                e.preventDefault();
                e.stopPropagation();
                goToOverview();
                return;
            }
            var card = e.target.closest ? e.target.closest('.overview-card') : null;
            if (!card) return;
            e.preventDefault();
            e.stopPropagation();
            var key = card.dataset ? card.dataset.section : null;
            if (!key) {
                var href = (card.getAttribute ? card.getAttribute('href') : '') || '';
                var m = href.match(/#section-(.+)$/);
                if (m) key = m[1];
            }
            if (key) activateSection(key);
        }, true);
    }

    /* -- Freemium boot ----------------------------------------------------- */
    function bootFreemium() {
        /* Feature-detect: only run on the Freemium page (which has #fmModal) */
        if (!document.getElementById('fmModal')) return;

        /* Supabase: build the client if the SDK is on the page */
        if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
            try {
                sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            } catch (e) {
                console.warn('[freemium] Supabase init failed; falling back to mock data.', e);
            }
        }

        /* Thumbnail index — start loading immediately, used by every grid */
        thumbReady = fetch('https://ute-laureo.github.io/t7academy-widgets/Assets/thumbnail_index.json?v=' + Date.now())
            .then(function (r) { return r.json(); })
            .then(function (idx) { thumbnailIndex = idx || {}; })
            .catch(function () { /* ignore */ });

        initOverviewCards();
        updateName();
        updateXP();

        var nameSave = document.getElementById('nameSave');
        var nameInput = document.getElementById('nameInput');
        var changeName = document.getElementById('changeName');
        if (nameSave && nameInput) {
            nameSave.addEventListener('click', function () {
                var name = nameInput.value.trim();
                if (!name) return;
                State.setName(name);
                nameInput.value = '';
                updateName();
            });
            nameInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') nameSave.click();
            });
        }
        if (changeName && nameInput) {
            changeName.addEventListener('click', function () {
                State.clearName();
                updateName();
                nameInput.focus();
            });
        }

        var modalBack = document.getElementById('fmModalBack');
        var modal     = document.getElementById('fmModal');
        if (modalBack) modalBack.addEventListener('click', closeVideo);
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target.id === 'fmModal') closeVideo();
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modal && modal.classList.contains('open')) closeVideo();
        });
    }


    /* ======================================================================
       Boot — call all initializers once the DOM is parsed.
       initThemeToggle always runs (both outside pages need it).
       bootFreemium is a no-op when Freemium's DOM isn't on the page.
       ====================================================================== */
    function boot() {
        initThemeToggle();
        bootFreemium();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();


/* ==========================================================================
   4. SUBSCRIPTION — CLUB ENQUIRY FORM (outside)
   --------------------------------------------------------------------------
   Feature-detected: runs only on the subscription page (#clubEnquiryForm).
   The form is hidden behind a button; opening it renders the Turnstile
   captcha and reveals the fields. Submit posts to the club-enquiry Edge
   Function, which verifies the captcha + rate-limits server-side.
   ========================================================================== */
(function () {
    'use strict';

    var SUPABASE_URL      = 'https://qajjuhjmrtuomwrbxmpz.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';

    var tsRendered = false;

    function boot() {
        var form = document.getElementById('clubEnquiryForm');
        if (!form) return;   /* not the subscription page */

        var msg    = document.getElementById('clubFormMsg');
        var submit = document.getElementById('clubSubmit');
        var toggle = document.getElementById('clubFormToggle');
        var wrap   = document.getElementById('clubFormCard');

        /* Reveal the form on demand + render the captcha the first time. */
        if (toggle && wrap) {
            toggle.addEventListener('click', function () {
                wrap.hidden = false;
                toggle.setAttribute('aria-expanded', 'true');
                toggle.style.display = 'none';
                renderTurnstile();
                var first = form.elements['club_name'];
                if (first) { try { first.focus(); } catch (e) {} }
                try { wrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
            });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (msg) { msg.className = 'sub-form-msg'; msg.textContent = ''; }

            var data = {
                club_name:    val('club_name'),
                contact_name: val('contact_name'),
                email:        val('email'),
                phone:        val('phone') || null,
                num_teams:    intOrNull('num_teams'),
                num_kids:     intOrNull('num_kids'),
                age_groups:   val('age_groups') || null,
                message:      val('message') || null,
                company_website: val('company_website'),        /* honeypot — must stay empty */
                'cf-turnstile-response': turnstileToken()        /* Cloudflare Turnstile token */
            };

            if (!data.club_name || !data.contact_name || !data.email) {
                showErr('Bitte Verein, Ansprechperson und E-Mail ausfüllen.');
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
                showErr('Bitte eine gültige E-Mail-Adresse eingeben.');
                return;
            }
            if (!data['cf-turnstile-response']) {
                showErr('Bitte bestätige kurz, dass du kein Roboter bist.');
                return;
            }

            if (submit) { submit.disabled = true; submit.textContent = 'Wird gesendet…'; }

            fetch(SUPABASE_URL + '/functions/v1/club-enquiry', {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }).then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (b) {
                    return { status: r.status, ok: r.ok, body: b };
                });
            }).then(function (res) {
                if (submit) { submit.disabled = false; submit.textContent = 'Anfrage senden'; }
                resetTurnstile();
                if (res.ok && res.body && res.body.ok) { showSuccess(data.contact_name); return; }
                showErr(errorMessage(res.status, res.body && res.body.error));
            }).catch(function (err) {
                if (submit) { submit.disabled = false; submit.textContent = 'Anfrage senden'; }
                resetTurnstile();
                console.error('[club-enquiry] submit failed', err);
                showErr('Senden fehlgeschlagen. Bitte später erneut versuchen oder schreib uns direkt an office@t7academy.com.');
            });
        });

        function renderTurnstile(tries) {
            tries = tries || 0;
            if (tsRendered) return;
            var el = document.getElementById('clubTurnstile');
            if (el && window.turnstile && window.turnstile.render) {
                try {
                    window.turnstile.render(el, { sitekey: el.getAttribute('data-sitekey'), theme: 'auto' });
                    tsRendered = true;
                } catch (e) { /* already rendered / ignore */ }
                return;
            }
            if (tries > 40) return;                         /* give up after ~10s */
            setTimeout(function () { renderTurnstile(tries + 1); }, 250);
        }
        function turnstileToken() {
            var el = form.elements['cf-turnstile-response'];
            if (el && el.value) return el.value;
            try { return (window.turnstile && window.turnstile.getResponse()) || ''; }
            catch (e) { return ''; }
        }
        function resetTurnstile() {
            try { if (window.turnstile) window.turnstile.reset(); } catch (e) { /* ignore */ }
        }
        function errorMessage(status, code) {
            if (status === 429 || code === 'rate_limited') return 'Zu viele Anfragen in kurzer Zeit. Bitte versuch es in einer Stunde noch einmal.';
            if (code === 'captcha_missing' || code === 'captcha_failed') return 'Die Roboter-Prüfung ist fehlgeschlagen. Bitte lade die Seite neu und versuch es erneut.';
            if (code === 'bad_email') return 'Bitte eine gültige E-Mail-Adresse eingeben.';
            if (code === 'missing_fields') return 'Bitte Verein, Ansprechperson und E-Mail ausfüllen.';
            return 'Senden fehlgeschlagen. Bitte später erneut versuchen.';
        }
        function val(name) {
            var el = form.elements[name];
            return el ? String(el.value || '').trim() : '';
        }
        function intOrNull(name) {
            var v = val(name);
            if (!v) return null;
            var n = parseInt(v, 10);
            return isNaN(n) ? null : n;
        }
        function showErr(text) {
            if (!msg) return;
            msg.className = 'sub-form-msg err';
            msg.textContent = text;
        }
        function showSuccess(name) {
            var card = document.getElementById('clubFormCard');
            if (!card) return;
            var first = (name && name.split(' ')[0]) ? (', ' + name.split(' ')[0]) : '';
            card.innerHTML =
                '<div class="sub-form-success">' +
                    '<div class="sfx-icon">✅</div>' +
                    '<h3>Danke' + escapeHTML(first) + '!</h3>' +
                    '<p>Deine Anfrage ist bei uns eingegangen. Wir melden uns in der Regel innerhalb von 2 Werktagen mit einem passenden Angebot für deinen Verein.</p>' +
                '</div>';
        }
        function escapeHTML(s) {
            return String(s).replace(/[&<>"']/g, function (c) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
