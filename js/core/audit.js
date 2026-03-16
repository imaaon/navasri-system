// ===== AUDIT TRAIL =====

const AUDIT_MODULES = { AUTH:'auth', PATIENT:'patient', CLINICAL:'clinical', INVENTORY:'inventory', REQUISITION:'requisition', ROOM:'room', BILLING:'billing', STAFF:'staff', ACCOUNT:'account' };
const AUDIT_ACTIONS = { LOGIN:'login', LOGOUT:'logout', CREATE:'create', UPDATE:'update', DELETE:'delete', APPROVE:'approve', REJECT:'reject', TRANSFER:'transfer', DISCHARGE:'discharge', RESET:'reset', EXPORT:'export' };

async function logAudit(module, action, recordId, detail = {}) {
  if (!currentUser || !supa) return;
  try {
    await supa.from('audit_events').insert({
      module, action,
      record_id:  String(recordId || ''),
      actor:      currentUser.username || '',
      actor_role: currentUser.role || '',
      detail:     JSON.stringify(detail),
      created_at: new Date().toISOString(),
    });
  } catch(e) { console.warn('audit log failed:', e.message); }
}