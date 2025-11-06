/* =========================================
   RosterFlow — Unified Script (Add + Dashboard + Calendar + Income + Conflicts)
   ========================================= */

/* =========================================
   🔐 Supabase Authentication + Cloud Sync Setup
   ========================================= */

import { supabase } from "./supabase.js";

let currentUser = null;
window.shifts = [];
window.workplaces = [];

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
  if (document.getElementById("calendarContainer") || document.getElementById("calendarHeatmapGrid")) {
    renderCalendarHeatmap();
    renderDetailedCalendar();
  }
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
// Save shift (and return inserted record)
async function saveShift(shift) {
  const { data, error } = await supabase
    .from("shifts")
    .insert([{ ...shift, user_id: currentUser.id }])
    .select(); // ✅ ensures Supabase returns the inserted row(s)
  if (error) console.error("Error saving shift:", error);
  else console.log("✅ Saved shift:", data);
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
  if (!error) {
    window.shifts = data || [];
    console.log("✅ Loaded shifts:", window.shifts);
  }
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
// Reload and render shifts table
async function reloadShiftTable() {
  await loadShifts();
  const tbody = document.querySelector("#shiftsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  window.shifts.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.job}</td>
      <td>${s.date}</td>
      <td>${s.start_time}</td>
      <td>${s.end_time}</td>
      <td>${s.hours.toFixed(2)}</td>
      <td>$${s.income.toFixed(2)}</td>
      <td>${s.notes || "-"}</td>
      <td><button class="delete-btn" data-id="${s.id}" style="background:red;color:white;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;">Delete</button></td>
    `;
    tbody.appendChild(tr);
  });

  // ✅ Attach event listeners safely
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      if (!id) {
        alert("Shift ID missing — cannot delete this shift.");
        return;
      }
      const confirmed = confirm("Are you sure you want to delete this shift?");
      if (!confirmed) return;

      const { error } = await supabase.from("shifts").delete().eq("id", id);
      if (error) {
        alert("Error deleting shift: " + error.message);
      } else {
        alert("Shift deleted successfully!");
        await reloadShiftTable();
      }
    });
  });
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

  const summaryContainer = document.getElementById("weeklyCards");
  summaryContainer.innerHTML = Object.entries(weekly)
    .map(([w, v]) => `
      <div class="summary-card glass-card">
        <h3>Week of ${w}</h3>
        <p><strong>${v.total.toFixed(1)} hrs</strong></p>
        <p>$${v.income.toFixed(2)} earned</p>
      </div>
    `)
    .join('') || `<p>No shifts added yet.</p>`;

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

  if (shifts.length > 0) renderCharts();
}

/* =========================================
   VISUAL CHARTS
   ========================================= */
function renderCharts() {
  const ctx1 = document.getElementById("hoursChart");
  const ctx2 = document.getElementById("incomeChart");
  const ctx3 = document.getElementById("hoursDonutChart");
  const ctx4 = document.getElementById("incomeDonutChart");

  if (!ctx1 || !ctx2) return;

  const hoursByWorkplace = {};
  shifts.forEach(shift => {
    const job = shift.job || "Other";
    hoursByWorkplace[job] = (hoursByWorkplace[job] || 0) + shift.hours;
  });

  const jobNames = Object.keys(hoursByWorkplace);
  const jobHours = Object.values(hoursByWorkplace);
  const colors = ['#c8b6ff', '#a0e7e5', '#ffb7c5', '#ffd6a5', '#bde0fe'];

  if (window.hoursChart && typeof window.hoursChart.destroy === "function") window.hoursChart.destroy();
  window.hoursChart = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: jobNames,
      datasets: [{
        label: "Hours by Workplace",
        data: jobHours,
        backgroundColor: colors.slice(0, jobNames.length),
        borderRadius: 8
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Work Hours by Workplace",
          font: { family: "Outfit", size: 18, weight: 600 },
          color: "#2d2d2d"
        }
      },
      scales: {
        x: { ticks: { color: "#333" }, grid: { display: false } },
        y: { ticks: { color: "#333" }, beginAtZero: true }
      }
    }
  });

  const weeklyIncome = {};
  shifts.forEach(s => {
    const w = getWeek(s.date);
    weeklyIncome[w] ??= { income: 0 };
    weeklyIncome[w].income += s.income;
  });

  const weeks = Object.keys(weeklyIncome);
  const inc = weeks.map(w => weeklyIncome[w].income);

  if (window.incomeChart && typeof window.incomeChart.destroy === "function") window.incomeChart.destroy();
  window.incomeChart = new Chart(ctx2, {
    type: "line",
    data: {
      labels: weeks,
      datasets: [{
        label: "Weekly Income (AUD)",
        data: inc,
        borderColor: "#a78bfa",
        backgroundColor: "rgba(200,182,255,0.2)",
        tension: 0.4,
        pointBackgroundColor: "#ffb7c5",
        pointRadius: 5,
        fill: true
      }]
    },
    options: { plugins: { legend: { position: "bottom" } } }
  });
}

/* =========================================
   CALENDAR HEATMAP (Fixed)
   ========================================= */
async function renderCalendarHeatmap() {
  const calendarDiv = document.getElementById("calendarHeatmapGrid");
  if (!calendarDiv) return;

  const shifts = window.shifts || [];
  calendarDiv.innerHTML = "";

  if (shifts.length === 0) {
    calendarDiv.innerHTML = "<p>No shifts recorded yet.</p>";
    return;
  }

  const dayHours = {};
  shifts.forEach(s => {
    dayHours[s.date] = (dayHours[s.date] || 0) + s.hours;
  });

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });

  const heading = document.querySelector("h2");
  if (heading && !document.getElementById("monthLabel")) {
    heading.insertAdjacentHTML("afterend", `
      <p id="monthLabel" style="color:#555;font-weight:500;margin-top:-10px;margin-bottom:18px;">
        ${monthName}
      </p>
    `);
  }

  const getColor = (hrs) => {
    if (hrs === 0) return "#f4f1ff";
    if (hrs < 3) return "#c4b5fd";
    if (hrs < 6) return "#7dd3fc";
    if (hrs < 9) return "#f9a8d4";
    return "#fb7185";
  };

  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
  const weekdayHeader = document.createElement("div");
  weekdayHeader.id = "weekdayHeader";
  weekdayHeader.style.display = "grid";
  weekdayHeader.style.gridTemplateColumns = "repeat(7, 1fr)";
  weekdayHeader.style.textAlign = "center";
  weekdayHeader.style.gap = "6px";
  weekdayHeader.style.marginBottom = "12px";
  weekdayHeader.style.fontWeight = "600";
  weekdayHeader.style.color = "#333";
  weekdayHeader.innerHTML = weekdays.map(d => `<div>${d}</div>`).join("");
  calendarDiv.parentNode.insertBefore(weekdayHeader, calendarDiv);

  const firstDayOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();

  let html = "";
  for (let i = 0; i < firstDayOffset; i++) html += `<div></div>`;

  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const hrs = dayHours[dateStr] || 0;

    html += `
      <div title="${dateStr}: ${hrs.toFixed(1)} hrs"
        style="
          display:flex;
          align-items:center;
          justify-content:center;
          width:48px;
          height:48px;
          background:${getColor(hrs)};
          border-radius:10px;
          color:${hrs > 0 ? '#222' : '#aaa'};
          font-size:0.9rem;
          font-weight:500;
          margin:0 auto;
          transition:transform 0.25s ease, box-shadow 0.25s ease;
        "
        onmouseover="this.style.transform='scale(1.12)';this.style.boxShadow='0 0 12px rgba(0,0,0,0.15)'"
        onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'"
      >${d}</div>
    `;
  }

  calendarDiv.style.display = "grid";
  calendarDiv.style.gridTemplateColumns = "repeat(7, 1fr)";
  calendarDiv.style.gap = "12px";
  calendarDiv.style.padding = "10px 0";
  calendarDiv.style.textAlign = "center";
  calendarDiv.style.justifyItems = "center";
  calendarDiv.innerHTML = html;
}

/* =========================================
   DETAILED CALENDAR
   ========================================= */
function renderDetailedCalendar() {
  const container = document.getElementById("calendarContainer");
  if (!container) return;

  container.innerHTML = "";
  const shifts = window.shifts || [];

  if (shifts.length === 0) {
    container.innerHTML = `<p class="no-shifts">No shifts found. Add shifts to view them here.</p>`;
    return;
  }

  const grouped = {};
  shifts.forEach(shift => {
    const date = shift.date;
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(shift);
  });

  Object.keys(grouped)
    .sort((a, b) => new Date(a) - new Date(b))
    .forEach(date => {
      const card = document.createElement("div");
      card.className = "calendar-date-card";
      card.innerHTML = `
        <h3>${new Date(date).toDateString()}</h3>
        <ul>
          ${grouped[date]
            .map(
              shift => `
              <li>
                <strong>${shift.job || shift.workplace || "Work"}</strong> • 
                ${shift.start_time || "?"}–${shift.end_time || "?"} 
                (${shift.hours?.toFixed(2) || 0} hrs, $${shift.income?.toFixed(2) || 0})
              </li>`
            )
            .join("")}
        </ul>
      `;
      container.appendChild(card);
    });
}

async function exportToICS() {
  console.log("📤 Export to Calendar triggered");

  // Wait to ensure shifts are loaded
  if (!window.shifts || window.shifts.length === 0) {
    console.warn("⚠️ No shifts loaded yet, fetching...");
    await loadShifts();
  }

  const shifts = window.shifts || [];
  if (shifts.length === 0) {
    alert("No shifts to export!");
    return;
  }

  let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//RosterFlow//EN\n";

  shifts.forEach((shift) => {
    if (!shift.start_time || !shift.end_time || !shift.date) {
      console.warn("⏩ Skipping incomplete shift:", shift);
      return;
    }

    const start = new Date(`${shift.date}T${shift.start_time}`);
    const end = new Date(`${shift.date}T${shift.end_time}`);

    // Format to UTC (ICS requires this)
    const formatDate = (date) =>
      date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    icsContent += "BEGIN:VEVENT\n";
    icsContent += `UID:${shift.id || Date.now()}@rosterflow.in\n`;
    icsContent += `SUMMARY:${shift.job || "Shift"}\n`;
    icsContent += `DTSTART:${formatDate(start)}\n`;
    icsContent += `DTEND:${formatDate(end)}\n`;
    icsContent += `DESCRIPTION:${shift.notes || ""}\\nWorked ${
      shift.hours?.toFixed(2) || 0
    } hours, earned $${shift.income?.toFixed(2) || 0}\n`;
    icsContent += "END:VEVENT\n";
  });

  icsContent += "END:VCALENDAR";

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "RosterFlow_Shifts.ics";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log("✅ ICS file generated and downloaded");
}

// Safely attach listener
document.addEventListener("DOMContentLoaded", () => {
  const exportBtn = document.getElementById("exportCalendarBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      try {
        await exportToICS();
      } catch (err) {
        console.error("❌ Export error:", err);
        alert("Export failed — see console for details.");
      }
    });
  } else {
    console.warn("⚠️ exportCalendarBtn not found in DOM");
  }
});



/* =========================================
   PAGE: CONFLICTS (Overlap + Availability Suggestions)
   ========================================= */
async function initConflictsPage() {
  const list = document.getElementById("conflictList");
  if (!list) return;

  const shifts = window.shifts || [];
  const workplaces = window.workplaces || [];

  if (shifts.length === 0) {
    list.innerHTML = `<p class="no-conflicts">No shifts added yet.</p>`;
  } else {
    const conflicts = [];
    const availabilityAdvice = {};

    // Sort by date for clarity
    shifts.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Compare each pair for overlaps
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

          conflicts.push({
            date: s1.date,
            shiftA: s1,
            shiftB: s2,
            overlapStart,
            overlapEnd,
            overlapHours,
          });
        }
      }
    }

    // Render conflicts
    if (conflicts.length > 0) {
      list.innerHTML = "";
      conflicts.forEach((c) => {
        const li = document.createElement("li");
        li.className = "conflict-item";

        const formatTime = (t) =>
          t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const start = formatTime(c.overlapStart);
        const end = formatTime(c.overlapEnd);

        li.innerHTML = `
          <h3>${new Date(c.date).toDateString()}</h3>
          <p><strong>Shift 1:</strong> ${c.shiftA.job} — ${c.shiftA.start_time} to ${c.shiftA.end_time}</p>
          <p><strong>Shift 2:</strong> ${c.shiftB.job} — ${c.shiftB.start_time} to ${c.shiftB.end_time}</p>
          <p class="conflict-details">⚠️ Overlap from <strong>${start}</strong> to <strong>${end}</strong> (${c.overlapHours.toFixed(2)} hrs)</p>
          <p class="availability-advice">Block availability between ${start}–${end} on ${new Date(
          c.date
        ).toDateString()} at both <strong>${c.shiftA.job}</strong> and <strong>${c.shiftB.job}</strong>.</p>
        `;
        list.appendChild(li);
      });
    } else {
      list.innerHTML = `<p class="no-conflicts">✅ No overlapping shifts detected!</p>`;
    }

    // Availability suggestions
    shifts.forEach((shift) => {
      if (!availabilityAdvice[shift.date]) {
        availabilityAdvice[shift.date] = new Set();
      }
      availabilityAdvice[shift.date].add(shift.job);
    });

    const adviceHeader = document.createElement("h2");
    adviceHeader.textContent = "Availability Suggestions";
    adviceHeader.style.marginTop = "2rem";
    adviceHeader.style.marginBottom = "0.5rem";
    list.appendChild(adviceHeader);

    const adviceUl = document.createElement("ul");
    adviceUl.className = "availability-list";

    Object.entries(availabilityAdvice).forEach(([date, jobs]) => {
      const bookedJobs = Array.from(jobs);
      const blocked = workplaces.filter((w) => !bookedJobs.includes(w));

      const li = document.createElement("li");
      li.className = "availability-item";
      li.innerHTML = `
        <h3>${new Date(date).toDateString()}</h3>
        <p><strong>Booked at:</strong> ${bookedJobs.join(", ")}</p>
        ${
          blocked.length > 0
            ? `<p class="block-advice">Block this date for: <strong>${blocked.join(", ")}</strong></p>`
            : `<p class="block-advice">No other workplaces to block — all free.</p>`
        }
      `;
      adviceUl.appendChild(li);
    });

    list.appendChild(adviceUl);
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

// ✅ Attach export listener after shifts are loaded
const exportBtn = document.getElementById("exportCalendarBtn");
if (exportBtn) {
  exportBtn.addEventListener("click", async () => {
    try {
      await exportToICS();
    } catch (err) {
      console.error("❌ Export error:", err);
      alert("Export failed — see console for details.");
    }
  });
}
