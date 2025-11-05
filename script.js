const shiftForm = document.getElementById('shiftForm');
const shiftsTable = document.querySelector('#shiftsTable tbody');
const conflictList = document.getElementById('conflictList');
const weekStats = document.getElementById('weekStats');

let shifts = JSON.parse(localStorage.getItem('shifts')) || [];
let hoursChart, incomeChart;

function renderTable() {
  shiftsTable.innerHTML = '';
  let conflicts = [];

  shifts.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.job}</td>
      <td>${s.date}</td>
      <td>${s.start}</td>
      <td>${s.end}</td>
      <td>${s.hours.toFixed(2)}</td>
      <td>$${s.income.toFixed(2)}</td>
      <td><button onclick="deleteShift(${i})" style="background:red">Delete</button></td>
    `;
    shiftsTable.appendChild(tr);
  });

  // detect clashes and block dates
  for (let i = 0; i < shifts.length; i++) {
    for (let j = i + 1; j < shifts.length; j++) {
      if (shifts[i].date === shifts[j].date) {
        const overlap = checkOverlap(shifts[i], shifts[j]);
        if (overlap) {
          conflicts.push(`⚠️ Time clash on ${shifts[i].date} between ${shifts[i].job} and ${shifts[j].job}`);
        }
      }
    }
  }

  const lovisaDates = shifts.filter(s => s.job === 'Lovisa').map(s => s.date);
  const blocked = [...new Set(lovisaDates)];
  conflictList.innerHTML = conflicts.map(c => `<li>${c}</li>`).join('') || "<li>No conflicts found ✅</li>";
  conflictList.innerHTML += `<li>Block Myer availability on: ${blocked.join(', ') || 'None'}</li>`;

  localStorage.setItem('shifts', JSON.stringify(shifts));
  renderWeeklyStats();
}

function deleteShift(index) {
  shifts.splice(index, 1);
  localStorage.setItem('shifts', JSON.stringify(shifts));
  renderTable();
}

function checkOverlap(a, b) {
  const aStart = new Date(`${a.date}T${a.start}`);
  const aEnd = new Date(`${a.date}T${a.end}`);
  const bStart = new Date(`${b.date}T${b.start}`);
  const bEnd = new Date(`${b.date}T${b.end}`);
  return aStart < bEnd && bStart < aEnd;
}

shiftForm.addEventListener('submit', e => {
  e.preventDefault();
  const job = document.getElementById('job').value;
  const date = document.getElementById('date').value;
  const start = document.getElementById('start').value;
  const end = document.getElementById('end').value;
  const rate = parseFloat(document.getElementById('rate').value) || 30;

  const hours = (new Date(`${date}T${end}`) - new Date(`${date}T${start}`)) / (1000 * 60 * 60);
  const income = hours * rate;

  shifts.push({ job, date, start, end, rate, hours, income });
  localStorage.setItem('shifts', JSON.stringify(shifts));
  renderTable();
  shiftForm.reset();
  document.getElementById('rate').value = 30;
});

function renderWeeklyStats() {
  if (!shifts.length) return;
  const weekly = {};
  const toWeek = d => {
    const date = new Date(d);
    const start = new Date(date.setDate(date.getDate() - date.getDay())); // start of week
    return start.toISOString().slice(0, 10);
  };

  shifts.forEach(s => {
    const week = toWeek(s.date);
    if (!weekly[week]) weekly[week] = { total: 0, income: 0, Myer: 0, Lovisa: 0 };
    weekly[week].total += s.hours;
    weekly[week].income += s.income;
    weekly[week][s.job] += s.hours;
  });

  weekStats.innerHTML = Object.keys(weekly).map(week =>
    `<strong>Week starting ${week}:</strong> 
     ${weekly[week].total.toFixed(2)} hrs total 
     (Myer: ${weekly[week].Myer.toFixed(2)}, Lovisa: ${weekly[week].Lovisa.toFixed(2)})<br>`
  ).join('');

  const weeks = Object.keys(weekly);
  const totalHours = weeks.map(w => weekly[w].total);
  const myerHours = weeks.map(w => weekly[w].Myer);
  const lovisaHours = weeks.map(w => weekly[w].Lovisa);
  const totalIncome = weeks.map(w => weekly[w].income);

  // Charts
  const ctxH = document.getElementById('hoursChart');
  const ctxI = document.getElementById('incomeChart');

  if (hoursChart) hoursChart.destroy();
  if (incomeChart) incomeChart.destroy();

  hoursChart = new Chart(ctxH, {
    type: 'bar',
    data: {
      labels: weeks,
      datasets: [
        { label: 'Myer Hours', data: myerHours, backgroundColor: '#007bff' },
        { label: 'Lovisa Hours', data: lovisaHours, backgroundColor: '#ff69b4' },
      ]
    },
    options: { plugins: { legend: { position: 'bottom' } } }
  });

  incomeChart = new Chart(ctxI, {
    type: 'line',
    data: {
      labels: weeks,
      datasets: [{ label: 'Total Income (AUD)', data: totalIncome, borderColor: '#28a745', fill: false }]
    },
    options: { plugins: { legend: { position: 'bottom' } } }
  });
}

document.getElementById('exportCalendar').addEventListener('click', () => {
  const ics = generateICS(shifts);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'work_schedule.ics';
  a.click();
  URL.revokeObjectURL(url);
});

function generateICS(shifts) {
  let ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//RosterFlow//EN\n`;
  shifts.forEach(s => {
    const start = formatICSDate(s.date, s.start);
    const end = formatICSDate(s.date, s.end);
    ics += `BEGIN:VEVENT\nSUMMARY:${s.job} Shift\nDTSTART:${start}\nDTEND:${end}\nDESCRIPTION:Work shift at ${s.job}\nEND:VEVENT\n`;
  });
  ics += `END:VCALENDAR`;
  return ics;
}

function formatICSDate(date, time) {
  const d = new Date(`${date}T${time}`);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

renderTable();
