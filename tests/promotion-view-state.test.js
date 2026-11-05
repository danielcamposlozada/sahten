import {it,expect} from 'vitest';
import {JSDOM} from 'jsdom';
import {capturePromotionView,restorePromotionView} from '../src/ui/promotion-view-state.js';
it('live rerender preserves expanded drafts, closed checks, focus and horizontal reading position',()=>{
 const dom=new JSDOM('<div id="root"><details class="drafts" open><summary>Borradores</summary><details class="checks"><summary>Requisitos</summary></details></details><div id="table"><input id="search" value="falafel"></div></div>');
 const d=dom.window.document,r=d.getElementById('root');
 d.getElementById('table').scrollLeft=120;d.getElementById('search').focus();d.getElementById('search').setSelectionRange(2,4);
 const state=capturePromotionView(r);r.innerHTML=r.innerHTML;
 restorePromotionView(r,state,{restoreFocus:true});
 expect(r.querySelector('.drafts').open).toBe(true);expect(r.querySelector('.checks').open).toBe(false);
 expect(d.activeElement.id).toBe('search');expect(d.activeElement.selectionStart).toBe(2);
 expect(d.getElementById('table').scrollLeft).toBe(120);dom.window.close();
});
it('does not reopen an unrelated disclosure or steal focus after changing tab',()=>{
 const dom=new JSDOM('<div id="r"><details class="drafts" open></details><input id="a"></div>');
 const r=dom.window.document.getElementById('r');r.querySelector('input').focus();const state=capturePromotionView(r);
 r.innerHTML='<details class="calendar"></details><input id="a">';restorePromotionView(r,state);
 expect(r.querySelector('details').open).toBe(false);expect(dom.window.document.activeElement.id).not.toBe('a');dom.window.close();
});
