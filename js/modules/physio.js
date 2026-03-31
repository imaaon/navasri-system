// ===== PHYSIO MODULE =====

function getThaiMonths() {
  var months = ["à¸¡à¸à¸£à¸²à¸à¸¡","à¸à¸¸à¸¡à¸ à¸²à¸à¸±à¸à¸à¹","à¸¡à¸µà¸à¸²à¸à¸¡","à¹à¸¡à¸©à¸²à¸¢à¸","à¸à¸¤à¸©à¸ à¸²à¸à¸¡","à¸¡à¸´à¸à¸¸à¸à¸²à¸¢à¸","à¸à¸£à¸à¸à¸²à¸à¸¡","à¸ªà¸´à¸à¸«à¸²à¸à¸¡","à¸à¸±à¸à¸¢à¸²à¸¢à¸","à¸à¸¸à¸¥à¸²à¸à¸¡","à¸à¸¤à¸¨à¸à¸´à¸à¸²à¸¢à¸","à¸à¸±à¸à¸§à¸²à¸à¸¡"];
  var now = new Date();
  var opts = [];
  for (var i = 0; i < 6; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var val = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
    var label = months[d.getMonth()] + " " + (d.getFullYear()+543);
    opts.push({ val: val, label: label });
  }
  return opts;
}

function calcPhysioAmount() {
  var dur = parseInt(document.getElementById("physio-duration").value || 60);
  var rate = parseFloat(document.getElementById("physio-rate").value || 0);
  var amt = Math.round((dur / 60) * rate * 100) / 100;
  var el = document.getElementById("physio-amount");
  if (el) el.value = amt.toLocaleString("th-TH", { minimumFractionDigits: 2 });
  return amt;
}

function openPhysioSessionModal(patientId, patientName, editId) {
  editId = editId || null;
  var p = db.patients.find(function(x) { return String(x.id) === String(patientId); });
  document.getElementById("physio-patient-id").value = patientId;
  document.getElementById("physio-patient-id").dataset.currentPatient = patientId;
  document.getElementById("physio-patient-name").value = patientName || (p ? p.name : "");
  document.getElementById("physio-session-id").value = editId || "";
  document.getElementById("physio-note").value = "";
  document.getElementById("physio-amount").value = "0.00";
  var today = new Date().toISOString().split("T")[0];
  document.getElementById("physio-date").value = today;
  document.getElementById("physio-rate").value = (p && p.physioRatePerHour) ? p.physioRatePerHour : 0;
  if (p && p.physioHoursPerDay) {
    var mins = p.physioHoursPerDay * 60;
    var sel = document.getElementById("physio-duration");
    var match = Array.from(sel.options).find(function(o) { return parseInt(o.value) === mins; });
    if (match) sel.value = String(mins); else sel.value = "60";
  } else {
    document.getElementById("physio-duration").value = "60";
  }
  var sel2 = document.getElementById("physio-therapist-id");
  if (sel2) {
    sel2.innerHTML = "<option value=\"\">à¹à¸¥à¸·à¸­à¸à¸à¸à¸±à¸à¸à¸²à¸</option>" +
      (db.staff || []).filter(function(s) { return !s.endDate || s.endDate >= today; })
      .map(function(s) { return "<option value=\"" + s.id + "\">" + s.name + "</option>"; }).join("");
  }
  var titleEl = document.getElementById("modal-physio-title");
  if (titleEl) titleEl.textContent = editId ? "âï¸ à¹à¸à¹à¹à¸ Session" : "ð¤¸ à¸à¸±à¸à¸à¸¶à¸à¸à¸²à¸¢à¸ à¸²à¸";
  if (editId) loadPhysioSessionForEdit(editId);
  openModal("modal-physio-session");
}

async function loadPhysioSessionForEdit(sessionId) {
  var result = await supa.from("physio_sessions").select("*").eq("id", sessionId).single();
  var data = result.data;
  if (!data) return;
  document.getElementById("physio-date").value = data.session_date;
  document.getElementById("physio-duration").value = String(data.duration_minutes);
  document.getElementById("physio-rate").value = data.rate_per_hour;
  document.getElementById("physio-note").value = data.note || "";
  document.getElementById("physio-therapist-id").value = data.therapist_id || "";
  calcPhysioAmount();
}

async function savePhysioSession() {
  if (!canManagePhysio()) { toast("à¹à¸¡à¹à¸¡à¸µà¸ªà¸´à¸à¸à¸´à¹à¸à¸±à¸à¸à¸¶à¸", "error"); return; }
  var patientId = document.getElementById("physio-patient-id").value;
  var sessionId = document.getElementById("physio-session-id").value;
  var date = document.getElementById("physio-date").value;
  var duration = parseInt(document.getElementById("physio-duration").value);
  var rate = parseFloat(document.getElementById("physio-rate").value) || 0;
  var note = document.getElementById("physio-note").value.trim();
  var therapistId = document.getElementById("physio-therapist-id").value || null;
  var therapist = (db.staff && therapistId) ? db.staff.find(function(s) { return String(s.id) === String(therapistId); }) : null;
  if (!date) { toast("à¸à¸£à¸¸à¸à¸²à¹à¸¥à¸·à¸­à¸à¸§à¸±à¸à¸à¸µà¹", "warning"); return; }
  if (!duration) { toast("à¸à¸£à¸¸à¸à¸²à¹à¸¥à¸·à¸­à¸à¸£à¸°à¸¢à¸°à¹à¸§à¸¥à¸²", "warning"); return; }
  if (!rate) { toast("à¸à¸£à¸¸à¸à¸²à¸£à¸°à¸à¸¸à¸£à¸²à¸à¸²", "warning"); return; }
  var row = {
    patient_id: patientId, therapist_id: therapistId,
    therapist_name: therapist ? therapist.name : null,
    session_date: date, duration_minutes: duration,
    rate_per_hour: rate, note: note || null,
    created_by: currentUser ? currentUser.username : null
  };
  var res;
  if (sessionId) {
    res = await supa.from("physio_sessions").update(row).eq("id", sessionId);
  } else {
    res = await supa.from("physio_sessions").insert(row);
  }
  if (res.error) { toast("à¸à¸±à¸à¸à¸¶à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸: " + res.error.message, "error"); return; }
  toast(sessionId ? "à¹à¸à¹à¹à¸à¹à¸£à¸µà¸¢à¸à¸£à¹à¸­à¸¢" : "à¸à¸±à¸à¸à¸¶à¸à¹à¸£à¸µà¸¢à¸à¸£à¹à¸­à¸¢", "success");
  closeModal("modal-physio-session");
  renderPhysioTab(patientId);
}

async function renderPhysioTab(patientId) {
  var summaryEl = document.getElementById("physio-summary-" + patientId);
  var listEl = document.getElementById("physio-list-" + patientId);
  if (!summaryEl || !listEl) return;
  listEl.innerHTML = "<div style=\"text-align:center;padding:20px;\">â³ à¹à¸«à¸¥à¸...</div>";
  var now = new Date();
  var month = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0");
  var startDate = month + "-01";
  var endDate = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split("T")[0];
  var filterEl = document.getElementById("physio-month-filter");
  if (filterEl) {
    if (filterEl.options.length === 0) {
      getThaiMonths().forEach(function(m, i) {
        var opt = document.createElement("option");
        opt.value = m.val; opt.textContent = m.label;
        if (i === 0) opt.selected = true;
        filterEl.appendChild(opt);
      });
      filterEl.onchange = function() { renderPhysioTab(patientId); };
    }
    var parts = filterEl.value.split("-");
    if (parts.length === 2) {
      startDate = filterEl.value + "-01";
      endDate = new Date(parseInt(parts[0]), parseInt(parts[1]), 0).toISOString().split("T")[0];
    }
  }
  var result = await supa.from("physio_sessions").select("*").eq("patient_id", patientId).order("session_date", { ascending: false });
  var sessions = result.data;
  var error = result.error;
  if (error) { listEl.innerHTML = "<div style=\"color:red;padding:16px;\">Error: " + error.message + "</div>"; return; }
  var totalMins = (sessions||[]).reduce(function(s,x) { return s + x.duration_minutes; }, 0);
  var totalAmt = (sessions||[]).reduce(function(s,x) { return s + parseFloat(x.amount||0); }, 0);
  var billedAmt = (sessions||[]).filter(function(x) { return x.billed; }).reduce(function(s,x) { return s + parseFloat(x.amount||0); }, 0);
  var unbilledAmt = totalAmt - billedAmt;
  summaryEl.innerHTML = "<div style=\"text-align:center;\"><div style=\"font-size:11px;color:var(--text3);\">à¸à¸³à¸à¸§à¸ Session</div><div style=\"font-size:20px;font-weight:700;color:var(--accent);\">" + (sessions||[]).length + "</div></div><div style=\"text-align:center;\"><div style=\"font-size:11px;color:var(--text3);\">à¸¢à¸±à¸à¹à¸¡à¹à¸£à¸§à¸¡à¸à¸´à¸¥</div><div style=\"font-size:20px;font-weight:700;color:#e67e22;\">" + unbilledAmt.toLocaleString("th-TH",{minimumFractionDigits:0}) + " à¸¿</div></div><div style=\"text-align:center;\"><div style=\"font-size:11px;color:var(--text3);\">à¸£à¸§à¸¡à¹à¸à¸à¸´à¸¥</div><div style=\"font-size:20px;font-weight:700;color:#27ae60;\">" + billedAmt.toLocaleString("th-TH",{minimumFractionDigits:0}) + " à¸¿</div></div>";
  var p = db.patients.find(function(x) { return String(x.id) === String(patientId); });
  var patName = p ? p.name.replace(/'/g, "\\'") : "";
  var addBtn = "<button class=\"btn btn-primary btn-sm\" onclick=\"openPhysioSessionModal('" + patientId + "','" + patName + "')\" style=\"margin-bottom:12px;\">à¸à¸±à¸à¸à¸¶à¸ Session</button>";
  if (!sessions || sessions.length === 0) {
    listEl.innerHTML = addBtn + "<div style=\"text-align:center;padding:32px;color:var(--text3);\">à¸¢à¸±à¸à¹à¸¡à¹à¸¡à¸µà¸à¸±à¸à¸à¸¶à¸à¹à¸à¹à¸à¸·à¸­à¸à¸à¸µà¹</div>";
    return;
  }
  var rows = (sessions||[]).map(function(s) {
    var hrs = s.duration_minutes >= 60 ? Math.floor(s.duration_minutes/60) + " à¸à¸¡." : s.duration_minutes + " à¸.";
    var amt = parseFloat(s.amount||0).toLocaleString("th-TH",{minimumFractionDigits:2});
    var editBtn = !s.billed
      ? "<button class=\"btn btn-ghost btn-xs\" onclick=\"openPhysioSessionModal('" + patientId + "','" + patName + "','" + s.id + "')\">âï¸</button> <button class=\"btn btn-ghost btn-xs\" style=\"color:#c0392b;\" onclick=\"deletePhysioSession('" + s.id + "','" + patientId + "')\">ðï¸</button>"
      : "<span style=\"font-size:11px;color:var(--text3);\">à¸¥à¹à¸­à¸</span>";
    return "<tr><td>" + s.session_date + "</td><td>" + hrs + "</td><td>" + (s.therapist_name||"-") + "</td><td style=\"text-align:right;font-weight:600;\">" + amt + "</td><td>" + editBtn + "</td></tr>";
  }).join("");
  listEl.innerHTML = addBtn + "<div class=\"table-wrap\"><table><thead><tr><th>à¸§à¸±à¸à¸à¸µà¹</th><th>à¹à¸§à¸¥à¸²</th><th>à¸à¸±à¸à¸à¸²à¸¢à¸ à¸²à¸</th><th>à¸¢à¸­à¸</th><th></th></tr></thead><tbody>" + rows + "</tbody></table></div>";
}

async function deletePhysioSession(sessionId, patientId) {
  if (!canManagePhysio()) { toast("à¹à¸¡à¹à¸¡à¸µà¸ªà¸´à¸à¸à¸´à¹à¸¥à¸", "error"); return; }
  if (!confirm("à¸¥à¸ Session à¸à¸µà¹?")) return;
  var res = await supa.from("physio_sessions").delete().eq("id", sessionId);
  if (res.error) { toast("à¸¥à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸: " + res.error.message, "error"); return; }
  toast("à¸¥à¸à¹à¸£à¸µà¸¢à¸à¸£à¹à¸­à¸¢", "success");
  renderPhysioTab(patientId);
}

async function loadPhysioUnbilledForInvoice(patientId, yearMonth) {
  var res = await supa.rpc("get_physio_unbilled", { p_patient_id: patientId, p_year_month: yearMonth });
  if (res.error) return null;
  return res.data;
}

async function exportPhysioExcel() {
  var res = await supa.from("physio_sessions").select("*, patients(name)").order("session_date", {ascending: false}).limit(1000);
  if (res.error) { toast("à¹à¸«à¸¥à¸à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸", "error"); return; }
  var rows = [["#","à¸§à¸±à¸à¸à¸µà¹","à¸à¸¹à¹à¸£à¸±à¸à¸à¸£à¸´à¸à¸²à¸£","à¸à¸±à¸à¸à¸²à¸¢à¸ à¸²à¸","à¹à¸§à¸¥à¸² (à¸à¸²à¸à¸µ)","à¸¢à¸­à¸","à¹à¸£à¸µà¸¢à¸à¹à¸à¹à¸"]];
  (res.data || []).forEach(function(s, i) {
    rows.push([i+1, s.session_date||"", (s.patients && s.patients.name)||"", s.therapist_name||"", s.duration_minutes||0, s.amount||0, s.billed ? "à¹à¸¥à¹à¸§" : "à¸¢à¸±à¸à¹à¸¡à¹"]);
  });
  if (typeof _xlsxDownload === "function") _xlsxDownload(rows, "à¸à¸²à¸¢à¸ à¸²à¸", "navasri_physio_" + new Date().toISOString().slice(0,10));
}