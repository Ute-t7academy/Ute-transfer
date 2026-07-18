/* ============================================================
   T7 ACADEMY · Certificate Video Upload Widget
   ------------------------------------------------------------
   Two submission paths inside one modal:
     1. "Direkt hier filmen"  — record in-browser via MediaRecorder
     2. "Video anhängen"      — pick an existing file from device

   Both end up as the same private upload to Supabase Storage.
   No email anywhere in the flow.

   USAGE:
     <script src=".../t7-widget-engine.js"></script>
     <script src=".../t7-cert-upload.js"></script>

     T7CertUpload(3);   // opens modal for 3-star certificate
   ============================================================ */

(function(){
  // ── Config ───────────────────────────────────────────────
  var SB_URL = 'https://qajjuhjmrtuomwrbxmpz.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';
  var BUCKET = 'cert-submissions';
  var MAX_BYTES = 100 * 1024 * 1024;        // 100 MB
  var MAX_REC_SECONDS = 120;                // 2 min hard stop on in-browser recording

  // Recording state (per-modal)
  var rec = { stream:null, recorder:null, chunks:[], blob:null, mime:'video/webm', timer:null, seconds:0 };

  // ── Public entry point ───────────────────────────────────
  window.T7CertUpload = function(stars){
    stars = parseInt(stars, 10);
    if (!(stars >= 1 && stars <= 5)) { console.error('T7CertUpload: stars must be 1–5'); return; }
    injectStyles();

    if (window.T7Identity && typeof T7Identity.resolve === 'function') {
      T7Identity.resolve(function(email){ openModal(stars, email); });
    } else {
      openModal(stars, null);
    }
  };

  // ── Modal ────────────────────────────────────────────────
  function openModal(stars, email){
    closeModal();
    var ov = document.createElement('div');
    ov.className = 't7cu-overlay';
    ov.id = 't7cu-overlay';
    ov.innerHTML = renderModal(stars, email);
    document.body.appendChild(ov);

    ov.addEventListener('click', function(e){ if (e.target === ov) closeModal(); });
    document.getElementById('t7cu-close').onclick = closeModal;

    if (email) checkExisting(stars, email);

    var consent = document.getElementById('t7cu-consent');
    consent.addEventListener('change', function(){
      document.getElementById('t7cu-choices').classList.toggle('enabled', consent.checked);
      document.getElementById('t7cu-choice-record').disabled = !consent.checked;
      document.getElementById('t7cu-choice-attach').disabled = !consent.checked;
    });

    // Choice: record in browser
    document.getElementById('t7cu-choice-record').addEventListener('click', function(){
      if (!consent.checked) return;
      startRecordView(stars, email);
    });

    // Choice: attach existing file
    document.getElementById('t7cu-choice-attach').addEventListener('click', function(){
      if (!consent.checked) return;
      document.getElementById('t7cu-file').click();
    });
    document.getElementById('t7cu-file').addEventListener('change', function(e){
      var f = e.target.files && e.target.files[0];
      if (f) startUpload(f, stars, email);
    });
  }

  function closeModal(){
    stopRecording(true);
    releaseStream();
    var ov = document.getElementById('t7cu-overlay');
    if (ov) ov.remove();
  }

  function renderModal(stars, email){
    var starsTxt = stars + (stars === 1 ? '-Stern' : '-Sterne');
    return ''
      + '<div class="t7cu-modal" role="dialog" aria-modal="true">'
      +   '<button class="t7cu-close" id="t7cu-close" aria-label="Schliessen">×</button>'

      +   '<div class="t7cu-head">'
      +     '<div class="t7cu-stars">' + repeat('★', stars) + '</div>'
      +     '<h2>Final-Video · ' + starsTxt + ' Zertifikat</h2>'
      +     '<p class="t7cu-sub">' + (email ? ('Spieler: <strong>' + esc(email) + '</strong>') : 'Bitte zuerst auf der Challenges-Seite anmelden.') + '</p>'
      +   '</div>'

      +   '<div id="t7cu-status"></div>'

      +   '<div id="t7cu-stage-choose">'
      +     '<div class="t7cu-rules">'
      +       '<div class="t7cu-rules-title">Bitte beim Drehen beachten:</div>'
      +       '<ul>'
      +         '<li>Drehe das Video <strong>draussen</strong> oder in einer neutralen Halle.</li>'
      +         '<li><strong>Keine anderen Personen</strong> sichtbar (auch nicht im Hintergrund).</li>'
      +         '<li>Keine Schul-, Vereins- oder Hausnummern-Logos erkennbar.</li>'
      +         '<li>Maximal <strong>2 Minuten</strong>, höchstens 100 MB (MP4, MOV oder WEBM).</li>'
      +       '</ul>'
      +     '</div>'

      +     '<label class="t7cu-consent">'
      +       '<input type="checkbox" id="t7cu-consent">'
      +       '<span>Ich bestätige, dass ich (oder bei unter 14-Jährigen meine Eltern/Erziehungsberechtigten) dem Upload zustimme. Das Video wird ausschliesslich vom T7-Experten geprüft und nach der Zertifizierung automatisch gelöscht (spätestens nach 14 Tagen).</span>'
      +     '</label>'

      +     '<div class="t7cu-choices" id="t7cu-choices">'
      +       '<button class="t7cu-choice" id="t7cu-choice-record" disabled type="button">'
      +         '<div class="t7cu-choice-icon">📹</div>'
      +         '<div class="t7cu-choice-title">Filme und sende das Video direkt hier</div>'
      +         '<div class="t7cu-choice-sub">Mit Kamera deines Geräts aufnehmen</div>'
      +       '</button>'
      +       '<button class="t7cu-choice" id="t7cu-choice-attach" disabled type="button">'
      +         '<div class="t7cu-choice-icon">📁</div>'
      +         '<div class="t7cu-choice-title">Anhängen und senden</div>'
      +         '<div class="t7cu-choice-sub">Video von deinem Gerät auswählen</div>'
      +       '</button>'
      +       '<input type="file" id="t7cu-file" accept="video/mp4,video/quicktime,video/webm" hidden>'
      +     '</div>'
      +   '</div>'

      +   '<div id="t7cu-stage-record" style="display:none">'
      +     '<div class="t7cu-rec-frame">'
      +       '<video id="t7cu-rec-live" autoplay playsinline muted></video>'
      +       '<video id="t7cu-rec-preview" controls playsinline style="display:none"></video>'
      +       '<div class="t7cu-rec-timer" id="t7cu-rec-timer" style="display:none">⏺ 0:00</div>'
      +     '</div>'
      +     '<div class="t7cu-rec-actions" id="t7cu-rec-actions"></div>'
      +   '</div>'

      +   '<div id="t7cu-stage-upload" style="display:none">'
      +     '<div class="t7cu-progress-wrap">'
      +       '<div class="t7cu-progress"><div class="t7cu-progress-fill" id="t7cu-progress-fill"></div></div>'
      +       '<div class="t7cu-progress-txt" id="t7cu-progress-txt">0 %</div>'
      +     '</div>'
      +   '</div>'

      +   '<div class="t7cu-footnote">Bei Fragen oder Problemen: <a href="mailto:support@laureo.at">support@laureo.at</a></div>'
      + '</div>';
  }

  // ── Pre-check: pending submission ────────────────────────
  function checkExisting(stars, email){
    var url = SB_URL + '/rest/v1/certification_submissions'
      + '?player_email=eq.' + encodeURIComponent(email)
      + '&stars=eq.' + stars
      + '&status=eq.pending'
      + '&select=id,submitted_at';
    fetch(url, { headers: anonHeaders() })
      .then(function(r){ return r.ok ? r.json() : []; })
      .then(function(rows){
        if (rows && rows.length) {
          var when = new Date(rows[0].submitted_at).toLocaleDateString('de-AT');
          showStatus('warn',
            'Du hast bereits ein Video für dieses Zertifikat eingereicht (' + when + '). '
            + 'Wir melden uns per E-Mail, sobald der Experte es geprüft hat.');
          document.getElementById('t7cu-consent').disabled = true;
          document.getElementById('t7cu-choice-record').disabled = true;
          document.getElementById('t7cu-choice-attach').disabled = true;
        }
      })
      .catch(function(){});
  }

  // ── Record-in-browser flow ───────────────────────────────
  function startRecordView(stars, email){
    document.getElementById('t7cu-stage-choose').style.display = 'none';
    document.getElementById('t7cu-stage-record').style.display = 'block';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showStatus('error', 'Dein Browser unterstützt die Video-Aufnahme nicht. Bitte stattdessen "Anhängen und senden" verwenden.');
      backToChoose();
      return;
    }

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true
    }).then(function(stream){
      rec.stream = stream;
      var live = document.getElementById('t7cu-rec-live');
      live.srcObject = stream;
      renderRecActions('idle', stars, email);
    }).catch(function(err){
      showStatus('error', 'Kamerazugriff verweigert oder nicht verfügbar. Bitte Berechtigung erteilen oder "Anhängen und senden" verwenden.');
      backToChoose();
    });
  }

  function renderRecActions(state, stars, email){
    var box = document.getElementById('t7cu-rec-actions');
    if (state === 'idle') {
      box.innerHTML = ''
        + '<button class="t7cu-rec-btn rec" id="t7cu-rec-start" type="button">⏺ Aufnahme starten</button>'
        + '<button class="t7cu-rec-btn ghost" id="t7cu-rec-back" type="button">Zurück</button>';
      document.getElementById('t7cu-rec-start').onclick = function(){ startRecording(stars, email); };
      document.getElementById('t7cu-rec-back').onclick = function(){ releaseStream(); backToChoose(); };
    } else if (state === 'recording') {
      box.innerHTML = ''
        + '<button class="t7cu-rec-btn stop" id="t7cu-rec-stop" type="button">⏹ Stopp</button>';
      document.getElementById('t7cu-rec-stop').onclick = function(){ stopRecording(false); };
    } else if (state === 'preview') {
      box.innerHTML = ''
        + '<button class="t7cu-rec-btn gold" id="t7cu-rec-use" type="button">✓ Dieses Video senden</button>'
        + '<button class="t7cu-rec-btn ghost" id="t7cu-rec-redo" type="button">↻ Neu aufnehmen</button>';
      document.getElementById('t7cu-rec-use').onclick = function(){
        if (!rec.blob) return;
        var ext = (rec.mime.indexOf('mp4') > -1) ? 'mp4' : 'webm';
        var fauxName = 'recording-' + Date.now() + '.' + ext;
        var fauxFile = new File([rec.blob], fauxName, { type: rec.blob.type || rec.mime });
        startUpload(fauxFile, stars, email);
      };
      document.getElementById('t7cu-rec-redo').onclick = function(){
        rec.blob = null;
        var pv = document.getElementById('t7cu-rec-preview');
        var live = document.getElementById('t7cu-rec-live');
        pv.style.display = 'none'; pv.src = '';
        live.style.display = '';
        startRecordView(stars, email);
      };
    }
  }

  function startRecording(stars, email){
    rec.chunks = [];
    rec.blob = null;
    // Include audio codec in probe strings — Firefox returns true for
    // 'video/webm;codecs=vp8' but then fails when the stream has audio.
    var preferred = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=opus,vp9',
      'video/webm;codecs=opus,vp8',
      'video/webm',
      'video/mp4'
    ];
    var mime = '';
    for (var i = 0; i < preferred.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(preferred[i])) { mime = preferred[i]; break; }
    }
    try {
      rec.recorder = mime ? new MediaRecorder(rec.stream, { mimeType: mime }) : new MediaRecorder(rec.stream);
    } catch(e){
      showStatus('error', 'Aufnahme nicht unterstützt: ' + (e && e.message || e) + ' Bitte stattdessen "Anhängen und senden" verwenden.');
      backToChoose();
      return;
    }
    rec.mime = rec.recorder.mimeType || mime || 'video/webm';
    rec.recorder.ondataavailable = function(e){ if (e.data && e.data.size > 0) rec.chunks.push(e.data); };
    rec.recorder.onstop = function(){
      rec.blob = new Blob(rec.chunks, { type: rec.mime });
      var live = document.getElementById('t7cu-rec-live');
      var pv = document.getElementById('t7cu-rec-preview');
      live.style.display = 'none';
      pv.src = URL.createObjectURL(rec.blob);
      pv.style.display = 'block';
      document.getElementById('t7cu-rec-timer').style.display = 'none';
      renderRecActions('preview', stars, email);
    };
    try {
      rec.recorder.start();
    } catch(e){
      showStatus('error', 'Aufnahme konnte nicht starten: ' + (e && e.message || e) + '. Bitte stattdessen "Anhängen und senden" verwenden.');
      backToChoose();
      return;
    }
    rec.seconds = 0;
    document.getElementById('t7cu-rec-timer').style.display = 'inline-block';
    document.getElementById('t7cu-rec-timer').textContent = '⏺ 0:00';
    rec.timer = setInterval(function(){
      rec.seconds++;
      var m = Math.floor(rec.seconds / 60), s = rec.seconds % 60;
      document.getElementById('t7cu-rec-timer').textContent = '⏺ ' + m + ':' + (s < 10 ? '0' + s : s);
      if (rec.seconds >= MAX_REC_SECONDS) stopRecording(false);
    }, 1000);
    renderRecActions('recording', stars, email);
  }

  function stopRecording(silent){
    if (rec.timer) { clearInterval(rec.timer); rec.timer = null; }
    if (rec.recorder && rec.recorder.state !== 'inactive') {
      try { rec.recorder.stop(); } catch(e){}
    }
  }

  function releaseStream(){
    if (rec.stream) {
      try { rec.stream.getTracks().forEach(function(t){ t.stop(); }); } catch(e){}
      rec.stream = null;
    }
  }

  function backToChoose(){
    var s = document.getElementById('t7cu-stage-choose');
    var r = document.getElementById('t7cu-stage-record');
    if (s) s.style.display = '';
    if (r) r.style.display = 'none';
  }

  // ── Upload flow (used by both paths) ─────────────────────
  function startUpload(file, stars, email){
    if (!email) {
      showStatus('error', 'Wir konnten deinen Account nicht erkennen. Bitte zuerst auf der Challenges-Seite anmelden, dann neu versuchen.');
      return;
    }
    if (file.size > MAX_BYTES) {
      showStatus('error', 'Das Video ist zu gross (' + fmtMB(file.size) + ', max. ' + fmtMB(MAX_BYTES) + '). Bitte kürze oder reduziere die Qualität.');
      return;
    }
    // Strip codec parameters from file.type so 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'
    // becomes 'video/mp4' — Supabase Storage's allowed_mime_types is an exact match list.
    var contentType = (file.type || 'video/webm').split(';')[0].trim().toLowerCase();
    if (contentType && contentType.indexOf('video/') !== 0) {
      showStatus('error', 'Dateityp ' + contentType + ' wird nicht unterstützt. Bitte MP4, MOV oder WEBM verwenden.');
      return;
    }

    // Free the camera, hide other stages, show progress
    releaseStream();
    document.getElementById('t7cu-stage-choose').style.display = 'none';
    document.getElementById('t7cu-stage-record').style.display = 'none';
    document.getElementById('t7cu-stage-upload').style.display = 'block';

    var ts   = new Date().toISOString().replace(/[:.]/g, '-');
    var ext  = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
    var safeEmail = email.replace(/[^a-zA-Z0-9._-]/g, '_');
    var path = safeEmail + '/' + stars + '/' + ts + '.' + ext;

    var xhr = new XMLHttpRequest();
    xhr.open('POST', SB_URL + '/storage/v1/object/' + BUCKET + '/' + path);
    xhr.setRequestHeader('apikey', SB_KEY);
    xhr.setRequestHeader('Authorization', 'Bearer ' + SB_KEY);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = function(e){
      if (e.lengthComputable) {
        var pct = Math.round(e.loaded / e.total * 100);
        document.getElementById('t7cu-progress-fill').style.width = pct + '%';
        document.getElementById('t7cu-progress-txt').textContent =
          pct + ' %  ·  ' + fmtMB(e.loaded) + ' / ' + fmtMB(e.total);
      }
    };
    xhr.onerror = function(){
      showStatus('error', 'Netzwerkfehler beim Upload. Bitte später erneut versuchen.');
    };
    xhr.onload = function(){
      if (xhr.status >= 200 && xhr.status < 300) {
        registerSubmission(path, stars, email);
      } else {
        var msg = 'Upload fehlgeschlagen (HTTP ' + xhr.status + ').';
        try { var b = JSON.parse(xhr.responseText); if (b.message) msg += ' ' + b.message; } catch(e){}
        showStatus('error', msg);
      }
    };
    xhr.send(file);
  }

  function registerSubmission(path, stars, email){
    fetch(SB_URL + '/rest/v1/certification_submissions', {
      method: 'POST',
      headers: Object.assign({}, anonHeaders(), {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }),
      body: JSON.stringify({
        player_email:       email,
        stars:              stars,
        video_path:         path,
        consent_confirmed:  true,
        status:             'pending'
      })
    }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, body: j }; }); })
      .then(function(res){
        if (!res.ok) throw new Error(res.body && res.body.message || 'DB error');
        showSuccess(stars);
      })
      .catch(function(err){
        showStatus('error', 'Upload erfolgreich, aber das Eintragen ist fehlgeschlagen. Bitte support@laureo.at kontaktieren.');
        console.error('Submission insert failed:', err);
      });
  }

  function showSuccess(stars){
    // Notify the page (cert widget listens to flip the "Eingereicht" badge)
    try {
      window.dispatchEvent(new CustomEvent('t7cert-submitted', { detail: { stars: stars } }));
    } catch (e) {
      // Older browsers without CustomEvent constructor
      var evt = document.createEvent('CustomEvent');
      evt.initCustomEvent('t7cert-submitted', false, false, { stars: stars });
      window.dispatchEvent(evt);
    }
    var modal = document.querySelector('.t7cu-modal');
    if (!modal) return;
    modal.innerHTML =
        '<button class="t7cu-close" onclick="document.getElementById(\'t7cu-overlay\').remove()" aria-label="Schliessen">×</button>'
      + '<div class="t7cu-success">'
      +   '<div class="t7cu-check">✓</div>'
      +   '<h2>Geschafft!</h2>'
      +   '<p>Dein Video für das <strong>' + stars + (stars===1?'-Stern':'-Sterne') + ' Zertifikat</strong> wurde sicher hochgeladen.</p>'
      +   '<p>Unser Experte prüft es in den nächsten <strong>2–3 Werktagen</strong> und meldet sich bei dir.</p>'
      +   '<p class="t7cu-success-note">Das Video ist nur für unseren Experten sichtbar. Nach der Zertifizierung wird es automatisch gelöscht — spätestens nach 14 Tagen.</p>'
      +   '<button class="t7cu-btn" onclick="document.getElementById(\'t7cu-overlay\').remove()">Super, danke!</button>'
      + '</div>';
  }

  // ── Helpers ──────────────────────────────────────────────
  function showStatus(kind, msg){
    var el = document.getElementById('t7cu-status');
    if (!el) return;
    el.className = 't7cu-status ' + kind;
    el.textContent = msg;
  }
  function anonHeaders(){ return { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }; }
  function repeat(s,n){ var r=''; for (var i=0;i<n;i++) r+=s; return r; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function fmtMB(b){ return (b / 1048576).toFixed(1) + ' MB'; }

  // ── Styles ───────────────────────────────────────────────
  function injectStyles(){
    if (document.getElementById('t7cu-styles')) return;
    var css = ''
      + '.t7cu-overlay{position:fixed;inset:0;background:rgba(8,15,30,.78);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:t7cu-fade .2s ease}'
      + '@keyframes t7cu-fade{from{opacity:0}to{opacity:1}}'
      + '.t7cu-modal{position:relative;background:var(--surface,#0d1528);color:var(--text,#e0f0ff);border:1.5px solid transparent;background-image:linear-gradient(var(--surface,#0d1528),var(--surface,#0d1528)),linear-gradient(135deg,#FFD700,#FF8C00);background-origin:border-box;background-clip:padding-box,border-box;border-radius:16px;padding:28px 26px;max-width:560px;width:100%;max-height:92vh;overflow-y:auto;font-family:"Open Sans",system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.5)}'
      + '.t7cu-close{position:absolute;top:12px;right:14px;background:transparent;border:0;color:var(--muted,rgba(224,240,255,.6));font-size:28px;cursor:pointer;line-height:1;padding:4px 10px;border-radius:8px}'
      + '.t7cu-close:hover{color:var(--text,#e0f0ff);background:rgba(255,255,255,.06)}'
      + '.t7cu-head{text-align:center;margin-bottom:18px}'
      + '.t7cu-stars{font-size:28px;color:#FFD700;letter-spacing:4px;margin-bottom:6px;text-shadow:0 0 12px rgba(255,180,0,.4)}'
      + '.t7cu-head h2{margin:0;font-size:22px;font-weight:800;letter-spacing:-.01em}'
      + '.t7cu-sub{margin:6px 0 0;font-size:13px;color:var(--muted,rgba(224,240,255,.6))}'
      + '.t7cu-status{margin:0 0 16px;padding:12px 14px;border-radius:10px;font-size:13px;line-height:1.5;display:none}'
      + '.t7cu-status.warn{display:block;background:rgba(255,180,0,.08);border:1px solid rgba(255,180,0,.3);color:#FFD700}'
      + '.t7cu-status.error{display:block;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);color:#fca5a5}'
      + '.t7cu-rules{background:rgba(128,140,160,.06);border:1px solid var(--border,rgba(0,229,255,.12));border-radius:10px;padding:14px 16px;margin-bottom:18px}'
      + '.t7cu-rules-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--accent,#00E5FF);margin-bottom:8px}'
      + '.t7cu-rules ul{margin:0;padding-left:20px;font-size:13px;line-height:1.65}'
      + '.t7cu-rules li{margin-bottom:4px}'
      + '.t7cu-consent{display:flex;gap:10px;align-items:flex-start;background:rgba(128,140,160,.06);border:1px solid var(--border,rgba(0,229,255,.12));border-radius:10px;padding:12px 14px;margin-bottom:16px;cursor:pointer;font-size:12.5px;line-height:1.55}'
      + '.t7cu-consent input{margin-top:3px;flex-shrink:0;width:18px;height:18px;accent-color:#FFD700}'
      + '.t7cu-choices{display:grid;grid-template-columns:1fr 1fr;gap:12px;opacity:.45;transition:opacity .2s}'
      + '@media(max-width:480px){.t7cu-choices{grid-template-columns:1fr}}'
      + '.t7cu-choices.enabled{opacity:1}'
      + '.t7cu-choice{background:rgba(128,140,160,.06);border:1.5px solid var(--border,rgba(0,229,255,.18));border-radius:12px;padding:18px 16px;cursor:pointer;text-align:center;font-family:inherit;color:var(--text,#e0f0ff);transition:all .15s}'
      + '.t7cu-choices.enabled .t7cu-choice:hover{border-color:#FFD700;background:rgba(255,215,0,.05);transform:translateY(-2px)}'
      + '.t7cu-choice:disabled{cursor:not-allowed}'
      + '.t7cu-choice-icon{font-size:32px;margin-bottom:8px;line-height:1}'
      + '.t7cu-choice-title{font-weight:800;font-size:14px;margin-bottom:4px;letter-spacing:-.01em}'
      + '.t7cu-choice-sub{font-size:11px;color:var(--muted,rgba(224,240,255,.6));line-height:1.4}'
      + '.t7cu-rec-frame{position:relative;background:#000;border-radius:12px;overflow:hidden;margin-bottom:14px}'
      + '.t7cu-rec-frame video{width:100%;display:block;max-height:55vh;background:#000}'
      + '.t7cu-rec-timer{position:absolute;top:12px;left:12px;background:rgba(220,38,38,.9);color:#fff;padding:6px 12px;border-radius:99px;font-weight:800;font-size:13px;font-family:monospace;letter-spacing:.05em}'
      + '.t7cu-rec-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}'
      + '.t7cu-rec-btn{flex:1;min-width:140px;padding:12px 20px;border:0;border-radius:10px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;transition:transform .15s,filter .15s}'
      + '.t7cu-rec-btn:hover{transform:translateY(-1px);filter:brightness(1.05)}'
      + '.t7cu-rec-btn.rec{background:#DC2626;color:#fff}'
      + '.t7cu-rec-btn.stop{background:#1f2937;color:#fff;border:1px solid #DC2626}'
      + '.t7cu-rec-btn.gold{background:linear-gradient(135deg,#FFD700,#FF8C00);color:#1a1100}'
      + '.t7cu-rec-btn.ghost{background:transparent;color:var(--text,#e0f0ff);border:1px solid var(--border,rgba(0,229,255,.18))}'
      + '.t7cu-progress-wrap{padding:24px 0}'
      + '.t7cu-progress{height:12px;background:rgba(128,140,160,.18);border-radius:99px;overflow:hidden;margin-bottom:10px}'
      + '.t7cu-progress-fill{height:100%;width:0%;background:linear-gradient(90deg,#FFD700,#FF8C00);border-radius:99px;transition:width .2s}'
      + '.t7cu-progress-txt{text-align:center;font-size:13px;font-weight:700;color:var(--text,#e0f0ff)}'
      + '.t7cu-footnote{margin-top:18px;font-size:11px;color:var(--muted,rgba(224,240,255,.6));text-align:center}'
      + '.t7cu-footnote a{color:var(--accent,#00E5FF)}'
      + '.t7cu-success{text-align:center;padding:10px 0}'
      + '.t7cu-check{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:36px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 0 24px rgba(16,185,129,.4)}'
      + '.t7cu-success h2{margin:0 0 12px;font-size:22px}'
      + '.t7cu-success p{margin:0 0 10px;font-size:14px;line-height:1.6;color:var(--text,#e0f0ff)}'
      + '.t7cu-success-note{font-size:12px !important;color:var(--muted,rgba(224,240,255,.6)) !important;margin-top:14px !important;padding-top:14px;border-top:1px solid var(--border,rgba(0,229,255,.12))}'
      + '.t7cu-btn{margin-top:18px;background:linear-gradient(135deg,#FFD700,#FF8C00);color:#1a1100;border:0;padding:12px 28px;border-radius:10px;font-weight:800;cursor:pointer;font-size:14px;font-family:inherit}';
    var s = document.createElement('style');
    s.id = 't7cu-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();
