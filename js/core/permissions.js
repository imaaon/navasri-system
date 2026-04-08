// ===== PERMISSIONS =====

// ===== ROLE-BASED ACCESS CONTROL =====
// Pages each role can see in sidebar
const ROLE_PAGES = {
  admin:             ['dashboard','stock','requisition','history','report','patients','rooms','staff',
                      'healthreport','items','purchasehistory','accounts','settings','billing','billing-settings',
                      'suppliers','supplierinvoices','purchaserequests','stockreport',
                      'incident','dietary','deposits','bi','expenses','assets','audit'],
  // Manager = เหมือน admin ทุกอย่าง รวม accounts
  manager:           ['dashboard','stock','requisition','history','report','patients','rooms','staff',
                      'healthreport','items','purchasehistory','accounts','settings','billing','billing-settings',
                      'suppliers','supplierinvoices','purchaserequests','stockreport',
                      'incident','dietary','deposits','bi','expenses','assets','audit'],
  officer:           ['dashboard','stock','requisition','history','report','patients','rooms','staff',
                      'healthreport','items','purchasehistory','billing','billing-settings',
                      'suppliers','supplierinvoices','purchaserequests','stockreport',
                      'incident','dietary','deposits','bi','expenses','assets'],
  accounting:        ['dashboard','billing','billing-settings','report','history',
                      'supplierinvoices','deposits','purchasehistory','bi'],
  nurse:             ['dashboard','requisition','history','report','patients','rooms',
                      'healthreport','incident','dietary'],
  // Caregiver: ดูข้อมูลผู้ป่วย + บันทึก vital ได้ แต่ไม่แก้ไขข้อมูลหลัก
  caregiver:         ['dashboard','patients','requisition','history','healthreport'],
  // Physical Therapist: ดูผู้ป่วย + บันทึก vital + จัดการ physio เท่านั้น
  physical_therapist:['dashboard','patients','healthreport'],
  // Legacy roles (backward compat)
  supervisor:        ['dashboard','requisition','history','report','patients','rooms'],
  warehouse:         ['dashboard','stock','requisition','history','report','patients',
                      'items','purchasehistory','settings',
                      'suppliers','purchaserequests','stockreport'],
};

// Data each role can see in history/report
// caregiver = own records only; others = all
function canSeeAllHistory() {
  // caregiver และ physical_therapist เห็นเฉพาะรายการของตัวเอง
  return currentUser && !['caregiver','physical_therapist','staff'].includes(currentUser.role);
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
  // Hide staff-filter dropdown in history if caregiver (they only see own)
  const staffFilterWrap = document.getElementById('histStaffWrap');
  if (staffFilterWrap) staffFilterWrap.style.display = canSeeAllHistory() ? '' : 'none';
  // Show/hide account nav (admin only)
  const accNav = document.getElementById('nav-accounts');
  if (accNav) accNav.style.display = ['admin','manager'].includes(currentUser.role) ? '' : 'none';
  // Show/hide billing nav section header
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
  // แก้ไขข้อมูลผู้ป่วยได้: admin, manager, officer, nurse
  // caregiver และ physical_therapist ดูได้อย่างเดียว
  return hasRole('admin', 'manager', 'officer', 'nurse');
}

function canViewPatients() {
  return hasRole('admin','manager','officer','nurse','caregiver','physical_therapist','warehouse');
}

function canManagePhysio() {
  // บันทึกและจัดการ physio sessions
  return hasRole('admin','manager','officer','nurse','physical_therapist');
}

function canManageVitals() {
  // บันทึก vital signs และสุขภาพ
  return hasRole('admin','manager','officer','nurse','caregiver','physical_therapist');
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
  return hasRole('admin', 'manager', 'nurse');
}