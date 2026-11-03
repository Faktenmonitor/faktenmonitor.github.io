/* Suche im ifo Faktenmonitor: läuft vollständig im Browser, lädt suchindex.json beim ersten Gebrauch.
   Erzeugt von build.py; Pflege der Suchbegriffe im Excel-Blatt „Inhalt“, Spalte „Suchbegriffe“. */
(function () {
  var me = document.currentScript, ROOT = (me && me.getAttribute('data-root')) || '';
  var STOP = {je:1,pro:1,in:1,der:1,die:1,das:1,des:1,und:1,im:1,von:1,zur:1,zum:1,mit:1,fuer:1,fur:1,nach:1,wo:1,wie:1,was:1,ist:1,am:1,an:1,auf:1,dem:1,den:1,ein:1,eine:1};
  function norm(s) {
    return s.toLowerCase().replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ß/g,'ss')
      .replace(/ae/g,'a').replace(/oe/g,'o').replace(/ue/g,'u');
  }
  function stem(w) {
    var suf = ['ungen','innen','ern','en','er','es','e','n','s'];
    for (var i = 0; i < suf.length; i++) if (w.length - suf[i].length >= 4 && w.slice(-suf[i].length) === suf[i]) return w.slice(0, -suf[i].length);
    return w;
  }
  function toks(s) { return (norm(s).match(/[a-z0-9]+/g) || []).filter(function (w) { return !STOP[w]; }).map(function (w) { return {w: w, s: stem(w)}; }); }
  // Bezugsgrößen zählen nicht als Treffer: „in % des BIP“, „je Erwerbstätigen“, „pro Kopf“, „je 1.000 Einwohner“ usw.
  // (bei Suche nach mehreren Wörtern gilt zusätzlich der Originaltext)
  var W_ = "[A-Za-zÄÖÜäöüß-]+";
  var BEZ = [new RegExp("(in )?(%|Prozent) (des|der|aller|am|an) (" + W_ + " )?" + W_, "g"),
             new RegExp("(^|[^A-Za-zÄÖÜäöüß])(je|pro) (\\d[\\d.,]*\\s*(Mio\\.\\s*)?)?([a-zäöüß][A-Za-zäöüß-]* )?" + W_, "g")];
  function bez(s) { return s.replace(BEZ[0], " ").replace(BEZ[1], "$1 "); }
  function lev1(a, b) { // höchstens ein Tippfehler: ein Buchstabe falsch, fehlend, zu viel oder zwei vertauscht
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a.length === b.length) {
      var diff = []; for (var k = 0; k < a.length; k++) if (a[k] !== b[k]) diff.push(k);
      if (diff.length === 1) return true;
      return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
    }
    var l = a.length > b.length ? a : b, sh = a.length > b.length ? b : a;
    for (var i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === sh) return true;
    return false;
  }
  var W = {n: 10, s: 6, e: 3, p: 2}, IDX = null, IDX_N = 0, LOADING = null;
  function prep(d) {
    IDX = d.map(function (x) {
      var f = {}; for (var k in W) f[k] = toks(bez(x[k] || ''));
      return {x: x, f: f, o: IDX_N++, raw: norm([x.n, x.s, x.e, x.p].join(' '))};
    });
  }
  function hit(t, list) { // t und Listeneinträge: {w: Wort, s: Wortstamm}
    var best = 0;
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      if (h.s === t.s) return 2;
      if (h.w.indexOf(t.w) === 0) best = Math.max(best, 1.6);
      else if (t.w.length >= 6 && h.w.indexOf(t.s) > 0) best = Math.max(best, 1.2);  /* Wortteil in Zusammensetzung, z. B. „personen“ in „Erwerbspersonen“ */
      else if (t.s.length >= 8 && (lev1(t.s, h.s) || (h.s.length > t.s.length && lev1(t.s, h.s.slice(0, t.s.length))))) best = Math.max(best, 1);
    }
    return best;
  }
  function part(p, list) { // Teil eines zusammengesetzten Wortes, z. B. „firmen“ in „Firmengründungen“
    for (var i = 0; i < list.length; i++) { var h = list[i].s, w = list[i].w; if (h.length >= 4 && (w.indexOf(p) === 0 || h === stem(p) || (p.indexOf(h) === 0 && p.length - h.length <= 2))) return true; }
    return false;
  }
  function compound(t, f) {
    t = t.w; if (t.length < 8) return 0;
    var all = [].concat(f.n, f.s, f.e, f.p);
    for (var i = 4; i <= t.length - 4; i++) if (part(t.slice(0, i), all) && part(t.slice(i), all)) return 2;
    return 0;
  }
  function search(q) {
    var qt = toks(q); if (!qt.length) return [];
    var phrase = q.trim().indexOf(' ') > 0 ? norm(q.trim()) : null, out = [];
    IDX.forEach(function (it) {
      var score = 0, ok = true;
      qt.forEach(function (t) {
        var best = 0;
        for (var k in W) { var m = hit(t, it.f[k]); if (m) best = Math.max(best, W[k] * m); }
        if (!best) best = compound(t, it.f);
        if (!best) ok = false; score += best;
      });
      if (phrase && it.raw.indexOf(phrase) >= 0) { ok = true; score += 40; }
      if (ok) out.push({it: it, score: score + (norm(it.x.n).indexOf(norm(q.trim())) === 0 ? 5 : 0)});
    });
    return out.sort(function (a, b) { return a.it.o - b.it.o; });  // Reihenfolge wie im Inhaltsverzeichnis
  }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function mark(s, q) {
    var ws = (q.match(/[\wäöüÄÖÜß]{3,}/g) || []).map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    var t = esc(s); if (!ws.length) return t;
    return t.replace(new RegExp('(' + ws.join('|') + ')', 'gi'), '<mark>$1</mark>');
  }
  function load(cb) {
    if (IDX) return cb();
    if (!LOADING) LOADING = fetch(ROOT + 'suchindex.json').then(function (r) { return r.json(); }).then(prep);
    LOADING.then(cb, function () {});
  }
  function setup(box) {
    var inp = box.querySelector('.fm-q'), ul = box.querySelector('.fm-hits'), cnt = box.querySelector('.fm-count'),
        big = box.classList.contains('search'), MAXN = big ? 40 : 12, sel = -1;
    function render() {
      var q = inp.value; sel = -1;
      if (q.trim().length < 2) { ul.innerHTML = ''; if (cnt) cnt.textContent = ''; box.classList.remove('open'); return; }
      load(function () {
        if (inp.value !== q) return;
        var r = search(q), show = r.slice(0, MAXN);
        var msg = r.length ? (r.length + (r.length === 1 ? ' Indikator' : ' Indikatoren') + (r.length > MAXN ? ' – die ersten ' + MAXN + ' werden angezeigt; ein genauerer Begriff hilft' : ''))
                           : 'Keine Treffer. Versuchen Sie einen anderen Begriff, z. B. „Einkommen“ statt „Geld“.';
        if (cnt) cnt.textContent = msg;
        ul.innerHTML = (big || r.length ? '' : '<li class="none">' + esc(msg) + '</li>') + show.map(function (h) {
          var x = h.it.x;
          return '<li><a href="' + ROOT + x.u + '"><span class="t">' + mark(x.n, q) + '</span><span class="c">' + esc(x.k) + '</span>' +
                 (big ? '<span class="d">' + esc(x.e) + '</span>' : '') + '</a></li>';
        }).join('') + (!big && r.length > MAXN ? '<li class="none">' + (r.length - MAXN) + ' weitere – bitte genauer suchen</li>' : '');
        box.classList.add('open');
      });
    }
    function move(d) {
      var li = ul.querySelectorAll('li a'); if (!li.length) return;
      if (sel >= 0) li[sel].parentNode.className = '';
      sel = (sel + d + li.length) % li.length; li[sel].parentNode.className = 'on'; li[sel].scrollIntoView({block: 'nearest'});
    }
    inp.addEventListener('input', render);
    inp.addEventListener('focus', function () { load(function () {}); if (inp.value.trim().length >= 2) render(); });
    inp.addEventListener('keydown', function (e) {
      var li = ul.querySelectorAll('li a');
      if (e.key === 'ArrowDown') { move(1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { move(-1); e.preventDefault(); }
      else if (e.key === 'Enter') {
        // Enter springt nur zu einem mit den Pfeiltasten gewählten Treffer; sonst bleibt die Liste stehen
        e.preventDefault();
        if (sel >= 0 && li[sel]) location.href = li[sel].href;
        else if (!big && inp.value.trim().length >= 2) location.href = ROOT + 'index.html?q=' + encodeURIComponent(inp.value.trim());
        else render();
      }
      else if (e.key === 'Escape') { inp.value = ''; render(); }
    });
    if (big) {  // Suchbegriff aus der Kopfzeile einer Indikatorseite übernehmen (index.html?q=…)
      var m = location.search.match(/[?&]q=([^&]*)/);
      if (m) { inp.value = decodeURIComponent(m[1].replace(/\+/g, ' ')); render(); }
    }
    if (!big) document.addEventListener('click', function (e) { if (!box.contains(e.target)) box.classList.remove('open'); });
  }
  var boxes = document.querySelectorAll('.fm-search');
  for (var i = 0; i < boxes.length; i++) { boxes[i].hidden = false; setup(boxes[i]); }
})();
