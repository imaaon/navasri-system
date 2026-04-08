// ===== ROUTER =====

// ===== PAGES =====
let currentPage = 'dashboard';
function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('show');
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

function showPage(page) {
  document.querySelectorAll('[id^="page-"]').forEach(p => p.style.display = 'none');
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.style.display = '';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes(`'${page}'`)) n.classList.add('active');
  });
  // For billing-settings, highlight billing nav
  if (page === 'billing-settings') {
    const nb = document.getElementById('nav-billing');
    if (nb) nb.classList.add('active');
  }
  currentPage = page;
  const titles = { dashboard:'Dashboard', stock:'คลังสต็อก', requisition:'เบิกสินค้า', history:'ประวัติการเบิก', report:'รายงาน', patients:'ผู้รับบริการ', rooms:'🛏️ ห้องพักและเตียง', staff:'พนักงาน', items:'รายการสินค้า', settings:'💬 Line & ตั้งค่า', reqform:'ใบเบิกสินค้า', patprofile:'ข้อมูลผู้รับบริการ', staffprofile:'ข้อมูลพนักงาน', accounts:'🔑 จัดการ Account', healthreport:'📋 รายงานสุขภาพ', purchasehistory:'📋 ประวัติการสั่งซื้อ', billing:'💰 ระบบบัญชี', 'billing-settings':'⚙️ ตั้งค่าบัญชี', incident:'⚠️ อุบัติเหตุ & แผลกดทับ', dietary:'🍽️ โภชนาการ & สายให้อาหาร', deposits:'🏦 มัดจำ & เงินประกัน', bi:'🔍 BI & วิเคราะห์กำไร', suppliers:'🏭 ผู้จำหน่าย', supplierinvoices:'🧾 ใบแจ้งหนี้ผู้จำหน่าย', purchaserequests:'📋 คำขอซื้อ', stockreport:'📊 รายงานสต็อก' audit:'Audit Trail' };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  closeSidebar();
  renderPage(page);
  if (typeof renderPageExtra === 'function') renderPageExtra(page);
}

function renderPage(page) {
  if (page === 'dashboard') renderDashboard();
  else if (page === 'stock') renderStock();
  else if (page === 'history') { renderHistory(); updateApprovalBadge(); }
  else if (page === 'report') renderReport();
  else if (page === 'rooms') renderRooms();
  else if (page === 'patients') renderPatients();
  else if (page === 'staff') renderStaff();
  else if (page === 'settings') { loadLineSettingsUI(); renderLineLog(); }
  else if (page === 'requisition') initReq();
  // reqform is populated by openReqForm() before showPage('reqform') is called
  // profiles are populated before showPage() is called
  else if (page === 'accounts') renderAccounts();
  else if (page === 'billing') renderBilling();
  else if (page === 'healthreport') {
    const hrMonth = document.getElementById('hr-month');
    if (!hrMonth.value) hrMonth.value = new Date().toISOString().slice(0,7);
    renderHealthReport();
  }
  else if (page === 'bi') {
    const biMonth = document.getElementById('bi-month');
    if (biMonth && !biMonth.value) biMonth.value = new Date().toISOString().slice(0,7);
    renderBIPage();
  }
  else if (page === 'suppliers') renderSuppliers();
  else if (page === 'supplierinvoices') { renderSupplierInvoices(); populateSupInvFilters(); }
  else if (page === 'purchaserequests') renderPurchaseRequests();
  else if (page === 'stockreport') {
    const srMonth = document.getElementById('sr-month');
    if (srMonth && !srMonth.value) srMonth.value = new Date().toISOString().slice(0,7);
    switchStockReportTab('lowstock');
  }
  else if (page === 'expenses') renderExpenses();
  else if (page === 'assets') { renderAssets(); }
  else if (page === 'audit') { window._auditPage=1; renderAuditPage(); }
}