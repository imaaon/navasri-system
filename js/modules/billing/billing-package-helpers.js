// ===== PACKAGE BILLING HELPERS =====
// helper functions กลางสำหรับ package billing

function normalizeContractItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map(function(item) {
    if (!item.type) return Object.assign({}, item, { type: 'charge' });
    return item;
  });
}

function getChargeItems(items) {
  return normalizeContractItems(items).filter(function(i) { return i.type === 'charge'; });
}

function getIncludedProducts(items) {
  return normalizeContractItems(items).filter(function(i) { return i.type === 'product_included'; });
}

function getPhysioRule(items) {
  return normalizeContractItems(items).find(function(i) { return i.type === 'physio_included'; }) || null;
}

function getActiveContract(patientId) {
  if (!patientId || !db.contracts) return null;
  return (db.contracts).find(function(c) {
    return String(c.patientId) === String(patientId) && c.isActive;
  }) || null;
}

function getBillingPeriod(contract, referenceDate) {
  if (!contract || !contract.startDate) return null;
  var ref = referenceDate ? new Date(referenceDate) : new Date();
  var startDay = parseInt(contract.startDate.split('-')[2]);
  var periodStart = new Date(ref.getFullYear(), ref.getMonth(), startDay);
  if (periodStart > ref) {
    periodStart = new Date(ref.getFullYear(), ref.getMonth() - 1, startDay);
  }
  var periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, startDay - 1);
  return {
    start: periodStart.toISOString().split('T')[0],
    end: periodEnd.toISOString().split('T')[0],
  };
}

function allocateIncludedProducts(requisitionItems, includedProducts) {
  var includedMap = {};
  (includedProducts || []).forEach(function(p) {
    if (p.item_id) {
      includedMap[String(p.item_id)] = { qty_limit: p.qty_limit || null, qty_used: 0, name: p.name };
    }
  });
  var billable = [], included = [];
  (requisitionItems || []).forEach(function(ri) {
    var key = String(ri.itemId || ri.item_id || '');
    var rule = includedMap[key];
    if (!rule) { billable.push(Object.assign({}, ri)); return; }
    var qty = ri.qty || 1;
    if (rule.qty_limit === null) {
      included.push(Object.assign({}, ri, { free_qty: qty, charge_qty: 0 }));
      rule.qty_used += qty; return;
    }
    var remaining = Math.max(0, rule.qty_limit - rule.qty_used);
    var free_qty = Math.min(qty, remaining);
    var charge_qty = qty - free_qty;
    rule.qty_used += qty;
    if (free_qty > 0) included.push(Object.assign({}, ri, { free_qty: free_qty, charge_qty: charge_qty }));
    if (charge_qty > 0) billable.push(Object.assign({}, ri, { qty: charge_qty }));
  });
  return { billable: billable, included: included };
}

function allocatePhysioSessions(sessions, physioRule) {
  var sessionsIncluded = (physioRule && physioRule.sessions_included) || 0;
  var ratePerHour = (physioRule && physioRule.rate_per_hour_extra) || 0;
  var free = [], charged = [], extra_amount = 0;
  (sessions || []).forEach(function(s, idx) {
    if (idx < sessionsIncluded) {
      free.push(Object.assign({}, s, { billing_source: 'contract_included' }));
    } else {
      var mins = s.duration_minutes || 0;
      var amount = Math.round((mins / 60) * ratePerHour * 100) / 100;
      charged.push(Object.assign({}, s, { billing_source: 'extra_charge', charge_amount: amount }));
      extra_amount += amount;
    }
  });
  return { free: free, charged: charged, extra_amount: extra_amount };
}