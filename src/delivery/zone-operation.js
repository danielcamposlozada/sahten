// Estados operativos aislados: nunca publican el borrador de tarifas o geometrías.
export const zoneStateKey = (id, flag) => JSON.stringify([id, flag]);
export const zoneStateFlags = ['enabled', 'requiresAuthorization'];

export function installZoneOperation(w) {
  const canEdit = () => !w.SAHTEN.project.session.readOnly && (!w.document.body.dataset.role || ['owner', 'admin'].includes(w.document.body.dataset.role));
  function persist(cfg) {
    w._saveTiendaConfig(cfg);
    if (!w.SAHTEN.project.session.readOnly) { w.SAHTEN.project.markDirty(); w.scheduleSave?.(); }
    w.SAHTEN.delivery?.admin?.refreshOperational();
    if (w.currentPanel === 'mostrador') { w._renderCartExtras?.(); w._renderCartTotals?.(); }
  }
  return {
    set(id, flag, value) {
      if (!canEdit() || !zoneStateFlags.includes(flag) || typeof value !== 'boolean') return false;
      const cfg = w._getTiendaConfig(), zone = cfg.deliveryV2?.zones?.find(z => z.id === id);
      if (!zone) return false;
      zone[flag] = value; persist(cfg);
      w.dispatchEvent(new w.CustomEvent('sahten:delivery-zone-state', { detail: { id, flag, value } }));
      return true;
    },
    applyRemote(remote, before) {
      const cfg = w._getTiendaConfig(), p = cfg.deliveryV2;
      if (!p || remote?.revision !== p.revision) return;
      let changed = false;
      const pending = w.SAHTEN.online.zonePublisher.info().changes;
      for (const row of remote.zones || []) {
        const z = p.zones.find(z => z.id === row.id), old = before?.zones?.find(z => z.id === row.id);
        if (!z || !old) continue;
        for (const flag of zoneStateFlags) {
          if (pending[zoneStateKey(z.id, flag)] || z[flag] !== old[flag] || typeof row[flag] !== 'boolean') continue;
          if (z[flag] !== row[flag]) { z[flag] = row[flag]; changed = true; }
        }
      }
      if (changed) persist(cfg);
    },
  };
}
