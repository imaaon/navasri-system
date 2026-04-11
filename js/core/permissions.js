// ===== PERMISSIONS =====

// ===== ROLE-BASED ACCESS CONTROL =====
const ROLE_PAGES = {
  admin: ['dashboard','stock','requisition','history','report','patients','rooms','staff',
          'healthreport','items','purchasehistory','accounts','settings','billing','billing-settings',
          'suppliers','supplierinvoices','purchaserequests','stockreport',
          'incident','dietary','deposits','bi','expenses','assets','audit'],

  manager: ['dashboard','stock','requisition','history','report','patients','rooms','staff',
             'healthreport','items','purchasehistory','accounts','settings','billing','billing-settings',
             'suppliers','supplierinvoices','purchaserequests','stockreport',
             'incident','dietary','deposits','bi','expenses','assets','audit'],

  // ธุรการ: เห็นหมด ยกเว้น accounts/audit/settings + อนุมัติใบเบิก
  officer: ['dashboard','stock','requisition','history','report','patients','rooms','staff',
             'healthreport','items','purchasehistory','billing','billing-settings',
             'suppliers','supplierinvoices','purchaserequests','stockreport',
             'incident','dietary','deposits','bi','expenses','assets'],

  // พยาบาลวิชาชีพ: ดูแลคนไข้ครบ + deposits + เบิกของ + PR + สต็อค(ดูอย่างเดียว)
  nurse: ['dashboard','requisition','history','report','patients','rooms',
           'healthreport','incident','dietary','deposits','stock','purchaserequests'],

  // พยาบาลพาร์ทไทม์: เหมือน nurse ยกเว้น deposits + staff
  parttime_nurse: ['dashboard','requisition','history','report','patients','rooms',
                    'healthreport','incident','dietary','stock','purchaserequests'],

  // หมอ (จากภายนอก): เฉพาะข้อมูลคนไข้ tab คลินิก
  doctor: ['dashboard','patients'],

  // นักกายภาพบำบัด: ข้อมูลคนไข้ + physio + เบิกของ
  physical_therapist: ['dashboard','patients','requisition','history'],

  // นักโภชนาการ: ข้อมูลคนไข้(บางส่วน) + dietary + เบิกของ
  dietitian: ['dashboard','patients','dietary','requisition','history'],

  // ผู้ช่วยพยาบาล / พนักงานผู้ช่วยเหลือคนไข้: vital + เบิกของ + ประวัติ
  caregiver: ['dashboard','patients','requisition','history','incident','dietary'],

  // พนักงานผู้ช่วยฯ (ตรวจสต็อค): สต็อค + เบิกของ + ประวัติ
  warehouse: ['dashboard','stock','requisition','history','report','patients',
               'items','purchasehistory','suppliers','purchaserequests','stockreport'],

  // Legacy
  supervisor: ['dashboard','requisition','history','report','patients','rooms'],
};

// ── Tab access per role (patient profile tabs) ─────────────────
// กำหนด tab ในโปรไฟล์คนไข้ที่แต่ละ role เห็นได้
const PATIENT_TAB_ACCESS = {
  // tab: [roles ที่เห็นได้]
  general:      ['admin','manager','officer','nurse','parttime_nurse','doctor',
                 'physical_therapist','dietitian','caregiver'],
  contacts:     ['admin','manager','officer','nurse','parttime_nurse',
                 'physical_therapist','dietitian','caregiver'],
  allergies:    ['admin','manager','officer','nurse','parttime_nurse','doctor',
                 'physical_therapist','dietitian','caregiver'],
  vitals:       ['admin','manager','officer','nurse','parttime_nurse','doctor',
                 'physical_therapist','dietitian','caregiver'],
  mar:          ['admin','manager','officer','nurse','parttime_nurse','doctor',
                 'dietitian','caregiver'],
  lab:          ['admin','manager','officer','nurse','parttime_nurse','doctor',
                 'physical_therapist','dietitian'],
  physio:       ['admin','manager','officer','nurse','parttime_nurse','doctor',
                 'physical_therapist'],
  nursing:      ['admin','manager','officer','nurse','parttime_nurse','doctor',
                 'physical_therapist','dietitian','caregiver'],
  dietary:      ['admin','manager','officer','nurse','parttime_nurse',
                 'dietitian','caregiver'],
  incident:     ['admin','manager','officer','nurse','parttime_nurse','caregiver'],
  appointments: ['admin','manager','officer','nurse','parttime_nurse'],
  belongings:   ['admin','manager','officer','nurse','parttime_nurse','caregiver'],
  assets:       ['admin','manager','officer','nurse'],
  deposits:     ['admin','manager','officer','nurse'],
  dnr:          ['admin','manager','officer','nurse','parttime_nurse'],
  consent:      ['admin','manager','officer','nurse','parttime_nurse'],
  history:      ['admin','manager','officer','nurse','parttime_nurse','physical_therapist','dietitian','caregiver','warehouse'],
  dispense:     ['admin','manager','officer','nurse','parttime_nurse','physical_therapist','dietitian','caregiver','warehouse'],
};

// tab ที่แก้ไขได้ (ไม่ใช่แค่ดู) สำหรับแต่ละ role
const PATIENT_TAB_WRITE = {
  general:      ['admin','manager','officer','nurse','parttime_nurse'],
  contacts:     ['admin','manager','officer','nurse'],
  allergies:    ['admin','manager','officer','nurse','parttime_nurse'],
  vitals:       ['admin','manager','officer','nurse','parttime_nurse',
                 'physical_therapist','dietitian','caregiver'],
  mar:          ['admin','manager','officer','nurse','parttime_nurse','caregiver'],
  lab:          ['admin','manager','officer','nurse','parttime_nurse'],
  physio:       ['admin','manager','officer','nurse','parttime_nurse','physical_therapist'],
  nursing:      ['admin','manager','officer','nurse','parttime_nurse','caregiver'],
  dietary:      ['admin','manager','officer','nurse','parttime_nurse','dietitian','caregiver'],
  incident:     ['admin','manager','officer','nurse','parttime_nurse','caregiver'],
  appointments: ['admin','manager','officer','nurse','parttime_nurse'],
  belongings:   ['admin','manager','officer','nurse','parttime_nurse','caregiver'],
  assets:       ['admin','manager','officer','nurse'],
  deposits:     ['admin','manager','officer','nurse'],
  dnr:          ['admin','manager','officer','nurse','parttime_nurse'],
  consent:      ['admin','manager','officer','nurse','parttime_nurse'],
  history:      ['admin','manager','officer','nurse','parttime_nurse','physical_therapist','dietitian','caregiver','warehouse'],
  dispense:     ['admin','manager','officer','nurse','parttime_nurse','physical_therapist','dietitian','caregiver','warehouse'],
};

function canSeeAllHistory() {
  return currentUser && !['caregiver','physical_therapist','staff','doctor',
                           'parttime_nurse','dietitian'].includes(currentUser.role);
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

function canManageBilling() {
  return hasRole('admin', 'manager', 'officer');
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
  return hasRole('admin', 'manager', 'accounting');
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
