/* =========================================
   RosterFlow — Unified Script (Add + Dashboard + Calendar + Income + Conflicts)
   ========================================= */

/* =========================================
   🔐 Supabase Authentication + Cloud Sync Setup
   ========================================= */

   
import { supabase } from "./supabase.js";

let currentUser = null;
let shifts = [];
let workplaces = [];

/* ---------- INITIAL SETUP ---------- */
(async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = data.user;
  await loadWorkplaces();
  await loadShifts();

  if (document.getElementById("shiftForm")) initAddShiftPage();
  if (document.getElementById("dashboardSummary")) initDashboard();
  if (document.getElementById("calendarContainer") || document.getElementById("calendarHeatmapGrid")) renderDetailedCalendar();
  if (document.getElementById("incomeFlowChart")) initIncomePage();
  if (document.getElementById("conflictList")) initConflictsPage();
})();

/* ---------- Supabase Helpers ---------- */

// Save workplace
async function saveWorkplace(name) {
  const { error } = await supabase.from("workplaces").insert([{ name, user_id: currentUser.id }]);
  if (error) console.error("Error saving workplace:", error);
}

// Save shift
async function saveShift(shift) {
  const { error } = await supabase.from("shifts").insert([{ ...shift, user_id: currentUser.id }]);
  if (error) console.error("Error saving shift:", error);
}

// Fetch all workplaces
async function loadWorkplaces() {
  const { data, error } = await supabase
    .from("workplaces")
    .select("*")
    .eq("user_id", currentUser.id);
  if (!error) workplaces = data.map(w => w.name);
}

// Fetch all shifts
async function loadShifts() {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("date", { ascending: true });
  if (!error) shifts = data || [];
}

/* =========================================
   COMMON HELPERS
   ========================================= */
function getWeek(date) {
  const d = new Date(date);
  const start = new Date(d.setDate(d.getDate() - d.getDay())); // Sunday
  return start.toISOString().slice(0, 10);
}

function checkOverlap(a, b) {
  const a1 = new Date(`${a.date}T${a.start_time}`);
  const a2 = new Date(`${a.date}T${a.end_time}`);
  const b1 = new Date(`${b.date}T${b.start_time}`);
  const b2 = new Date(`${b.date}T${b.end_time}`);
  return a1 < b2 && b1 < a2;
}

/* =========================================
   PAGE: ADD SHIFTS
   ========================================= */
async function initAddShiftPage() {
  const jobSelect = document.getElementById("job");

  // Populate workplaces
  workplaces.forEach(w => {
    const o = document.createElement("option");
    o.value = o.textContent = w;
    jobSelect.appendChild(o);
  });

  // Add new workplace
  const workplaceForm = document.getElementById("workplaceForm");
  if (workplaceForm) {
    workplaceForm.onsubmit = async e => {
      e.preventDefault();
      const name = document.getElementById("newWorkplace").value.trim();
      if (name && !workplaces.includes(name)) {
        workplaces.push(name);
        await saveWorkplace(name);
        const o = document.createElement("option");
        o.value = o.textContent = name;
        jobSelect.appendChild(o);
        jobSelect.value = name;
        document.getElementById("newWorkplace").value = "";
      }
    };
  }

  // Add new shift
  document.getElementById("shiftForm").onsubmit = async e => {
    e.preventDefault();
    const job = jobSelect.value;
    const dateVal = document.getElementById("date").value;
    const startVal = document.getElementById("start").value;
    const endVal = document.getElementById("end").value;
    const rateVal = parseFloat(document.getElementById("rate").value) || 30;
    const notesVal = document.getElementById("notes").value.trim();

    if (!job) {
      alert("Please add or select a workplace first.");
      return;
    }

    const hours = (new Date(`${dateVal}T${endVal}`) - new Date(`${dateVal}T${startVal}`)) / 3600000;
    if (hours > 0) {
      const shift = {
        job,
        date: dateVal,
        start_time: startVal,
        end_time: endVal,
        hours,
        income: hours * rateVal,
        notes: notesVal
      };
      await saveShift(shift);
      alert("Shift added!");
      await reloadShiftTable();
    } else {
      alert("End time must be after start time.");
    }
  };

  await reloadShiftTable();
}

// Reload and render shifts table
async function reloadShiftTable() {
  await loadShifts();
  const tbody = document.querySelector("#shiftsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  shifts.forEach(s => {
    const r = document.createElement("tr");
    r.innerHTML = `
      <td>${s.job}</td>
      <td>${s.date}</td>
      <td>${s.start_time}</td>
      <td>${s.end_time}</td>
      <td>${s.hours.toFixed(2)}</td>
      <td>$${s.income.toFixed(2)}</td>
      <td>${s.notes || "-"}</td>
      <td><button onclick="deleteShift(${s.id})" style="background:red">Delete</button></td>
    `;
    tbody.appendChild(r);
  });
}

// Delete shift
async function deleteShift(id) {
  if (!id) {
    alert("Missing shift ID.");
    return;
  }

  if (!confirm("Are you sure you want to delete this shift?")) return;

  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) {
    alert("Error deleting shift: " + error.message);
  } else {
    alert("Shift deleted!");
    await reloadShiftTable(); // ✅ Wait for table to refresh
  }
}


/* =========================================
   PAGE: DASHBOARD
   ========================================= */
function initDashboard() {
  const weekly = {};
  shifts.forEach(s => {
    const w = getWeek(s.date);
    weekly[w] ??= { total: 0, income: 0 };
    weekly[w].total += s.hours;
    weekly[w].income += s.income;
  });

  // Weekly Summary
  const summaryContainer = document.getElementById("weeklyCards");
  summaryContainer.innerHTML = Object.entries(weekly)
    .map(([w, v]) => `
      <div class="summary-card">
        <h3>Week of ${w}</h3>
        <p><strong>${v.total.toFixed(1)} hrs</strong></p>
        <p>$${v.income.toFixed(2)} earned</p>
      </div>
    `)
    .join('') || `<p>No shifts added yet.</p>`;

  // Work restriction tracker
  const restrictionDiv = document.getElementById("restrictionSection");
  restrictionDiv.innerHTML = "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const fortnightStart = new Date(weekStart);
  fortnightStart.setDate(weekStart.getDate() - 7);

  let weekHours = 0, fortnightHours = 0;
  shifts.forEach(s => {
    const shiftDate = new Date(s.date + "T00:00");
    if (shiftDate >= weekStart) weekHours += s.hours;
    if (shiftDate >= fortnightStart) fortnightHours += s.hours;
  });

  const createProgressBar = (value, max, color) => {
    const percent = Math.min((value / max) * 100, 100);
    return `
      <div style="background:#ddd;border-radius:10px;overflow:hidden;width:100%;height:16px;margin-top:4px;">
        <div style="width:${percent}%;background:${color};height:100%;transition:width 0.3s;"></div>
      </div>`;
  };

  const weekColor = weekHours > 24 ? "red" : weekHours > 20 ? "orange" : "#28a745";
  const fortnightColor = fortnightHours > 48 ? "red" : fortnightHours > 40 ? "orange" : "#28a745";

  restrictionDiv.innerHTML = `
    <p><strong>This Week:</strong> ${weekHours.toFixed(1)} hrs / 24 hrs</p>
    ${createProgressBar(weekHours, 24, weekColor)}
    <p><strong>This Fortnight:</strong> ${fortnightHours.toFixed(1)} hrs / 48 hrs</p>
    ${createProgressBar(fortnightHours, 48, fortnightColor)}
  `;

  // Charts (reuse your original chart logic)
  renderCharts();
}

function renderCharts() {
  if (shifts.length === 0) return;
  const ctx1 = document.getElementById("hoursChart");
  const ctx2 = document.getElementById("incomeChart");

  const hoursByWorkplace = {};
  shifts.forEach(shift => {
    const job = shift.job || "Other";
    hoursByWorkplace[job] = (hoursByWorkplace[job] || 0) + shift.hours;
  });

  const jobNames = Object.keys(hoursByWorkplace);
  const jobHours = Object.values(hoursByWorkplace);

  if (window.hoursChart && window.hoursChart.destroy) window.hoursChart.destroy();
  window.hoursChart = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: jobNames,
      datasets: [{
        label: "Hours by Workplace",
        data: jobHours,
        backgroundColor: ['#c8b6ff', '#a0e7e5', '#ffb7c5', '#ffd6a5', '#bde0fe'],
        borderRadius: 8
      }]
    },
    options: { plugins: { legend: { display: false } } }
  });

  const weeklyIncome = {};
  shifts.forEach(s => {
    const w = getWeek(s.date);
    weeklyIncome[w] ??= { income: 0 };
    weeklyIncome[w].income += s.income;
  });

  const weeks = Object.keys(weeklyIncome);
  const inc = weeks.map(w => weeklyIncome[w].income);

  if (window.incomeChart && window.incomeChart.destroy) window.incomeChart.destroy();
  window.incomeChart = new Chart(ctx2, {
    type: "line",
    data: {
      labels: weeks,
      datasets: [{
        label: "Weekly Income (AUD)",
        data: inc,
        borderColor: "#a78bfa",
        backgroundColor: "rgba(200,182,255,0.2)",
        fill: true,
        tension: 0.4
      }]
    }
  });
}

/* =========================================
   PAGE: CALENDAR
   ========================================= */
function renderDetailedCalendar() {
  const container = document.getElementById("calendarContainer");
  const calendarDiv = document.getElementById("calendarHeatmapGrid");

  if (!container && !calendarDiv) return;

  if (shifts.length === 0) {
    if (container) container.innerHTML = `<p>No shifts found.</p>`;
    if (calendarDiv) calendarDiv.innerHTML = `<p>No shifts recorded yet.</p>`;
    return;
  }

  // Group shifts by date
  const grouped = {};
  shifts.forEach(shift => {
    if (!grouped[shift.date]) grouped[shift.date] = [];
    grouped[shift.date].push(shift);
  });

  if (container) {
    container.innerHTML = "";
    Object.keys(grouped)
      .sort((a, b) => new Date(a) - new Date(b))
      .forEach(date => {
        const card = document.createElement("div");
        card.className = "calendar-date-card";
        card.innerHTML = `
          <h3>${new Date(date).toDateString()}</h3>
          <ul>
            ${grouped[date]
              .map(shift => `
                <li>
                  <strong>${shift.job}</strong> • ${shift.start_time}–${shift.end_time} 
                  (${shift.hours.toFixed(2)} hrs, $${shift.income.toFixed(2)})
                </li>
              `)
              .join("")}
          </ul>
        `;
        container.appendChild(card);
      });
  }
}

/* =========================================
   PAGE: INCOME
   ========================================= */
function initIncomePage() {
  if (shifts.length === 0) {
    document.getElementById("incomeSummary").innerHTML = `<p>No income data yet.</p>`;
    return;
  }

  const weeklyIncome = {};
  shifts.forEach(s => {
    const w = getWeek(s.date);
    weeklyIncome[w] = (weeklyIncome[w] || 0) + s.income;
  });

  const weeks = Object.keys(weeklyIncome).sort((a, b) => new Date(a) - new Date(b));
  const incomes = weeks.map(w => weeklyIncome[w]);

  new Chart(document.getElementById("incomeFlowChart"), {
    type: "line",
    data: {
      labels: weeks,
      datasets: [{
        label: "Weekly Income (AUD)",
        data: incomes,
        borderColor: "#a78bfa",
        backgroundColor: "rgba(200,182,255,0.25)",
        fill: true,
        tension: 0.4
      }]
    }
  });

  const now = new Date();
  const thisMonth = now.getMonth();
  const monthly = shifts.filter(s => new Date(s.date).getMonth() === thisMonth)
                        .reduce((sum, s) => sum + s.income, 0);
  const total = shifts.reduce((sum, s) => sum + s.income, 0);

  document.getElementById("incomeSummary").innerHTML = `
    <strong>This Month:</strong> $${monthly.toFixed(2)}<br>
    <strong>Total Overall:</strong> $${total.toFixed(2)}
  `;
}

/* =========================================
   PAGE: CONFLICTS
   ========================================= */
function initConflictsPage() {
  const list = document.getElementById("conflictList");
  if (!list) return;

  if (shifts.length === 0) {
    list.innerHTML = `<p class="no-conflicts">No shifts added yet.</p>`;
    return;
  }

  const conflicts = [];
  shifts.sort((a, b) => new Date(a.date) - new Date(b.date));

  for (let i = 0; i < shifts.length; i++) {
    for (let j = i + 1; j < shifts.length; j++) {
      const s1 = shifts[i];
      const s2 = shifts[j];
      if (s1.date === s2.date && checkOverlap(s1, s2)) {
        const startA = new Date(`${s1.date}T${s1.start_time}`);
        const endA = new Date(`${s1.date}T${s1.end_time}`);
        const startB = new Date(`${s2.date}T${s2.start_time}`);
        const endB = new Date(`${s2.date}T${s2.end_time}`);
        const overlapStart = new Date(Math.max(startA, startB));
        const overlapEnd = new Date(Math.min(endA, endB));
        const overlapHours = (overlapEnd - overlapStart) / 3600000;

        conflicts.push({ date: s1.date, s1, s2, overlapStart, overlapEnd, overlapHours });
      }
    }
  }

  if (conflicts.length > 0) {
    conflicts.forEach(c => {
      const li = document.createElement("li");
      li.className = "conflict-item";
      const formatTime = t => t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      li.innerHTML = `
        <h3>${new Date(c.date).toDateString()}</h3>
        <p><strong>${c.s1.job}</strong> (${c.s1.start_time}–${c.s1.end_time}) overlaps with 
           <strong>${c.s2.job}</strong> (${c.s2.start_time}–${c.s2.end_time})</p>
        <p>⚠️ Overlap: ${formatTime(c.overlapStart)}–${formatTime(c.overlapEnd)} 
           (${c.overlapHours.toFixed(2)} hrs)</p>
      `;
      list.appendChild(li);
    });
  } else {
    list.innerHTML = `<p class="no-conflicts">✅ No overlapping shifts detected!</p>`;
  }
}

/* =========================================
   LOGOUT
   ========================================= */
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
}
