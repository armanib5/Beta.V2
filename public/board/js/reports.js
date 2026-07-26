/* Report a flyer/event or a vendor listing - a structured form (not a
   raw mailto:, which turns into unorganized email threads) that inserts
   into Supabase's `reports` table. Public users can only INSERT, not
   read - see supabase/migration_reports.sql, which must be run once in
   the Supabase project before this works (same one-time step as the
   original schema.sql). Reports show up in /admin/'s Reports tab. */

function openReportForm(targetType, targetId, targetName) {
  var fp = document.getElementById("reportPanel");
  fp.innerHTML = "<div class='fi'><h2>Report " + escHtml(targetName) + "</h2>" +
    "<label>Reason *</label><select id='rpReason'>" +
    "<option value=''>Select a reason</option>" +
    "<option value='Inappropriate Content'>Inappropriate Content</option>" +
    "<option value='Fraudulent Flyer'>Fraudulent Flyer</option>" +
    "<option value='Misleading Information'>Misleading Information</option>" +
    "<option value='Other'>Other</option>" +
    "</select>" +
    "<label>Details *</label><textarea id='rpDetails' placeholder='Describe the issue...'></textarea>" +
    "<div id='rpErr' style='color:#c0392b;font-size:12px;margin-top:6px;display:none;'></div>" +
    "<p style='font-size:11px;line-height:1.5;color:rgba(90,65,30,.75);margin-top:14px;'>" + PLATFORM_DISCLAIMER + "</p>" +
    "<div class='facts'><button class='bcan' id='rpCancel'>Cancel</button><button class='bsub' id='rpSubmit'>Submit Report</button></div>" +
    "</div>";
  document.getElementById("rpCancel").onclick = closeReportForm;
  document.getElementById("rpSubmit").onclick = function () { submitReport(targetType, targetId, targetName); };
  document.getElementById("reportOv").classList.add("on");
}

function closeReportForm() {
  document.getElementById("reportOv").classList.remove("on");
  document.getElementById("reportPanel").innerHTML = "";
}

function submitReport(targetType, targetId, targetName) {
  var reason = document.getElementById("rpReason").value;
  var details = document.getElementById("rpDetails").value.trim();
  var err = document.getElementById("rpErr");
  if (!reason || !details) {
    err.textContent = "Please pick a reason and add details."; err.style.display = "block"; return;
  }
  var sb = getSupabase();
  if (!sb) {
    err.textContent = "Couldn't reach the reporting service right now - check your connection and try again."; err.style.display = "block"; return;
  }
  var btn = document.getElementById("rpSubmit");
  btn.disabled = true; btn.textContent = "Submitting…";
  sb.from("reports").insert({
    target_type: targetType, target_id: String(targetId), target_name: targetName,
    reason: reason, details: details
  }).then(function (res) {
    btn.disabled = false; btn.textContent = "Submit Report";
    if (res.error) { err.textContent = res.error.message; err.style.display = "block"; return; }
    var fp = document.getElementById("reportPanel");
    fp.innerHTML = "<div class='fi'><h2>Report Submitted</h2><p style='font-size:13px;'>Thanks - our moderation team will review this.</p><div class='facts'><button class='bsub' id='rpDone'>Done</button></div></div>";
    document.getElementById("rpDone").onclick = closeReportForm;
  });
}
