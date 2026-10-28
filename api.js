// Everything that talks to Supabase lives here. UI files only call these functions.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = !!(url && key && !url.includes('YOUR-PROJECT'));
export const sb = configured ? createClient(url, key) : null;

// People sign in with a username; Supabase Auth stores it as a synthetic email.
export const DOMAIN = 'geniotech.app';
export const emailOf = u => `${u.trim().toLowerCase()}@${DOMAIN}`;

/* ---------- in-memory cache the UI reads from ---------- */
export const DB = { users: [], courses: [], progress: {} };
export const getCourse = id => DB.courses.find(c => c.id === id);
export const groupOf = a => (a >= 10 ? 10 : a >= 7 ? 7 : 4);
export const prog = sid => DB.progress[sid] || (DB.progress[sid] = { enrolled: [], courses: {}, last: null });
export const cprog = (sid, cid) =>
  prog(sid).courses[cid] || (prog(sid).courses[cid] = { done: [], xp: 0, max: 0, right: 0, total: 0, completedAt: null });
const nDone = (sid, cid) => {
  const c = getCourse(cid);
  return cprog(sid, cid).done.filter(i => c.lessons.some(l => l.id === i)).length;
};
export const xpOf = (sid, cid) => {
  const c = getCourse(cid), p = cprog(sid, cid);
  return { earned: p.xp, target: p.max || c.lessons.reduce((s, l) => s + (l.xp || 100), 0) };
};
export const pct = (sid, cid) => {
  const c = getCourse(cid);
  return c.lessons.length ? Math.min(100, Math.round((nDone(sid, cid) / c.lessons.length) * 100)) : 0;
};
export const totalXp = sid =>
  Object.keys(prog(sid).courses).reduce((s, cid) => (getCourse(cid) ? s + cprog(sid, cid).xp : s), 0);
export const certsOf = sid => Object.keys(prog(sid).courses).filter(cid => getCourse(cid) && prog(sid).courses[cid].completedAt);
export const studentById = id => DB.users.find(u => u.id === id);

const must = r => { if (r.error) throw r.error; return r.data || []; };
const isStaffRole = r => r === 'admin' || r === 'teacher';

/* ---------- auth ---------- */
export async function signIn(username, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email: emailOf(username), password });
  if (error) throw new Error('bad-login');
  return data.user;
}
export const signOut = async () => { await sb.auth.signOut(); DB.users = []; DB.courses = []; DB.progress = {}; };
export async function sessionUser() {
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.user : null;
}
export async function myProfile(id) {
  const { data } = await sb.from('profiles').select('*').eq('id', id).single();
  return data ? { id: data.id, username: data.username, name: data.full_name, role: data.role, age: data.age } : null;
}
export async function verifyChild(username) {
  const { data, error } = await sb.rpc('verify_parent_child', { child_username: username });
  return !error && data === true;
}

const mapCourse = (c, quizzes = {}) => ({
  id: c.id, cat: c.category, age: c.age_track, level: c.level, img: c.thumb_path,
  title: { en: c.title_en, ar: c.title_ar }, desc: { en: c.desc_en, ar: c.desc_ar },
  lessons: (c.lessons || []).sort((a, b) => a.position - b.position).map(l => ({
    id: l.id, title: { en: l.title_en || '', ar: l.title_ar || '' }, dur: l.demo_seconds, xp: l.xp, video: l.video_path, quizzes: quizzes[l.id] || [],
  })),
});
// Public catalog for the landing page (visitors who are not signed in).
export async function loadCatalog() {
  const r = await sb.from('courses').select('*, lessons(id, position)').order('created_at');
  DB.courses = r.error ? [] : r.data.map(c => mapCourse(c));
}

/* ---------- load everything this person may see (Row Level Security filters it) ---------- */
function buildProgress({ en, lp, xp, ce, la }) {
  const lessonCourse = {};
  DB.courses.forEach(c => c.lessons.forEach(l => (lessonCourse[l.id] = c.id)));
  en.forEach(r => { prog(r.student_id).enrolled.push(r.course_id); cprog(r.student_id, r.course_id); });
  lp.forEach(r => { const cid = lessonCourse[r.lesson_id]; if (cid) cprog(r.student_id, cid).done.push(r.lesson_id); });
  xp.forEach(r => Object.assign(cprog(r.student_id, r.course_id), { xp: r.xp, max: r.max_xp, right: r.right_answers, total: r.answered }));
  ce.forEach(r => (cprog(r.student_id, r.course_id).completedAt = r.issued_at));
  la.forEach(r => { if (r.course_id && r.lesson_id) prog(r.student_id).last = { cid: r.course_id, lid: r.lesson_id, ts: r.updated_at }; });
}
export async function loadAll(role) {
  const staff = isStaffRole(role);
  const [pr, ps, co, en, lp, xp, ce, la, qz] = (await Promise.all([
    sb.from('profiles').select('*'),
    sb.from('parent_students').select('*'),
    sb.from('courses').select('*, lessons(*)').order('created_at'),
    sb.from('enrollments').select('*'),
    sb.from('lesson_progress').select('*'),
    sb.from('student_course_xp').select('*'),
    sb.from('certificates').select('*'),
    sb.from('last_activity').select('*'),
    staff ? sb.from('quizzes').select('*').order('at_second') : Promise.resolve({ data: [] }),
  ])).map(must);
  const quizzes = {};
  qz.forEach(q => (quizzes[q.lesson_id] ||= []).push({ id: q.id, at: q.at_second, q: q.question, opts: q.options, correct: q.correct_index }));
  DB.courses = co.map(c => mapCourse(c, quizzes));
  DB.users = pr.map(p => ({ id: p.id, username: p.username, name: p.full_name, role: p.role, age: p.age, children: [] }));
  ps.forEach(l => {
    const par = DB.users.find(u => u.id === l.parent_id), st = DB.users.find(u => u.id === l.student_id);
    if (par && st) par.children.push(st.username);
  });
  DB.progress = {};
  buildProgress({ en, lp, xp, ce, la });
}
// Light refresh of one student's progress after a quiz answer or lesson completion.
export async function refreshProgress(sid) {
  const [en, lp, xp, ce, la] = (await Promise.all([
    sb.from('enrollments').select('*').eq('student_id', sid),
    sb.from('lesson_progress').select('*').eq('student_id', sid),
    sb.from('student_course_xp').select('*').eq('student_id', sid),
    sb.from('certificates').select('*').eq('student_id', sid),
    sb.from('last_activity').select('*').eq('student_id', sid),
  ])).map(must);
  delete DB.progress[sid];
  buildProgress({ en, lp, xp, ce, la });
}

/* ---------- student actions ---------- */
export const enroll = async (sid, cid) => must(await sb.from('enrollments').insert({ student_id: sid, course_id: cid }).select());
export const touchLast = (sid, cid, lid) =>
  sb.from('last_activity').upsert({ student_id: sid, course_id: cid, lesson_id: lid, updated_at: new Date().toISOString() });
export async function getQuizzes(lid) {
  return must(await sb.rpc('lesson_quizzes', { p_lesson: lid })).map(q => ({ id: q.id, at: q.at_second, q: q.question, opts: q.options }));
}
export async function answerQuiz(qid, choice) {
  const r = must(await sb.rpc('submit_quiz_answer', { p_quiz: qid, p_choice: choice }))[0];
  return { ok: r.is_correct, correct: r.correct_index };
}
export async function completeLesson(lid) {
  return must(await sb.rpc('complete_lesson', { p_lesson: lid }))[0].course_done;
}
export async function videoUrl(path) {
  const { data, error } = await sb.storage.from('lesson-videos').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/* ---------- staff actions ---------- */
export async function saveCourse(id, d) {
  const row = { title_en: d.en, title_ar: d.ar, desc_en: d.descEn, desc_ar: d.descAr, category: d.cat, age_track: d.age, level: d.level };
  if (id) must(await sb.from('courses').update(row).eq('id', id).select());
  else must(await sb.from('courses').insert(row).select());
}
export async function deleteCourse(id) {
  const c = getCourse(id);
  const paths = (c ? c.lessons : []).map(l => l.video).filter(Boolean);
  if (paths.length) await sb.storage.from('lesson-videos').remove(paths);
  must(await sb.from('courses').delete().eq('id', id).select());
}
export async function saveLesson({ courseId, lessonId, en, ar, dur, quizzes, file }) {
  const id = lessonId || crypto.randomUUID();
  const course = getCourse(courseId);
  const old = course.lessons.find(l => l.id === id);
  let video = old ? old.video : null;
  if (file) {
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
    const path = `${courseId}/${id}.${ext}`;
    const up = await sb.storage.from('lesson-videos').upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) throw up.error;
    if (video && video !== path) await sb.storage.from('lesson-videos').remove([video]);
    video = path;
  }
  const row = { id, course_id: courseId, title_en: en, title_ar: ar, demo_seconds: dur, video_path: video };
  if (old) must(await sb.from('lessons').update(row).eq('id', id).select());
  else must(await sb.from('lessons').insert({ ...row, position: course.lessons.length }).select());
  must(await sb.from('quizzes').delete().eq('lesson_id', id).select());
  if (quizzes.length)
    must(await sb.from('quizzes').insert(quizzes.map(q => ({ lesson_id: id, at_second: q.at, question: q.q, options: q.opts, correct_index: q.correct }))).select());
}
export async function deleteLesson(courseId, lessonId) {
  const l = getCourse(courseId).lessons.find(x => x.id === lessonId);
  if (l && l.video) await sb.storage.from('lesson-videos').remove([l.video]);
  must(await sb.from('lessons').delete().eq('id', lessonId).select());
}

/* ---------- admin: create / delete users (runs in the Edge Function, never in the browser) ---------- */
export async function adminUsers(body) {
  const { data, error } = await sb.functions.invoke('admin-users', { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}
