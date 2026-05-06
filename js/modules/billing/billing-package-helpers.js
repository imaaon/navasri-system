// ===== PACKAGE BILLING HELPERS =====
// helper functions กลางสำหรับ package billing

function normalizeContractItems(items) {
  if (!Array.isArray(items)) return [];
  var CHARGE_TYPES = ['charge', 'room'];
  return items.map(function(item) {
    if (!item.type) return Object.assign({}, item, { type: 'charge' });
    // normalize type เก่า (room) ให้เป็น charge
    if (CHARGE_TYPES.indexOf(item.type) >= 0) return Object.assign({}, item, { type: 'charge' });
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
  // รับทั้ง schema ใหม่ (rate_per_session, duration_minutes) และเก่า (rate_per_hour_extra)
  var pkgDuration = (physioRule && physioRule.duration_minutes != null) ? Number(physioRule.duration_minutes) : null;
  var pkgRate = null;
  if (physioRule) {
    if (physioRule.rate_per_session != null && physioRule.rate_per_session > 0) {
      pkgRate = Number(physioRule.rate_per_session);
    } else if (physioRule.rate_per_hour_extra != null) {
      pkgRate = Number(physioRule.rate_per_hour_extra);
    }
  }
  
  var free = [], charged = [], extra_amount = 0;
  var matchedCount = 0;
  
  (sessions || []).forEach(function(s) {
    // ราคาต่อ session: ใช้ rate_per_session ก่อน, fallback amount, สุดท้าย infer
    var sessionRate;
    if (s.rate_per_session != null && s.rate_per_session > 0) {
      sessionRate = Number(s.rate_per_session);
    } else if (s.amount != null && s.amount > 0) {
      sessionRate = Number(s.amount);
    } else {
      sessionRate = Math.round(((s.duration_minutes||0)/60) * (s.rate_per_hour||0) * 100) / 100;
    }
    
    // Spec match: ตรงทั้ง duration AND rate
    var matchesSpec = (
      pkgDuration !== null && pkgRate !== null &&
      Number(s.duration_minutes) === pkgDuration &&
      sessionRate === pkgRate
    );
    
    if (matchesSpec && matchedCount < sessionsIncluded) {
      // ตรงสเปค + ยังไม่เกิน quota → ฟรี
      free.push(Object.assign({}, s, { billing_source: 'package_free', charge_amount: 0 }));
      matchedCount++;
    } else if (matchesSpec) {
      // ตรงสเปคแต่เกิน quota → คิดเงิน rate ของ pkg
      charged.push(Object.assign({}, s, { billing_source: 'package_overflow', charge_amount: sessionRate }));
      extra_amount += sessionRate;
    } else {
      // ไม่ตรงสเปค → addon (คิดราคาที่กรอกใน session)
      charged.push(Object.assign({}, s, { billing_source: 'addon_different_spec', charge_amount: sessionRate }));
      extra_amount += sessionRate;
    }
  });
  return { free: free, charged: charged, extra_amount: extra_amount };
}