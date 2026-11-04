// Una excepción comercial permite estimar gastos adicionales pendientes;
// no confirma esos gastos ni sustituye costos base, firma o canje del servidor.
export function hasDeferredCostApproval(value){
 const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s||'');
 return value?.approved===true&&value.kind==='deferred_additional_costs'
  &&uuid(value.auditId)&&uuid(value.approvedBy)&&Number.isFinite(Date.parse(value.approvedAt||''))
  &&typeof value.note==='string'&&value.note.trim().length>=20
  &&value.assumedIncrementalCost===0&&value.assumedOrderCost===0;
}
