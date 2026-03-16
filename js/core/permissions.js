// ===== PERMISSIONS =====

// ===== ROLE-BASED ACCESS CONTROL =====
// Pages each role can see in sidebar
const ROLE_PAGES = {
  admin:     ['dashboard','stock','requisition','history','report','patients','rooms','staff','healthreport','items','purchasehistory','accounts','settings','billing','billing-settings'],
  manager:   ['dashboard','stock','requisition','history','report','patients','rooms','staff','healthreport','items','purchasehistory','settings','billing','billing-settings'],
  officer:   ['dashboard','stock','requisition','history','report','patients','rooms','staff','healthreport','items','purchasehistory','billing','billing-settings'],
  nurse:     ['dashboard','requisition','history','report','patients','rooms','healthreport'],
  caregiver: ['dashboard','requisition','history'],
  // Legacy roles (backward compat)
  supervisor:['dashboard','requisition','history','report','patients','rooms'],
  warehouse: ['dashboard','stock','requisition','history','report','patients','items','purchasehistory','settings'],
};

// Data each role can see in history/report
// caregiver = own records only; others = all
function canSeeAllHistory() {
  return currentUser && !['caregiver','staff'].includes(currentUser.role);
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
  if (accNav) accNav.style.display = currentUser.role === 'admin' ? '' : 'none';
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
  return hasRole('admin', 'manager', 'officer', 'nurse');
}

function canManageInventory() {
  return hasRole('admin', 'manager', 'officer', 'warehouse');
}

function canManageStaff() {
  return hasRole('admin', 'manager', 'officer');
}

function canViewAccounts() {
  return hasRole('admin');
}

function canResetInvoice() {
  return hasRole('admin', 'manager', 'officer');
}

function canDischargePatient() {
  return hasRole('admin', 'manager', 'nurse');
}