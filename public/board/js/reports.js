/* Report a flyer/event, a vendor listing, or an unauthorized pin - a
   structured form (not a raw mailto:, which turns into unorganized email
   threads) that inserts into Supabase's `reports` table (V2 project -
   see supabase/migrations/0026_reports.sql and 0049_report_takedown_
   auto_suspend.sql, the second of which makes a report on a real vendor/
   event immediately suspend/hide it pending admin review). Reports show
   up in /admin/'s Reports tab.

   Previously wrote through getSupabase() (shared/supabase-client.js),
   which is hardcoded to the OLD V1 project (shared/supabase-config.js) -
   a different Supabase project than the one `reports` actually lives in
   (V2, same one lov_entries/vendors/etc. live in). Every report
   submitted through this form was silently going nowhere admins could
   ever see it. Fixed by writing directly to V2's REST API instead,
   matching how the rest of this file already reads V2 data. */
var REPORT_TAKEDOWN_DISCLAIMER = "Citypinned and Baypinned operate solely as user-driven directories. We do not host, authorize, or endorse listed events. Report flags trigger immediate review and temporary listing suspension pending investigation.";

// Cheap, no-dependency deterrent against scripted spam (the DB-side
// cooldown in migration 0052 is the real backstop against a determined
// human attacker) - a bot filling every field in a form dump will fill
// this honeypot too, and a script submitting instantly will trip the
// minimum-dwell-time check below.
var reportFormOpenedAt = 0;

function openReportForm(targetType, targetId, targetName) {
  reportFormOpenedAt = Date.now();
  var fp = document.getElementById("reportPanel");
  fp.innerHTML = "<div class='fi'><h2>Report " + escHtml(targetName) + "</h2>" +
    "<label>Reason *</label><select id='rpReason'>" +
    "<option value=''>Select a reason</option>" +
    "<option value='Unauthorized Solicitation'>Unauthorized Solicitation</option>" +
    "<option value='Incorrect Event Info'>Incorrect Event Info</option>" +
    "<option value='Safety Hazard'>Safety Hazard</option>" +
    "<option value='Intellectual Property / Trademark'>Intellectual Property / Trademark</option>" +
    "<option value='Inappropriate Content'>Inappropriate Content</option>" +
    "<option value='Fraudulent Flyer'>Fraudulent Flyer</option>" +
    "<option value='Misleading Information'>Misleading Information</option>" +
    "<option value='Other'>Other</option>" +
    "</select>" +
    "<label>Details (optional)</label><textarea id='rpDetails' placeholder='Describe the issue...'></textarea>" +
    "<input type='text' id='rpHoneypot' name='website' autocomplete='off' tabindex='-1' aria-hidden='true' style='position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;'>" +
    "<div id='rpErr' style='color:#c0392b;font-size:12px;margin-top:6px;display:none;'></div>" +
    "<p style='font-size:11px;line-height:1.5;color:rgba(90,65,30,.75);margin-top:14px;'>" + REPORT_TAKEDOWN_DISCLAIMER + "</p>" +
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
  if (!reason) {
    err.textContent = "Please pick a reason."; err.style.display = "block"; return;
  }
  var honeypot = document.getElementById("rpHoneypot");
  if (honeypot && honeypot.value) {
    // A field a real person never sees or fills got filled - silently
    // accept without actually submitting, same as a real success, so an
    // automated script gets no signal that it was caught.
    var doneFp = document.getElementById("reportPanel");
    doneFp.innerHTML = "<div class='fi'><h2>Report Submitted</h2><p style='font-size:13px;'>Thanks - our moderation team will review this.</p><div class='facts'><button class='bsub' id='rpDone'>Done</button></div></div>";
    document.getElementById("rpDone").onclick = closeReportForm;
    return;
  }
  if (Date.now() - reportFormOpenedAt < 2000) {
    err.textContent = "Please take a moment to review before submitting."; err.style.display = "block"; return;
  }
  if (typeof V2_SUPABASE_URL === "undefined") {
    err.textContent = "Couldn't reach the reporting service right now - check your connection and try again."; err.style.display = "block"; return;
  }
  var btn = document.getElementById("rpSubmit");
  btn.disabled = true; btn.textContent = "Submitting…";
  fetch(V2_SUPABASE_URL + "/rest/v1/reports", {
    method: "POST",
    headers: { apikey: V2_SUPABASE_ANON_KEY, Authorization: "Bearer " + V2_SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ target_type: targetType, target_id: String(targetId), target_name: targetName, reason: reason, details: details || null })
  }).then(function (res) {
    btn.disabled = false; btn.textContent = "Submit Report";
    if (!res.ok) {
      return res.text().then(function (t) { err.textContent = t || "Could not submit report."; err.style.display = "block"; });
    }
    var fp = document.getElementById("reportPanel");
    fp.innerHTML = "<div class='fi'><h2>Report Submitted</h2><p style='font-size:13px;'>Thanks - our moderation team will review this. The listing has been temporarily hidden pending review.</p><div class='facts'><button class='bsub' id='rpDone'>Done</button></div></div>";
    document.getElementById("rpDone").onclick = closeReportForm;
  }).catch(function () {
    btn.disabled = false; btn.textContent = "Submit Report";
    err.textContent = "Could not reach the reporting service. Please try again."; err.style.display = "block";
  });
}
