import { jsPDF } from 'jspdf';
import { T, t, tx, lang } from './i18n.js';
import { S, go } from './state.js';
import { getCourse, cprog, xpOf, pct, studentById, prog, touchLast, getQuizzes, answerQuiz, completeLesson, videoUrl, refreshProgress } from './api.js';
import { esc, ic, arrow, fmtDate, fmtTime, toast } from './ui.js';

let PL = null;
export function stopPlayer() { if (PL) { clearInterval(PL.timer); PL = null; } }

export function learnView() {
  const c = getCourse(S.cid), l = c && c.lessons.find(x => x.id === S.lid);
  if (!c || !l) return go({ view: 'dash' }), '';
  const sid = S.user.id, pr = cprog(sid, c.id);
  return `<div class="wrap page"><button class="btn ghost sm" data-act="open-course" data-id="${c.id}">← ${esc(tx(c.title))}</button>
   <div class="sec-h" style="margin-top:.6rem"><h2>${esc(tx(l.title))}</h2><span class="xpbadge" id="xpb">★ ${xpOf(sid, c.id).earned} ${t('xp')}</span></div>
   <div class="learn"><div><div class="stage" id="stage"><div id="media"></div><div id="quizLayer"></div></div><div id="after" style="margin-top:1rem"></div></div>
   <div class="card"><h3>${t('lessons')}</h3>${c.lessons.map((x, i) => `<div class="lesson-li ${pr.done.includes(x.id) ? 'done' : ''}"><span class="n">${pr.done.includes(x.id) ? '✓' : i + 1}</span><div class="t"><b>${esc(tx(x.title))}</b></div>${x.id !== l.id ? `<button class="btn line sm" data-act="learn" data-cid="${c.id}" data-lid="${x.id}">${t('open')}</button>` : '<span class="pill red">▶</span>'}</div>`).join('')}</div></div></div>`;
}

export async function mountPlayer() {
  const c = getCourse(S.cid), l = c.lessons.find(x => x.id === S.lid), sid = S.user.id;
  const media = document.getElementById('media');
  if (!media) return;
  touchLast(sid, c.id, l.id);
  prog(sid).last = { cid: c.id, lid: l.id, ts: new Date().toISOString() };

  let quizzes = [], src = null;
  try { quizzes = await getQuizzes(l.id); } catch (e) { toast(t('quizFail')); }
  if (l.video) { try { src = await videoUrl(l.video); } catch (e) { toast(t('videoFail')); } }
  if (!document.getElementById('media')) return; // user navigated away while loading

  const answered = new Set();
  let finished = false;
  const P = { dur: l.dur || 30, t: 0, playing: false, el: null, timer: null };
  PL = P;
  const ctl = () => `<div class="ctl"><button id="pp" aria-label="${t('play')}">${ic('play', 16)}</button><div class="track" id="trk"><i id="fill" style="width:0"></i>${quizzes.map(q => `<u style="inset-inline-start:${Math.min(98, (q.at / P.dur) * 100)}%"></u>`).join('')}</div><time id="tm">0:00 / ${fmtTime(P.dur)}</time></div>`;
  const setUi = () => {
    const f = document.getElementById('fill'); if (!f) return;
    f.style.width = Math.min(100, (P.t / P.dur) * 100) + '%';
    document.getElementById('tm').textContent = fmtTime(P.t) + ' / ' + fmtTime(P.dur);
    const b = document.getElementById('pp');
    b.innerHTML = ic(P.playing ? 'pause' : 'play', 16);
    b.setAttribute('aria-label', P.playing ? t('pause') : t('play'));
  };
  if (src) {
    media.innerHTML = `<video id="vid" src="${esc(src)}" playsinline></video>${ctl()}`;
    P.el = document.getElementById('vid');
    P.el.addEventListener('loadedmetadata', () => { P.dur = P.el.duration || P.dur; setUi(); });
    P.el.addEventListener('timeupdate', () => { P.t = P.el.currentTime; setUi(); check(); });
    P.el.addEventListener('ended', () => finish());
    P.el.addEventListener('play', () => { P.playing = true; setUi(); });
    P.el.addEventListener('pause', () => { P.playing = false; setUi(); });
  } else {
    media.innerHTML = `<div class="demo">${ic('robot', 60)}<b>${esc(tx(l.title))}</b><p>${t('demoNote')}</p></div>${ctl()}`;
  }
  const play = () => {
    if (P.el) P.el.play();
    else {
      P.playing = true; clearInterval(P.timer);
      P.timer = setInterval(() => {
        P.t += 0.25;
        if (P.t >= P.dur) { P.t = P.dur; setUi(); clearInterval(P.timer); P.playing = false; finish(); return; }
        setUi(); check();
      }, 250);
    }
    setUi();
  };
  const pause = () => { if (P.el) P.el.pause(); else { clearInterval(P.timer); P.playing = false; } setUi(); };
  document.getElementById('pp').onclick = () => (P.playing ? pause() : play());
  document.getElementById('trk').onclick = e => {
    const r = e.currentTarget.getBoundingClientRect();
    let f = (e.clientX - r.left) / r.width;
    if (document.documentElement.dir === 'rtl') f = 1 - f;
    const target = Math.max(0, Math.min(P.dur, f * P.dur));
    // cannot skip past an unanswered quiz
    const blocked = quizzes.filter(q => !answered.has(q.id) && q.at <= target && q.at > P.t).sort((a, b) => a.at - b.at)[0];
    const to = blocked ? Math.max(0, blocked.at - 0.1) : target;
    P.t = to; if (P.el) P.el.currentTime = to; setUi();
  };
  function check() {
    const q = quizzes.filter(x => !answered.has(x.id) && P.t >= x.at).sort((a, b) => a.at - b.at)[0];
    if (q) { answered.add(q.id); pause(); ask(q); }
  }
  function ask(q) {
    const layer = document.getElementById('quizLayer');
    layer.innerHTML = `<div class="quiz"><div class="box"><span class="pill red">${t('quizTime')}</span><h4 style="margin-top:.5rem">${esc(q.q)}</h4>${q.opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}<div id="fb"></div></div></div>`;
    layer.querySelectorAll('.opt').forEach(b => (b.onclick = async () => {
      layer.querySelectorAll('.opt').forEach(x => (x.disabled = true));
      let res;
      try { res = await answerQuiz(q.id, +b.dataset.i); } catch (e) { toast(t('errGeneric')); layer.innerHTML = ''; play(); return; }
      layer.querySelectorAll('.opt').forEach((x, j) => {
        if (j === res.correct) x.classList.add('right'); else if (x === b) x.classList.add('wrong');
      });
      try { await refreshProgress(sid); } catch (e) {}
      const xb = document.getElementById('xpb'); if (xb) xb.textContent = '★ ' + xpOf(sid, c.id).earned + ' ' + t('xp');
      document.getElementById('fb').innerHTML = `<div class="fb" style="color:var(--${res.ok ? 'ok' : 'bad'})">${res.ok ? t('correct') : t('wrong')}</div><button class="btn red" id="cont">${t('continueV')} ${arrow()}</button>`;
      document.getElementById('cont').onclick = () => { layer.innerHTML = ''; play(); };
    }));
  }
  async function finish() {
    if (finished) return; finished = true; pause();
    const wasDone = !!cprog(sid, c.id).completedAt;
    try { await completeLesson(l.id); await refreshProgress(sid); } catch (e) { toast(t('errGeneric')); return; }
    const cp = cprog(sid, c.id), nx = c.lessons[c.lessons.findIndex(x => x.id === l.id) + 1];
    const xb = document.getElementById('xpb'); if (xb) xb.textContent = '★ ' + xpOf(sid, c.id).earned + ' ' + t('xp');
    document.getElementById('after').innerHTML = `<div class="card"><div class="row sp"><b>${t('lessonDone').replace(/\s*[+‏]+\s*\d+.*$/, '')}</b><span class="xpbadge">★ ${xpOf(sid, c.id).earned} / ${xpOf(sid, c.id).target}</span></div>
     <div class="bar xp" style="margin-block:.7rem"><i style="width:${pct(sid, c.id)}%"></i></div>
     ${cp.completedAt ? `<p style="font-weight:700;margin-bottom:.6rem">${t('courseDone')}</p><button class="btn red" data-act="cert" data-sid="${sid}" data-id="${c.id}">${t('downloadCert')}</button> ` : ''}
     ${nx ? `<button class="btn ${cp.completedAt ? 'line' : 'red'}" data-act="learn" data-cid="${c.id}" data-lid="${nx.id}">${t('next')} ${arrow()}</button>` : ''}
     <button class="btn ghost" data-act="open-course" data-id="${c.id}">${t('back')}</button></div>`;
    toast(cp.completedAt && !wasDone ? t('courseDone') : t('lessonDone').replace(/\s*[+‏]+\s*\d+.*$/, ''));
    setTimeout(() => { const a = document.getElementById('after'); a && a.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 50);
  }
}

/* ---------- certificate: drawn on a canvas, saved as an A4 landscape PDF ---------- */
function drawCert(name, course, dateISO, lg) {
  const W = 1754, H = 1240, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), ar = lg === 'ar', tt = k => T[lg][k];
  const RED = '#A51C30', NAVY = '#1F3A5F', INK = '#12213B';
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.strokeStyle = NAVY; g.lineWidth = 14; g.strokeRect(50, 50, W - 100, H - 100);
  g.strokeStyle = RED; g.lineWidth = 4; g.strokeRect(80, 80, W - 160, H - 160);
  g.strokeStyle = RED; g.lineWidth = 6; g.fillStyle = '#fff';
  [[120, 120, 1, 1], [W - 120, 120, -1, 1], [120, H - 120, 1, -1], [W - 120, H - 120, -1, -1]].forEach(([x, y, sx, sy]) => {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 120 * sx, y); g.lineTo(x + 170 * sx, y + 50 * sy); g.lineTo(x + 170 * sx, y + 130 * sy); g.stroke();
    [[x, y], [x + 170 * sx, y + 130 * sy]].forEach(([a, b]) => { g.beginPath(); g.arc(a, b, 13, 0, 7); g.fill(); g.stroke(); });
  });
  const fam = ar ? 'Cairo, sans-serif' : 'Poppins, sans-serif';
  g.direction = 'ltr'; g.textAlign = 'left';
  g.font = '800 64px Poppins, sans-serif'; const gw = g.measureText('GENIO').width;
  g.font = '800 46px Poppins, sans-serif'; const tw = g.measureText('TECH').width;
  const x0 = W / 2 - (gw + tw + 8) / 2;
  g.font = '800 64px Poppins, sans-serif'; g.fillStyle = NAVY; g.fillText('GENIO', x0, 250);
  g.font = '800 46px Poppins, sans-serif'; g.fillStyle = RED; g.fillText('TECH', x0 + gw + 8, 250);
  g.textAlign = 'center'; g.direction = ar ? 'rtl' : 'ltr';
  g.fillStyle = RED; g.font = '700 84px ' + fam; g.fillText(tt('certTitle'), W / 2, 430);
  g.fillStyle = INK; g.font = '500 36px ' + fam; g.fillText(tt('certThis'), W / 2, 520);
  let fs = 100; g.font = '800 ' + fs + 'px ' + fam;
  while (g.measureText(name).width > W - 400 && fs > 40) { fs -= 4; g.font = '800 ' + fs + 'px ' + fam; }
  g.fillStyle = NAVY; g.fillText(name, W / 2, 665);
  g.fillStyle = RED; g.fillRect(W / 2 - 380, 700, 760, 5);
  g.fillStyle = INK; g.font = '500 36px ' + fam; g.fillText(tt('certDone'), W / 2, 790);
  fs = 68; g.font = '700 ' + fs + 'px ' + fam;
  while (g.measureText(course).width > W - 400 && fs > 34) { fs -= 4; g.font = '700 ' + fs + 'px ' + fam; }
  g.fillStyle = RED; g.fillText(course, W / 2, 885);
  g.fillStyle = INK; g.font = '600 30px ' + fam;
  g.fillText(tt('certDate') + ': ' + fmtDate(dateISO, lg), W / 2 - 380, 1060);
  g.fillRect(W / 2 + 190, 1040, 380, 3); g.fillText(tt('certSig'), W / 2 + 380, 1090);
  g.fillStyle = NAVY; g.font = '600 22px Poppins, sans-serif'; g.direction = 'ltr'; g.fillText('stem education for all ages', W / 2, 1150);
  return cv;
}
export async function downloadCert(sid, cid) {
  const st = studentById(sid), c = getCourse(cid), cp = cprog(sid, cid);
  if (!st || !c || !cp.completedAt) return;
  try { await document.fonts.load('800 60px Poppins'); await document.fonts.load('700 60px Cairo'); await document.fonts.ready; } catch (e) {}
  try {
    const cv = drawCert(st.name, tx(c.title), cp.completedAt, lang);
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210);
    pdf.save('Geniotech-Certificate-' + st.username + '-' + c.id.slice(0, 6) + '.pdf');
    toast(t('certDl'));
  } catch (e) { toast(t('certFail')); }
}
