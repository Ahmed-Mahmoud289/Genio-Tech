// Shared UI state. Views read S; call go({...}) to change it and re-render.
export const S = {
  view: 'home', role: 'student', user: null, child: null, tab: 'overview',
  cid: null, lid: null, err: '', catF: 'all', ageF: 'all', pendDel: null, loading: false, fatal: '',
};
let _render = () => {};
export const setRender = f => { _render = f; };
export const render = () => _render();
export function go(patch) { Object.assign(S, patch); render(); window.scrollTo({ top: 0 }); }
