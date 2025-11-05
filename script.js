let shifts = JSON.parse(localStorage.getItem('shifts')) || [];
let workplaces = JSON.parse(localStorage.getItem('workplaces')) || ["Myer", "Lovisa"];

function save() {
  localStorage.setItem('shifts', JSON.stringify(shifts));
  localStorage.setItem('workplaces', JSON.stringify(workplaces));
}

function getWeek(date) {
  const d = new Date(date);
  const start = new Date(d.setDate(d.getDate() - d.getDay())); // start of week (Sunday)
  return start.toISOString().slice(0, 10);
}

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
        // Add to dropdown instantly
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

  // Display summary
  const summary = Object.entries(weekly)
    .map(([w, v]) => `<p>Week of ${w}: ${v.total.toFixed(1)} hrs, $${v.income.toFixed(2)}</p>`)
    .join('');
  document.getElementById('dashboardSummary').innerHTML = summary || '<p>No shifts added yet.</p>';

  // Render charts only if data exists
  if (Object.keys(weekly).length > 0) {
    const ctx1 = document.getElementById('hoursChart');
    const ctx2 = document.getElementById('incomeChart');
    const weeks = Object.keys(weekly);
    const hrs = weeks.map(w => weekly[w].total);
    const inc = weeks.map(w => weekly[w].income);

    if (window.hoursChart && typeof window.hoursChart.destroy === 'function') {
      window.hoursChart.destroy();
    }
    if (window.incomeChart && typeof window.incomeChart.destroy === 'function') {
      window.incomeChart.destroy();
    }

    window.hoursChart = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: weeks,
        datasets: [{ label: 'Hours', data: hrs, backgroundColor: '#007bff' }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });

    window.incomeChart = new Chart(ctx2, {
      type: 'line',
      data: {
        labels: weeks,
        datasets: [{ label: 'Income (AUD)', data: inc, borderColor: '#28a745', fill: false }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
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
      <ul>
        ${grouped[d].map(s => `<li>${s.job} (${s.start}-${s.end}) - ${s.hours.toFixed(1)}h</li>`).join('')}
      </ul>
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

  if (window.incomeFlowChart && typeof window.incomeFlowChart.destroy === 'function') {
    window.incomeFlowChart.destroy();
  }

  window.incomeFlowChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: weeks,
      datasets: [{
        label: 'Weekly Income (AUD)',
        data: incomeData,
        borderColor: '#ff6600',
        fill: false
      }]
    },
    options: { plugins: { legend: { position: 'bottom' } } }
  });
}

/* ---------- PAGE: CONFLICTS ---------- */
if (document.getElementById('conflictList')) {
  const list = document.getElementById('conflictList');
  let conflicts = [];
  let dayJobs = {}; // { date: [job1, job2] }

  // 1. Detect overlapping shifts (true conflicts)
  for (let i = 0; i < shifts.length; i++) {
    for (let j = i + 1; j < shifts.length; j++) {
      if (shifts[i].date === shifts[j].date && checkOverlap(shifts[i], shifts[j])) {
        conflicts.push(`⚠️ Clash on ${shifts[i].date} between ${shifts[i].job} (${shifts[i].start}-${shifts[i].end}) and ${shifts[j].job} (${shifts[j].start}-${shifts[j].end})`);
      }
    }
  }

  // 2. Group jobs by date
  shifts.forEach(s => {
    if (!dayJobs[s.date]) dayJobs[s.date] = [];
    dayJobs[s.date].push(s.job);
  });

  // 3. Build "block availability" recommendations
  let blockMsgs = [];
  for (const [date, jobs] of Object.entries(dayJobs)) {
    // For each job on that date, suggest blocking all *other* workplaces
    workplaces.forEach(place => {
      if (!jobs.includes(place)) {
        jobs.forEach(worked => {
          blockMsgs.push(`📅 You are working at ${worked} on ${date} — block ${place} on this day.`);
        });
      }
    });
  }

  // 4. Build output HTML
  let html = '';

  html += '<h3>Conflicting Shifts</h3>';
  if (conflicts.length > 0) {
    html += '<ul>' + conflicts.map(c => `<li>${c}</li>`).join('') + '</ul>';
  } else {
    html += '<p>No overlapping shifts ✅</p>';
  }

  html += '<h3>Block Availability</h3>';
  if (blockMsgs.length > 0) {
    html += '<ul>' + blockMsgs.map(b => `<li>${b}</li>`).join('') + '</ul>';
  } else {
    html += '<p>No shifts to block yet.</p>';
  }

  list.innerHTML = html;
}
