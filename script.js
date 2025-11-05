/* ---------- LOCAL STORAGE SETUP ---------- */
let shifts = JSON.parse(localStorage.getItem('shifts')) || [];
let workplaces = JSON.parse(localStorage.getItem('workplaces')) || [];

// Save data
function save() {
  localStorage.setItem('shifts', JSON.stringify(shifts));
  localStorage.setItem('workplaces', JSON.stringify(workplaces));
}

// Helper: Get start of week
function getWeek(date) {
  const d = new Date(date);
  const start = new Date(d.setDate(d.getDate() - d.getDay())); // Sunday
  return start.toISOString().slice(0, 10);
}

// Helper: Check overlapping shifts
function checkOverlap(a, b) {
  const a1 = new Date(`${a.date}T${a.start}`);
  const a2 = new Date(`${a.date}T${a.end}`);
  const b1 = new Date(`${b.date}T${b.start}`);
  const b2 = new Date(`${b.date}T${b.end}`);
  return a1 < b2 && b1 < a2;
}

/* ---------- PAGE: ADD SHIFTS ---------- */
if (document.getElementById('shiftForm')) {
  const jobSelect = document.getElementById('job');

  // Populate existing workplaces
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
    const notesVal = document.getElementById('notes').value.trim();

    if (!job) {
      alert("Please add or select a workplace first.");
      return;
    }

    const hours = (new Date(`${dateVal}T${endVal}`) - new Date(`${dateVal}T${startVal}`)) / 3600000;
    if (hours > 0) {
      shifts.push({
        job,
        date: dateVal,
        start: startVal,
        end: endVal,
        rate: rateVal,
        notes: notesVal,
        hours,
        income: hours * rateVal
      });
      save();
      location.reload();
    } else {
      alert("End time must be after start time.");
    }
  };

  // Display all shifts
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
      <td>${s.notes ? s.notes : '-'}</td>
      <td><button onclick="deleteShift(${i})" style="background:red">Delete</button></td>
    `;
    tbody.appendChild(r);
  });
}

// Delete shift
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

  // Display summary
  const summary = Object.entries(weekly)
    .map(([w, v]) => `<p>Week of ${w}: ${v.total.toFixed(1)} hrs, $${v.income.toFixed(2)}</p>`)
    .join('');
  document.getElementById('dashboardSummary').innerHTML = summary || '<p>No shifts added yet.</p>';

  /* ----- WORK RESTRICTION TRACKER ----- */
  const restrictionDiv = document.createElement('div');
  restrictionDiv.className = "restrictions";
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

    window.hoursDonutChart = new Chart(document.getElementById('hoursDonutChart'), {
      type: 'doughnut',
      data: { labels: jobNames, datasets: [{ data: jobHours, backgroundColor: colors.slice(0, jobNames.length) }] },
      options: { plugins: { legend: { position: 'right' } } }
    });

    window.incomeDonutChart = new Chart(document.getElementById('incomeDonutChart'), {
      type: 'doughnut',
      data: { labels: jobNames, datasets: [{ data: jobIncomes, backgroundColor: colors.slice(0, jobNames.length) }] },
      options: { plugins: { legend: { position: 'right' } } }
    });
  }

}

/* ---------- PAGE: INCOME (Gradient Line Chart) ---------- */
if (document.getElementById('incomeFlowChart')) {
  window.addEventListener('DOMContentLoaded', () => {
    if (shifts.length === 0) return;

    const weekly = {};
    shifts.forEach(s => {
      const w = getWeek(s.date);
      weekly[w] ??= { income: 0 };
      weekly[w].income += s.income;
    });

    const weeks = Object.keys(weekly);
    const incomeData = weeks.map(w => weekly[w].income);
    const ctx = document.getElementById('incomeFlowChart').getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(200,182,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,183,197,0.1)');

    if (window.incomeFlowChart && typeof window.incomeFlowChart.destroy === 'function')
      window.incomeFlowChart.destroy();

    window.incomeFlowChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: weeks,
        datasets: [{
          label: 'Weekly Income (AUD)',
          data: incomeData,
          borderColor: '#c8b6ff',
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#ffb7c5',
          pointRadius: 6,
          pointHoverRadius: 9
        }]
      },
      options: {
        responsive: true,
        animation: { duration: 1200, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#fff',
            titleColor: '#111',
            bodyColor: '#444',
            borderColor: '#c8b6ff',
            borderWidth: 1,
            padding: 12,
            displayColors: false
          }
        },
        scales: {
          x: { grid: { color: 'rgba(220,220,220,0.1)' }, ticks: { color: '#666' } },
          y: { beginAtZero: true, grid: { color: 'rgba(200,200,200,0.15)' }, ticks: { color: '#444' } }
        }
      }
    });
  });
}
/* ---------- PAGE: CALENDAR LIST ---------- */
if (document.getElementById('calendarContainer')) {
  const div = document.getElementById('calendarContainer');
  const grouped = {};
  shifts.forEach(s => { (grouped[s.date] ??= []).push(s); });
  const sortedDates = Object.keys(grouped).sort();
  div.innerHTML = sortedDates.map(d => `
    <div class="day">
      <strong>${d}</strong>
      <ul>${grouped[d].map(s =>
        `<li>${s.job} (${s.start}-${s.end}) - ${s.hours.toFixed(1)}h${s.notes ? ` — <em>${s.notes}</em>` : ''}</li>`
      ).join('')}</ul>
    </div>`).join('');
}

/* ---------- PAGE: CALENDAR HEATMAP ---------- */
if (document.getElementById('calendarHeatmapGrid')) {
  const grid = document.getElementById('calendarHeatmapGrid');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();

  const hoursPerDay = {};
  shifts.forEach(s => {
    const d = new Date(s.date);
    if (d.getMonth() === month && d.getFullYear() === year) {
      hoursPerDay[s.date] = (hoursPerDay[s.date] || 0) + s.hours;
    }
  });

  grid.innerHTML = "";
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hours = hoursPerDay[dateStr] || 0;
    let color = "#eee";
    if (hours > 0 && hours <= 4) color = "#b7e4c7";
    else if (hours <= 8) color = "#52b788";
    else if (hours > 8) color = "#e63946";
    grid.innerHTML += `<div class="dayBox" title="${dateStr}: ${hours.toFixed(1)} hrs" style="background:${color}">${d}</div>`;
  }
}

/* ---------- PAGE: CONFLICTS (Enhanced Visual View) ---------- */
if (document.getElementById('conflictList')) {
  const list = document.getElementById('conflictList');
  let conflicts = [];
  let dayJobs = {};

  // Detect overlapping shifts
  for (let i = 0; i < shifts.length; i++) {
    for (let j = i + 1; j < shifts.length; j++) {
      if (shifts[i].date === shifts[j].date && checkOverlap(shifts[i], shifts[j])) {
        conflicts.push({
          date: shifts[i].date,
          a: shifts[i],
          b: shifts[j]
        });
      }
    }
  }

  // Group jobs by date for block-availability
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

  // Build HTML output
  let html = '<h3>Conflicting Shifts</h3>';
  if (conflicts.length > 0) {
    conflicts.forEach(c => {
      html += `
        <div class="conflict-card">
          <p class="conflict-date">⚠️ ${c.date}</p>
          <div class="conflict-pair">
            <div class="shift-box">
              <h4>${c.a.job}</h4>
              <p>${c.a.start} – ${c.a.end}</p>
              <p>${c.a.hours.toFixed(1)} h  |  $${c.a.income.toFixed(2)}</p>
              ${c.a.notes ? `<p><em>${c.a.notes}</em></p>` : ''}
            </div>
            <div class="shift-box">
              <h4>${c.b.job}</h4>
              <p>${c.b.start} – ${c.b.end}</p>
              <p>${c.b.hours.toFixed(1)} h  |  $${c.b.income.toFixed(2)}</p>
              ${c.b.notes ? `<p><em>${c.b.notes}</em></p>` : ''}
            </div>
          </div>
        </div>
      `;
    });
  } else {
    html += '<p>No overlapping shifts ✅</p>';
  }

  html += '<h3>Block Availability</h3>';
  html += blockMsgs.length
    ? `<ul>${blockMsgs.map(b => `<li>${b}</li>`).join('')}</ul>`
    : '<p>No shifts to block yet.</p>';

  list.innerHTML = html;
}

/* ---------- EXPORT TO CALENDAR (.ICS) ---------- */
if (document.getElementById('exportCalendarBtn')) {
  document.getElementById('exportCalendarBtn').addEventListener('click', () => {
    if (shifts.length === 0) {
      alert("No shifts to export!");
      return;
    }

    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//RosterFlow//EN\n";

    shifts.forEach(s => {
      const start = new Date(`${s.date}T${s.start}`);
      const end = new Date(`${s.date}T${s.end}`);
      const uid = `${s.job}-${s.date}-${s.start}`;
      const summary = `Work at ${s.job}`;
      const desc = `Shift at ${s.job}\nTime: ${s.start} - ${s.end}\nExpected Income: $${s.income.toFixed(2)}${s.notes ? `\nNotes: ${s.notes}` : ''}`;
      const dtStart = start.toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";
      const dtEnd = end.toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";

      ics += [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${desc}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        "END:VEVENT\n"
      ].join("\n");
    });

    ics += "END:VCALENDAR";

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "RosterFlow_Shifts.ics";
    link.click();
  });
}

