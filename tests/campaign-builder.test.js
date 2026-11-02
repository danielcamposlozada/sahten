import {describe,it,expect} from 'vitest';
import {campaignTemplate,validateCampaignDraft,describeSchedule} from '../src/core/campaign-builder.js';
import {scheduleMatches} from '../src/core/promotions.js';
describe('creación intuitiva de campañas',()=>{
 it('la plantilla lunes y miércoles empieza como borrador y se repite en esos días',()=>{
 const p=campaignTemplate('mon-wed','promo123');
 expect(p.enabled).toBe(false);expect(p.schedule.weekdays).toEqual([1,3]);
 expect(describeSchedule(p.schedule)).toContain('Lun');
 expect(scheduleMatches(p.schedule,new Date('2026-11-02T12:00:00-03:00'))).toBe(true);
 expect(scheduleMatches(p.schedule,new Date('2026-11-03T12:00:00-03:00'))).toBe(false);
 expect(scheduleMatches(p.schedule,new Date('2026-11-04T12:00:00-03:00'))).toBe(true);
 });
 it('requiere producto, canal, días y descuento correcto antes de publicar',()=>{
 const p=campaignTemplate('mon-wed','promo123');
 expect(validateCampaignDraft(p).length).toBeGreaterThan(0);
 p.productIds=['falafel'];expect(validateCampaignDraft(p)).toEqual([]);
 p.schedule.weekdays=[];expect(validateCampaignDraft(p).join(' ')).toContain('día');
 p.schedule.weekdays=[1,3];p.schedule.from='2026-12-08';p.schedule.until='2026-12-01';
 expect(validateCampaignDraft(p).join(' ')).toContain('posterior');
 });
});
