import { t } from './i18n.js';

export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const P={robot:'<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 8V4M9 13h.01M15 13h.01M9 17h6"/><circle cx="12" cy="3.5" r="1"/>',
 code:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="m10 9-2 2 2 2m4-4 2 2-2 2M8 21h8"/>',
 game:'<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10v5M4.5 12.5h5M15.5 11h.01M18 14h.01"/>',
 star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
 cap:'<path d="m2 9 10-5 10 5-10 5zM6 11.5V16c3 2.5 9 2.5 12 0v-4.5"/>',
 people:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.5M18 14.3c1.8.8 3 2.6 3 4.7"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',play:'<path d="m7 4 13 8-13 8z" fill="currentColor"/>',pause:'<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>',
 shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',book:'<path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6M20 4v14h-6"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',trophy:'<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 14v4m-4 3h8"/>'};
export const ic=(n,s=22)=>`<svg class="icn" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||''}</svg>`;
export const arrow=()=>`<span class="arrow">${ic('arrow',18)}</span>`;
export const CATS={robotics:'robot',programming:'code',game:'game'};
export const catName=c=>t(c==='game'?'game':c);
export const lvlName=l=>t(l);
export const fmtDate=(iso,l)=>{try{return new Date(iso).toLocaleDateString(l==='ar'?'ar-EG':'en-GB',{day:'numeric',month:'long',year:'numeric'})}catch(e){return iso}};
export const fmtTime=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
export function toast(msg){const el=document.getElementById('toast');el.innerHTML='<span>'+esc(msg)+'</span>';clearTimeout(toast.h);toast.h=setTimeout(()=>{el.innerHTML=''},2600)}


export const thumb = c =>
  c.img ? `style="background-image:url(${esc(c.img)})"` : `style="background-image:linear-gradient(135deg,var(--navy),var(--red))"`;
export const $ = id => document.getElementById(id);
