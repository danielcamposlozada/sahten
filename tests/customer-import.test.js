import { describe, expect, it } from 'vitest';
import { guessCustomerColumns, planCustomerImport, materializeCustomerImport, normalizeImportPhone } from '../src/core/customer-import.js';
const heads = ['Id', 'Nombre', 'Teléfono', 'Email', 'Cant_compras', 'Activo'];
const mapping = guessCustomerColumns(heads);
describe('clientes y direcciones importados', () => {
  it('conserva personas distintas que comparten teléfono y omite duplicados claros o IDs repetidos', () => {
    const rows = [['1','Ana','+5491112345678','',3,'Sí'],['2','Luis','+5491112345678','',2,'Sí'],['1','Ana','+5491112345678','',3,'Sí']];
    const plan = planCustomerImport({ rows, mapping });
    expect(plan).toMatchObject({ newCount: 2, duplicateCount: 1, invalidCount: 0 });
    expect(plan.rows[1].warnings.join()).toMatch(/compartido/);
    let n=0; const imported=materializeCustomerImport(plan,{id:()=>String(++n)});
    expect(imported[0].phone).toBe('+5491112345678'); expect(imported[1].externalId).toBe('2');
    expect(imported.reduce((n,c)=>n+c.importedPurchaseCount,0)).toBe(5);
    expect(planCustomerImport({rows,mapping,existing:imported}).newCount).toBe(0);
  });
  it('vincula varias direcciones por ID, deduplica equivalencias exactas y conserva una principal', () => {
    const headers=['Id Cliente','Calle','Número','Piso/Depto','Ciudad','Referencia','Es principal'];
    const addressMapping=guessCustomerColumns(headers);
    const addresses=[['138','Av. Cabildo','4967','8B','CABA','','Sí'],['138','Avda Cabildo','4967','8B','CABA','Timbre 2','Sí'],['138','Laprida','2056','Depto 1','Vicente López','','No'],['999','Roca','1','','','','Sí']];
    const plan=planCustomerImport({rows:[['138','Majo','+5491112345678','',5,'Sí']],mapping,addresses,addressMapping});
    expect(plan.orphanAddresses).toBe(1);
    const c=plan.rows[0].customer;
    expect(c.addresses).toHaveLength(2); expect(c.addresses.filter(a=>a.isPrimary)).toHaveLength(1);
    expect(c.addresses[0].reference).toBe('Timbre 2');
    expect(c.address).toContain('Cabildo');
  });
  it('no fusiona departamentos distintos ni ciudades distintas y no inventa ciudad o número', () => {
    const addressMapping=guessCustomerColumns(['Id Cliente','Calle','Número','Piso/Depto','Ciudad']);
    const plan=planCustomerImport({rows:[['1','Ana','','',0,'Sí']],mapping,addressMapping,addresses:[['1','Roca','10','',''],['1','Roca','10','1',''],['1','Roca','10','1','Olivos']]});
    expect(plan.rows[0].customer.addresses).toHaveLength(3);
    expect(plan.rows[0].customer.addresses[0].city).toBe('');
  });
  it('normaliza teléfonos argentinos solo cuando se solicita y conserva el dato problemático para revisar', () => {
    for(const value of ['11 5377-6333','+5491153776333','+54 9 11 5377 6333','0111553776333']) expect(normalizeImportPhone(value,'AR').phone).toBe('+5491153776333');
    expect(normalizeImportPhone('1553776333','AR')).toMatchObject({phone:'',original:'1553776333'});
    expect(normalizeImportPhone('0011223344').phone).toBe('0011223344');
    const plan=planCustomerImport({rows:[['1','Sin teléfono','1553776333','',0,'No']],mapping,country:'AR'});
    expect(plan.newCount).toBe(1); expect(plan.rows[0].customer).toMatchObject({phone:'',active:false,importPhoneOriginal:'1553776333'});
  });
  it('rechaza correos inválidos y filas vacías, limita cantidad y no modifica los clientes previos', () => {
    const existing=[{id:'a',name:'Ana',phone:'+5491112345678'}], before=structuredClone(existing);
    const plan=planCustomerImport({rows:[['','Ana','+5491112345678','','',''],['','Luis','','correo roto','',''],['','','','','','']],mapping,existing});
    expect(plan).toMatchObject({newCount:0,duplicateCount:1,invalidCount:1}); expect(existing).toEqual(before);
    expect(()=>planCustomerImport({rows:Array(10001).fill([]),mapping})).toThrow(/límite/);
  });
});
