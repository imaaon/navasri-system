// ===== DATA STORE & LOADER =====

// ===== DATA STORE =====
// ── Supabase ─────────────────────────────────────────────────


let db = {
  items: [],
  patients: [],
  staff: [],
  requisitions: [],
  purchases: [],
  itemLots: [],
  rooms: [],
  beds: [],
  contracts: [],   // patient_contracts
  payments: [],    // payments
  approvalLogs: [], // approval_logs
  returnItems: [],  // return_items
  roomHistory: [], // patient_room_history
  stockMovements: [], // stock_movements
  suppliers: [],       // suppliers master
  purchaseRequests: [], // purchase_requests
  supplierInvoices: [], // supplier_invoices
  invoiceResetLogs: [], // invoice_reset_logs
  appointments: [], // patient_appointments
  belongings: [],   // patient_belongings
  patientConsents: [], // patient_consents (DNR)
  // Lazy-loaded per patient (key = patientId)
  medications: {},    // patient_medications
  marRecords: {},     // mar_records (daily tick)
  vitalSigns: {},     // vital_signs
  nursingNotes: {},   // nursing_notes
  users: {},
  lineSettings: {
    enabled: false, webhookUrl: '',
    notifyNewReq: true, notifyForward: true,
    notifyApproved: true, notifyRejected: true, notifyLowStock: true
  }
};

// ── Load all data from Supabase ─────────────────────────────

// ── Barcode Lookup Maps (O(1)) ───────────────────────────────
const _barcodeMap = {};         // barcode (NVS-xxx) → item
const _barcodeExtMap = {};      // barcode_external (EAN) → item

function buildBarcodeMap() {
  Object.keys(_barcodeMap).forEach(k => delete _barcodeMap[k]);
  Object.keys(_barcodeExtMap).forEach(k => delete _barcodeExtMap[k]);
  (db.items || []).forEach(item => {
    if (item.barcode) _barcodeMap[item.barcode] = item;
    if (item.barcodeExternal) _barcodeExtMap[item.barcodeExternal] = item;
  });
}

function lookupItemByBarcode(code) {
  if (!code) return null;
  return _barcodeMap[code] || _barcodeExtMap[code] || null;
}
async function loadDB() {
  showLoadingOverlay(true);
  try {
    // ── Core data: โหลดทันที (ต้องการ dashboard + ทุกหน้า) ──
    const [
      itemsRes, patientsRes, staffRes, reqsRes, purchasesRes,
      settingsRes, itemLotsRes, roomsRes, bedsRes
    ] = await Promise.all([
      supa.from('items').select('*').order('id'),
      supa.from('patients').select('*, patient_contacts(*)').order('id'),
      supa.from('staff').select('*').order('id'),
      supa.from('requisitions').select('*').order('id', {ascending: false}).limit(500),
      supa.from('purchases').select('*').order('created_at', {ascending: false}).limit(500),
      supa.from('settings').select('*'),
      supa.from('item_lots').select('*').order('expiry_date', {ascending: true}).limit(500),
      supa.from('rooms').select('*').order('name'),
      supa.from('beds').select('*').order('room_id'),
    ]);
    db.items        = (itemsRes.data || []).map(mapItem);
    db.patients     = (patientsRes.data || []).map(mapPatient);
    db.staff        = (staffRes.data || []).map(mapStaff);
    db.requisitions = (reqsRes.data || []).map(mapReq);
    db.purchases    = (purchasesRes.data || []).map(mapPurchase);
    db.itemLots     = (itemLotsRes.data || []).map(mapLot);
    db.rooms        = (roomsRes.data || []).map(mapRoom);
    db.beds         = (bedsRes.data || []).map(mapBed);
    db.users = {};
    const ls = (settingsRes.data || []).find(s => s.key === 'lineSettings');
    if (ls) db.lineSettings = { ...db.lineSettings, ...ls.value };
    if (typeof loadBillingFromSettings === 'function') {
      loadBillingFromSettings(settingsRes.data || []);
    }
    if (db.items.length === 0) seedData();
    window._dbLoaded = true;
    buildBarcodeMap();
  } catch(e) {
    console.error('loadDB error', e);
    window._dbLoaded = true;
    toast('เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต', 'error');
  }
  showLoadingOverlay(false);
  // โหลด secondary data แบบ non-blocking หลัง UI ขึ้นแล้ว
  setTimeout(() => loadDBSecondary(), 500);
}

async function loadDBSecondary() {
  // ── Secondary data: โหลดหลัง dashboard ขึ้น (billing, clinical history) ──
  try {
    const [
      contractsRes, paymentsRes, approvalLogsRes, returnItemsRes,
      appointmentsRes, belongingsRes, consentsRes, invoicesRes,
      expensesRes, roomHistoryRes, invoiceResetLogsRes,
      stockMovementsRes, suppliersRes, purchaseRequestsRes, supplierInvoicesRes
    ] = await Promise.all([
      supa.from('patient_contracts').select('*').order('created_at', {ascending: false}).limit(200),
      supa.from('payments').select('*').order('payment_date', {ascending: false}).limit(300),
      supa.from('approval_logs').select('*').order('created_at', {ascending: false}).limit(200),
      supa.from('return_items').select('*').order('created_at', {ascending: false}).limit(200),
      supa.from('patient_appointments').select('*').order('appt_date', {ascending: true}).limit(200),
      supa.from('patient_belongings').select('*').order('created_at', {ascending: false}).limit(200),
      supa.from('patient_consents').select('*'),
      supa.from('invoices').select('*').order('created_at', {ascending: false}).limit(300),
      supa.from('expenses').select('*').order('created_at', {ascending: false}).limit(300),
      supa.from('patient_room_history').select('*').order('transfer_date', {ascending: false}).limit(200),
      supa.from('invoice_reset_logs').select('*').order('reset_at', {ascending: false}).limit(200),
      supa.from('stock_movements').select('*').order('created_at', {ascending: false}).limit(200),
      supa.from('suppliers').select('*').order('supplier_name'),
      supa.from('purchase_requests').select('*').order('created_at', {ascending: false}).limit(200),
      supa.from('supplier_invoices').select('*').order('created_at', {ascending: false}).limit(200),
    ]);
    db.contracts       = (contractsRes.data || []).map(mapContract);
    db.payments        = (paymentsRes.data || []).map(mapPayment);
    db.approvalLogs    = (approvalLogsRes.data || []).map(mapApprovalLog);
    db.returnItems     = (returnItemsRes.data || []).map(mapReturnItem);
    db.appointments    = (appointmentsRes.data || []).map(mapAppointment);
    db.belongings      = (belongingsRes.data || []).map(mapBelonging);
    db.patientConsents = (consentsRes.data || []).map(mapConsent);
    db.invoices        = (invoicesRes.data || []).map(mapInvoice);
    db.expenses        = (expensesRes.data || []).map(mapExpense);
    db.roomHistory     = (roomHistoryRes?.data || []);
    db.invoiceResetLogs  = (invoiceResetLogsRes?.data || []);
    db.stockMovements    = (stockMovementsRes?.data || []).map(mapStockMovement);
    db.suppliers         = (suppliersRes?.data || []).map(mapSupplier);
    db.purchaseRequests  = (purchaseRequestsRes?.data || []).map(mapPurchaseRequest);
    db.supplierInvoices  = (supplierInvoicesRes?.data || []).map(mapSupplierInvoice);
    db.suppliers         = (suppliersRes?.data || []).map(mapSupplier);
    db.purchaseRequests  = (purchaseRequestsRes?.data || []).map(mapPurchaseRequest);
    db.supplierInvoices  = (supplierInvoicesRes?.data || []).map(mapSupplierInvoice);
    window._dbSecondaryLoaded = true;
    buildBarcodeMap();
  } catch(e) {
    console.warn('loadDBSecondary error', e);
  }
}
// ── Helper: รอให้ secondary data โหลดเสร็จก่อนแสดง billing/clinical ──
async function ensureSecondaryDB() {
  if (window._dbSecondaryLoaded) return;
  // รอสูงสุด 5 วินาที
  for (let i = 0; i < 50; i++) {
    if (window._dbSecondaryLoaded) return;
    await new Promise(r => setTimeout(r, 100));
  }
}


// ── Map functions (snake_case → camelCase) ──────────────────

function mapStockMovement(r) {
  return {
    id: r.id, itemId: r.item_id, barcode: r.barcode || '',
    movementType: r.movement_type, quantity: r.quantity,
    beforeQty: r.before_qty, afterQty: r.after_qty,
    lotNo: r.lot_no || '', expiryDate: r.expiry_date || '',
    cost: r.cost || 0, note: r.note || '',
    refId: r.ref_id, refType: r.ref_type || '',
    createdBy: r.created_by || '', createdAt: r.created_at,
  };
}


function mapSupplierInvoice(r) {
  return {
    id: r.id, invoiceNo: r.invoice_no, date: r.invoice_date,
    dueDate: r.due_date || '', supplierId: r.supplier_id,
    supplierName: r.supplier_name, prId: r.purchase_request_id,
    subtotal: r.subtotal || 0, vatRate: r.vat_rate || 7,
    vatAmt: r.vat_amt || 0, total: r.total || 0,
    status: r.status || 'pending', paidDate: r.paid_date || '',
    paidAmount: r.paid_amount || 0, note: r.note || '',
    createdBy: r.created_by || '', createdAt: r.created_at,
    lines: [],
  };
}
function mapSupplier(r) {
  return {
    id: r.id, code: r.supplier_code || '', name: r.supplier_name,
    contactName: r.contact_name || '', phone: r.phone || '',
    email: r.email || '', address: r.address || '',
    taxId: r.tax_id || '', note: r.note || '',
    status: r.status || 'active',
    createdAt: r.created_at,
  };
}

function mapPurchaseRequest(r) {
  return {
    id: r.id, refNo: r.ref_no, date: r.request_date,
    requesterName: r.requester_name,
    supplierId: r.supplier_id, supplierName: r.supplier_name || '',
    urgency: r.urgency || 'normal', note: r.note || '',
    status: r.status || 'draft',
    approvedBy: r.approved_by || '', approvedAt: r.approved_at,
    rejectReason: r.reject_reason || '',
    createdBy: r.created_by || '', createdAt: r.created_at,
    lines: [],
  };
}
function mapItem(r) {
  return { id: r.id, name: r.name, category: r.category, unit: r.unit, barcode: r.barcode||'', barcodeExternal: r.barcode_external||'',
    qty: r.qty, reorder: r.reorder, cost: r.cost||0, price: r.price||0, photo: r.photo,
    purchaseUnit: r.purchase_unit || r.unit || 'ชิ้น',
    dispenseUnit: r.dispense_unit || r.unit || 'ชิ้น',
    conversionFactor: r.conversion_factor || 1,
    isBillable: r.is_billable !== false,
  };
}
function mapPatient(r) {
  const medLogs = (r.medical_logs || []);
  return { id: r.id, name: r.name, idType: r.id_type, idcard: r.idcard,
    dob: r.dob, admitDate: r.admit_date, endDate: r.end_date,
    status: r.status||'active', phone: r.phone, emergency: r.emergency,
    address: r.address, note: r.note, photo: r.photo,
    currentBedId: r.current_bed_id || null,
    physioRatePerHour: r.physio_rate_per_hour || 0,
    physioHoursPerDay: r.physio_hours_per_day || 0,
    birthYear:  r.birth_year || null,
    dobUnknown: r.dob_unknown || false,
    allergies: (r.patient_allergies || []).map(a => ({
      id: a.id, allergen: a.allergen, allergyType: a.allergy_type||'ยา',
      severity: a.severity||'ปานกลาง', reaction: a.reaction||'', note: a.note||''
    })),
    contacts: (r.patient_contacts || []).map(c => ({
      id: c.id, name: c.name, relation: c.relation, phone: c.phone,
      role: c.role||'ญาติ', isPayer: c.is_payer||false, isDecisionMaker: c.is_decision_maker||false,
      email: c.email||'', note: c.note||''
    })),
    medicalLog: medLogs.filter(l => l.log_type==='medical').map(l => ({
      date: l.date, detail: l.detail, by: l.by_user, savedAt: l.saved_at, _supaId: l.id })),
    medsLog: medLogs.filter(l => l.log_type==='meds').map(l => ({
      date: l.date, detail: l.detail, by: l.by_user, savedAt: l.saved_at, _supaId: l.id })),
  };
}
function mapRoom(r) {
  return { id: r.id, name: r.name, roomType: r.room_type||'ห้องเดี่ยว',
    zone: r.zone||'', monthlyRate: r.monthly_rate||0, dailyRate: r.daily_rate||0,
    capacity: r.capacity||1, note: r.note||'' };
}
function mapBed(r) {
  return { id: r.id, roomId: r.room_id, bedCode: r.bed_code,
    status: r.status||'available', note: r.note||'', otherNote: r.other_note||'' };
}
function mapContract(r) {
  return {
    id: r.id, patientId: r.patient_id, patientName: r.patient_name||'',
    name: r.name||'', items: r.items||[], totalMonthly: r.total_monthly||0,
    billingDay: r.billing_day||1, dueDays: r.due_days||7,
    startDate: r.start_date||'', endDate: r.end_date||'',
    isActive: r.is_active!==false, note: r.note||'',
    createdAt: r.created_at||''
  };
}
function mapPayment(r) {
  return {
    id: r.id, invoiceId: r.invoice_id, patientId: r.patient_id,
    patientName: r.patient_name||'',
    amount: r.amount||0, paymentDate: r.payment_date||'',
    method: r.method||'โอนเงิน', reference: r.reference||'',
    receivedBy: r.received_by||'', note: r.note||'',
    receiptNo: r.receipt_no||'', createdAt: r.created_at||''
  };
}
function mapInvoice(r) {
  return {
    id: r.id, type: r.type||'invoice',
    docNo: r.doc_no||'', patientId: r.patient_id||'', patientName: r.patient_name||'',
    date: r.date||'', dueDate: r.due_date||'', jobName: r.job_name||'',
    roomEnabled: r.room_enabled||false, roomType: r.room_type||'monthly',
    roomQty: r.room_qty||0, roomRate: r.room_rate||0, roomTotal: r.room_total||0,
    roomLabel: r.room_label||'',
    ptEnabled: r.pt_enabled||false, ptType: r.pt_type||'monthly',
    ptQty: r.pt_qty||0, ptRate: r.pt_rate||0, ptTotal: r.pt_total||0,
    medItems: r.med_items||[], medTotal: r.med_total||0,
    hideItems: r.hide_items||false,
    otherItems: r.other_items||[], otherTotal: r.other_total||0,
    subtotal: r.subtotal||0, vatRate: r.vat_rate||0, vatAmt: r.vat_amt||0,
    beforeWht: r.before_wht||0, whtRate: r.wht_rate||0, whtAmt: r.wht_amt||0,
    grandTotal: r.grand_total||0,
    note: r.note||'', status: r.status||'draft',
    contractId: r.contract_id||null,
    createdAt: r.created_at||'', updatedAt: r.updated_at||'',
  };
}
function mapExpense(r) {
  return {
    id: r.id, docNo: r.doc_no||'', date: r.date||'',
    preparer: r.preparer||'', job: r.job||'',
    vendorName: r.vendor_name||'', vendorAddr: r.vendor_addr||'',
    vendorTaxId: r.vendor_tax_id||'',
    items: r.items||[],
    subtotal: r.subtotal||0, vatAmt: r.vat_amt||0, totalVat: r.total_vat||0,
    whtRate: r.wht_rate||0, whtAmt: r.wht_amt||0, net: r.net||0,
    payMethod: r.pay_method||'cash', bank: r.bank||'', bankNo: r.bank_no||'',
    payDate: r.pay_date||'', note: r.note||'',
    createdAt: r.created_at||'', updatedAt: r.updated_at||'',
  };
}
function mapApprovalLog(r) {
  return {
    id: r.id, reqId: r.req_id, action: r.action,
    level: r.level||1, actorName: r.actor_name||'',
    actorRole: r.actor_role||'', reason: r.reason||'',
    createdAt: r.created_at||''
  };
}
function mapReturnItem(r) {
  return {
    id: r.id, reqId: r.req_id, refNo: r.ref_no||'',
    patientId: r.patient_id||'', patientName: r.patient_name||'',
    itemId: r.item_id, itemName: r.item_name||'',
    qtyReturned: r.qty_returned||0, unit: r.unit||'',
    unitPrice: r.unit_price||0, totalCredit: r.total_credit||0,
    reason: r.reason||'', note: r.note||'',
    creditNoteId: r.credit_note_id||'', returnDate: r.return_date||'',
    createdBy: r.created_by||'', createdAt: r.created_at||''
  };
}
function mapAppointment(r) {
  return {
    id: r.id, patientId: r.patient_id||'', patientName: r.patient_name||'',
    apptDate: r.appt_date||'', apptTime: r.appt_time||'',
    hospital: r.hospital||'', department: r.department||'', doctor: r.doctor||'',
    purpose: r.purpose||'', preparation: r.preparation||'',
    transport: r.transport||'รถคลินิก', transportNote: r.transport_note||'',
    status: r.status||'upcoming', note: r.note||'',
    createdBy: r.created_by||'', createdAt: r.created_at||''
  };
}
function mapBelonging(r) {
  return {
    id: r.id, patientId: r.patient_id||'', patientName: r.patient_name||'',
    itemName: r.item_name||'', qty: r.qty||1, condition: r.condition||'ดี',
    description: r.description||'', photoUrl: r.photo_url||'',
    dateIn: r.date_in||'', dateOut: r.date_out||'',
    receivedBy: r.received_by||'', returnedBy: r.returned_by||'',
    status: r.status||'held', note: r.note||'',
    createdAt: r.created_at||''
  };
}
function mapConsent(r) {
  return {
    id: r.id, patientId: r.patient_id||'',
    dnrStatus: r.dnr_status||'not_set',
    dnrSignedDate: r.dnr_signed_date||'', dnrSignedBy: r.dnr_signed_by||'',
    cprConsent: r.cpr_consent??null, ventilatorConsent: r.ventilator_consent??null,
    preferredHospital: r.preferred_hospital||'',
    emergencyContact: r.emergency_contact||'', emergencyPhone: r.emergency_phone||'',
    advanceDirective: r.advance_directive||'',
    note: r.note||'', updatedAt: r.updated_at||''
  };
}
function mapMedication(r) {
  return {
    id: r.id, patientId: r.patient_id, name: r.name,
    dose: r.dose||'', unit: r.unit||'', route: r.route||'ทาน',
    timings: r.timings||[], // array e.g. ['เช้า','เย็น']
    frequency: r.frequency||'', isActive: r.is_active!==false,
    startDate: r.start_date||'', endDate: r.end_date||'',
    note: r.note||''
  };
}
function mapMarRecord(r) {
  return {
    id: r.id, patientId: r.patient_id, medicationId: r.medication_id,
    date: r.date, timing: r.timing, givenAt: r.given_at||null,
    givenBy: r.given_by||'', note: r.note||''
  };
}
function mapVitalSign(r) {
  return {
    id: r.id, patientId: r.patient_id,
    recordedAt: r.recorded_at, recordedBy: r.recorded_by||'',
    bp_sys: r.bp_sys, bp_dia: r.bp_dia,
    hr: r.hr, temp: r.temp, spo2: r.spo2,
    dtx: r.dtx, rr: r.rr,
    weight: r.weight||null, height: r.height||null,
    otherFields: r.other_fields||'',
    note: r.note||''
  };
}
function mapNursingNote(r) {
  return {
    id: r.id, patientId: r.patient_id,
    date: r.date, shift: r.shift||'เช้า', time: r.time||'',
    recordedBy: r.recorded_by||'',
    generalCondition: r.general_condition||'',
    consciousness: r.consciousness||'',
    pain: r.pain||'',
    eating: r.eating||'',
    elimination: r.elimination||'',
    sleep: r.sleep||'',
    activity: r.activity||'',
    wound: r.wound||'',
    iv: r.iv||'',
    o2: r.o2||'',
    handoverNote: r.handover_note||'',
    createdAt: r.created_at||''
  };
}

// Lazy load clinical data for a patient
async function loadPatientClinical(patientId) {
  const pid = String(patientId);
  const [meds, mar, vitals, notes] = await Promise.all([
    supa.from('patient_medications').select('*').eq('patient_id', patientId).order('name'),
    supa.from('mar_records').select('*').eq('patient_id', patientId).order('date', {ascending: false}),
    supa.from('vital_signs').select('*').eq('patient_id', patientId).order('recorded_at', {ascending: false}).limit(90),
    supa.from('nursing_notes').select('*').eq('patient_id', patientId).order('date', {ascending: false}).order('shift'),
  ]);
  db.medications[pid]  = (meds.data  ||[]).map(mapMedication);
  db.marRecords[pid]   = (mar.data   ||[]).map(mapMarRecord);
  db.vitalSigns[pid]   = (vitals.data||[]).map(mapVitalSign);
  db.nursingNotes[pid] = (notes.data ||[]).map(mapNursingNote);
}
// helpers
function getPatientBed(patient) {
  if (!patient?.currentBedId) return null;
  return db.beds.find(b => b.id == patient.currentBedId) || null;
}
function getPatientRoom(patient) {
  const bed = getPatientBed(patient);
  if (!bed) return null;
  return db.rooms.find(r => r.id == bed.roomId) || null;
}
function getAvailableBeds() {
  return db.beds.filter(b => b.status === 'available');
}
function getBedLabel(bed) {
  if (!bed) return '-';
  const room = db.rooms.find(r => r.id == bed.roomId);
  return room ? `${room.name} / เตียง ${bed.bedCode}` : `เตียง ${bed.bedCode}`;
}
// render allergy banner HTML
function renderAllergyBanner(patient, compact=false) {
  if (!patient?.allergies?.length) return '';
  const items = patient.allergies.map(a => {
    const sevText = a.severity ? ` — ${a.severity}` : '';
    return `<span style="background:rgba(255,255,255,.2);border-radius:4px;padding:2px 9px;font-size:${compact?'11px':'12px'};margin:2px;white-space:nowrap;">${a.allergen}<span style="opacity:.8;font-size:10px;">${sevText}</span></span>`;
  }).join('');
  return `<div style="background:#c0392b;color:white;border-radius:8px;padding:${compact?'8px 12px':'10px 16px'};display:flex;align-items:flex-start;gap:10px;margin-bottom:${compact?'8px':'12px'};">
    <span style="font-size:${compact?'18px':'22px'};flex-shrink:0;">🚨</span>
    <div>
      <div style="font-weight:700;font-size:${compact?'12px':'14px'};">แพ้ยา/อาหาร — ต้องระวัง!</div>
      <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px;">${items}</div>
    </div>
  </div>`;
}
function mapStaff(r) {
  return { id: r.id, name: r.name, nickname: r.nickname, position: r.position,
    idType: r.id_type, idcard: r.idcard, dob: r.dob,
    startDate: r.start_date, endDate: r.end_date,
    phone: r.phone, address: r.address, note: r.note,
    photo: r.photo, contractData: r.contract_data, contractName: r.contract_name };
}
function mapReq(r) {
  return { id: r.id, date: r.date, patientId: r.patient_id, patientName: r.patient_name,
    itemId: r.item_id, itemName: r.item_name, qty: r.qty, unit: r.unit,
    staffId: r.staff_id, staffName: r.staff_name, status: r.status||'pending', note: r.note };
}
function mapPurchase(r) {
  return { id: r.id, date: r.date, itemId: r.item_id, itemName: r.item_name,
    unit: r.unit, qty: r.qty, cost: r.cost||0, po: r.po, supplier: r.supplier,
    note: r.note, by: r.by_user };
}
function mapLot(r) {
  return {
    id: r.id, itemId: r.item_id, lotNumber: r.lot_number,
    manufacturingDate: r.manufacturing_date, expiryDate: r.expiry_date,
    qtyInLot: r.qty_in_lot, qtyRemaining: r.qty_remaining,
    purchaseId: r.purchase_id, receivedDate: r.received_date, notes: r.notes,
  };
}
// helper: คืน lots ของ item เรียงตาม FEFO
function getLotsForItem(itemId) {
  return (db.itemLots || [])
    .filter(l => l.itemId == itemId && l.qtyRemaining > 0)
    .sort((a,b) => {
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate.localeCompare(b.expiryDate);
    });
}
// helper: expiry warning threshold (วัน)
function getExpiryWarnDays() {
  const bs = (typeof getBillingSettings === 'function') ? getBillingSettings() : {};
  return bs.expiryWarnDays || 30;
}
// helper: วันหมดอายุใกล้หรือเกินแล้ว
function getLotStatus(expiryDate) {
  if (!expiryDate) return 'no-expiry';
  const today = new Date(); today.setHours(0,0,0,0);
  const exp   = new Date(expiryDate);
  const diff  = Math.ceil((exp - today) / 86400000);
  if (diff < 0)  return 'expired';
  if (diff <= getExpiryWarnDays()) return 'expiring';
  return 'ok';
}

// ── saveDB — บันทึก lineSettings เท่านั้น (ทุกอย่างอื่น save ตรง) ──
async function saveDB() {
  await supa.from('settings').upsert({ key: 'lineSettings', value: db.lineSettings });
}

// ── Loading overlay ─────────────────────────────────────────
function showLoadingOverlay(show) {
  // ถ้า login screen กำลังแสดงอยู่ ไม่ต้องสร้าง overlay ทับ
  const loginScreen = document.getElementById('loginScreen');
  const loginVisible = loginScreen && loginScreen.style.display !== 'none';
  if (loginVisible) return;

  let el = document.getElementById('_loading_overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = '_loading_overlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;';
    el.innerHTML = '<div style="font-size:40px;">🏥</div><div style="font-size:16px;font-weight:700;color:#2d6a48;">กำลังโหลดข้อมูล...</div><div style="font-size:12px;color:#6b7280;">กำลังเชื่อมต่อ Supabase</div>';
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

// ===== SEED DATA =====
function seedData() {
  if (db.items.length > 0) return;

  // Items from Excel
  const itemNames = [
    '0.9% NSS 100 ml','0.9% NSS 1000 ml','0.9% NSS 1000 ml Irrigate','Acyclovir Cream',
    'Alcohol 70%','Ambroxol 30 mg','Amlopine 5 mg','Amlopine 10 mg','Amoxy 500 mg',
    'Antacid gel','ATK','Bluepad','Cetaphil Lotion','Gauze Sterile 3x3',
    'Gloves S','Gloves M','Insulin Novorapid','Micropore 1"','NSS 5 ml',
    'Paracetamol 500 mg','ผ้าอ้อม L Certainty','แผ่นเสริมซึมซับ','แผ่นปูรอง','ถุงมือ',
    'สายให้อาหาร','ถุงให้อาหาร','ไม้พันสำลี','น้ำยาบ้วนปาก','โลชั่นทาผิว','Betadine Solution',
    'Chlorhexidine','Cotton Ball','Elastic Bandage','Feeding Tube Fr14','Foley Catheter',
    'Urine Bag','IV Set','Syringe 10 ml','Syringe 5 ml','Tegaderm'
  ];
  const cats = ['ยา','ยา','เวชภัณฑ์','ยา','เวชภัณฑ์','ยา','ยา','ยา','ยา','ยา',
    'เวชภัณฑ์','ของใช้','เวชภัณฑ์','เวชภัณฑ์','เวชภัณฑ์','เวชภัณฑ์','ยา','เวชภัณฑ์','ยา',
    'ยา','ของใช้','ของใช้','ของใช้','เวชภัณฑ์',
    'เวชภัณฑ์','เวชภัณฑ์','เวชภัณฑ์','เวชภัณฑ์','ของใช้','เวชภัณฑ์',
    'เวชภัณฑ์','เวชภัณฑ์','เวชภัณฑ์','เวชภัณฑ์','เวชภัณฑ์',
    'เวชภัณฑ์','เวชภัณฑ์','เวชภัณฑ์','เวชภัณฑ์','เวชภัณฑ์'];
  const units = ['ขวด','ขวด','ขวด','หลอด','ขวด','เม็ด','เม็ด','เม็ด','แคปซูล','ขวด',
    'ชุด','ห่อ','ขวด','ชิ้น','กล่อง','กล่อง','หลอด','ม้วน','หลอด',
    'เม็ด','ชิ้น','ชิ้น','ชิ้น','กล่อง',
    'เส้น','ถุง','ก้าน','ขวด','ขวด','ขวด',
    'ขวด','ก้อน','ม้วน','เส้น','เส้น',
    'ถุง','ชุด','ชิ้น','ชิ้น','ชิ้น'];

  itemNames.forEach((name, i) => {
    const qty = Math.floor(Math.random() * 80) + 2;
    db.items.push({
      id: i + 1, name, category: cats[i] || 'ยา', unit: units[i] || 'ชิ้น',
      qty, reorder: 10, createdAt: new Date().toISOString()
    });
  });

  // Patients from Excel (full data)
  const allPatients = [{"name":"ม.ร.ว. นภาศรี บุรณศิริ","idcard":"31006-0077489-2","dob":"1932-12-06","admitDate":"2010-04-30","endDate":"2026-03-11","status":"active","id":1},{"name":"นาง นงลักษณ์ คงยืนยงวาณิชย์","idcard":"5101899015124","dob":"1929-01-01","admitDate":"2016-07-06","endDate":"2026-03-11","status":"active","id":2},{"name":"นาย ประเทือง ควรพจน์","idcard":"31006-0285813-9","dob":"1938-07-16","admitDate":"2016-10-06","endDate":"2026-03-11","status":"active","id":3},{"name":"น.ส. นิภาวรรณ ฑีฆะบุตร","idcard":"31704-0015890-0","dob":"1944-01-24","admitDate":"2016-11-18","endDate":"2026-03-11","status":"active","id":4},{"name":"น.ส. สัณสนีย์ ทวีชัยศุภพงษ์","idcard":"31014-0054594-7","dob":"1982-04-17","admitDate":"2017-05-06","endDate":"2026-03-11","status":"active","id":5},{"name":"นาง สมถวิล ธนวิทยาพล","idcard":"31006-0300834-1","dob":"1934-01-01","admitDate":"2017-05-24","endDate":"2026-03-11","status":"active","id":6},{"name":"นาย วงศ์ไทย ภูริสรรพสิทธิ์","idcard":"31017-0073575-0","dob":"1965-08-26","admitDate":"2018-02-19","endDate":"2026-03-11","status":"active","id":7},{"name":"นาง ถนอม บุญเฉย","idcard":"51014-0006775-8","dob":"1943-01-01","admitDate":"2019-02-23","endDate":"2026-03-11","status":"active","id":8},{"name":"น.ส. ประไพ กลับถิ่นเดิม","idcard":"31199-0048393-0","dob":"1937-10-28","admitDate":"2019-05-15","endDate":"2026-03-11","status":"active","id":9},{"name":"นาง เฉลียว รัตนเกษตร","idcard":"31005-0024363-1","dob":"1933-07-28","admitDate":"2019-08-06","endDate":"2026-03-11","status":"active","id":10},{"name":"นาง ไพฑูรย์ทิพย์ ยุวบูรณ์","idcard":"51006-9905429-0","dob":"1936-05-26","admitDate":"2019-09-10","endDate":"2026-03-11","status":"active","id":11},{"name":"นาย ปหัษฐิศร์ ณ พัทลุง","idcard":"31020-0090551-3","dob":"1958-08-22","admitDate":"2019-10-18","endDate":"2026-03-11","status":"active","id":12},{"name":"นาย ทองสุข สร้อยกุดเรือ","idcard":"32504-0012801-5","dob":"1945-12-28","admitDate":"2020-01-26","endDate":"2026-03-11","status":"active","id":13},{"name":"นาย พิษณุ สุนทราชุน","idcard":"31015-0099113-2","dob":"1950-02-01","admitDate":"2020-02-12","endDate":"2026-03-11","status":"active","id":14},{"name":"น.ส. ณัฐพร รัตนนนท์","idcard":"31007-0002801-7","dob":"1966-10-10","admitDate":"2020-08-15","endDate":"2026-03-11","status":"active","id":15},{"name":"นาง สุภาพ ทวีสิทธิ์","idcard":"31015-0094065-1","dob":"1935-01-01","admitDate":"2021-05-01","endDate":"2026-03-11","status":"active","id":16},{"name":"น.ส สุวรรณี ตั้งใจไว้ศักดิ์","idcard":"31013-0013482-1","dob":"1954-02-09","admitDate":"2021-05-01","endDate":"2026-03-11","status":"active","id":17},{"name":"น.ส บุบผา เทวาหุดี","idcard":"31014-0075268-3","dob":"1949-01-30","admitDate":"2022-12-26","endDate":"2026-03-11","status":"active","id":18},{"name":"นาง พัชรี วงศ์เกียรติขจร","idcard":"31006-0322667-5","dob":"1945-08-20","admitDate":"2023-02-23","endDate":"2026-03-11","status":"active","id":19},{"name":"นาง บุญสม จึงพิชาญวณิชย์","idcard":"34299-0009705-1","dob":"1936-01-10","admitDate":"2023-05-27","endDate":"2026-03-11","status":"active","id":20},{"name":"นาย ชูเกียรติ กาญจนเลิศรัตน์","idcard":"31017-0199397-3","dob":"1970-08-14","admitDate":"2023-08-19","endDate":"2026-03-11","status":"active","id":21},{"name":"นาง พเยาว์ ปรัชฌวิทยากร","idcard":"31201-0063255-0","dob":"1950-01-03","admitDate":"2024-01-05","endDate":"2026-03-11","status":"active","id":22},{"name":"นางสาว วลัยรัตน์ จารุนครินทร์","idcard":"31009-0510861-6","dob":"1940-05-28","admitDate":"2024-01-07","endDate":"2026-03-11","status":"active","id":23},{"name":"นายสม กสิกรานันท์","idcard":"33014-0131920-5","dob":"1936-05-25","admitDate":"2024-01-13","endDate":"2026-03-11","status":"active","id":24},{"name":"นาง สอิ้งมาศ เกตุแก้ว","idcard":"31006-0241911-9","dob":"1936-01-01","admitDate":"2024-04-24","endDate":"2026-03-11","status":"active","id":25},{"name":"นาย สุรพล วณิชชานนท์","idcard":"38403-0018670-1","dob":"1946-01-01","admitDate":"2024-05-21","endDate":"2026-03-11","status":"active","id":26},{"name":"นาง กัลยา งามมงกุฎ","idcard":"31009-0161150-0","dob":"1942-01-01","admitDate":"2025-01-05","endDate":"2026-03-11","status":"active","id":27},{"name":"น.ส.วรพิน มิตรธรรมพิทักษ์","idcard":"31007-0043552-6","dob":"1942-01-20","admitDate":"2025-02-12","endDate":"2026-03-11","status":"active","id":28},{"name":"น.ส. กอบกุล ศิริกาญจนาวงศ์","idcard":"31014-0180509-8","dob":"1948-05-18","admitDate":"2025-04-15","endDate":"2026-03-11","status":"active","id":29},{"name":"Mr.Charles Michael Berryman","idcard":"537070478","dob":"1947-09-03","admitDate":"2025-04-04","endDate":"2026-03-11","status":"active","id":30},{"name":"นางนนทรี จีระสันติกุล","idcard":"31206-0067494-4","dob":"1949-02-14","admitDate":"2025-05-07","endDate":"2026-03-11","status":"active","id":31},{"name":"น.ส.สมปรารถนา ลายกนก","idcard":"31006-0064636-3","dob":"1948-12-28","admitDate":"2025-05-11","endDate":"2026-03-11","status":"active","id":32},{"name":"นางสุกรี ปลื้มวิทยาภรณ์","idcard":"31009-0283839-7","dob":"1950-02-01","admitDate":"2025-06-04","endDate":"2026-03-11","status":"active","id":33},{"name":"น.ส. สุปราณี สูงรัง","idcard":"3101700085852","dob":"1958-09-29","admitDate":"2025-09-05","endDate":"2026-03-11","status":"active","id":34},{"name":"น.ส. สุชาดา เลิศประไพ","idcard":"3100602716148","dob":"1958-02-07","admitDate":"2025-09-27","endDate":"2026-03-11","status":"active","id":35},{"name":"นางสมพร สูงรัง","idcard":"3101700085844","dob":"1935-01-01","admitDate":"2025-11-08","endDate":"2026-03-11","status":"active","id":36},{"name":"นางสุวรรณี แต้มบุญเลิศชัย","idcard":"31002-0251763-6","dob":"1936-02-12","admitDate":"2025-12-05","endDate":"2026-03-11","status":"active","id":37},{"name":"นางอุไรวรรณ พรหมภิบาลชีพ","idcard":"31017-0069618-5","dob":"1936-07-03","admitDate":"2025-12-06","endDate":"2026-03-11","status":"active","id":38},{"name":"นายบัณฑิต โพธิ์สง่า","idcard":"3100901358341","dob":"1960-01-19","admitDate":"2026-01-14","endDate":"2026-03-11","status":"active","id":39},{"name":"นายอารีย์ ทรงสกุลเกียรติ","idcard":"31018-0080726-4","dob":"1955-11-07","admitDate":"2026-02-05","endDate":"2026-03-11","status":"active","id":40},{"name":"นาง สมจิต นิยมไทย","idcard":"31006-0269169-2","dob":"1940-10-17","admitDate":"2024-12-12","endDate":"2025-01-11","status":"inactive","id":41},{"name":"นายวิศณุ สกุลพิเชฐรัตน์","idcard":"31017-0156068-6","dob":"1962-09-02","admitDate":"2025-01-23","endDate":"2025-01-31","status":"inactive","id":42},{"name":"จ.ส.อ. โชติ จันทร์อำรุง","idcard":"31006-0297738-3","dob":"1929-12-11","admitDate":"2024-02-01","endDate":"2025-01-26","status":"inactive","id":43},{"name":"นาย ทำเนียบ เชื้อวิวัฒน์","idcard":"31011-0038936-2","dob":"1932-12-29","admitDate":"2022-05-04","endDate":"2025-02-03","status":"inactive","id":44},{"name":"นายวิเชียร โรจน์วชิรนนท์","idcard":"31009-0293589-9","dob":"1938-12-25","admitDate":"2025-02-10","endDate":"2025-02-12","status":"inactive","id":45},{"name":"นาง อาทร ตีรณกุล","idcard":"31006-0169304-7","dob":"1933-04-30","admitDate":"2022-07-06","endDate":"2025-02-14","status":"inactive","id":46},{"name":"น.ส. สมจินตนา จิตรวรประเสริฐ","idcard":"31009-0450255-8","dob":"1942-01-01","admitDate":"2025-02-08","endDate":"2025-02-15","status":"inactive","id":47},{"name":"นาง นาฏนภา สุธาชีวะ","idcard":"31012-0194429-9","dob":"1945-12-13","admitDate":"2025-02-12","endDate":"2025-02-18","status":"inactive","id":48},{"name":"นางสุภาณี สุทธิ์ทราศิริกุล","idcard":"31201-0085892-2","dob":"1943-04-28","admitDate":"2025-03-06","endDate":"2025-03-22","status":"inactive","id":49},{"name":"นาง ประทุมทิพย์ พรรณะ","idcard":"31006-0240862-1","dob":"1946-07-24","admitDate":"2024-06-11","endDate":"2025-03-31","status":"inactive","id":50},{"name":"นายบำรุงรัตน์ เธียรศิริพิพัฒน์","idcard":"32099-0001086-1","dob":"1956-02-02","admitDate":"2024-11-27","endDate":"2025-03-31","status":"inactive","id":51},{"name":"นาย วรวิทย์ พิสุทธิ์พิบูลวงศ์","idcard":"31009-0258787-4","dob":"1957-04-27","admitDate":"2025-03-16","endDate":"2025-04-23","status":"inactive","id":52},{"name":"นาง มาลินทร์ คำภีร์","idcard":"31014-0083157-5","dob":"1934-01-01","admitDate":"2025-04-13","endDate":"2025-05-15","status":"inactive","id":53},{"name":"นาง โพชู ฟันเดอร์ ฮุ๊ก","idcard":"31009-0106630-7","dob":"1927-06-18","admitDate":"2024-05-22","endDate":"2025-05-17","status":"inactive","id":54},{"name":"น.ส. ระรินทิพย์ รังสิชัยนิรันดร์","idcard":"31017-0026559-1","dob":"1935-01-01","admitDate":"2025-04-12","endDate":"2025-07-11","status":"inactive","id":55},{"name":"นาย เลิศ เลิศอภิรักษ์","idcard":"31008-0066655-4","dob":"1973-01-06","admitDate":"2024-06-26","endDate":"2025-07-26","status":"inactive","id":56},{"name":"นางวราภรณ์ อภัยยานุกร","idcard":"","dob":"","admitDate":"2025-06-24","endDate":"2025-07-27","status":"inactive","id":57},{"name":"นาย เซียะเพียว แซ่โซว","idcard":"31017-0240469-6","dob":"1938-01-01","admitDate":"2021-09-28","endDate":"2025-06-02","status":"inactive","id":58},{"name":"นาย สนอง ภาคลำเจียก","idcard":"3100601115680","dob":"1938-12-30","admitDate":"2025-08-11","endDate":"2025-09-03","status":"inactive","id":59},{"name":"นาย วิศิษฐ์ ปริวุฒิพงศ์","idcard":"31004-0005611-2","dob":"1939-01-01","admitDate":"2009-12-01","endDate":"2025-09-30","status":"inactive","id":60},{"name":"Mr.Stephen Becker","idcard":"576395994","dob":"1949-09-29","admitDate":"2025-06-15","endDate":"","status":"active","id":61},{"name":"นางจินตนา พนาสหธรรม","idcard":"","dob":"","admitDate":"2025-10-23","endDate":"2025-10-25","status":"inactive","id":62},{"name":"นาง นงนุช ตันบุตร","idcard":"3819900053998","dob":"1947-06-22","admitDate":"2025-08-12","endDate":"2025-11-03","status":"inactive","id":63},{"name":"น.ส. วิรดา กาญจนเจริญ","idcard":"3100601099765","dob":"1957-05-01","admitDate":"2025-09-27","endDate":"2025-11-26","status":"inactive","id":64},{"name":"น.ส. สุนทรี โรจนสุพจน์","idcard":"31006-0146102-2","dob":"1941-12-22","admitDate":"2020-03-27","endDate":"2025-12-08","status":"inactive","id":65},{"name":"นางพรภัทร์ ส่งวิรุฬห์","idcard":"31009-0151114-9","dob":"1932-01-01","admitDate":"2024-09-06","endDate":"2025-12-23","status":"inactive","id":66},{"name":"นาย สุจริต สิริขจร","idcard":"51014-0003336-5","dob":"1940-06-01","admitDate":"2021-09-01","endDate":"2025-12-26","status":"inactive","id":67},{"name":"นายสง่า แย้มวาทีทอง","idcard":"31009-0223499-8","dob":"1952-04-10","admitDate":"2025-12-02","endDate":"2025-12-31","status":"inactive","id":68},{"name":"นายพรชัย โกมลวาณิชกิจ","idcard":"31012-0006525-9","dob":"1975-05-23","admitDate":"2025-12-28","endDate":"2026-01-01","status":"inactive","id":69},{"name":"น.ส. ศรีประภา แซ่เจียม","idcard":"31006-0119728-7","dob":"1944-04-15","admitDate":"2010-06-13","endDate":"2026-01-13","status":"inactive","id":70},{"name":"นายเกวิน วรรณดารา","idcard":"31017-0118863-9","dob":"1942-02-10","admitDate":"2025-12-15","endDate":"2026-01-14","status":"inactive","id":71},{"name":"น.ส. สุวารีย์ โพธิสา","idcard":"3101401211295","dob":"1964-11-11","admitDate":"2025-12-18","endDate":"2026-01-16","status":"inactive","id":72},{"name":"น.ส.สุภาพร โกมลวาณิชกิจ","idcard":"3101200065216","dob":"1944-01-20","admitDate":"2026-01-05","endDate":"2026-01-16","status":"inactive","id":73},{"name":"น.ส. พัชรี จิราพงษ์","idcard":"3639900137972","dob":"1968-03-19","admitDate":"2026-01-05","endDate":"2026-01-17","status":"inactive","id":74},{"name":"นาย วิชัย อุดมสมบูรณ์ดี","idcard":"31009-0130249-3","dob":"1956-09-16","admitDate":"2025-05-03","endDate":"2026-01-19","status":"inactive","id":75},{"name":"น.ส. พรพรรณ อินทมุณี","idcard":"38698-0003475-4","dob":"1937-01-01","admitDate":"2025-11-29","endDate":"2026-01-29","status":"inactive","id":76},{"name":"นาง พึงใจ ไวยกูล","idcard":"31006-0011235-1","dob":"1950-08-18","admitDate":"2024-07-27","endDate":"2026-01-31","status":"inactive","id":77},{"name":"น.ส. เยาวลักษณ์ พัฒนปรีชากุล","idcard":"3100601692474","dob":"1943-03-08","admitDate":"2025-10-24","endDate":"2026-02-02","status":"inactive","id":78}];
  allPatients.forEach(p => db.patients.push(p));

  // Staff from Excel (full data)
  const allStaff = [{"name":"น.ส.อรนันท์ อุดมภาพ","nickname":"โอ๋","position":"ผู้บริหาร","idcard":"","dob":"1980-09-17","startDate":"2013-02-01","endDate":"2026-03-11","id":1},{"name":"น.ส.สุธีนุช ธุวะคำ","nickname":"อิ่ม","position":"ธุรการ","idcard":"1101401380384","dob":"1988-08-05","startDate":"2013-03-03","endDate":"2026-03-11","id":2},{"name":"พญ. พรเพ็ญ พงศทันธรรม","nickname":"","position":"หมอ","idcard":"","dob":"","startDate":"","endDate":"2026-03-11","id":3},{"name":"น.ส.ศศิวรรณ ชูพวกพ้อง","nickname":"จุ๋ม","position":"ธุุรการ","idcard":"31015-0075335-5","dob":"1959-12-10","startDate":"2008-07-01","endDate":"2026-03-11","id":4},{"name":"นางมลฤดี ตั้งนิตยวงศ์","nickname":"มล","position":"โภชนากร","idcard":"3100701107085","dob":"1959-12-28","startDate":"2002-10-01","endDate":"2026-03-11","id":5},{"name":"น.ส.อุไรวรรณ หนูสุข","nickname":"อุ","position":"บัญชี","idcard":"","dob":"","startDate":"","endDate":"2026-03-11","id":6},{"name":"น.ส.ปิยะวรรณ นาคำนวน","nickname":"มด","position":"พยาบาล","idcard":"31901-0045805-3","dob":"1983-10-23","startDate":"2012-03-01","endDate":"2026-03-11","id":7},{"name":"น.ส.อรดี บุตรอำคา","nickname":"ออ","position":"พยาบาล","idcard":"13508-0000450-2","dob":"1984-03-28","startDate":"2013-04-01","endDate":"2026-03-11","id":8},{"name":"น.ส. ณัฐฏศษิ กิจสกุลรุ่งโรจน์","nickname":"ณัฐ","position":"พยาบาล","idcard":"","dob":"","startDate":"","endDate":"2026-03-11","id":9},{"name":"น.ส. มาลาตี แวหามะ","nickname":"ตรี","position":"นักกายภาพ","idcard":"1940200053418","dob":"1986-06-27","startDate":"2024-06-12","endDate":"2026-03-11","id":10},{"name":"น.ส.สมฤทัย พัฒนวรากร","nickname":"พริ้ง","position":"PN","idcard":"15802-0005987-8","dob":"1994-08-28","startDate":"2013-08-16","endDate":"2026-03-11","id":11},{"name":"น.ส.กันนิดา สีหะบุตร","nickname":"ปลา","position":"PN","idcard":"13210-0027375-5","dob":"1993-01-22","startDate":"2013-08-16","endDate":"2026-03-11","id":12},{"name":"น.ส.อุดม กาลจักร์","nickname":"ดม","position":"บริบาล","idcard":"33503 00067 331","dob":"1978-06-08","startDate":"2001-11-01","endDate":"2026-03-11","id":13},{"name":"น.ส จารุวรรณ นวนิยม","nickname":"วรรณ","position":"PN","idcard":"14303-0131796-2","dob":"2000-08-15","startDate":"2021-08-08","endDate":"2026-03-11","id":14},{"name":"น.ส. กัญญารัตน์ ฉลองรัมย์","nickname":"โบ๊ท","position":"บริบาล","idcard":"1103703957805","dob":"2005-05-08","startDate":"2024-08-01","endDate":"2026-03-11","id":15},{"name":"น.ส. นภัสสร สุขจิต","nickname":"แก้ม","position":"บริบาล","idcard":"1839902035583","dob":"2008-09-03","startDate":"2024-08-01","endDate":"2026-03-11","id":16},{"name":"น.ส.หน่อย ช่อธกุล","nickname":"หน่อย","position":"บริบาล","idcard":"571500017073","dob":"2003-08-10","startDate":"2024-10-01","endDate":"2026-03-11","id":17},{"name":"น.ส.นวล ช่อธิกุล","nickname":"นวล","position":"บริบาล","idcard":"571500017057","dob":"2004-11-19","startDate":"2024-10-01","endDate":"2026-03-11","id":18},{"name":"น.ส. ชญานิศ พงค์เสน่ห์","nickname":"แวว","position":"บริบาล","idcard":"1560700055014","dob":"2000-08-20","startDate":"2025-04-21","endDate":"2026-03-11","id":19},{"name":"น.ส. นภาพร หล้าเที่ยง","nickname":"แหวน","position":"บริบาล","idcard":"1579901236944","dob":"2007-05-26","startDate":"2025-07-17","endDate":"2026-03-11","id":20},{"name":"น.ส. เนรัญชรา แซ่พร่าน","nickname":"เหมย","position":"บริบาล","idcard":"1579901213324","dob":"2006-12-18","startDate":"2025-07-16","endDate":"2026-03-11","id":21},{"name":"น.ส. พรพิมล แซ่โซ้ง","nickname":"พร","position":"บริบาล","idcard":"0571300005861","dob":"2007-03-17","startDate":"2025-07-17","endDate":"2026-03-11","id":22},{"name":"น.ส. สุวันดี จารุเรืองสิริกุล","nickname":"วัน","position":"บริบาล","idcard":"1570301223983","dob":"2005-12-23","startDate":"2025-07-16","endDate":"2026-03-11","id":23},{"name":"น.ส. เบญญาภา  อินทรสุนทร","nickname":"เบญ","position":"บริบาล","idcard":"1539300026091","dob":"2006-09-29","startDate":"2025-07-28","endDate":"2026-03-11","id":24},{"name":"น.ส.กัจจนา ทวดธรรม","nickname":"โม","position":"บริบาล","idcard":"18099-0216145-7","dob":"2002-08-19","startDate":"2026-01-02","endDate":"2026-03-11","id":25},{"name":"Miss.NAW MU TA KAE (มะระ)","nickname":"มะระ","position":"แม่ครัว","idcard":"","dob":"","startDate":"2021-04-19","endDate":"2026-03-11","id":26},{"name":"Mr.SAW AUNG MYA SEIN (ท้อ)","nickname":"ท้อ","position":"พ่อครัว","idcard":"","dob":"","startDate":"2021-04-19","endDate":"2026-03-11","id":27},{"name":"Miss.NAW MA NEW (นวย_น้องมะระ)","nickname":"นวย","position":"แม่ครัว","idcard":"","dob":"","startDate":"2021-11-19","endDate":"2026-03-11","id":28},{"name":"Miss.นอพอ มาทำแทนมะระ","nickname":"พ้อ","position":"แม่บ้าน","idcard":"","dob":"","startDate":"2023-10-11","endDate":"2026-03-11","id":29},{"name":"Mr.SAW MAUNG KO (เกลือ)","nickname":"เกลือ","position":"พ่อบ้าน","idcard":"","dob":"","startDate":"2024-03-12","endDate":"2026-03-11","id":30},{"name":"สา (พม่า)","nickname":"สา","position":"พ่อบ้าน","idcard":"","dob":"","startDate":"2025-07-03","endDate":"2026-03-11","id":31},{"name":"น.ส. กนกวรรณ แท่นแก้ว","nickname":"แบม","position":"บริบาล","idcard":"1749901021946","dob":"2005-03-06","startDate":"2024-07-28","endDate":"2025-08-20","id":32},{"name":"นายกฤษฏา ห่วง","nickname":"ดิว","position":"บริบาล","idcard":"1329901354833","dob":"2005-08-05","startDate":"2024-07-29","endDate":"2025-08-20","id":33},{"name":"น.ส.กัจจนา ทวดธรรม","nickname":"โม","position":"บริบาล","idcard":"18099-0216145-7","dob":"2002-08-19","startDate":"2022-01-03","endDate":"2025-11-30","id":34},{"name":"รูไฟด๊ะห์ เจ๊ะซู","nickname":"ด๊ะห์","position":"บริบาล","idcard":"","dob":"","startDate":"2023-10-05","endDate":"2025-11-30","id":35},{"name":"นูรีฮัน หะยีหะซา","nickname":"ฟา","position":"บริบาล","idcard":"","dob":"","startDate":"2023-10-05","endDate":"2025-11-30","id":36},{"name":"นายลุตฟาน มะกะนิ","nickname":"ฟาน","position":"บริบาล","idcard":"1959300025902","dob":"2004-07-03","startDate":"2025-12-24","endDate":"2026-01-03","id":37}];
  allStaff.forEach(s => db.staff.push(s));

  // Sample requisitions
  const today = new Date();
  for (let d = 6; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const count = Math.floor(Math.random() * 5) + 1;
    for (let j = 0; j < count; j++) {
      const item = db.items[Math.floor(Math.random() * db.items.length)];
      const patient = db.patients[Math.floor(Math.random() * db.patients.length)];
      const staff = db.staff[Math.floor(Math.random() * db.staff.length)];
      const qty = Math.floor(Math.random() * 5) + 1;
      db.requisitions.push({
        id: db.requisitions.length + 1,
        date: date.toISOString().split('T')[0],
        patientId: patient.id, patientName: patient.name,
        itemId: item.id, itemName: item.name,
        qty, unit: item.unit,
        staffId: staff.id, staffName: staff.name,
        note: ''
      });
    }
  }

  saveDB();
}