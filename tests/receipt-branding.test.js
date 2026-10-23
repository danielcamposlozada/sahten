import {describe,it,expect} from 'vitest';
import {toPublicProject,applyPublicToFile} from '../src/online/roles.js';
import {emptyFile} from '../src/project/schema.js';
it('el cajero recibe marca y QR de su negocio sin copiar claves ni costos',()=>{
 const f=emptyFile('Negocio');
 f.settings.customization={brandName:'Mi negocio',reviewEnabled:true,reviewUrl:'https://g.page/r/demo/review',reviewText:'Contanos',secret:'privado'};
 const pub=toPublicProject(f,()=>({}));
 expect(pub.branding.brandName).toBe('Mi negocio');expect(pub.branding.secret).toBeUndefined();
 const cash=applyPublicToFile(emptyFile(),pub);
 expect(cash.settings.customization.reviewUrl).toBe('https://g.page/r/demo/review');
 expect(cash.costs.gastosOp).toEqual([]);
});
