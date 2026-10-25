import {it,expect,vi} from 'vitest';
import {createAddressSuggestions} from '../src/delivery/address-suggestions.js';
const center={lat:-34.5264,lng:-58.4818};
const address=(name,lat=-34.527,lon=-58.482)=>({altura:{valor:1489},calle:{nombre:name},nomenclatura:name+' 1489, Localidad ficticia',ubicacion:{lat,lon}});
function mock(){return vi.fn(async url=>{const u=new URL(url);if(u.pathname.endsWith('/departamentos'))return Response.json({departamentos:[{id:'home',centroide:{lat:-34.53,lon:-58.49}},{id:'neighbor',centroide:{lat:-34.55,lon:-58.50}},{id:'far',centroide:{lat:-38,lon:-65}}]});if(u.pathname.endsWith('/ubicacion'))return Response.json({ubicacion:{departamento:{id:'home'}}});return Response.json({direcciones:[address('ROMA',-34.5265,-58.4819),address('GRL JULIO A ROCA'),address('ROCA',null,null)]});});}
it('espera calle y altura, prioriza coincidencia de calle y no ofrece coordenadas ausentes',async()=>{
 const fetchImpl=mock(),suggest=createAddressSuggestions({fetchImpl});expect(await suggest('Roca',center)).toEqual([]);expect(fetchImpl).not.toHaveBeenCalled();
 const rows=await suggest('Roca 1489',center);expect(rows).toHaveLength(2);expect(rows[0].display_name).toContain('ROCA');expect(rows.every(r=>r.provider==='georef')).toBe(true);
 const query=new URL(fetchImpl.mock.calls.find(([u])=>u.includes('/direcciones?'))[0]);expect(query.searchParams.get('departamento')).toBe('home,neighbor');expect(query.searchParams.get('direccion')).toBe('Roca 1489');expect(fetchImpl.mock.calls.some(([u])=>u.includes('nominatim'))).toBe(false);
});
it('reutiliza contexto y resultados sin guardar información fuera de memoria',async()=>{
 let now=0;const fetchImpl=mock(),suggest=createAddressSuggestions({fetchImpl,now:()=>now});
 await suggest('Roca 1489',center);expect(fetchImpl).toHaveBeenCalledTimes(3);await suggest(' ROCA 1489 ',center);expect(fetchImpl).toHaveBeenCalledTimes(3);
 await suggest('Roca 1500, Olivos',center);expect(fetchImpl).toHaveBeenCalledTimes(4);expect(new URL(fetchImpl.mock.calls.at(-1)[0]).searchParams.get('localidad')).toBe('Olivos');
 now=300001;await suggest('Roca 1489',center);expect(fetchImpl).toHaveBeenCalledTimes(5);
});
it('descarta búsquedas canceladas y no interpreta una respuesta fallida como una ubicación',async()=>{
 const fetchImpl=mock(),controller=new AbortController();controller.abort();const suggest=createAddressSuggestions({fetchImpl});await expect(suggest('Roca 1489',center,{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});expect(fetchImpl.mock.calls.some(([u])=>u.includes('/direcciones?'))).toBe(false);
 const fail=createAddressSuggestions({fetchImpl:async()=>Response.json({}, {status:503})});await expect(fail('Roca 1489',center)).rejects.toThrow('No pudimos consultar');
});
