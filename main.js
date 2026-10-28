import './styles.css';
import { t, lang, setLang } from './i18n.js';
import { S, go, render, setRender } from './state.js';
import * as api from './api.js';
import { DB, getCourse, prog } from './api.js';
import { toast, $ } from './ui.js';
import * as V from './views.js';
import { learnView, mountPlayer, stopPlayer, downloadCert } from './player.js';

/* ---------- render ---------- */
function paint() {
  stopPlayer();
  setLang(lang);
  const u = S.user;
  let main = '';
  if (S.fatal) main = `<div class="wrap"><div class="login"><div class="err">${S.fatal}</div></div></div>`;
  else if (S.loading) main = `<div class="wrap page"><div class="empty">${t('loading')}</div></div>`;
  else if (S.view === 'login' && !u) main = V.loginView();
  else if (!u) { S.view = 'home'; main = V.landing(); }
  else if (S.view === 'home') main = V.landing();
  else if (S.view === 'course') main = V.courseView();
  else if (S.view === 'learn' && u.role === 'student') main = learnView();
  else main = u.role === 'student' ? V.studentDash() : u.role === 'parent' ? V.parentDash() : V.staffDash();
  $('app').innerHTML = V.topbar() + main;
  if (S.view === 'learn' && u && !S.loading) mountPlayer();
}
setRender(paint);

const home = () => go({ view: S.user ? 'dash' : 'home' });
const firstTab = r => (r === 'student' ? 'my' : r === 'parent' ? 'child' : 'overview');
function scrollAll() { setTimeout(() => { const a = $('all'); a && a.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30); }
const fail = e => { console.error(e); toast(t('errGeneric')); };

/* ---------- auth ---------- */
async function enter(profile, child) {
  S.user = profile; S.child = child || null; S.loading = true; S.view = 'dash'; S.tab = firstTab(profile.role); paint();
  try { await api.loadAll(profile.role); } catch (e) { fail(e); }
  S.loading = false; paint();
}
async function doLogin(f) {
  const username = f.u.value.trim(), password = f.p.value, child = f.c ? f.c.value.trim().toLowerCase() : '';
  const bad = msg => { S.err = msg; paint(); };
  let authUser;
  try { authUser = await api.signIn(username, password); } catch (e) { return bad(t('badLogin')); }
  const profile = await api.myProfile(authUser.id);
  if (!profile || profile.role !== S.role) { await api.signOut(); return bad(t('badLogin')); }
  if (profile.role === 'parent') {
    if (!child) { await api.signOut(); return bad(t('needChild')); }
    if (!(await api.verifyChild(child))) { await api.signOut(); return bad(t('badChild')); }
  }
  S.err = '';
  await enter(profile, child);
}

/* ---------- clicks ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  if (a === 'm-bg') { if (e.target === el) V.closeModal(); return; }
  try {
    switch (a) {
      case 'home': case 'about': home(); break;
      case 'courses':
        if (S.user) go({ view: 'dash', tab: S.user.role === 'student' ? 'avail' : S.tab });
        else if (S.view !== 'home') { go({ view: 'home' }); scrollAll(); } else scrollAll();
        break;
      case 'cat': S.catF = id; go({ view: 'home' }); scrollAll(); break;
      case 'login': go({ view: 'login', err: '' }); break;
      case 'lang': setLang(lang === 'en' ? 'ar' : 'en'); render(); break;
      case 'theme': {
        const r = document.documentElement;
        const dark = r.dataset.theme === 'dark' || (!r.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches);
        r.dataset.theme = dark ? 'light' : 'dark'; break;
      }
      case 'logout': await api.signOut(); await api.loadCatalog(); go({ user: null, child: null, view: 'home' }); break;
      case 'role': S.role = id; S.err = ''; render(); break;
      case 'tab': S.tab = id; S.pendDel = null; render(); break;
      case 'dash': go({ view: 'dash' }); break;
      case 'open-course': S.user ? go({ view: 'course', cid: id }) : go({ view: 'login' }); break;
      case 'learn': go({ view: 'learn', cid: el.dataset.cid, lid: el.dataset.lid }); break;
      case 'enroll':
        await api.enroll(S.user.id, id); await api.refreshProgress(S.user.id); toast(t('enrolledOk'));
        if (S.view === 'course') render(); else go({ tab: 'my' });
        break;
      case 'cert': downloadCert(el.dataset.sid, id); break;
      case 'm-course': V.mCourse(id || ''); break;
      case 'm-lesson': V.mLesson(el.dataset.cid, el.dataset.lid || ''); break;
      case 'm-user': V.mUser(); break;
      case 'm-close': V.closeModal(); break;
      case 'add-q': $('qList').insertAdjacentHTML('beforeend', V.qRow(null)); break;
      case 'rm-q': el.closest('.qrow').remove(); break;
      case 'del-course': case 'del-lesson': case 'del-user': {
        const key = a === 'del-course' ? 'c' + id : a === 'del-user' ? 'u' + id : el.dataset.cid + el.dataset.lid;
        if (S.pendDel !== key) { S.pendDel = key; render(); break; }
        S.pendDel = null;
        if (a === 'del-course') await api.deleteCourse(id);
        else if (a === 'del-lesson') await api.deleteLesson(el.dataset.cid, el.dataset.lid);
        else await api.adminUsers({ action: 'delete', id });
        await api.loadAll(S.user.role); render(); break;
      }
    }
  } catch (err) { fail(err); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'catF') { S.catF = e.target.value; render(); scrollAll(); }
  if (e.target.id === 'ageF') { S.ageF = e.target.value; render(); scrollAll(); }
});

/* ---------- forms ---------- */
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target;
  const busy = on => f.querySelectorAll('button[type=submit]').forEach(b => (b.disabled = on));
  try {
    if (f.id === 'loginForm') { busy(true); await doLogin(f); return; }
    if (f.id === 'fCourse') {
      busy(true);
      await api.saveCourse(f.dataset.id, { en: $('ce').value.trim(), ar: $('ca').value.trim() || $('ce').value.trim(), descEn: $('cde').value.trim(), descAr: $('cda').value.trim() || $('cde').value.trim(), cat: $('cc').value, age: +$('cg').value, level: $('cl').value });
      await api.loadAll(S.user.role); V.closeModal(); toast(t('saved')); render(); return;
    }
    if (f.id === 'fLesson') {
      busy(true);
      const quizzes = [...document.querySelectorAll('#qList .qrow')].map(r => {
        const g = k => r.querySelector('[data-f="' + k + '"]').value;
        const opts = g('opts').split('\n').map(s => s.trim()).filter(Boolean);
        return { at: Math.max(0, +g('at') || 0), q: g('q').trim(), opts, correct: Math.min(opts.length - 1, Math.max(0, (+g('correct') || 1) - 1)) };
      }).filter(q => q.q && q.opts.length >= 2).sort((a, b) => a.at - b.at);
      const file = $('lv').files[0];
      if (file) toast(t('uploading'));
      await api.saveLesson({ courseId: f.dataset.cid, lessonId: f.dataset.lid, en: $('le').value.trim(), ar: $('la').value.trim() || $('le').value.trim(), dur: +$('ld').value || 30, quizzes, file });
      await api.loadAll(S.user.role); V.closeModal(); toast(t('saved')); render(); return;
    }
    if (f.id === 'fUser') {
      const err = m => { $('uErr').innerHTML = `<div class="err">${m}</div>`; busy(false); };
      const username = $('uu').value.trim().toLowerCase(), password = $('up').value, role = $('ur').value;
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) return err(t('badUsername'));
      if (password.length < 6) return err(t('pwMin'));
      busy(true);
      try {
        await api.adminUsers({ action: 'create', username, password, role, name: $('un').value.trim(), age: +$('ua').value || null, children: $('ul').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) });
      } catch (ex) { return err(ex.message === 'username-taken' ? t('usernameTaken') : ex.message === 'children-not-found' ? t('noChild') : ex.message); }
      await api.loadAll(S.user.role); V.closeModal(); toast(t('userCreated')); render();
    }
  } catch (err) { fail(err); busy(false); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') V.closeModal(); });

/* ---------- start ---------- */
(async function init() {
  if (!api.configured) { S.fatal = t('needConfig'); return paint(); }
  paint();
  try {
    const au = await api.sessionUser();
    if (au) { const p = await api.myProfile(au.id); if (p) { S.role = p.role; await enter(p, null); return; } }
  } catch (e) { console.error(e); }
  await api.loadCatalog();
  paint();
})();
