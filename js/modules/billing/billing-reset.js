// ===== BILLING: INVOICE RESET =====

// ===== BILLING MODULE =====

// ===== INVOICE RESET =====
function openInvoiceResetModal(id) {
  // ตรวจสิทธิ์
  const role = currentUser?.role;
  if (!['admin','manager','officer'].includes(role)) {
    toast('❌ ไม่มีสิทธิ์ Reset บิล', 'error'); return;
  }
  const inv = (db.invoices||[]).find(i=>i.id===id);
  if (!inv) return;

  document.getElementById('reset-invoice-id').value = id;
  document.getElementById('reset-invoice-reason').value = '';
  document.getElementById('reset-invoice-status').value = 'sent';

  const dynStatus = getDynamicInvoiceStatus(inv);
  const STATUS_LABELS = { draft:'ร่าง', sent:'รอชำระ', partial:'ชำระบางส่วน', paid:'ชำระครบ' };
  const paid = getInvoicePaidAmount(id);
  document.getElementById('reset-invoice-info').innerHTML =
    `<div>เลขที่: <strong>${inv.docNo||'-'}</strong></div>
     <div>สถานะปัจจุบัน: <strong style="color:#c0392b;">${STATUS_LABELS[dynStatus]||dynStatus}</strong></div>
     <div>ยอดรับชำระแล้ว: <strong>${formatThb(paid)}</strong> / ${formatThb(inv.grandTotal||0)}</div>`;

  openModal('modal-invoice-reset');
}

async function saveInvoiceReset() {
  await ensureSecondaryDB();
  const id     = document.getElementById('reset-invoice-id').value;
  const newStatus = document.getElementById('reset-invoice-status').value;
  const reason = document.getElementById('reset-invoice-reason').value.trim();

  if (!reason) { toast('กรุณาระบุเหตุผล', 'warning'); return; }

  const inv = (db.invoices||[]).find(i=>i.id===id);
  if (!inv) return;

  const dynStatus = getDynamicInvoiceStatus(inv);
  const paid = getInvoicePaidAmount(id);

  // บันทึก Log ก่อน
  const logData = {
    invoice_id:     id,
    doc_no:         inv.docNo || '-',
    patient_name:   inv.patientName || '-',
    old_status:     dynStatus,
    new_status:     newStatus,
    old_paid_amount: paid,
    grand_total:    inv.grandTotal || 0,
    reason:         reason,
    reset_by:       currentUser?.displayName || currentUser?.username || '',
    reset_by_role:  currentUser?.role || '',
    reset_at:       new Date().toISOString()
  };
  const { error: logErr } = await supa.from('invoice_reset_logs').insert(logData);
  if (logErr) console.warn('reset log error:', logErr.message);

  // ถ้า reset เป็น draft หรือ sent → ลบประวัติการชำระทั้งหมดของบิลนี้ออก
  if (newStatus === 'draft' || newStatus === 'sent') {
    await supa.from('payments').delete().eq('invoice_id', id);
    db.payments = (db.payments||[]).filter(p => p.invoiceId != id);
  }

  // อัปเดตสถานะบิล
  await supa.from('invoices').update({ status: newStatus }).eq('id', id);
  inv.status = newStatus;

  // บันทึก log ใน local
  if (!db.invoiceResetLogs) db.invoiceResetLogs = [];
  db.invoiceResetLogs.unshift(logData);

  toast(`✅ Reset บิล ${inv.docNo} เรียบร้อย → ${newStatus}`, 'success');
  closeModal('modal-invoice-reset');
  renderBilling();
}

function openInvoiceResetLogModal() {
  renderInvoiceResetLog();
  openModal('modal-invoice-reset-log');
}

function renderInvoiceResetLog() {
  const logs = db.invoiceResetLogs || [];
  const el = document.getElementById('invoice-reset-log-list');
  const STATUS_LABELS = { draft:'ร่าง', sent:'รอชำระ', partial:'ชำระบางส่วน', paid:'ชำระครบ' };

  if (!logs.length) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);">ยังไม่มีประวัติการ Reset</div>';
    return;
  }

  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="background:var(--bg2);position:sticky;top:0;">
      <th style="padding:10px 12px;text-align:left;">เวลา</th>
      <th style="padding:10px 12px;text-align:left;">เลขที่บิล</th>
      <th style="padding:10px 12px;text-align:left;">ผู้รับบริการ</th>
      <th style="padding:10px 12px;text-align:left;">สถานะเดิม</th>
      <th style="padding:10px 12px;text-align:left;">Reset เป็น</th>
      <th style="padding:10px 12px;text-align:right;">ยอดชำระเดิม</th>
      <th style="padding:10px 12px;text-align:left;">เหตุผล</th>
      <th style="padding:10px 12px;text-align:left;">ผู้ Reset</th>
    </tr></thead>
    <tbody>${logs.map(l => `<tr style="border-top:1px solid var(--border);">
      <td style="padding:9px 12px;font-size:11px;color:var(--text3);">${l.reset_at ? new Date(l.reset_at).toLocaleString('th-TH') : '-'}</td>
      <td style="padding:9px 12px;font-weight:600;font-family:monospace;">${l.doc_no||'-'}</td>
      <td style="padding:9px 12px;">${l.patient_name||'-'}</td>
      <td style="padding:9px 12px;"><span style="color:#c0392b;font-weight:600;">${STATUS_LABELS[l.old_status]||l.old_status||'-'}</span></td>
      <td style="padding:9px 12px;"><span style="color:#27ae60;font-weight:600;">${STATUS_LABELS[l.new_status]||l.new_status||'-'}</span></td>
      <td style="padding:9px 12px;text-align:right;">${l.old_paid_amount ? formatThb(l.old_paid_amount) : '-'}</td>
      <td style="padding:9px 12px;color:var(--text2);">${l.reason||'-'}</td>
      <td style="padding:9px 12px;font-size:12px;">${l.reset_by||'-'} <span style="color:var(--text3);">(${l.reset_by_role||'-'})</span></td>
    </tr>`).join('')}</tbody>
  </table>`;
}