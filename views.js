import { t, tx, lang } from './i18n.js';
import { S, go } from './state.js';
import { DB, getCourse, groupOf, prog, cprog, xpOf, pct, totalXp, certsOf, studentById } from './api.js';
import { esc, ic, arrow, CATS, catName, lvlName, fmtDate, thumb, $ } from './ui.js';

/* ---------- top bar ---------- */
export function topbar(){
  const u=S.user;
  return `<header class="top"><div class="wrap">
   <button class="brand" data-act="home" aria-label="Geniotech"><img src="/img/brain.jpg" alt=""><span class="wm"><b>GENIO<i>TECH</i></b><small>${t('tag')}</small></span></button>
   <nav class="nav">${u?'':`<button class="${S.view==='home'?'on':''}" data-act="home">${t('home')}</button><button data-act="courses">${t('courses')}</button><button data-act="courses">${t('paths')}</button><button data-act="about">${t('about')}</button>`}</nav>
   <div class="tools" style="${u?'margin-inline-start:auto':''}">
    <button class="chip" data-act="lang">${t('lang')}</button>
    <button class="chip" data-act="theme" aria-label="Theme">◐</button>
    ${u?`<span class="who"><span class="avatar">${esc((u.name||'?')[0])}</span><span>${esc(u.name)}<br><small style="color:var(--muted)">${t(u.role)}</small></span></span><button class="btn line sm" data-act="logout">${t('logout')}</button>`
       :`<button class="btn line sm" data-act="login">${t('login')}</button><button class="btn red sm" data-act="login">${t('getStarted')} ${arrow()}</button>`}
   </div></div></header>`;
}

/* ---------- course card ---------- */
export function courseCard(c,opts={}){
  const sid=S.user&&S.user.role==='student'?S.user.id:null;
  const enr=sid&&prog(sid).enrolled.includes(c.id);
  const p=enr?pct(sid,c.id):0;
  return `<article class="course"><div class="th" ${thumb(c)}><span class="tag">${catName(c.cat)}</span></div>
   <div class="bd"><h3>${esc(tx(c.title))}</h3><p>${esc(tx(c.desc))}</p>
   <div class="meta"><span>${lvlName(c.level)}</span><span>${t('ages')} ${c.age}+</span><span>${c.lessons.length} ${t('lessons')}</span></div>
   ${enr?`<div class="bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div>`:''}
   <div class="ft">${enr?`<span class="pill ${p===100?'ok':''}">${p}%</span><button class="btn red sm" data-act="open-course" data-id="${c.id}">${p===100?t('open'):p?t('continueB'):t('start')} ${arrow()}</button>`
     :opts.enroll&&sid?`<button class="btn line sm" data-act="enroll" data-id="${c.id}">${t('enroll')}</button><button class="btn ghost sm" data-act="open-course" data-id="${c.id}">${t('open')}</button>`
     :`<span></span><button class="btn red sm" data-act="${S.user?'open-course':'login'}" data-id="${c.id}">${S.user?t('open'):t('getStarted')} ${arrow()}</button>`}</div>
   </div></article>`;
}

/* ---------- landing ---------- */
export function landing(){
  const list=DB.courses.filter(c=>(S.catF==='all'||c.cat===S.catF)&&(S.ageF==='all'||String(c.age)===S.ageF));
  const filters=`<div class="row" style="margin-bottom:1rem"><select class="chip" id="catF" aria-label="${t('category')}"><option value="all">${t('allCats')}</option>${Object.keys(CATS).map(k=>`<option value="${k}" ${S.catF===k?'selected':''}>${catName(k)}</option>`).join('')}</select>
   <select class="chip" id="ageF" aria-label="${t('ageGroup')}"><option value="all">${t('allAges')}</option>${[4,7,10].map(a=>`<option value="${a}" ${S.ageF===String(a)?'selected':''}>${t('ages')} +${a}</option>`).join('')}</select></div>`;
  return `<div class="wrap"><section class="hero"><div><h1>${t('heroA')}<span>${t('heroB')}</span></h1><p class="lead">${t('heroLead')}</p>
   <div class="cta"><button class="btn red" data-act="courses">${t('exploreCourses')} ${arrow()}</button><button class="btn line" data-act="login">${ic('play',16)} ${t('howItWorks')}</button></div></div>
   <figure><img src="/img/hero.jpg" alt=""></figure></section>
   <section class="cats">${[['robot','robotics','catRobo'],['code','programming','catProg'],['game','game','catGame'],['trophy','xpcert','catXp']].map(([i,k,d])=>`<button class="cat" data-act="${k==='xpcert'?'login':'cat'}" data-id="${k==='game'?'game':k}"><span class="ic">${ic(i,26)}</span><span><b>${t(k)}</b><span>${t(d)}</span></span></button>`).join('')}</section>
   <section id="all"><div class="sec-h"><h2>${t('learnPace')}</h2><em>— ${t('popular')}</em></div>${filters}
   <div class="grid">${list.map(c=>courseCard(c)).join('')||`<div class="empty">${t('noneYet')}</div>`}</div></section>
   <section class="perks"><div><span class="ic">${ic('cap')}</span><p><b>${t('handsOn')}</b><span>${t('handsOnD')}</span></p></div>
   <div><span class="ic">${ic('people')}</span><p><b>${t('experts')}</b><span>${t('expertsD')}</span></p></div>
   <div><span class="ic">${ic('target')}</span><p><b>${t('realP')}</b><span>${t('realPD')}</span></p></div></section>
   <footer class="ft2">© Geniotech · ${t('tag')}</footer></div>`;
}

/* ---------- login ---------- */
export function loginView(){
  const roles=[['student','user'],['parent','people'],['teacher','book'],['admin','shield']];
  return `<div class="wrap"><form class="login" id="loginForm" autocomplete="off"><h2>${t('login')}</h2><p class="sub">${t('chooseRole')}</p>
   <div class="roles" role="radiogroup">${roles.map(([r,i])=>`<button type="button" class="role ${S.role===r?'on':''}" role="radio" aria-checked="${S.role===r}" data-act="role" data-id="${r}"><span class="ic">${ic(i,20)}</span>${t(r)}</button>`).join('')}</div>
   ${S.err?`<div class="err" role="alert">${esc(S.err)}</div>`:''}
   <div class="field"><label for="lu">${t('username')}</label><input id="lu" name="u" required autocapitalize="none"></div>
   <div class="field"><label for="lp">${t('password')}</label><input id="lp" name="p" type="password" required></div>
   ${S.role==='parent'?`<div class="field"><label for="lc">${t('childUser')}</label><input id="lc" name="c" required autocapitalize="none"></div>`:''}
   <button class="btn red" style="width:100%" type="submit">${t('signIn')} ${arrow()}</button></form></div>`;
}

/* ---------- shared bits ---------- */
const stat=(v,l,cls='')=>`<div class="stat ${cls}"><b>${v}</b><span>${l}</span></div>`;
const tabsBar=(items)=>`<div class="tabs" role="tablist">${items.map(([k,l])=>`<button role="tab" aria-selected="${S.tab===k}" class="${S.tab===k?'on':''}" data-act="tab" data-id="${k}">${l}</button>`).join('')}</div>`;
export function certRows(sid){
  const ids=certsOf(sid);
  if(!ids.length)return `<div class="empty">${t('noneYet')}</div>`;
  return `<div class="grid">${ids.map(cid=>{const c=getCourse(cid);return `<div class="card"><div class="pill gold" style="margin-bottom:.5rem">${ic('trophy',14)} ${t('cert')}</div><h3>${esc(tx(c.title))}</h3><p style="color:var(--muted);font-size:.85rem;margin-bottom:.8rem">${fmtDate(prog(sid).courses[cid].completedAt,lang)}</p><button class="btn red sm" data-act="cert" data-sid="${sid}" data-id="${cid}">${t('downloadCert')}</button></div>`}).join('')}</div>`;
}
export function resumeCard(sid){
  const last=prog(sid).last;if(!last)return '';
  const c=getCourse(last.cid);if(!c)return '';
  const l=c.lessons.find(x=>x.id===last.lid)||c.lessons[0];
  return `<div class="resume"><div><small>${t('continueL')}</small><b>${esc(tx(c.title))} · ${esc(tx(l.title))}</b></div><button class="btn red" data-act="learn" data-cid="${c.id}" data-lid="${l.id}">${t('continueB')} ${arrow()}</button></div>`;
}

/* ---------- student ---------- */
export function studentDash(){
  const u=S.user,p=prog(u.id),g=groupOf(u.age||7);
  const mine=p.enrolled.map(getCourse).filter(Boolean);
  const avail=DB.courses.filter(c=>c.age===g&&!p.enrolled.includes(c.id));
  const done=Object.keys(p.courses).reduce((s,k)=>s+(getCourse(k)?p.courses[k].done.length:0),0);
  let body='';
  if(S.tab==='my'){
    body=resumeCard(u.id)+`<div class="stats">${stat(totalXp(u.id),t('totalXp'),'xp')}${stat(mine.length,t('myCourses'))}${stat(done,t('lessonsDone'))}${stat(certsOf(u.id).length,t('certs'))}</div>
     <div class="sec-h"><h2>${t('myCourses')}</h2></div>${mine.length?`<div class="grid">${mine.map(c=>courseCard(c)).join('')}</div>`:`<div class="empty">${t('noMyCourses')}</div>`}`;
  }else if(S.tab==='avail'){
    body=`<div class="sec-h"><h2>${t('available')}</h2><span class="pill red">${t('ages')} +${g}</span></div>${avail.length?`<div class="grid">${avail.map(c=>courseCard(c,{enroll:true})).join('')}</div>`:`<div class="empty">${t('noAvail')}</div>`}`;
  }else body=`<div class="sec-h"><h2>${t('certs')}</h2></div>${certRows(u.id)}`;
  return `<div class="wrap page"><h2 style="font-size:1.6rem;font-weight:800;margin-bottom:1rem">${t('welcomeBack')}, ${esc(u.name.split(' ')[0])}</h2>
   ${tabsBar([['my',t('myCourses')],['avail',t('available')],['certs',t('certs')]])}${body}</div>`;
}

/* ---------- course detail (student/any) ---------- */
export function courseView(){
  const c=getCourse(S.cid);if(!c)return go({view:'dash'}),'';
  const u=S.user,isS=u&&u.role==='student';
  const sid=isS?u.id:null;
  const enr=isS&&prog(sid).enrolled.includes(c.id);
  const x=enr?xpOf(sid,c.id):null,pr=enr?cprog(sid,c.id):null;
  return `<div class="wrap page"><button class="btn ghost sm" data-act="dash">← ${t('back').replace(/.*/,t('home'))}</button>
   <div class="sec-h" style="margin-top:.8rem"><h2>${esc(tx(c.title))}</h2><span class="pill">${catName(c.cat)}</span><span class="pill">${lvlName(c.level)}</span><span class="pill red">${t('ages')} ${c.age}+</span></div>
   <p style="color:var(--muted);max-width:60ch;margin-bottom:1rem">${esc(tx(c.desc))}</p>
   ${enr?`<div class="card" style="margin-bottom:1rem"><div class="row sp"><b>${t('yourXp')}</b><span class="xpbadge">★ ${x.earned} / ${x.target} ${t('xp')}</span></div>
     <div class="bar xp" style="margin-top:.6rem" role="progressbar" aria-valuenow="${pct(sid,c.id)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct(sid,c.id)}%"></i></div>
     ${pr.completedAt?`<div class="row" style="margin-top:.8rem"><span class="pill ok">${t('completed')}</span><button class="btn red sm" data-act="cert" data-sid="${sid}" data-id="${c.id}">${t('downloadCert')}</button></div>`:''}</div>`:''}
   ${isS&&!enr?`<button class="btn red" style="margin-bottom:1rem" data-act="enroll" data-id="${c.id}">${t('enroll')}</button>`:''}
   <div class="card"><h3>${t('lessons')}</h3>${c.lessons.length?c.lessons.map((l,i)=>{const d=enr&&pr.done.includes(l.id);
     return `<div class="lesson-li ${d?'done':''}"><span class="n">${d?'✓':i+1}</span><div class="t"><b>${esc(tx(l.title))}</b>${u&&u.role!=='student'?`<span>${l.quizzes.length} ${t('quizzes').toLowerCase()}</span>`:''}</div>${enr?`<button class="btn ${d?'line':'red'} sm" data-act="learn" data-cid="${c.id}" data-lid="${l.id}">${d?t('open'):t('start')} ${arrow()}</button>`:''}</div>`}).join(''):`<div class="empty">${t('noLessons')}</div>`}</div></div>`;
}

/* ---------- parent ---------- */
export function parentDash(){
  const me=DB.users.find(x=>x.id===S.user.id)||S.user,uname=(S.child||(me.children||[])[0]||'').toLowerCase();
  const st=DB.users.find(x=>x.role==='student'&&x.username.toLowerCase()===uname);
  if(!st)return `<div class="wrap page"><div class="empty">${t('badChild')}</div></div>`;
  const p=prog(st.id),ids=p.enrolled.filter(id=>getCourse(id));
  const done=ids.reduce((s,id)=>s+cprog(st.id,id).done.length,0);
  const rows=ids.map(id=>{const c=getCourse(id),cp=cprog(st.id,id),acc=cp.total?Math.round(cp.right/cp.total*100)+'%':'—';
    return `<tr><td><b>${esc(tx(c.title))}</b><br><small style="color:var(--muted)">${catName(c.cat)} · ${t('ages')} ${c.age}+</small></td><td style="min-width:130px"><div class="bar"><i style="width:${pct(st.id,id)}%"></i></div><small>${pct(st.id,id)}%</small></td><td>${xpOf(st.id,id).earned}</td><td>${acc}</td><td>${cp.completedAt?`<span class="pill ok">${t('completed')}</span>`:`<span class="pill">${t('inProgress')}</span>`}</td></tr>`}).join('');
  const last=p.last&&getCourse(p.last.cid);
  return `<div class="wrap page"><div class="sec-h"><h2>${t('trackChild')}: ${esc(st.name)}</h2><span class="pill">@${esc(st.username)}</span><span class="pill red">${t('ages')} +${groupOf(st.age||7)}</span></div>
   <div class="stats">${stat(totalXp(st.id),t('totalXp'),'xp')}${stat(ids.length,t('myCourses'))}${stat(done,t('lessonsDone'))}${stat(certsOf(st.id).length,t('certs'))}</div>
   ${last?`<div class="card" style="margin-bottom:1rem"><b>${t('lastSeen')}</b><p style="color:var(--muted)">${esc(tx(last.title))} · ${esc(tx((last.lessons.find(l=>l.id===p.last.lid)||last.lessons[0]).title))} — ${fmtDate(p.last.ts,lang)}</p></div>`:''}
   <div class="card" style="margin-bottom:1rem"><h3>${t('myCourses')}</h3>${rows?`<div class="tablew"><table><thead><tr><th>${t('name')}</th><th>${t('progress')}</th><th>${t('xp')}</th><th>${t('acc')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="empty">${t('noneYet')}</div>`}</div>
   <div class="sec-h"><h2>${t('certs')}</h2></div>${certRows(st.id)}</div>`;
}

/* ---------- admin / teacher ---------- */
export function staffDash(){
  const isA=S.user.role==='admin';
  const tabs=[['overview',t('overview')],['courses',t('manageCourses')]];if(isA)tabs.push(['users',t('users')]);
  const cnt=r=>DB.users.filter(u=>u.role===r).length;
  let body='';
  if(S.tab==='overview'){
    const lessons=DB.courses.reduce((s,c)=>s+c.lessons.length,0),qs=DB.courses.reduce((s,c)=>s+c.lessons.reduce((a,l)=>a+l.quizzes.length,0),0);
    body=`<div class="stats">${stat(cnt('student'),t('students'))}${stat(cnt('teacher'),t('teachers'))}${stat(cnt('parent'),t('parents'))}${stat(DB.courses.length,t('manageCourses'))}${stat(lessons,t('lessons'))}${stat(qs,t('quizzes'))}</div>
     <div class="card"><h3>${t('students')}</h3>${studentTable()}</div>`;
  }else if(S.tab==='courses'){
    body=`<div class="row sp" style="margin-bottom:1rem"><h2 style="font-size:1.4rem">${t('manageCourses')}</h2><button class="btn red" data-act="m-course">+ ${t('addCourse')}</button></div>
     ${DB.courses.map(c=>`<div class="card" style="margin-bottom:1rem"><div class="row sp"><div><h3 style="margin:0">${esc(tx(c.title))}</h3><div class="meta" style="margin-top:.3rem"><span>${catName(c.cat)}</span><span>${lvlName(c.level)}</span><span>${t('ages')} ${c.age}+</span></div></div>
       <div class="row">${isA?`<button class="btn line sm" data-act="m-course" data-id="${c.id}">${t('edit')}</button><button class="btn danger sm" data-act="del-course" data-id="${c.id}">${S.pendDel==='c'+c.id?t('deleteSure'):t('del')}</button>`:''}<button class="btn red sm" data-act="m-lesson" data-cid="${c.id}">+ ${t('addLesson')}</button></div></div>
       ${c.lessons.map((l,i)=>`<div class="lesson-li"><span class="n">${i+1}</span><div class="t"><b>${esc(tx(l.title))}</b><span>${l.video?'🎬 ':''}${l.quizzes.length} ${t('quizzes').toLowerCase()}</span></div><button class="btn line sm" data-act="m-lesson" data-cid="${c.id}" data-lid="${l.id}">${t('edit')}</button><button class="btn danger sm" data-act="del-lesson" data-cid="${c.id}" data-lid="${l.id}">${S.pendDel===c.id+l.id?t('deleteSure'):t('del')}</button></div>`).join('')||`<div class="empty" style="margin-top:.8rem">${t('noLessons')}</div>`}</div>`).join('')}`;
  }else if(S.tab==='users'&&isA){
    body=`<div class="row sp" style="margin-bottom:1rem"><h2 style="font-size:1.4rem">${t('users')}</h2><button class="btn red" data-act="m-user">+ ${t('addUser')}</button></div>
     <div class="card"><div class="tablew"><table><thead><tr><th>${t('name')}</th><th>${t('username')}</th><th>${t('role')}</th><th>${t('age')} / ${t('linkStudent').split(' (')[0]}</th><th></th></tr></thead><tbody>
     ${DB.users.map(u=>`<tr><td>${esc(u.name)}</td><td>@${esc(u.username)}</td><td><span class="pill ${u.role==='admin'?'red':''}">${t(u.role)}</span></td><td>${u.role==='student'?u.age:u.role==='parent'?esc((u.children||[]).join(', ')):''}</td><td>${u.id===S.user.id?'':`<button class="btn danger sm" data-act="del-user" data-id="${u.id}">${S.pendDel==='u'+u.id?t('deleteSure'):t('del')}</button>`}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  return `<div class="wrap page"><h2 style="font-size:1.6rem;font-weight:800;margin-bottom:1rem">${t('welcome')}, ${esc(S.user.name)}</h2>${tabsBar(tabs)}${body}</div>`;
}
export function studentTable(){
  const sts=DB.users.filter(u=>u.role==='student');
  if(!sts.length)return `<div class="empty">${t('noneYet')}</div>`;
  return `<div class="tablew"><table><thead><tr><th>${t('name')}</th><th>${t('ageGroup')}</th><th>${t('totalXp')}</th><th>${t('myCourses')}</th><th>${t('certs')}</th></tr></thead><tbody>${sts.map(s=>`<tr><td>${esc(s.name)}<br><small style="color:var(--muted)">@${esc(s.username)}</small></td><td>+${groupOf(s.age||7)}</td><td>${totalXp(s.id)}</td><td>${prog(s.id).enrolled.length}</td><td>${certsOf(s.id).length}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ---------- modals ---------- */
const opt=(v,l,sel)=>`<option value="${v}" ${sel?'selected':''}>${l}</option>`;
export function showModal(html){document.getElementById('modal').innerHTML=`<div class="modal" data-act="m-bg"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;const f=document.querySelector('#modal input');if(f)f.focus()}
export function closeModal(){document.getElementById('modal').innerHTML=''}
export function mCourse(id){
  const c=id?getCourse(id):{title:{},desc:{},cat:'robotics',age:7,level:'beginner'};
  showModal(`<h3>${id?t('editCourse'):t('addCourse')}</h3><form id="fCourse" data-id="${id||''}">
   <div class="two"><div class="field"><label for="ce">${t('titleEn')}</label><input id="ce" value="${esc(c.title.en)}" required></div><div class="field"><label for="ca">${t('titleAr')}</label><input id="ca" dir="rtl" value="${esc(c.title.ar)}"></div></div>
   <div class="two"><div class="field"><label for="cde">${t('descEn')}</label><textarea id="cde" rows="2">${esc(c.desc.en)}</textarea></div><div class="field"><label for="cda">${t('descAr')}</label><textarea id="cda" dir="rtl" rows="2">${esc(c.desc.ar)}</textarea></div></div>
   <div class="two"><div class="field"><label for="cc">${t('category')}</label><select id="cc">${Object.keys(CATS).map(k=>opt(k,catName(k),c.cat===k)).join('')}</select></div>
   <div class="field"><label for="cg">${t('ageGroup')}</label><select id="cg">${[4,7,10].map(a=>opt(a,'+'+a,c.age===a)).join('')}</select></div>
   <div class="field"><label for="cl">${t('level')}</label><select id="cl">${['beginner','intermediate','advanced'].map(k=>opt(k,t(k),c.level===k)).join('')}</select></div></div>
   <div class="row"><button class="btn red" type="submit">${t('save')}</button><button class="btn ghost" type="button" data-act="m-close">${t('cancel')}</button></div></form>`);
}
export function qRow(q){
  const opts=q&&Array.isArray(q.opts)?q.opts:[];
  return `<div class="qrow"><div class="two"><div class="field"><label>${t('atTime')}</label><input type="number" min="0" data-f="at" value="${q?q.at:10}"></div><div class="field"><label>${t('correctL')}</label><input type="number" min="1" data-f="correct" value="${q?q.correct+1:1}"></div></div>
   <div class="field"><label>${t('question')}</label><input data-f="q" value="${esc(q?tx(q.q):'')}"></div>
   <div class="field"><label>${t('optionsL')}</label><textarea rows="3" data-f="opts">${esc(opts.join('\n'))}</textarea></div>
   <button class="btn danger sm" type="button" data-act="rm-q">${t('del')}</button></div>`;
}
export function mLesson(cid,lid){
  const c=getCourse(cid),l=lid?c.lessons.find(x=>x.id===lid):{title:{},dur:30,quizzes:[]};
  showModal(`<h3>${lid?t('editLesson'):t('addLesson')} · ${esc(tx(c.title))}</h3><form id="fLesson" data-cid="${cid}" data-lid="${lid||''}">
   <div class="two"><div class="field"><label for="le">${t('titleEn')}</label><input id="le" value="${esc(l.title.en)}" required></div><div class="field"><label for="la">${t('titleAr')}</label><input id="la" dir="rtl" value="${esc(l.title.ar)}"></div></div>
   <div class="field"><label for="lv">${t('video')}</label><input id="lv" type="file" accept="video/*"><small style="color:var(--muted)">${t('videoNote')}</small>${l.video?'<small class="pill ok" style="align-self:flex-start;margin-top:.3rem">🎬 ✓</small>':''}</div>
   <div class="field" style="max-width:220px"><label for="ld">${t('duration')}</label><input id="ld" type="number" min="10" max="600" value="${l.dur||30}"></div>
   <div class="row sp" style="margin-block:.4rem .6rem"><b>${t('quizzes')}</b><button class="btn line sm" type="button" data-act="add-q">+ ${t('addQuiz')}</button></div>
   <div id="qList">${(l.quizzes||[]).map(qRow).join('')}</div>
   <div class="row" style="margin-top:.8rem"><button class="btn red" type="submit">${t('save')}</button><button class="btn ghost" type="button" data-act="m-close">${t('cancel')}</button></div></form>`);
}
export function mUser(){
  showModal(`<h3>${t('addUser')}</h3><form id="fUser">
   <div class="two"><div class="field"><label for="ur">${t('role')}</label><select id="ur">${['student','teacher','parent','admin'].map(r=>opt(r,t(r))).join('')}</select></div>
   <div class="field"><label for="un">${t('fullName')}</label><input id="un" required></div></div>
   <div class="two"><div class="field"><label for="uu">${t('username')}</label><input id="uu" required autocapitalize="none"></div><div class="field"><label for="up">${t('password')}</label><input id="up" required></div></div>
   <div class="two"><div class="field"><label for="ua">${t('age')} (${t('student')})</label><input id="ua" type="number" min="4" max="18" value="8"></div>
   <div class="field"><label for="ul">${t('linkStudent')} (${t('parent')})</label><input id="ul" placeholder="sara, omar"></div></div>
   <div id="uErr"></div><div class="row"><button class="btn red" type="submit">${t('save')}</button><button class="btn ghost" type="button" data-act="m-close">${t('cancel')}</button></div></form>`);
}
