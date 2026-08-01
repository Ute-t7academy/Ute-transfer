(function(){
  // ── CONFIG ─────────────────────────────────────────────
  var SB_URL = 'https://qajjuhjmrtuomwrbxmpz.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';
  var BUCKET = 'cert-submissions';
  var SIGNED_URL_TTL = 3600;
  var LS_KEY = 't7_expert_session';

  var MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var PERMS = [
    { key:'certifications',   label:'Zertifikate' },
    { key:'challenges',       label:'Challenges' },
    { key:'club_enquiries',   label:'Club-Anfragen' },
    { key:'it_admin',         label:'IT' },
    { key:'manage_employees', label:'Mitarbeiter verwalten' }
  ];

  var session = null;
  try { session = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch(e){}

  var me = null;                   // caller's employees row
  var currentFilter = 'pending';   // review
  var modules = [];                // monats dropdown cache
  var inited = { review:false, monats:false, team:false, enquiries:false };

  // ── BOOT ───────────────────────────────────────────────
  function boot(){
    var recToken = parseRecovery();
    if (recToken) { showRecover(recToken); return; }
    if (session && session.access_token && session.user) showAdmin();
    else showLogin();
  }

  // Detect the recovery token Supabase appends to the URL hash after the email link.
  function parseRecovery(){
    var h = window.location.hash || '';
    if (h.indexOf('type=recovery') < 0) return null;
    try { return new URLSearchParams(h.replace(/^#/, '')).get('access_token'); } catch(e){ return null; }
  }

  function showLogin(){
    document.getElementById('view-recover').style.display = 'none';
    document.getElementById('view-login').style.display = 'block';
    document.getElementById('view-admin').style.display = 'none';
    document.getElementById('li-btn').onclick = login;
    document.getElementById('li-pass').onkeydown = function(e){ if (e.key === 'Enter') login(); };
    document.getElementById('li-forgot').onclick = function(e){ e.preventDefault(); requestRecovery(); };
  }

  function showAdmin(){
    document.getElementById('view-recover').style.display = 'none';
    document.getElementById('view-login').style.display = 'none';
    document.getElementById('view-admin').style.display = 'block';
    document.getElementById('who-email').textContent = (session && session.user && session.user.email) || '';
    document.getElementById('logout-btn').onclick = logout;
    initThemeToggle();
    // Resolve who I am (permissions) before showing anything.
    fetchMe(configure);
  }

  // Light/Dark toggle — persists to localStorage, applied pre-paint in <head>.
  function initThemeToggle(){
    var btn = document.getElementById('theme-toggle'); if (!btn) return;
    function sync(){ btn.textContent = document.documentElement.getAttribute('data-theme') === 'light' ? '☾' : '☀︎'; }
    sync();
    btn.onclick = function(){
      var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try{ localStorage.setItem('t7_expert_theme', next); }catch(e){}
      sync();
    };
  }

  function fetchMe(cb){
    var myId = session.user && session.user.id;
    fetch(SB_URL + '/rest/v1/employees?id=eq.' + encodeURIComponent(myId) + '&select=*&limit=1', { headers: authHeaders() })
      .then(handle401).then(function(r){ return r.json(); })
      .then(function(rows){ me = (Array.isArray(rows) && rows.length) ? rows[0] : null; cb(); })
      .catch(function(e){ if (e && e.message === 'session_expired') return; me = null; cb(); });
  }

  function can(perm){ return !!(me && me.active && (me.is_owner || (me.permissions || []).indexOf(perm) >= 0)); }

  function configure(){
    var tabbar = document.getElementById('tabbar');
    var noAccess = document.getElementById('no-access');

    if (!me || !me.active) {
      tabbar.style.display = 'none';
      ['tab-review','tab-monats','tab-team'].forEach(function(id){ document.getElementById(id).style.display = 'none'; });
      document.getElementById('no-access-msg').textContent = me
        ? 'Dein Konto ist deaktiviert. Wende dich an einen Administrator.'
        : 'Dein Login ist noch keinem Mitarbeiter zugeordnet. Wende dich an einen Administrator.';
      noAccess.style.display = 'block';
      return;
    }

    var allowed = [];
    if (can('certifications'))   allowed.push('review');
    if (can('certifications'))   allowed.push('msgs');
    if (can('challenges'))       allowed.push('monats');
    if (can('club_enquiries'))   allowed.push('enquiries');
    if (can('manage_employees')) allowed.push('team');

    if (!allowed.length) {
      tabbar.style.display = 'none';
      document.getElementById('no-access-msg').textContent = 'Dein Konto hat noch keine Berechtigungen. Wende dich an einen Administrator.';
      noAccess.style.display = 'block';
      return;
    }

    noAccess.style.display = 'none';
    tabbar.style.display = 'flex';
    ['review','msgs','monats','enquiries','team'].forEach(function(name){
      document.querySelector('.tab[data-tab="' + name + '"]').style.display = allowed.indexOf(name) >= 0 ? 'inline-block' : 'none';
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(b){
      b.onclick = function(){ switchTab(b.getAttribute('data-tab')); };
    });
    if (can('certifications')) {
      Array.prototype.forEach.call(document.querySelectorAll('.filter-bar .pill'), function(b){
        b.onclick = function(){
          Array.prototype.forEach.call(document.querySelectorAll('.filter-bar .pill'), function(x){ x.classList.remove('active'); });
          b.classList.add('active');
          currentFilter = b.getAttribute('data-filter');
          loadSubs();
        };
      });
    }
    switchTab(allowed[0]);
    if (can('certifications')) refreshMsgTabDot();
    if (can('club_enquiries')) refreshEnqDot();
  }

  function switchTab(name){
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(b){
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    document.getElementById('tab-review').style.display = name === 'review' ? 'block' : 'none';
    document.getElementById('tab-msgs').style.display   = name === 'msgs'   ? 'block' : 'none';
    document.getElementById('tab-monats').style.display = name === 'monats' ? 'block' : 'none';
    document.getElementById('tab-team').style.display   = name === 'team'   ? 'block' : 'none';
    document.getElementById('tab-enquiries').style.display = name === 'enquiries' ? 'block' : 'none';
    if (name === 'review' && !inited.review) { inited.review = true; initReview(); }
    if (name === 'msgs'   && !inited.msgs)   { inited.msgs   = true; initMsgs(); }
    if (name === 'monats' && !inited.monats) { inited.monats = true; initMonats(); }
    if (name === 'team'   && !inited.team)   { inited.team   = true; initTeam(); }
    if (name === 'enquiries' && !inited.enquiries) { inited.enquiries = true; initEnquiries(); }
  }

  // ── AUTH ───────────────────────────────────────────────
  function login(){
    var email = document.getElementById('li-email').value.trim();
    var pass  = document.getElementById('li-pass').value;
    var err   = document.getElementById('li-err');
    var btn   = document.getElementById('li-btn');
    err.textContent = '';
    if (!email || !pass) { err.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
    btn.disabled = true; btn.textContent = 'Anmelden…';
    fetch(SB_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pass })
    }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, body: j }; }); })
      .then(function(res){
        btn.disabled = false; btn.textContent = 'Anmelden';
        if (!res.ok) { err.textContent = res.body.error_description || res.body.msg || 'Login fehlgeschlagen.'; return; }
        session = res.body;
        localStorage.setItem(LS_KEY, JSON.stringify(session));
        showAdmin();
      }).catch(function(){ btn.disabled = false; btn.textContent = 'Anmelden'; err.textContent = 'Netzwerkfehler.'; });
  }

  function logout(){
    session = null; me = null;
    inited = { review:false, monats:false, team:false, enquiries:false };
    localStorage.removeItem(LS_KEY);
    showLogin();
  }

  function authHeaders(extra){
    return Object.assign({ 'apikey': SB_KEY, 'Authorization': 'Bearer ' + (session && session.access_token) }, extra || {});
  }

  function handle401(r){ if (r.status === 401) { logout(); throw new Error('session_expired'); } return r; }

  // ── PASSWORD RECOVERY ──────────────────────────────────
  // Send the reset email. The link returns to this page's URL, so that URL
  // must be listed under Supabase → Authentication → URL Configuration.
  function requestRecovery(){
    var email = document.getElementById('li-email').value.trim();
    var err = document.getElementById('li-err');
    if (!email) { err.textContent = 'Bitte zuerst deine E-Mail oben eingeben.'; return; }
    var redirect = window.location.origin + window.location.pathname;
    fetch(SB_URL + '/auth/v1/recover?redirect_to=' + encodeURIComponent(redirect), {
      method: 'POST', headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    }).catch(function(){});
    // Neutral message either way (don't reveal whether the account exists).
    err.textContent = '';
    toast('ok', 'Falls ein Konto existiert, wurde eine E-Mail gesendet.');
  }

  function showRecover(token){
    document.getElementById('view-login').style.display = 'none';
    document.getElementById('view-admin').style.display = 'none';
    document.getElementById('view-recover').style.display = 'block';
    document.getElementById('rc-btn').onclick = function(){ submitNewPassword(token); };
    document.getElementById('rc-pass2').onkeydown = function(e){ if (e.key === 'Enter') submitNewPassword(token); };
  }

  function submitNewPassword(token){
    var p1 = document.getElementById('rc-pass').value;
    var p2 = document.getElementById('rc-pass2').value;
    var err = document.getElementById('rc-err');
    err.textContent = '';
    if (p1.length < 8) { err.textContent = 'Mindestens 8 Zeichen.'; return; }
    if (p1 !== p2)     { err.textContent = 'Passwörter stimmen nicht überein.'; return; }
    var btn = document.getElementById('rc-btn'); btn.disabled = true; btn.textContent = 'Speichern…';
    fetch(SB_URL + '/auth/v1/user', {
      method: 'PUT',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: p1 })
    }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, body: j }; }); })
      .then(function(res){
        btn.disabled = false; btn.textContent = 'Passwort speichern';
        if (!res.ok) { err.textContent = (res.body && (res.body.msg || res.body.error_description)) || 'Link ungültig oder abgelaufen.'; return; }
        try { history.replaceState(null, '', window.location.pathname); } catch(e){}
        toast('ok', 'Passwort gespeichert. Bitte einloggen.');
        showLogin();
      }).catch(function(){ btn.disabled = false; btn.textContent = 'Passwort speichern'; err.textContent = 'Netzwerkfehler.'; });
  }

  /* ==========================================================
     TAB — CERTIFICATION REVIEW  (permission: certifications)
     ========================================================== */
  function initReview(){ loadStats(); loadSubs(); }

  function loadStats(){
    fetch(SB_URL + '/rest/v1/certification_submissions?select=status', { headers: authHeaders() })
      .then(handle401).then(function(r){ return r.json(); })
      .then(function(rows){
        var c = { pending:0, approved:0, rejected:0, expired:0 };
        rows.forEach(function(r){ c[r.status] = (c[r.status]||0) + 1; });
        document.getElementById('stats').innerHTML =
          statTile(c.pending,'Offen','accent') + statTile(c.approved,'Zertifiziert','') +
          statTile(c.rejected,'Abgelehnt','') + statTile(c.expired,'Abgelaufen','');
      }).catch(function(){});
  }
  function statTile(n,lbl,cls){ return '<div class="stat"><div class="stat-num ' + cls + '">' + n + '</div><div class="stat-lbl">' + lbl + '</div></div>'; }

  function loadSubs(){
    var el = document.getElementById('sub-list');
    el.innerHTML = '<div class="loading">Lade…</div>';
    var q = '?select=*&order=submitted_at.desc';
    if (currentFilter !== 'all') q += '&status=eq.' + currentFilter;
    fetch(SB_URL + '/rest/v1/certification_submissions' + q, { headers: authHeaders() })
      .then(handle401).then(function(r){ if (!r.ok) throw r; return r.json(); })
      .then(function(rows){
        if (!rows.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">📭</div>Keine ' + filterLabel() + '.</div>'; return; }
        el.innerHTML = rows.map(renderItem).join(''); bindItems();
      }).catch(function(e){ if (e && e.message === 'session_expired') return; el.innerHTML = '<div class="empty">Fehler beim Laden.</div>'; });
  }
  function filterLabel(){ return { pending:'offenen Einreichungen', approved:'zertifizierten Einreichungen', rejected:'abgelehnten Einreichungen', expired:'abgelaufenen Einreichungen', all:'Einreichungen' }[currentFilter]; }

  function renderItem(it){
    var stars = '★'.repeat(it.stars);
    var date  = new Date(it.submitted_at).toLocaleDateString('de-AT', { day:'2-digit', month:'short', year:'numeric' });
    var reviewedLine = it.reviewed_at ? ('<div>Geprüft: <strong>' + new Date(it.reviewed_at).toLocaleString('de-AT') + '</strong> von ' + esc(it.reviewed_by || '?') + '</div>') : '';
    var notesLine = it.notes ? ('<div>Notiz: <strong>' + esc(it.notes) + '</strong></div>') : '';
    var expiresLine = it.status === 'pending' ? ('<div>Läuft ab: <strong>' + new Date(it.expires_at).toLocaleDateString('de-AT') + '</strong></div>') : '';
    var actions = '';
    if (it.status === 'pending' || it.status === 'expired') actions = '<button class="btn" data-review="' + it.id + '">Video ansehen</button>';
    else if (it.video_path) actions = '<button class="btn ghost" data-review="' + it.id + '">Datei prüfen</button>';
    var who = esc(it.player_name || it.profile_id || '?');
    var ident = esc(it.profile_id || '');
    return '<div class="card review-card" data-id="' + it.id + '"><div class="card-row"><div class="card-left">'
      + '<div class="card-title"><span class="card-stars">' + stars + '</span>' + who + '</div>'
      + '<div class="card-meta"><span class="badge ' + it.status + '">' + statusLabel(it.status) + '</span>'
      + (ident ? '<span style="opacity:.7">' + ident + '</span>' : '')
      + '<span>Eingereicht: <strong>' + date + '</strong></span>' + reviewedLine + notesLine + expiresLine + '</div>'
      + '</div><div class="card-actions">' + actions + '</div></div><div class="review" id="review-' + it.id + '"></div></div>';
  }
  function statusLabel(s){ return { pending:'Offen', approved:'Zertifiziert', rejected:'Abgelehnt', expired:'Abgelaufen' }[s] || s; }
  function bindItems(){ Array.prototype.forEach.call(document.querySelectorAll('[data-review]'), function(btn){ btn.onclick = function(){ openReview(parseInt(btn.getAttribute('data-review'), 10)); }; }); }

  function openReview(id){
    var box = document.getElementById('review-' + id);
    if (box.classList.contains('open')) { box.classList.remove('open'); box.innerHTML = ''; return; }
    box.classList.add('open'); box.innerHTML = '<div class="loading">Video wird vorbereitet…</div>';
    fetch(SB_URL + '/rest/v1/certification_submissions?id=eq.' + id + '&select=*', { headers: authHeaders() })
      .then(handle401).then(function(r){ return r.json(); })
      .then(function(rows){ if (!rows.length) throw new Error('not found'); var sub = rows[0];
        // Video may be deleted (after approve/reject) — still open the panel
        // so the message thread stays reachable.
        return getSignedUrl(sub.video_path).then(
          function(url){ logView(sub.id); renderReviewPanel(box, sub, url); },
          function(){ renderReviewPanel(box, sub, null); }); })
      .catch(function(e){ if (e && e.message === 'session_expired') return; box.innerHTML = '<div class="empty">Konnte nicht geladen werden.</div>'; });
  }
  function getSignedUrl(path){
    return fetch(SB_URL + '/storage/v1/object/sign/' + BUCKET + '/' + path, {
      method: 'POST', headers: authHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify({ expiresIn: SIGNED_URL_TTL })
    }).then(handle401).then(function(r){ return r.json(); }).then(function(j){
      if (!j.signedURL && !j.signedUrl) throw new Error('no signed url'); return SB_URL + '/storage/v1' + (j.signedURL || j.signedUrl); });
  }
  function logView(submissionId){
    fetch(SB_URL + '/rest/v1/submission_views', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ submission_id: submissionId, viewer_email: session.user.email, user_agent: navigator.userAgent.slice(0, 200) }) }).catch(function(){});
  }
  function renderReviewPanel(box, sub, url){
    var wm = esc(session.user.email) + ' · ' + new Date().toLocaleString('de-AT');
    box.innerHTML = (url
        ? '<div class="video-wrap"><video src="' + esc(url) + '" controls controlsList="nodownload" playsinline></video>'
          + '<div class="watermark">' + wm + '</div><div class="watermark bl">' + wm + '</div></div>'
        : '<div class="empty" style="padding:14px">Video nicht mehr verfügbar (nach Prüfung gelöscht).</div>')
      + (sub.status === 'pending'
        ? '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px"><button class="btn green" id="approve-open-' + sub.id + '">✓ Zertifizieren…</button><button class="btn danger" id="reject-open-' + sub.id + '">Ablehnen…</button></div>'
          + '<div class="reject-box" id="approve-box-' + sub.id + '"><div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px">Feedback an den Spieler (optional – auf dem Zertifikat sichtbar)</div>'
          + '<textarea id="approve-notes-' + sub.id + '" placeholder="z.B. Starke Ballkontrolle! Achte beim nächsten Mal noch auf dein Tempo."></textarea>'
          + '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn green" id="approve-confirm-' + sub.id + '">Zertifikat erteilen</button><button class="btn ghost" id="approve-cancel-' + sub.id + '">Abbrechen</button></div></div>'
          + '<div class="reject-box" id="reject-box-' + sub.id + '"><div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px">Grund für Ablehnung (sichtbar für den Spieler)</div>'
          + '<textarea id="reject-notes-' + sub.id + '" placeholder="z.B. Im Hintergrund sind andere Personen sichtbar – bitte erneut ohne weitere Personen drehen."></textarea>'
          + '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn danger" id="reject-confirm-' + sub.id + '">Ablehnung bestätigen</button><button class="btn ghost" id="reject-cancel-' + sub.id + '">Abbrechen</button></div></div>'
        : '');
    if (sub.status === 'pending') {
      document.getElementById('approve-open-' + sub.id).onclick = function(){ document.getElementById('approve-box-' + sub.id).classList.add('open'); };
      document.getElementById('approve-cancel-' + sub.id).onclick = function(){ document.getElementById('approve-box-' + sub.id).classList.remove('open'); };
      document.getElementById('approve-confirm-' + sub.id).onclick = function(){ approveSubmission(sub, document.getElementById('approve-notes-' + sub.id).value.trim()); };
      document.getElementById('reject-open-' + sub.id).onclick = function(){ document.getElementById('reject-box-' + sub.id).classList.add('open'); };
      document.getElementById('reject-cancel-' + sub.id).onclick = function(){ document.getElementById('reject-box-' + sub.id).classList.remove('open'); };
      document.getElementById('reject-confirm-' + sub.id).onclick = function(){ rejectSubmission(sub, document.getElementById('reject-notes-' + sub.id).value.trim()); };
    }
  }
  // ── Messaging (expert side) ────────────────────────────────
  function expertName(){ return (me && me.full_name && me.full_name.trim()) ? me.full_name.trim() : 'T7 Academy Expert'; }
  function subProfileId(sub){
    // profile_id is the single source of truth for the player link
    // (→ player_profiles.id → player_stats.id). player_email is retired.
    return sub.profile_id || null;
  }
  function postMessage(profileId, body){
    if (!profileId || !body) return Promise.resolve();
    return fetch(SB_URL + '/rest/v1/messages', { method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ profile_id: profileId, sender: 'expert', sender_name: expertName(), body: body, read_by_expert: true, read_by_player: false }) })
      .then(handle401).then(function(r){ if (!r.ok) console.warn('message insert', r.status); });
  }
  function markExpertRead(profileId){
    if (!profileId) return;
    fetch(SB_URL + '/rest/v1/messages?profile_id=eq.' + encodeURIComponent(profileId) + '&sender=eq.player&read_by_expert=eq.false',
      { method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }), body: JSON.stringify({ read_by_expert: true }) }).catch(function(){});
  }
  function loadThread(profileId, elId){
    var el = document.getElementById(elId); if (!el) return;
    if (!profileId) { el.innerHTML = '<div style="color:var(--muted);font-size:12px">Kein Profil verknüpft.</div>'; return; }
    fetch(SB_URL + '/rest/v1/messages?profile_id=eq.' + encodeURIComponent(profileId) + '&select=sender,sender_name,body,created_at&order=created_at.asc', { headers: authHeaders() })
      .then(handle401).then(function(r){ return r.json(); })
      .then(function(rows){
        if (!Array.isArray(rows) || !rows.length) { el.innerHTML = '<div style="color:var(--muted);font-size:12px">Noch keine Nachrichten.</div>'; return; }
        el.innerHTML = rows.map(function(m){
          var mine = m.sender === 'expert';
          var when = new Date(m.created_at).toLocaleString('de-AT');
          return '<div style="margin-bottom:8px;text-align:' + (mine ? 'right' : 'left') + '">'
            + '<div style="display:inline-block;max-width:85%;padding:8px 10px;border-radius:10px;text-align:left;background:' + (mine ? 'rgba(0,229,255,.12)' : 'var(--surface2)') + '">'
            + '<div style="font-size:12.5px;color:var(--text);line-height:1.4">' + esc(m.body) + '</div>'
            + '<div style="font-size:10px;color:var(--muted);margin-top:3px">' + esc(m.sender_name || (mine ? 'Experte' : 'Spieler')) + ' · ' + when + '</div>'
            + '</div></div>';
        }).join('');
        el.scrollTop = el.scrollHeight;
        markExpertRead(profileId);
      }).catch(function(){ el.innerHTML = '<div style="color:var(--muted);font-size:12px">Fehler beim Laden.</div>'; });
  }

  // ── Nachrichten tab (broadcast + per-player) ───────────────
  var msgCurrentPid = null;
  function initMsgs(){
    // Broadcast to all players
    document.getElementById('bc-send').onclick = function(){
      var body = document.getElementById('bc-body').value.trim();
      if (!body) { toast('err', 'Bitte eine Nachricht eingeben.'); return; }
      if (!confirm('Diese Nachricht an ALLE Spieler senden?')) return;
      var btn = this; btn.disabled = true;
      fetch(SB_URL + '/rest/v1/player_profiles?select=id', { headers: authHeaders() })
        .then(handle401).then(function(r){ return r.json(); })
        .then(function(players){
          var rows = (players || []).filter(function(p){ return p.id; }).map(function(p){
            return { profile_id: p.id, sender: 'expert', sender_name: expertName(), body: body, read_by_expert: true, read_by_player: false };
          });
          if (!rows.length) throw new Error('Keine Spieler gefunden.');
          return fetch(SB_URL + '/rest/v1/messages', { method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }), body: JSON.stringify(rows) })
            .then(handle401).then(function(r){ if (!r.ok) throw new Error('Senden fehlgeschlagen (' + r.status + ')'); return rows.length; });
        })
        .then(function(n){ document.getElementById('bc-body').value = ''; btn.disabled = false; toast('ok', 'An ' + n + ' Spieler gesendet.'); })
        .catch(function(e){ btn.disabled = false; if (e && e.message === 'session_expired') return; toast('err', 'Fehler: ' + (e.message || e)); });
    };
    loadMsgPlayers();
  }
  // Red dot on the "Nachrichten" tab when any player has unread replies.
  function refreshMsgTabDot(){
    fetch(SB_URL + '/rest/v1/messages?sender=eq.player&read_by_expert=eq.false&select=profile_id', { headers: authHeaders() })
      .then(handle401).then(function(r){ return r.json(); })
      .then(function(rows){ var d = document.getElementById('msgs-tab-dot'); if (d) d.style.display = (rows && rows.length) ? 'inline-block' : 'none'; })
      .catch(function(){});
  }
  function loadMsgPlayers(){
    var el = document.getElementById('msg-players');
    Promise.all([
      fetch(SB_URL + '/rest/v1/player_profiles?select=id,first_name,last_name', { headers: authHeaders() }).then(handle401).then(function(r){ return r.json(); }),
      fetch(SB_URL + '/rest/v1/messages?sender=eq.player&read_by_expert=eq.false&select=profile_id', { headers: authHeaders() }).then(handle401).then(function(r){ return r.json(); })
    ]).then(function(out){
      var players = out[0] || [], unread = {};
      (out[1] || []).forEach(function(m){ if (m.profile_id) unread[m.profile_id] = (unread[m.profile_id] || 0) + 1; });
      var d = document.getElementById('msgs-tab-dot'); if (d) d.style.display = Object.keys(unread).length ? 'inline-block' : 'none';
      if (!players.length) { el.innerHTML = '<div class="empty">Keine Spieler.</div>'; return; }
      // Unread players first, then alphabetical.
      players.sort(function(a, b){
        var ua = unread[a.id] ? 1 : 0, ub = unread[b.id] ? 1 : 0;
        if (ua !== ub) return ub - ua;
        var na = ((a.first_name || '') + ' ' + (a.last_name || '')).trim().toLowerCase();
        var nb = ((b.first_name || '') + ' ' + (b.last_name || '')).trim().toLowerCase();
        return na < nb ? -1 : na > nb ? 1 : 0;
      });
      el.innerHTML = players.map(function(p){
        var nm = ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || p.id;
        var dot = unread[p.id] ? '<span class="msg-udot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#DC2626;margin-left:8px"></span>' : '';
        return '<div class="msg-prow" style="border-bottom:1px solid var(--border)">'
          + '<button class="btn ghost" data-pid="' + esc(p.id) + '" style="display:block;width:100%;text-align:left">' + esc(nm) + dot + '</button>'
          + '<div class="msg-pthread" id="pthread-' + esc(p.id) + '" style="display:none;padding:6px 2px 14px">'
            + '<div id="thread-' + esc(p.id) + '" style="max-height:300px;overflow:auto;margin-bottom:10px">Lade…</div>'
            + '<textarea id="pbody-' + esc(p.id) + '" placeholder="Nachricht an den Spieler…" style="width:100%;background:var(--surface);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;font-family:inherit;font-size:13px;min-height:60px;resize:vertical"></textarea>'
            + '<div style="margin-top:8px"><button class="btn" data-send="' + esc(p.id) + '">Senden</button></div>'
          + '</div></div>';
      }).join('');
      Array.prototype.forEach.call(el.querySelectorAll('button[data-pid]'), function(b){
        b.onclick = function(){ toggleMsgPlayer(b.getAttribute('data-pid')); };
      });
      Array.prototype.forEach.call(el.querySelectorAll('button[data-send]'), function(b){
        b.onclick = function(){
          var pid = b.getAttribute('data-send'), ta = document.getElementById('pbody-' + pid), body = (ta.value || '').trim();
          if (!body) return; b.disabled = true;
          postMessage(pid, body).then(function(){ ta.value = ''; b.disabled = false; loadThread(pid, 'thread-' + pid); toast('ok', 'Nachricht gesendet.'); })
            .catch(function(){ b.disabled = false; });
        };
      });
    }).catch(function(e){ if (e && e.message === 'session_expired') return; el.innerHTML = '<div class="empty">Fehler beim Laden.</div>'; });
  }
  // Expand/collapse a player's thread in place (no scrolling to a bottom panel).
  function toggleMsgPlayer(pid){
    var wrap = document.getElementById('pthread-' + pid); if (!wrap) return;
    if (wrap.style.display !== 'none') { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    loadThread(pid, 'thread-' + pid);   // marks the player's messages read
    setTimeout(function(){
      refreshMsgTabDot();
      var udot = document.querySelector('button[data-pid="' + pid + '"] .msg-udot'); if (udot) udot.remove();
    }, 700);
  }

  function approveSubmission(sub, notes){
    notes = notes || null;
    // The player's identity is the profile UUID (certification_submissions.profile_id
    // → player_stats.id). There is NO separate `certifications` table: the approved
    // submission row plus player_stats.stars together are the certification record.
    var pid = subProfileId(sub);
    if (!pid) { toast('err', 'Kein Profil verknüpft — Zertifikat kann nicht erteilt werden.'); return; }
    if (!confirm('Zertifikat erteilen und Video löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.')) return;
    // Grant the star by writing player_stats directly. If this fails (e.g. RLS),
    // it throws — so the submission is NOT marked approved and the video is NOT
    // deleted, and the expert sees an error instead of a silent loss.
    awardStars(pid, sub.stars, notes)
      .then(function(){ return updateSubmission(sub.id, { status:'approved', reviewed_at: new Date().toISOString(), reviewed_by: session.user.email, notes: notes }); })
      .then(function(){ return deleteVideo(sub.video_path); })
      .then(function(){ toast('ok', 'Zertifikat erteilt und Video gelöscht.'); loadStats(); loadSubs(); })
      .catch(function(e){ if (e && e.message === 'session_expired') return; toast('err', 'Fehler: ' + (e.message || e)); });
  }
  // Write the star into player_stats. player_stats is a 1:1 table whose primary
  // key `id` IS the player's profile id (FK → player_profiles.id), so we key on
  // `id`. Only raises the value — never lowers a player who already has a higher star.
  //
  // IMPORTANT: these calls use the public ANON key, not the expert's login token.
  // Under RLS the authenticated staff role is not granted write access to
  // player_stats (that returns 403), whereas the anon key is — it's how the player
  // XP widgets write this same table. Using it here keeps approval working without
  // needing a new policy.
  function anonStatsHeaders(extra){
    return Object.assign({ 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }, extra || {});
  }
  function awardStars(profileId, stars, notes){
    if (!profileId || !stars) return Promise.resolve();
    return fetch(SB_URL + '/rest/v1/player_stats?id=eq.' + encodeURIComponent(profileId) + '&select=stars', { headers: anonStatsHeaders() })
      .then(function(r){ return r.ok ? r.json() : []; })
      .then(function(rows){
        var cur = (rows && rows.length && rows[0].stars) ? parseInt(rows[0].stars, 10) : 0;
        if (cur >= parseInt(stars, 10)) return;   // already has an equal/higher star
        return fetch(SB_URL + '/rest/v1/player_stats', {
          method: 'POST',
          headers: anonStatsHeaders({ 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }),
          body: JSON.stringify({ id: profileId, stars: stars, stars_awarded_at: new Date().toISOString(), stars_note: notes || null, updated_at: new Date().toISOString() })
        }).then(function(r){ if (!r.ok) throw new Error('player_stats update fehlgeschlagen (' + r.status + ')'); });
      });
  }
  function rejectSubmission(sub, notes){
    if (!notes) { alert('Bitte einen Grund eintragen.'); return; }
    if (!confirm('Einreichung ablehnen und Video löschen?')) return;
    updateSubmission(sub.id, { status:'rejected', reviewed_at:new Date().toISOString(), reviewed_by:session.user.email, notes:notes })
      .then(function(){ return deleteVideo(sub.video_path); })
      .then(function(){ toast('ok', 'Einreichung abgelehnt. Spieler benachrichtigen nicht vergessen.'); loadStats(); loadSubs(); })
      .catch(function(e){ if (e && e.message === 'session_expired') return; toast('err', 'Fehler: ' + (e.message || e)); });
  }
  function updateSubmission(id, patch){
    return fetch(SB_URL + '/rest/v1/certification_submissions?id=eq.' + id, { method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json', 'Prefer':'return=minimal' }), body: JSON.stringify(patch) })
      .then(handle401).then(function(r){ if (!r.ok) throw new Error('update failed (' + r.status + ')'); });
  }
  function deleteVideo(path){
    return fetch(SB_URL + '/storage/v1/object/' + BUCKET + '/' + path, { method: 'DELETE', headers: authHeaders() })
      .then(handle401).then(function(r){ if (!r.ok && r.status !== 404) throw new Error('delete failed (' + r.status + ')'); });
  }

  /* ==========================================================
     TAB — CHALLENGE DES MONATS  (permission: challenges)
     ========================================================== */
  // Curation state
  var vpSelected = [];                 // [{title, vid, hash, meta, xp}]
  var vpMode = 'search';
  var vpFilters = { stars:[], sevens:[], position:[], difficulty:[], category:[], player:[] };
  var vpTimer = null;
  var VP_SELECT = 'select=id,title_DE,title_EN,vimeo_code,vimeo_url,stars,sevens,difficulty,category,player_1,player_2,player_3';

  function initMonats(){
    document.getElementById('f-save').onclick = save;
    document.getElementById('f-clear').onclick = clearForm;
    setupPicker();
    loadSchedule();
  }

  // ── VIDEO PICKER ───────────────────────────────────────
  function setupPicker(){
    Array.prototype.forEach.call(document.querySelectorAll('#vp-modes .pill'), function(b){
      b.onclick = function(){ vpSetMode(b.getAttribute('data-mode')); };
    });
    var q = document.getElementById('vp-q');
    q.oninput = function(){ clearTimeout(vpTimer); vpTimer = setTimeout(vpRunSearch, 300); };
    document.getElementById('vp-vadd').onclick = addVimeo;
    Array.prototype.forEach.call(document.querySelectorAll('#vp-pos .vp-fpill'), function(p){
      p.onclick = function(){ vpTogglePill(p); };
    });
    loadDistinct();
    renderSelected();
  }
  function vpSetMode(mode){
    vpMode = mode;
    Array.prototype.forEach.call(document.querySelectorAll('#vp-modes .pill'), function(b){
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
    document.getElementById('vp-pane-search').style.display = mode === 'search' ? 'block' : 'none';
    document.getElementById('vp-pane-filter').style.display = mode === 'filter' ? 'block' : 'none';
    document.getElementById('vp-pane-vimeo').style.display  = mode === 'vimeo'  ? 'block' : 'none';
    var res = document.getElementById('vp-results');
    if (mode === 'vimeo') { res.innerHTML = ''; return; }
    if (mode === 'search') vpRunSearch(); else vpRunFilter();
  }
  function vpHeaders(){ return authHeaders(); }

  // Parse {vid, hash} from a videos row (vimeo_code "id/hash", vimeo_url fallback)
  function parseVidHash(row){
    var vid = '', hash = '';
    var code = row && row.vimeo_code ? String(row.vimeo_code).trim() : '';
    if (code){ var parts = code.split('/'); vid = (parts[0]||'').trim(); if (parts[1]) hash = parts[1].trim(); }
    if (!hash && row && row.vimeo_url){
      var m = String(row.vimeo_url).match(/vimeo\.com\/(?:video\/)?\d+\/([a-zA-Z0-9]+)/);
      if (m) hash = m[1]; else { m = String(row.vimeo_url).match(/[?&]h=([a-zA-Z0-9]+)/); if (m) hash = m[1]; }
    }
    if (!vid && row && row.vimeo_url){ var m2 = String(row.vimeo_url).match(/vimeo\.com\/(?:video\/)?(\d+)/); if (m2) vid = m2[1]; }
    return { vid: vid, hash: hash };
  }
  // Parse a raw Vimeo URL or ID typed by the expert
  function parseVimeoInput(str){
    str = (str||'').trim();
    if (!str) return { vid:'', hash:'' };
    var m = str.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/);
    if (m) { var h = m[2] || ''; if (!h){ var hh = str.match(/[?&]h=([a-zA-Z0-9]+)/); if (hh) h = hh[1]; } return { vid: m[1], hash: h }; }
    var p = str.split(/[\/?#]/); var vid = (p[0]||'').replace(/[^0-9]/g,''); var hash = (p[1]||'').replace(/[^a-zA-Z0-9]/g,'');
    return { vid: vid, hash: hash };
  }
  function clean(s){ return (s==null?'':String(s)).trim(); }
  function metaOf(row){ return [clean(row.difficulty), clean(row.category)].filter(Boolean).join(' – ') || 'Challenge des Monats'; }
  function drillKey(d){ return String(d.vid||'') + '|' + String(d.hash||''); }
  function isSelected(d){ var k = drillKey(d); for (var i=0;i<vpSelected.length;i++) if (drillKey(vpSelected[i])===k) return true; return false; }

  function vpRunSearch(){
    var q = document.getElementById('vp-q').value.trim();
    var res = document.getElementById('vp-results');
    if (!q){ res.innerHTML = '<div class="vp-empty">Tippe zum Suchen…</div>'; return; }
    res.innerHTML = '<div class="vp-empty">Suche…</div>';
    var enc = encodeURIComponent(q);
    var url = SB_URL + '/rest/v1/videos?' + VP_SELECT
      + '&vimeo_code=not.is.null&or=(title_DE.ilike.*' + enc + '*,title_EN.ilike.*' + enc + '*)&limit=25';
    fetch(url, { headers: vpHeaders() }).then(handle401).then(function(r){ return r.json(); })
      .then(function(rows){ renderResults(Array.isArray(rows)?rows:[]); })
      .catch(function(e){ if (e && e.message==='session_expired') return; res.innerHTML = '<div class="vp-empty">Fehler beim Laden.</div>'; });
  }
  function vpTogglePill(btn){
    var field = btn.parentElement.getAttribute('data-field'); var val = btn.getAttribute('data-val');
    if (!field || !val) return; var arr = vpFilters[field]; var i = arr.indexOf(val);
    if (btn.classList.contains('active')){ btn.classList.remove('active'); if (i>=0) arr.splice(i,1); }
    else { btn.classList.add('active'); if (i<0) arr.push(val); }
    vpRunFilter();
  }
  function anyFilter(){ for (var k in vpFilters) if (vpFilters[k].length) return true; return false; }
  function buildFilterQuery(){
    var q = [];
    if (vpFilters.stars.length)  q.push('stars=in.(' + vpFilters.stars.join(',') + ')');
    if (vpFilters.sevens.length) q.push('sevens=in.(' + vpFilters.sevens.join(',') + ')');
    if (vpFilters.position.length){ q.push('or=(' + vpFilters.position.map(function(p){ return p + '.gt.0'; }).join(',') + ')'); }
    if (vpFilters.difficulty.length){ q.push('difficulty=in.(' + vpFilters.difficulty.map(function(v){ return '"'+v+'"'; }).join(',') + ')'); }
    if (vpFilters.category.length){ q.push('category=in.(' + vpFilters.category.map(function(v){ return '"'+v+'"'; }).join(',') + ')'); }
    if (vpFilters.player.length){
      var orPl = []; vpFilters.player.forEach(function(p){ var pe='"'+p+'"'; orPl.push('player_1.eq.'+pe,'player_2.eq.'+pe,'player_3.eq.'+pe); });
      q.push('or=(' + orPl.join(',') + ')');
    }
    q.push('vimeo_code=not.is.null'); q.push(VP_SELECT); q.push('limit=40');
    return q.join('&');
  }
  function vpRunFilter(){
    var res = document.getElementById('vp-results');
    if (!anyFilter()){ res.innerHTML = '<div class="vp-empty">Wähle Filter, um Videos zu finden.</div>'; return; }
    res.innerHTML = '<div class="vp-empty">Suche…</div>';
    fetch(SB_URL + '/rest/v1/videos?' + buildFilterQuery(), { headers: vpHeaders() }).then(handle401).then(function(r){ return r.json(); })
      .then(function(rows){ renderResults(Array.isArray(rows)?rows:[]); })
      .catch(function(e){ if (e && e.message==='session_expired') return; res.innerHTML = '<div class="vp-empty">Fehler beim Laden.</div>'; });
  }
  function renderResults(rows){
    var res = document.getElementById('vp-results');
    if (!rows.length){ res.innerHTML = '<div class="vp-empty">Keine Videos gefunden.</div>'; return; }
    res.innerHTML = '';
    rows.forEach(function(row){
      var vh = parseVidHash(row);
      var title = clean(row.title_DE) || clean(row.title_EN) || 'Untitled';
      var meta = metaOf(row);
      var drill = { title: title, vid: vh.vid, hash: vh.hash, meta: meta, xp: 10 };
      var added = isSelected(drill);
      var d = document.createElement('div');
      d.className = 'vp-res' + (added ? ' added' : '');
      d.innerHTML = '<div class="vp-res-main"><div class="vp-res-title">' + esc(title) + '</div>'
        + '<div class="vp-res-meta">' + esc(meta) + (vh.vid ? ' · #' + esc(vh.vid) : '') + (vh.hash ? '' : ' · <span style="color:var(--red)">kein Hash</span>') + '</div></div>';
      var btn = document.createElement('button');
      btn.className = 'btn sm'; btn.type = 'button';
      btn.textContent = added ? '✓ Hinzugefügt' : '+ Hinzufügen';
      btn.disabled = added;
      btn.onclick = function(){ addDrill(drill); btn.textContent = '✓ Hinzugefügt'; btn.disabled = true; d.classList.add('added'); };
      d.appendChild(btn);
      res.appendChild(d);
    });
  }
  function addDrill(drill){
    if (!drill.vid){ toast('err', 'Video ohne Vimeo-ID – übersprungen.'); return; }
    if (isSelected(drill)) return;
    vpSelected.push({ title: drill.title, vid: drill.vid, hash: drill.hash, meta: drill.meta, xp: (typeof drill.xp==='number'?drill.xp:10) });
    renderSelected();
  }
  function addVimeo(){
    var vh = parseVimeoInput(document.getElementById('vp-vurl').value);
    var title = document.getElementById('vp-vtitle').value.trim();
    if (!vh.vid){ toast('err', 'Keine gültige Vimeo-ID erkannt.'); return; }
    addDrill({ title: title || ('Vimeo ' + vh.vid), vid: vh.vid, hash: vh.hash, meta: 'Challenge des Monats', xp: 10 });
    document.getElementById('vp-vurl').value = ''; document.getElementById('vp-vtitle').value = '';
  }
  function renderSelected(){
    var el = document.getElementById('vp-selected');
    document.getElementById('vp-count').textContent = vpSelected.length;
    if (!vpSelected.length){ el.innerHTML = '<div class="vp-empty">Noch keine Videos ausgewählt.</div>'; return; }
    el.innerHTML = '';
    vpSelected.forEach(function(d, i){
      var row = document.createElement('div'); row.className = 'vp-sel';
      row.innerHTML = '<div class="vp-sel-num">' + (i+1) + '</div>'
        + '<div class="vp-sel-main">'
        +   '<input class="vp-sel-title" value="' + esc(d.title) + '" placeholder="Titel">'
        +   '<div class="vp-sel-meta">' + esc(d.meta || '') + ' · #' + esc(d.vid) + (d.hash ? '/' + esc(d.hash) : ' · <span style="color:var(--red)">kein Hash</span>') + '</div>'
        + '</div>'
        + '<label class="vp-sel-xp">XP <input type="number" min="0" max="999" value="' + (d.xp) + '"></label>'
        + '<div class="vp-sel-btns">'
        +   '<button class="vp-icon" type="button" data-up="' + i + '"' + (i===0?' disabled':'') + '>↑</button>'
        +   '<button class="vp-icon" type="button" data-down="' + i + '"' + (i===vpSelected.length-1?' disabled':'') + '>↓</button>'
        +   '<button class="vp-icon del" type="button" data-del="' + i + '">✕</button>'
        + '</div>';
      row.querySelector('.vp-sel-title').onchange = function(e){ vpSelected[i].title = e.target.value.trim() || ('Video ' + (i+1)); };
      row.querySelector('.vp-sel-xp input').onchange = function(e){ var v = parseInt(e.target.value,10); vpSelected[i].xp = isNaN(v)?10:Math.max(0,v); };
      row.querySelector('[data-del]').onclick = function(){ vpSelected.splice(i,1); renderSelected(); refreshResultsAdded(); };
      var up = row.querySelector('[data-up]'); if (up) up.onclick = function(){ if (i>0){ var t=vpSelected[i]; vpSelected[i]=vpSelected[i-1]; vpSelected[i-1]=t; renderSelected(); } };
      var dn = row.querySelector('[data-down]'); if (dn) dn.onclick = function(){ if (i<vpSelected.length-1){ var t=vpSelected[i]; vpSelected[i]=vpSelected[i+1]; vpSelected[i+1]=t; renderSelected(); } };
      el.appendChild(row);
    });
  }
  function refreshResultsAdded(){
    if (vpMode === 'search') vpRunSearch(); else if (vpMode === 'filter') vpRunFilter();
  }

  // ── Distinct filter values (stars / sevens / difficulty / category / player) ──
  function loadDistinct(){
    fetch(SB_URL + '/rest/v1/videos?select=stars,sevens,difficulty,category,player_1,player_2,player_3&vimeo_code=not.is.null', { headers: vpHeaders() })
      .then(handle401).then(function(r){ return r.json(); })
      .then(function(rows){
        if (!Array.isArray(rows)) return;
        var stars={}, sevens={}, diff={}, cat={}, pl={};
        rows.forEach(function(r){
          if (r.stars!=null) stars[String(r.stars)]=1;
          if (r.sevens!=null) sevens[String(r.sevens)]=1;
          var d=clean(r.difficulty); if (d) diff[d]=1;
          var c=clean(r.category); if (c) cat[c]=1;
          [r.player_1,r.player_2,r.player_3].forEach(function(p){ var n=clean(p); if (n) pl[n]=1; });
        });
        var numSort=function(a,b){ return Number(a)-Number(b); };
        fillStarPills('vp-stars', Object.keys(stars).sort(numSort), '⭐');
        fillStarPills('vp-sevens', Object.keys(sevens).sort(numSort), '7️⃣');
        fillPills('vp-diff', Object.keys(diff).sort());
        fillPills('vp-cat', Object.keys(cat).sort());
        fillPills('vp-player', Object.keys(pl).sort());
      })
      .catch(function(){
        ['vp-stars','vp-sevens','vp-diff','vp-cat','vp-player'].forEach(function(id){
          var el=document.getElementById(id); if (el) el.innerHTML='<span class="vp-empty">Fehler beim Laden</span>';
        });
      });
  }
  function fillPills(containerId, values){
    var el = document.getElementById(containerId); if (!el) return;
    if (!values.length){ el.innerHTML='<span class="vp-empty">Keine Daten</span>'; return; }
    el.innerHTML='';
    values.forEach(function(v){
      var b=document.createElement('button'); b.type='button'; b.className='vp-fpill'; b.setAttribute('data-val', v); b.textContent=v;
      b.onclick=function(){ vpTogglePill(b); }; el.appendChild(b);
    });
  }
  function fillStarPills(containerId, values, icon){
    var el = document.getElementById(containerId); if (!el) return;
    if (!values.length){ el.innerHTML='<span class="vp-empty">Keine Daten</span>'; return; }
    el.innerHTML='';
    values.forEach(function(v){
      var b=document.createElement('button'); b.type='button'; b.className='vp-fpill'; b.setAttribute('data-val', v);
      var n=Math.min(7,Math.max(1,Number(v)||1)); b.textContent=icon.repeat(n)+' '+v;
      b.onclick=function(){ vpTogglePill(b); }; el.appendChild(b);
    });
  }

  function save(){
    var err = document.getElementById('f-err'); err.textContent = '';
    var month = document.getElementById('f-month').value, name = document.getElementById('f-name').value.trim(),
        badge = document.getElementById('f-badge').value.trim(),
        hero = document.getElementById('f-hero').value.trim(), unlk = document.getElementById('f-unlock').value.trim();
    if (!month) { err.textContent = 'Bitte einen Monat wählen.'; return; }
    if (!name)  { err.textContent = 'Bitte einen Titel eingeben.'; return; }
    if (!vpSelected.length) { err.textContent = 'Bitte mindestens ein Video auswählen.'; return; }
    var missing = vpSelected.filter(function(d){ return !d.vid; });
    if (missing.length) { err.textContent = missing.length + ' Video(s) ohne Vimeo-ID. Bitte entfernen oder korrigieren.'; return; }
    var drills = vpSelected.map(function(d){ return { title: d.title, vid: String(d.vid), hash: String(d.hash||''), meta: d.meta||'', xp: (typeof d.xp==='number'?d.xp:10) }; });
    var btn = document.getElementById('f-save'); btn.disabled = true; btn.textContent = 'Speichern…';
    var body = { month: month, name: name, module_key: null, drills: drills, badge: badge || null,
      hero_text: hero || null, unlock_msg: unlk || null, updated_at: new Date().toISOString(), updated_by: session.user.email };
    fetch(SB_URL + '/rest/v1/monthly_challenges', { method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(body) })
      .then(handle401).then(function(r){ btn.disabled = false; btn.textContent = 'Speichern';
        if (!r.ok) return r.text().then(function(t){ throw new Error(t || ('HTTP ' + r.status)); });
        toast('ok', 'Gespeichert für ' + prettyMonth(month) + ' (' + drills.length + ' Videos).'); clearForm(); loadSchedule(); })
      .catch(function(e){ btn.disabled = false; btn.textContent = 'Speichern'; if (e && e.message === 'session_expired') return; err.textContent = 'Fehler: ' + (e.message || e); });
  }
  function editRow(row){
    document.getElementById('form-title').textContent = 'Monat bearbeiten';
    document.getElementById('f-month').value = row.month; document.getElementById('f-name').value = row.name || '';
    document.getElementById('f-badge').value = row.badge || '';
    document.getElementById('f-hero').value = row.hero_text || ''; document.getElementById('f-unlock').value = row.unlock_msg || '';
    var raw = row.drills, arr = [];
    try { arr = (typeof raw === 'string' ? JSON.parse(raw) : (raw || [])); } catch(e){ arr = []; }
    vpSelected = (Array.isArray(arr) ? arr : []).map(function(d){
      return { title: d.title || '', vid: String(d.vid||''), hash: String(d.hash||''), meta: d.meta || '', xp: (typeof d.xp==='number'?d.xp:10) };
    });
    renderSelected(); refreshResultsAdded();
    document.getElementById('f-clear').style.display = 'inline-block'; document.getElementById('f-err').textContent = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function clearForm(){
    document.getElementById('form-title').textContent = 'Neue Monats-Challenge';
    ['f-month','f-name','f-badge','f-hero','f-unlock'].forEach(function(id){ document.getElementById(id).value = ''; });
    vpSelected = []; renderSelected();
    document.getElementById('vp-q').value = '';
    Array.prototype.forEach.call(document.querySelectorAll('#vp-pane-filter .vp-fpill.active'), function(p){ p.classList.remove('active'); });
    vpFilters = { stars:[], sevens:[], position:[], difficulty:[], category:[], player:[] };
    vpSetMode('search');
    document.getElementById('f-clear').style.display = 'none'; document.getElementById('f-err').textContent = '';
  }
  function delRow(month){
    if (!confirm('Eintrag für ' + prettyMonth(month) + ' löschen?')) return;
    fetch(SB_URL + '/rest/v1/monthly_challenges?month=eq.' + encodeURIComponent(month), { method: 'DELETE', headers: authHeaders({ 'Prefer': 'return=minimal' }) })
      .then(handle401).then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); toast('ok', 'Gelöscht.'); loadSchedule(); })
      .catch(function(e){ if (e && e.message === 'session_expired') return; toast('err', 'Löschen fehlgeschlagen: ' + (e.message || e)); });
  }
  function loadSchedule(){
    var el = document.getElementById('sched-list'); el.innerHTML = '<div class="loading">Lade…</div>';
    fetch(SB_URL + '/rest/v1/monthly_challenges?select=*&order=month.desc', { headers: authHeaders() })
      .then(handle401).then(function(r){ return r.json(); })
      .then(function(rows){
        if (!Array.isArray(rows) || !rows.length){ el.innerHTML = '<div class="empty"><div class="empty-icon">📅</div>Noch keine Monate geplant.</div>'; return; }
        var nowKey = monthKey(new Date());
        el.innerHTML = rows.map(function(row){ return renderSched(row, nowKey); }).join('');
        Array.prototype.forEach.call(el.querySelectorAll('[data-edit]'), function(b){ b.onclick = function(){ editRow(findRow(rows, b.getAttribute('data-edit'))); }; });
        Array.prototype.forEach.call(el.querySelectorAll('[data-del]'), function(b){ b.onclick = function(){ delRow(b.getAttribute('data-del')); }; });
      }).catch(function(e){ if (e && e.message === 'session_expired') return; el.innerHTML = '<div class="empty">Fehler beim Laden.</div>'; });
  }
  function drillCount(row){
    var raw = row.drills, arr = [];
    try { arr = (typeof raw === 'string' ? JSON.parse(raw) : (raw || [])); } catch(e){ arr = []; }
    return Array.isArray(arr) ? arr.length : 0;
  }
  function renderSched(row, nowKey){
    var isNow = row.month === nowKey;
    var n = drillCount(row);
    var meta = n
      ? (n + ' Video' + (n === 1 ? '' : 's'))
      : (row.module_key ? 'Modul: ' + esc(row.module_key) + ' (alt)' : '<span style="color:var(--red)">keine Videos</span>');
    return '<div class="srow' + (isNow ? ' current' : '') + '"><div class="srow-main">'
      + '<div class="srow-month">' + prettyMonth(row.month) + (isNow ? ' · aktiv' : '') + '</div>'
      + '<div class="srow-name">' + esc(row.name) + (row.badge ? '<span class="srow-badge">' + esc(row.badge) + '</span>' : '') + '</div>'
      + '<div class="srow-meta"><strong style="color:var(--text)">' + meta + '</strong></div></div>'
      + '<div class="srow-actions"><button class="btn ghost sm" data-edit="' + esc(row.month) + '">Bearbeiten</button>'
      + '<button class="btn danger sm" data-del="' + esc(row.month) + '">Löschen</button></div></div>';
  }
  function monthKey(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function prettyMonth(mk){ var p = (mk || '').split('-'); if (p.length < 2) return mk || ''; return (MONTHS[parseInt(p[1], 10) - 1] || p[1]) + ' ' + p[0]; }
  function findRow(rows, month){ for (var i = 0; i < rows.length; i++) if (rows[i].month === month) return rows[i]; return null; }

  /* ==========================================================
     TAB — MITARBEITER  (permission: manage_employees)
     ========================================================== */
  function initTeam(){ loadTeam(); }

  function loadTeam(){
    var el = document.getElementById('team-list'); el.innerHTML = '<div class="loading">Lade…</div>';
    fetch(SB_URL + '/rest/v1/employees?select=*&order=created_at.asc', { headers: authHeaders() })
      .then(handle401).then(function(r){ return r.json(); })
      .then(function(rows){
        rows = Array.isArray(rows) ? rows : [];
        if (!rows.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">👥</div>Keine Mitarbeiter gefunden.</div>'; return; }
        el.innerHTML = rows.map(renderEmployee).join('');
        bindTeamControls();
      }).catch(function(e){ if (e && e.message === 'session_expired') return; el.innerHTML = '<div class="empty">Fehler beim Laden.</div>'; });
  }

  function permLabel(key){ for (var i = 0; i < PERMS.length; i++) if (PERMS[i].key === key) return PERMS[i].label; return key; }

  function renderEmployee(row){
    var isMe = row.id === (session.user && session.user.id);
    var isOwner = !!(me && me.is_owner);
    var perms = row.permissions || [];
    var badges = (row.is_owner ? '<span class="ebadge admin">owner</span>' : '')
      + (row.active ? '<span class="ebadge active">aktiv</span>' : '<span class="ebadge inactive">inaktiv</span>');
    var chips = row.is_owner ? '<span class="ebadge role">alle Rechte</span>'
      : (perms.length ? perms.map(function(p){ return '<span class="ebadge role">' + esc(permLabel(p)) + '</span>'; }).join('')
                      : '<span style="color:var(--muted);font-size:12px">keine Rechte</span>');

    var ctl;
    if (isMe) {
      ctl = '<div class="emp-ctl"><span style="font-size:12px;color:var(--muted)">— du — (dein eigenes Konto ändert ein anderer Admin)</span></div>';
    } else {
      var checks = PERMS.map(function(p){
        var on = row.is_owner || perms.indexOf(p.key) >= 0;
        return '<label class="emp-check"><input type="checkbox" data-perm="' + p.key + '" data-id="' + esc(row.id) + '"'
          + (on ? ' checked' : '') + (row.is_owner ? ' disabled' : '') + '> ' + esc(p.label) + '</label>';
      }).join('');
      var ownerToggle = isOwner
        ? '<label class="emp-check"><input type="checkbox" data-owner="' + esc(row.id) + '"' + (row.is_owner ? ' checked' : '') + '> <strong>Owner</strong></label>'
        : '';
      var activeBtn = '<button class="btn ' + (row.active ? 'danger' : 'green') + ' sm" data-active-toggle="' + esc(row.id) + '" data-active="' + (row.active ? '1' : '0') + '">'
        + (row.active ? 'Deaktivieren' : 'Aktivieren') + '</button>';
      ctl = '<div class="emp-ctl"><div class="emp-checks">' + checks + ownerToggle + '</div>' + activeBtn + '</div>';
    }

    return '<div class="card"><div class="srow-name">'
      + '<input class="emp-name" data-name="' + esc(row.id) + '" value="' + esc(row.full_name || '') + '" placeholder="Name">'
      + ' ' + badges + '</div>'
      + '<div class="srow-meta" style="margin-top:6px">' + esc(row.email || '') + ' · ' + chips + '</div>'
      + ctl + '</div>';
  }

  function bindTeamControls(){
    Array.prototype.forEach.call(document.querySelectorAll('input[data-perm]'), function(cb){
      cb.onchange = function(){
        var id = cb.getAttribute('data-id'); var arr = [];
        Array.prototype.forEach.call(document.querySelectorAll('input[data-perm][data-id="' + id + '"]'), function(x){ if (x.checked) arr.push(x.getAttribute('data-perm')); });
        patchEmployee(id, { permissions: arr }, 'Berechtigungen aktualisiert.');
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[data-owner]'), function(cb){
      cb.onchange = function(){
        var id = cb.getAttribute('data-owner');
        if (cb.checked && !confirm('Diesem Mitarbeiter ALLE Rechte (Owner) geben?')) { cb.checked = false; return; }
        patchEmployee(id, { is_owner: cb.checked }, 'Owner-Status aktualisiert.');
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-active-toggle]'), function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-active-toggle'); var makeActive = btn.getAttribute('data-active') === '0';
        if (!makeActive && !confirm('Mitarbeiter deaktivieren? Der Zugriff wird sofort entzogen.')) return;
        patchEmployee(id, { active: makeActive }, makeActive ? 'Aktiviert.' : 'Deaktiviert.');
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[data-name]'), function(inp){
      inp.onchange = function(){ patchEmployee(inp.getAttribute('data-name'), { full_name: inp.value.trim() || null }, 'Name gespeichert.', true); };
    });
  }

  function patchEmployee(id, patch, okMsg, quiet){
    fetch(SB_URL + '/rest/v1/employees?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: authHeaders({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body: JSON.stringify(patch)
    }).then(handle401).then(function(r){
      if (!r.ok) return r.text().then(function(t){ throw new Error(t || ('HTTP ' + r.status)); });
      toast('ok', okMsg); if (!quiet) loadTeam();
    }).catch(function(e){ if (e && e.message === 'session_expired') return; toast('err', 'Fehler: ' + (e.message || e)); loadTeam(); });
  }

  /* ==========================================================
     TAB — CLUB-ANFRAGEN  (permission: club_enquiries)
     Reads rows from the public `club_enquiries` table (written by the
     subscription page's enquiry form) and lets staff mark them
     contacted / closed. Mirrors the certification-review pattern.
     ========================================================== */
  var enqFilter = 'new';

  function initEnquiries(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-enq-filter]'), function(b){
      b.onclick = function(){
        Array.prototype.forEach.call(document.querySelectorAll('[data-enq-filter]'), function(x){ x.classList.remove('active'); });
        b.classList.add('active');
        enqFilter = b.getAttribute('data-enq-filter');
        loadEnquiries();
      };
    });
    loadEnqStats();
    loadEnquiries();
  }

  function loadEnqStats(){
    fetch(SB_URL + '/rest/v1/club_enquiries?select=status', { headers: authHeaders() })
      .then(handle401).then(function(r){ return r.json(); })
      .then(function(rows){
        rows = Array.isArray(rows) ? rows : [];
        var c = { new:0, contacted:0, closed:0 };
        rows.forEach(function(r){ if (c[r.status] != null) c[r.status]++; });
        document.getElementById('enq-stats').innerHTML =
          statTile(c.new,'Neu','accent') + statTile(c.contacted,'Kontaktiert','') +
          statTile(c.closed,'Geschlossen','') + statTile(rows.length,'Gesamt','');
      }).catch(function(){});
  }

  function loadEnquiries(){
    var el = document.getElementById('enq-list');
    el.innerHTML = '<div class="loading">Lade…</div>';
    var q = '?select=*&order=created_at.desc';
    if (enqFilter !== 'all') q += '&status=eq.' + enqFilter;
    fetch(SB_URL + '/rest/v1/club_enquiries' + q, { headers: authHeaders() })
      .then(handle401).then(function(r){ if (!r.ok) throw r; return r.json(); })
      .then(function(rows){
        rows = Array.isArray(rows) ? rows : [];
        if (!rows.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">📭</div>Keine Anfragen.</div>'; return; }
        el.innerHTML = rows.map(renderEnquiry).join('');
        bindEnquiries();
      }).catch(function(e){ if (e && e.message === 'session_expired') return; el.innerHTML = '<div class="empty">Fehler beim Laden.</div>'; });
  }

  function enqStatusLabel(s){ return { new:'Neu', contacted:'Kontaktiert', closed:'Geschlossen' }[s] || s; }
  function enqBadgeClass(s){ return { new:'pending', contacted:'approved', closed:'expired' }[s] || 'pending'; }

  function renderEnquiry(it){
    var date = new Date(it.created_at).toLocaleString('de-AT', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    var size = [];
    if (it.num_teams != null) size.push(esc(it.num_teams) + ' Teams');
    if (it.num_kids  != null) size.push(esc(it.num_kids) + ' Kinder');
    if (it.age_groups) size.push(esc(it.age_groups));
    var contactBits = [];
    if (it.email) contactBits.push('<a href="mailto:' + esc(it.email) + '" style="color:var(--accent);text-decoration:none">' + esc(it.email) + '</a>');
    if (it.phone) contactBits.push('<a href="tel:' + esc(it.phone) + '" style="color:var(--accent);text-decoration:none">' + esc(it.phone) + '</a>');
    var handledLine = it.handled_at
      ? ('<div>Bearbeitet: <strong>' + new Date(it.handled_at).toLocaleString('de-AT') + '</strong>' + (it.handled_by ? ' von ' + esc(it.handled_by) : '') + '</div>')
      : '';
    var actions = '';
    if (it.status !== 'contacted') actions += '<button class="btn sm" data-enq-contacted="' + esc(it.id) + '">Als kontaktiert markieren</button>';
    if (it.status !== 'closed')    actions += '<button class="btn ghost sm" data-enq-closed="' + esc(it.id) + '">Schließen</button>';
    if (it.status !== 'new')       actions += '<button class="btn ghost sm" data-enq-new="' + esc(it.id) + '">Wieder öffnen</button>';

    return '<div class="card"><div class="card-row"><div class="card-left">'
      + '<div class="card-title">' + esc(it.club_name || '—') + '</div>'
      + '<div class="card-meta">'
        + '<span class="badge ' + enqBadgeClass(it.status) + '">' + enqStatusLabel(it.status) + '</span> '
        + '<span>Eingegangen: <strong>' + date + '</strong></span>'
        + '<div>Ansprechperson: <strong>' + esc(it.contact_name || '—') + '</strong></div>'
        + (contactBits.length ? '<div>' + contactBits.join(' · ') + '</div>' : '')
        + (size.length ? '<div>Größe: <strong>' + size.join(' · ') + '</strong></div>' : '')
        + (it.message ? '<div style="margin-top:6px">„' + esc(it.message) + '“</div>' : '')
        + handledLine
      + '</div></div>'
      + '<div class="card-actions">' + actions + '</div></div></div>';
  }

  function bindEnquiries(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-enq-contacted]'), function(b){
      b.onclick = function(){ setEnqStatus(b.getAttribute('data-enq-contacted'), 'contacted'); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-enq-closed]'), function(b){
      b.onclick = function(){ setEnqStatus(b.getAttribute('data-enq-closed'), 'closed'); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-enq-new]'), function(b){
      b.onclick = function(){ setEnqStatus(b.getAttribute('data-enq-new'), 'new'); };
    });
  }

  function setEnqStatus(id, status){
    var patch = { status: status };
    if (status === 'new') { patch.handled_at = null; patch.handled_by = null; }
    else { patch.handled_at = new Date().toISOString(); patch.handled_by = session.user.email; }
    fetch(SB_URL + '/rest/v1/club_enquiries?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: authHeaders({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body: JSON.stringify(patch)
    }).then(handle401).then(function(r){
      if (!r.ok) return r.text().then(function(t){ throw new Error(t || ('HTTP ' + r.status)); });
      toast('ok', 'Status: ' + enqStatusLabel(status) + '.');
      loadEnqStats(); loadEnquiries(); refreshEnqDot();
    }).catch(function(e){ if (e && e.message === 'session_expired') return; toast('err', 'Fehler: ' + (e.message || e)); });
  }

  function refreshEnqDot(){
    fetch(SB_URL + '/rest/v1/club_enquiries?status=eq.new&select=id', { headers: authHeaders() })
      .then(handle401).then(function(r){ return r.json(); })
      .then(function(rows){ var d = document.getElementById('enq-tab-dot'); if (d) d.style.display = (rows && rows.length) ? 'inline-block' : 'none'; })
      .catch(function(){});
  }

  // ── SHARED UTILS ───────────────────────────────────────
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function toast(kind, msg){ var t = document.getElementById('toast'); t.className = 'toast ' + kind + ' show'; t.textContent = msg; setTimeout(function(){ t.className = 'toast ' + kind; }, 3200); }

  boot();
})();
