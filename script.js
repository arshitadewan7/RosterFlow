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
  if (shifts.length > 0) {
    const ctx1 = document.getElementById('hoursChart');
    const ctx2 = document.getElementById('incomeChart');

    // -------- FIXED: Hours by Workplace --------
    const hoursByWorkplace = {};
    shifts.forEach(shift => {
      const job = shift.job || "Other";
      hoursByWorkplace[job] = (hoursByWorkplace[job] || 0) + shift.hours;
    });

    const jobNames = Object.keys(hoursByWorkplace);
    const jobHours = Object.values(hoursByWorkplace);

    if (window.hoursChart && typeof window.hoursChart.destroy === 'function') window.hoursChart.destroy();
    window.hoursChart = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: jobNames,
        datasets: [{
          label: 'Hours by Workplace',
          data: jobHours,
          backgroundColor: ['#c8b6ff', '#a0e7e5', '#ffb7c5', '#ffd6a5', '#bde0fe'],
          borderRadius: 8
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Work Hours by Workplace',
            font: { family: 'Outfit', size: 18, weight: 600 },
            color: '#2d2d2d'
          }
        },
        scales: {
          x: {
            ticks: { color: '#333', font: { family: 'Poppins' } },
            grid: { display: false }
          },
          y: {
            ticks: { color: '#333', font: { family: 'Poppins' } },
            grid: { color: 'rgba(200,200,200,0.1)' },
            beginAtZero: true
          }
        }
      }
    });

    // -------- Weekly Income Chart --------
    const weekly = {};
    shifts.forEach(s => {
      const w = getWeek(s.date);
      weekly[w] ??= { income: 0 };
      weekly[w].income += s.income;
    });

    const weeks = Object.keys(weekly);
    const inc = weeks.map(w => weekly[w].income);

    if (window.incomeChart && typeof window.incomeChart.destroy === 'function') window.incomeChart.destroy();
    window.incomeChart = new Chart(ctx2, {
      type: 'line',
      data: {
        labels: weeks,
        datasets: [{
          label: 'Weekly Income (AUD)',
          data: inc,
          borderColor: '#a78bfa',
          backgroundColor: 'rgba(200,182,255,0.2)',
          tension: 0.4,
          pointBackgroundColor: '#ffb7c5',
          pointRadius: 5,
          fill: true
        }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });

    // -------- Donut Charts --------
    const jobTotals = {};
    shifts.forEach(s => {
      jobTotals[s.job] ??= { hours: 0, income: 0 };
      jobTotals[s.job].hours += s.hours;
      jobTotals[s.job].income += s.income;
    });

    const jobIncomes = Object.keys(jobTotals).map(j => jobTotals[j].income);
    const colors = ['#c8b6ff', '#a0e7e5', '#ffb7c5', '#ffd6a5', '#bde0fe'];

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



