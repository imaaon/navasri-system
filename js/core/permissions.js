// ===== PERMISSIONS =====

// ===== ROLE-BASED ACCESS CONTROL =====
const ROLE_PAGES = {
  admin: ['dashboard','stock','requisition','history','report','patients','rooms','staff',
          'healthreport','purchasehistory','billing',
          'suppliers','supplierinvoices','purchaserequests','stockreport',
          'incident','dietary','deposits','bi','expenses','assets','audit',
          'accounts','billing-settings','settings'],

  manager: ['dashboard','stock','requisition','history','report','patients','rooms','staff',
             'healthreport','purchasehistory','billing',
             'suppliers','supplierinvoices','purchaserequests','stockreport',
             'incident','dietary','deposits','bi','expenses','assets','audit',
             'accounts','billing-settings','settings'],

  // ธุรการ: เห็นหมด ยกเว้น accounts/audit/settings + อนุมัติใบเบิก
  officer: ['dashboard','stock','requisition','history','report','patients','rooms','staff',
             'healthreport','purchasehistory','billing',
             'suppliers','supplierinvoices','purchaserequests','stockreport',
             'incident','dietary','deposits','bi','expenses','assets',
             'billing-settings'],

  // พยาบาลวิชาชีพ: ดูแลคนไข้ครบ + deposits + เบิกของ + PR + สต็อค(ดูอย่างเดียว)
  nurse: ['dashboard','requisition','history','report','patients','rooms',
           'healthreport','incident','dietary','deposits','stock','purchaserequests','assets'],

  // พยาบาลพาร์ทไทม์: เหมือน nurse ยกเว้น deposits + staff
  parttime_nurse: ['dashboard','requisition','history','report','patients','rooms',
                    'healthreport','incident','dietary','stock','purchaserequests','deposits','assets'],

  // หมอ (จากภายนอก): เฉพาะข้อมูลคนไข้ tab คลินิก
  doctor: ['dashboard','patients'],

  // นักกายภาพบำบัด: ข้อมูลคนไข้ + physio + เบิกของ
  physical_therapist: ['dashboard','patients','requisition','history'],

  // นักโภชนาการ: ข้อมูลคนไข้(บางส่วน) + dietary + เบิกของ
  dietitian: ['dashboard','patients','dietary','requisition','history'],

  // ผู้ช่วยพยาบาล / พนักงานผู้ช่วยเหลือคนไข้: vital + เบิกของ + ประวัติ
  caregiver: ['dashboard','patients','requisition','history','incident','dietary','assets'],

  // พนักงานผู้ช่วยฯ (ตรวจสต็อค): สต็อค + เบิกของ + ประวัติ
  warehouse: ['dashboard','stock','requisition','history','report',
               'purchasehistory','suppliers','purchaserequests','stockreport'],

  // Legacy
  supervisor: ['dashboard','requisition','history','report','patients','rooms'],
};

// ── Tab access per role (patient profile tabs) ─────────────────
// กำหนด tab ในโปรไฟล์คนไข้ที่แต่ละ role เห็นได้
const PATIENT_TAB_ACCESS = {
  // key ตรงกับ HTML switchPatTab() keys ใน clinical/clinical-profile.js
  history:     ['admin','manager','officer','nurse','parttime_nurse','physical_therapist','dietitian','caregiver','warehouse'],
  medical:     ['admin','manager','officer','nurse','parttime_nurse','doctor','physical_therapist','dietitian','caregiver'],
  meds:        ['admin','manager','officer','nurse','parttime_nurse','doctor','dietitian','caregiver'],
  allergy:     ['admin','manager','officer','nurse','parttime_nurse','doctor','physical_therapist','dietitian','caregiver'],
  contacts:    ['admin','manager','officer','nurse','parttime_nurse','physical_therapist','dietitian','caregiver'],
  notes:       ['admin','manager','officer','nurse','parttime_nurse','doctor','physical_therapist','dietitian','caregiver'],
  mar:         ['admin','manager','officer','nurse','parttime_nurse','doctor','dietitian','caregiver'],
  vitals:      ['admin','manager','officer','nurse','parttime_nurse','doctor','physical_therapist','dietitian','caregiver'],
  excretion:    ['admin','manager','nurse','parttime_nurse','caregiver'],
  lab:         ['admin','manager','officer','nurse','parttime_nurse','doctor','physical_therapist','dietitian'],
  nursing:     ['admin','manager','officer','nurse','parttime_nurse','doctor','physical_therapist','dietitian','caregiver'],
  appts:       ['admin','manager','officer','nurse','parttime_nurse'],
  belongings:  ['admin','manager','officer','nurse','parttime_nurse','caregiver'],
  dnr:         ['admin','manager','officer','nurse','parttime_nurse'],
  physio:      ['admin','manager','officer','nurse','parttime_nurse','doctor','physical_therapist'],
  dispense:    ['admin','manager','officer','nurse','parttime_nurse','physical_therapist','dietitian','caregiver','warehouse'],
  incident:    ['admin','manager','officer','nurse','parttime_nurse','caregiver'],
  dietary:     ['admin','manager','officer','nurse','parttime_nurse','dietitian','caregiver'],
  dispense:    ['admin','manager','officer','nurse','parttime_nurse','physical_therapist','dietitian','caregiver','warehouse'],
  deposits:    ['admin','manager','officer','nurse'],
}

function canSeePatientTab(tab) {
  if (!currentUser) return false;
  const allowed = PATIENT_TAB_ACCESS[tab] || [];
  return allowed.includes(currentUser.role);
}

function canWritePatientTab(tab) {
  if (!currentUser) return false;
  const allowed = PATIENT_TAB_WRITE[tab] || [];
  return allowed.includes(currentUser.role);
}

function updateSidebarForRole() {
  if (!currentUser) return;
  // [R25 15พค69] Set body class for role-based CSS variants
  document.body.className = document.body.className.replace(/\brole-\S+/g, '').trim();
  document.body.classList.add('role-' + currentUser.role);

  const allowed = ROLE_PAGES[currentUser.role] || [];
  document.querySelectorAll('.nav-item').forEach(n => {
    const onclick = n.getAttribute('onclick') || '';
    const match = onclick.match(/'([^']+)'/);
    if (!match) return;
    const pageId = match[1];
    n.style.display = allowed.includes(pageId) ? '' : 'none';
  });
  const staffFilterWrap = document.getElementById('histStaffWrap');
  if (staffFilterWrap) staffFilterWrap.style.display = canSeeAllHistory() ? '' : 'none';
  const accNav = document.getElementById('nav-accounts');
  if (accNav) accNav.style.display = ['admin','manager'].includes(currentUser.role) ? '' : 'none';
  const billingSection = document.getElementById('nav-section-billing');
  if (billingSection) billingSection.style.display = allowed.includes('billing') ? '' : 'none';
}

// ── Permission Helpers ───────────────────────────────────────
function hasRole(...roles) {
  return currentUser && roles.includes(currentUser.role);
}

function canApproveReq() {
  return hasRole('admin', 'manager', 'officer');
}

function canSeeAllHistory() {
  return hasRole('admin', 'manager');
}

function canSeeExcretion() {
  return hasRole('admin', 'manager', 'nurse', 'parttime_nurse', 'caregiver');
}

function canEditExcretion() {
  return hasRole('admin', 'manager', 'nurse', 'parttime_nurse', 'caregiver');
}

function canManageBilling() {
  return hasRole('admin', 'manager', 'officer');
}

// ── Hide prices/money figures from non-finance roles ─────────
// เห็นราคา: admin, manager, officer, nurse, parttime_nurse
// ซ่อนราคา: caregiver, doctor, physical_therapist, dietitian, warehouse
function canSeePrice() {
  return hasRole('admin', 'manager', 'officer', 'nurse', 'parttime_nurse');
}

function canManagePatients() {
  return hasRole('admin', 'manager', 'officer', 'nurse', 'parttime_nurse');
}

function canViewPatients() {
  return hasRole('admin','manager','officer','nurse','parttime_nurse',
                 'doctor','physical_therapist','dietitian','caregiver','warehouse');
}

function canManagePhysio() {
  return hasRole('admin','manager','officer','nurse','parttime_nurse','physical_therapist');
}

function canManageVitals() {
  return hasRole('admin','manager','officer','nurse','parttime_nurse',
                 'caregiver','physical_therapist','dietitian');
}

function canManageInventory() {
  return hasRole('admin', 'manager', 'officer', 'warehouse');
}

function canManageStaff() {
  return hasRole('admin', 'manager', 'officer');
}

function canViewAccounts() {
  return hasRole('admin', 'manager');
}

function canManageAccounting() {
  return hasRole('admin', 'manager');
}

function canResetInvoice() {
  return hasRole('admin', 'manager', 'officer');
}

function canDischargePatient() {
  return hasRole('admin', 'manager', 'nurse', 'parttime_nurse');
}

function canSubmitRequisition() {
  return hasRole('admin','manager','officer','nurse','parttime_nurse',
                 'physical_therapist','dietitian','caregiver','warehouse');
}

function canViewStock() {
  return hasRole('admin','manager','officer','nurse','parttime_nurse',
                 'physical_therapist','dietitian','caregiver','warehouse');
}

function canWriteStock() {
  return hasRole('admin','manager','officer','warehouse');
}

function canViewSuppliers() {
  return hasRole('admin','manager','officer','warehouse');
}

function canWriteSuppliers() {
  return hasRole('admin','manager','officer');
}

function isDoctor() {
  return hasRole('doctor');
}

function isDietitian() {
  return hasRole('dietitian');
}
