let shifts = JSON.parse(localStorage.getItem('shifts')) || [];
let workplaces = JSON.parse(localStorage.getItem('workplaces')) || [];

// Save to localStorage
function save() {
  localStorage.setItem('shifts', JSON.stringify(shifts));
  localStorage.setItem('workplaces', JSON.stringify(workplaces));
}

// Helper: get start date of the week
function getWeek(date) {
  const d = new Date(date);
  const start = new Date(d.setDate(d.getDate() - d.getDay())); // Sunday
  return start.toISOString().slice(0, 10);
}

// Helper: check overlapping shifts
function checkOverlap(a, b) {
  const a1 = new Date(`${a.date}T${a.start}`);
  const a2 = new Date(`${a.date}T${a.end}`);
  const b1 = new Date(`${b.date}T${b.start}`);
  const b2 = new Date(`${b.date}T${b.end}`);
  return a1 < b2 && b1 < a2;
}

/* ---------- PAGE: ADD ---------- */
if (document.getElementById('shiftForm')) {
  const jobSelect = document.getElementById('job');

  // Populate workplace dropdown
  workplaces.forEach(w => {
    const o = document.createElement('option');
    o.value = o.textContent = w;
    jobSelect.appendChild(o);
  });

  // Add new workplace
  const workplaceForm = document.getElementById('workplaceForm');
  if (workplaceForm) {
    workplaceForm.onsubmit = e => {
      e.preventDefault();
      const name = document.getElementById('newWorkplace').value.trim();
      if (name && !workplaces.includes(name)) {
        workplaces.push(name);
        save();
        const o = document.createElement('option');
        o.value = o.textContent = name;
        jobSelect.appendChild(o);
        jobSelect.value = name;
        document.getElementById('newWorkplace').value = '';
      }
    };
  }

  // Add new shift
  document.getElementById('shiftForm').onsubmit = e => {
    e.preventDefault();
    const job = jobSelect.value;
    const dateVal = document.getElementById('date').value;
    const startVal = document.getElementById('start').value;
    const endVal = document.getElementById('end').value;
    const rateVal = parseFloat(document.getElementById('rate').value) || 30;

    if (!job) {
      alert("Please add or select a workplace first.");
      return;
    }

    const hours = (new Date(`${dateVal}T${endVal}`) - new Date(`${dateVal}T${startVal}`)) / 3600000;
    if (hours > 0) {
      shifts.push({ job, date: dateVal, start: startVal, end: endVal, rate: rateVal, hours, income: hours * rateVal });
      save();
      location.reload();
    } else {
      alert("End time must be after start time.");
    }
  };

  // Display shifts
  const tbody = document.querySelector('#shiftsTable tbody');
  shifts.forEach((s, i) => {
    const r = document.createElement('tr');
    r.innerHTML = `
      <td>${s.job}</td>
      <td>${s.date}</td>
      <td>${s.start}</td>
      <td>${s.end}</td>
      <td>${s.hours.toFixed(2)}</td>
      <td>$${s.income.toFixed(2)}</td>
      <td><button onclick="deleteShift(${i})" style="background:red">Delete</button></td>
    `;
    tbody.appendChild(r);
  });
}

function deleteShift(i) {
  shifts.splice(i, 1);
  save();
  location.reload();
}

/* ---------- PAGE: DASHBOARD ---------- */
if (document.getElementById('dashboardSummary')) {
  const weekly = {};
  shifts.forEach(s => {
    const w = getWeek(s.date);
    weekly[w] ??= { total: 0, income: 0 };
    weekly[w].total += s.hours;
    weekly[w].income += s.income;
  });

  // Display weekly summary
  const summary = Object.entries(weekly)
    .map(([w, v]) => `<p>Week of ${w}: ${v.total.toFixed(1)} hrs, $${v.income.toFixed(2)}</p>`)
    .join('');
  document.getElementById('dashboardSummary').innerHTML = summary || '<p>No shifts added yet.</p>';

  /* ----- WORK RESTRICTION TRACKER (local Adelaide time) ----- */
  const restrictionDiv = document.createElement('div');
  restrictionDiv.className = "restrictions";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Local Sunday midnight
  const fortnightStart = new Date(weekStart);
  fortnightStart.setDate(weekStart.getDate() - 7);

  let weekHours = 0, fortnightHours = 0;
  shifts.forEach(s => {
    const shiftDate = new Date(s.date + "T00:00");
    if (shiftDate >= weekStart) weekHours += s.hours;
    if (shiftDate >= fortnightStart) fortnightHours += s.hours;
  });

  // Helper: create progress bars
  const createProgressBar = (value, max, color) => {
    const percent = Math.min((value / max) * 100, 100);
    return `
      <div style="background:#ddd;border-radius:10px;overflow:hidden;width:100%;height:16px;margin-top:4px;">
        <div style="width:${percent}%;background:${color};height:100%;transition:width 0.3s;"></div>
      </div>
    `;
  };

  // Determine colors based on thresholds
  const weekColor = weekHours > 24 ? "red" : weekHours > 20 ? "orange" : "#28a745";
  const fortnightColor = fortnightHours > 48 ? "red" : fortnightHours > 40 ? "orange" : "#28a745";

  restrictionDiv.innerHTML = `
    <h3>Work Restrictions</h3>
    <p><strong>This Week:</strong> ${weekHours.toFixed(1)} hrs / 24 hrs</p>
    ${createProgressBar(weekHours, 24, weekColor)}
    <p><strong>This Fortnight:</strong> ${fortnightHours.toFixed(1)} hrs / 48 hrs</p>
    ${createProgressBar(fortnightHours, 48, fortnightColor)}
  `;

  document.getElementById('dashboard').appendChild(restrictionDiv);

  /* ----- VISUAL CHARTS ----- */
  if (Object.keys(weekly).length > 0) {
    const ctx1 = document.getElementById('hoursChart');
    const ctx2 = document.getElementById('incomeChart');
    const weeks = Object.keys(weekly);
    const hrs = weeks.map(w => weekly[w].total);
    const inc = weeks.map(w => weekly[w].income);

    if (window.hoursChart && typeof window.hoursChart.destroy === 'function') window.hoursChart.destroy();
    if (window.incomeChart && typeof window.incomeChart.destroy === 'function') window.incomeChart.destroy();

    window.hoursChart = new Chart(ctx1, {
      type: 'bar',
      data: { labels: weeks, datasets: [{ label: 'Hours', data: hrs, backgroundColor: '#007bff' }] },
      options: { plugins: { legend: { position: 'bottom' } } }
    });

    window.incomeChart = new Chart(ctx2, {
      type: 'line',
      data: { labels: weeks, datasets: [{ label: 'Income (AUD)', data: inc, borderColor: '#28a745', fill: false }] },
      options: { plugins: { legend: { position: 'bottom' } } }
    });

    // Donut Charts
    const jobTotals = {};
    shifts.forEach(s => {
      jobTotals[s.job] ??= { hours: 0, income: 0 };
      jobTotals[s.job].hours += s.hours;
      jobTotals[s.job].income += s.income;
    });

    const jobNames = Object.keys(jobTotals);
    const jobHours = jobNames.map(j => jobTotals[j].hours);
    const jobIncomes = jobNames.map(j => jobTotals[j].income);
    const colors = ['#007bff', '#28a745', '#ff9800', '#8e44ad', '#e91e63'];

    if (window.hoursDonutChart && typeof window.hoursDonutChart.destroy === 'function') window.hoursDonutChart.destroy();
    if (window.incomeDonutChart && typeof window.incomeDonutChart.destroy === 'function') window.incomeDonutChart.destroy();

    const donutCtx1 = document.getElementById('hoursDonutChart');
    window.hoursDonutChart = new Chart(donutCtx1, {
      type: 'doughnut',
      data: { labels: jobNames, datasets: [{ data: jobHours, backgroundColor: colors.slice(0, jobNames.length) }] },
      options: { plugins: { legend: { position: 'right' } } }
    });

    const donutCtx2 = document.getElementById('incomeDonutChart');
    window.incomeDonutChart = new Chart(donutCtx2, {
      type: 'doughnut',
      data: { labels: jobNames, datasets: [{ data: jobIncomes, backgroundColor: colors.slice(0, jobNames.length) }] },
      options: { plugins: { legend: { position: 'right' } } }
    });
  }
}

/* ---------- PAGE: CALENDAR ---------- */
if (document.getElementById('calendarContainer')) {
  const div = document.getElementById('calendarContainer');
  const grouped = {};
  shifts.forEach(s => { (grouped[s.date] ??= []).push(s); });

  const sortedDates = Object.keys(grouped).sort();
  div.innerHTML = sortedDates.map(d => `
    <div class="day">
      <strong>${d}</strong>
      <ul>${grouped[d].map(s => `<li>${s.job} (${s.start}-${s.end}) - ${s.hours.toFixed(1)}h</li>`).join('')}</ul>
    </div>
  `).join('');
}

/* ---------- PAGE: INCOME ---------- */
if (document.getElementById('incomeFlowChart')) {
  const weekly = {};
  shifts.forEach(s => {
    const w = getWeek(s.date);
    weekly[w] ??= { income: 0 };
    weekly[w].income += s.income;
  });

  const ctx = document.getElementById('incomeFlowChart');
  const weeks = Object.keys(weekly);
  const incomeData = weeks.map(w => weekly[w].income);

  if (window.incomeFlowChart && typeof window.incomeFlowChart.destroy === 'function') window.incomeFlowChart.destroy();

  window.incomeFlowChart = new Chart(ctx, {
    type: 'line',
    data: { labels: weeks, datasets: [{ label: 'Weekly Income (AUD)', data: incomeData, borderColor: '#ff6600', fill: false }] },
    options: { plugins: { legend: { position: 'bottom' } } }
  });
}

/* ---------- PAGE: CONFLICTS ---------- */
if (document.getElementById('conflictList')) {
  const list = document.getElementById('conflictList');
  let conflicts = [];
  let dayJobs = {};

  for (let i = 0; i < shifts.length; i++) {
    for (let j = i + 1; j < shifts.length; j++) {
      if (shifts[i].date === shifts[j].date && checkOverlap(shifts[i], shifts[j])) {
        conflicts.push(`⚠️ Clash on ${shifts[i].date} between ${shifts[i].job} (${shifts[i].start}-${shifts[i].end}) and ${shifts[j].job} (${shifts[j].start}-${shifts[j].end})`);
      }
    }
  }

  shifts.forEach(s => {
    if (!dayJobs[s.date]) dayJobs[s.date] = [];
    dayJobs[s.date].push(s.job);
  });

  let blockMsgs = [];
  for (const [date, jobs] of Object.entries(dayJobs)) {
    workplaces.forEach(place => {
      if (!jobs.includes(place)) {
        jobs.forEach(worked => {
          blockMsgs.push(`📅 You are working at ${worked} on ${date} — block ${place} on this day.`);
        });
      }
    });
  }

  let html = '<h3>Conflicting Shifts</h3>';
  html += conflicts.length ? `<ul>${conflicts.map(c => `<li>${c}</li>`).join('')}</ul>` : '<p>No overlapping shifts ✅</p>';
  html += '<h3>Block Availability</h3>';
  html += blockMsgs.length ? `<ul>${blockMsgs.map(b => `<li>${b}</li>`).join('')}</ul>` : '<p>No shifts to block yet.</p>';
  list.innerHTML = html;
}

if (document.getElementById('calendarHeatmapGrid')) {
  const grid = document.getElementById('calendarHeatmapGrid');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Get first and last day of current month
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();

  const hoursPerDay = {};
  shifts.forEach(s => {
    if (new Date(s.date).getMonth() === month) {
      hoursPerDay[s.date] = (hoursPerDay[s.date] || 0) + s.hours;
    }
  });

  grid.innerHTML = "";
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hours = hoursPerDay[dateStr] || 0;
    let color = "#eee";
    if (hours >= 1 && hours <= 4) color = "#b7e4c7";
    else if (hours <= 8) color = "#52b788";
    else if (hours > 8) color = "#e63946";

    grid.innerHTML += `
      <div class="dayBox" title="${dateStr}: ${hours.toFixed(1)} hrs" style="background:${color}">
        ${d}
      </div>`;
  }
}

/* ---------- PAGE: CALENDAR (Heatmap Style) ---------- */
if (document.getElementById('calendarHeatmapGrid')) {
  const grid = document.getElementById('calendarHeatmapGrid');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // 1. Get first and last day of current month
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();

  // 2. Group total hours per day for this month
  const hoursPerDay = {};
  shifts.forEach(s => {
    const d = new Date(s.date);
    if (d.getMonth() === month && d.getFullYear() === year) {
      hoursPerDay[s.date] = (hoursPerDay[s.date] || 0) + s.hours;
    }
  });

  // 3. Render day boxes
  grid.innerHTML = "";
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hours = hoursPerDay[dateStr] || 0;
    let color = "#eee";
    if (hours > 0 && hours <= 4) color = "#b7e4c7";
    else if (hours <= 8) color = "#52b788";
    else if (hours > 8) color = "#e63946";

    grid.innerHTML += `
      <div class="dayBox" title="${dateStr}: ${hours.toFixed(1)} hrs" style="background:${color}">
        ${d}
      </div>`;
  }
}

