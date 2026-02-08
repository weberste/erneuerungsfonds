'use strict';

// --- Number formatting ---

function formatNum(val) {
  const num = Math.round(val);
  if (isNaN(num)) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function parseNum(str) {
  var s = String(str).replace(/'/g, '').trim();
  var match = s.match(/^([0-9.,]+)\s*([kmKM])$/);
  if (match) {
    var num = parseFloat(match[1].replace(/,/g, '.'));
    var suffix = match[2].toLowerCase();
    return num * (suffix === 'k' ? 1000 : 1000000);
  }
  return parseFloat(s);
}

// --- Pure simulation logic ---

function simulate(params) {
  const {
    gebaeudeAlter,
    fondsstandStart,
    gvs,
    einzahlungProzent,
    plafonierung,
    wertquote,
    ausgaben,
  } = params;

  const jaehrlicherBeitrag = gvs * einzahlungProzent / 100;
  const plafonierungCHF = gvs * plafonierung / 100;

  // Determine simulation end: last expense year, or at least current age + 1
  const maxAlter = ausgaben.length > 0
    ? Math.max(...ausgaben.map(a => a.faelligkeit))
    : gebaeudeAlter;
  const endAlter = Math.max(maxAlter, gebaeudeAlter + 1);

  let fondsstand = fondsstandStart;
  const results = [];

  for (let alter = gebaeudeAlter; alter <= endAlter; alter++) {
    // 1. Einzahlung
    let einzahlung = 0;
    if (fondsstand < plafonierungCHF) {
      einzahlung = Math.min(jaehrlicherBeitrag, plafonierungCHF - fondsstand);
    }
    fondsstand += einzahlung;

    // 2. Ausgaben dieses Jahres
    const faelligeAusgaben = ausgaben.filter(a => a.faelligkeit === alter);
    const ausgabenDetails = faelligeAusgaben.map(a => {
      const kosten = a.typ === 'prozent' ? gvs * (a.kosten / 100) : a.kosten;
      return { name: a.name, kosten };
    });
    const ausgabenSumme = ausgabenDetails.reduce((sum, a) => sum + a.kosten, 0);

    // 3. Abzug vom Fonds
    let sonderumlage = 0;
    let sonderumlageProEigentuemer = 0;
    if (ausgabenSumme <= fondsstand) {
      fondsstand -= ausgabenSumme;
    } else {
      sonderumlage = ausgabenSumme - fondsstand;
      sonderumlageProEigentuemer = sonderumlage * wertquote / 10000;
      fondsstand = 0;
    }

    results.push({
      gebaeudeAlter: alter,
      fondsstand,
      einzahlung,
      ausgaben: ausgabenSumme,
      sonderumlage,
      sonderumlageProEigentuemer,
      ausgabenDetails,
    });
  }

  return results;
}

// --- DOM helpers ---

function getParams() {
  const gebaeudeAlter = parseInt(document.getElementById('gebaeudeAlter').value, 10);
  const fondsstandStart = parseNum(document.getElementById('fondsstand').value);
  const gvs = parseNum(document.getElementById('gvs').value);
  const einzahlungProzent = parseFloat(document.getElementById('einzahlungProzent').value);
  const plafonierung = parseFloat(document.getElementById('plafonierung').value);
  const wertquote = parseFloat(document.getElementById('wertquote').value);

  const ausgaben = [];
  document.querySelectorAll('.ausgabe-row').forEach(row => {
    const name = row.querySelector('.ausgabe-name').value.trim();
    const faelligkeit = parseInt(row.querySelector('.ausgabe-faelligkeit').value, 10);
    const kosten = parseNum(row.querySelector('.ausgabe-kosten').value);
    const typ = row.querySelector('.toggle-btn.active').dataset.type === 'prozent' ? 'prozent' : 'chf';
    if (name && !isNaN(faelligkeit) && !isNaN(kosten) && kosten > 0) {
      ausgaben.push({ name, faelligkeit, kosten, typ });
    }
  });

  return { gebaeudeAlter, fondsstandStart, gvs, einzahlungProzent, plafonierung, wertquote, ausgaben };
}

// --- Chart rendering ---

let chartFondsstand = null;
let chartFlows = null;

function formatCHF(val) {
  return val.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 });
}

function renderCharts(results, plafonierung) {
  const labels = results.map(r => r.gebaeudeAlter);
  const fondsstandData = results.map(r => r.fondsstand);
  const einzahlungen = results.map(r => r.einzahlung);
  const ausgaben = results.map(r => -r.ausgaben);
  const aoEinzahlungen = results.map(r => r.sonderumlage);

  // Destroy previous charts
  if (chartFondsstand) chartFondsstand.destroy();
  if (chartFlows) chartFlows.destroy();

  const tooltipCHF = {
    callbacks: {
      label: function(ctx) {
        return ctx.dataset.label + ': ' + formatCHF(Math.abs(ctx.parsed.y));
      }
    }
  };

  // Chart 1: Fondsstand
  chartFondsstand = new Chart(document.getElementById('chartFondsstand'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Fondsstand',
          data: fondsstandData,
          borderColor: '#0071e3',
          backgroundColor: 'rgba(0, 113, 227, 0.08)',
          fill: true,
          tension: 0.1,
        },
        {
          label: 'Plafonierung',
          data: labels.map(() => plafonierung),
          borderColor: '#aeaeb2',
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: tooltipCHF,
      },
      scales: {
        x: {
          title: { display: true, text: 'Gebäudealter (Jahre)' },
        },
        y: {
          title: { display: true, text: 'CHF' },
          beginAtZero: true,
          ticks: {
            callback: v => formatCHF(v),
          },
        },
      },
    },
  });

  // Chart 2: Ein-/Auszahlungen
  chartFlows = new Chart(document.getElementById('chartFlows'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Jährliche Einzahlungen',
          data: einzahlungen,
          backgroundColor: '#34c759',
        },
        {
          label: 'Ausserordentliche Einzahlungen',
          data: aoEinzahlungen,
          backgroundColor: '#ff9500',
        },
        {
          label: 'Ausgaben',
          data: ausgaben,
          backgroundColor: '#ff3b30',
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          filter: function(item) {
            return item.parsed.y !== 0;
          },
          callbacks: {
            title: function(items) {
              var idx = items[0].dataIndex;
              var r = results[idx];
              var parts = [];
              if (r.einzahlung > 0) parts.push('Jährliche Einzahlung');
              if (r.ausgabenDetails.length > 0) {
                r.ausgabenDetails.forEach(function(a) { parts.push(a.name); });
              }
              return parts.join(', ') || 'Gebäudealter ' + r.gebaeudeAlter;
            },
            label: function(ctx) {
              return formatCHF(Math.abs(ctx.parsed.y));
            }
          }
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Gebäudealter (Jahre)' },
          stacked: true,
        },
        y: {
          title: { display: true, text: 'CHF' },
          stacked: true,
          ticks: {
            callback: v => formatCHF(v),
          },
        },
      },
    },
  });
}

// --- Sonderumlagen table ---

function renderSonderumlagen(results, wertquote) {
  const section = document.getElementById('sonderumlagenSection');
  const tbody = document.querySelector('#sonderumlagenTable tbody');
  const tfoot = document.querySelector('#sonderumlagenTable tfoot');
  tbody.innerHTML = '';
  tfoot.innerHTML = '';

  const mitSonderumlage = results.filter(r => r.sonderumlage > 0);
  if (mitSonderumlage.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  document.getElementById('wertquoteHinweis').textContent =
    'Berechnung pro Eigentümer basierend auf Wertquote ' + wertquote + ' / 10\u2019000';
  var totalSonderumlage = 0;
  var totalProEigentuemer = 0;

  mitSonderumlage.forEach(r => {
    const tr = document.createElement('tr');
    const ausgabeText = r.ausgabenDetails.map(a => a.name + ' (' + formatCHF(a.kosten) + ')').join(', ');
    tr.innerHTML =
      '<td>' + r.gebaeudeAlter + ' Jahre</td>' +
      '<td>' + ausgabeText + '</td>' +
      '<td>' + formatCHF(r.sonderumlage) + '</td>' +
      '<td>' + formatCHF(r.sonderumlageProEigentuemer) + '</td>';
    tbody.appendChild(tr);
    totalSonderumlage += r.sonderumlage;
    totalProEigentuemer += r.sonderumlageProEigentuemer;
  });

  const trSum = document.createElement('tr');
  trSum.innerHTML =
    '<td colspan="2"><strong>Total</strong></td>' +
    '<td><strong>' + formatCHF(totalSonderumlage) + '</strong></td>' +
    '<td><strong>' + formatCHF(totalProEigentuemer) + '</strong></td>';
  tfoot.appendChild(trSum);
}

// --- Ausgaben management ---

let ausgabeCount = 2;
const MAX_AUSGABEN = 5;

function createAusgabeRow(index) {
  const div = document.createElement('div');
  div.className = 'ausgabe-row';
  div.dataset.index = index;
  div.innerHTML =
    '<button type="button" class="btn-remove" title="Entfernen">&times;</button>' +
    '<input type="text" placeholder="Name" class="ausgabe-name">' +
    '<div class="input-wrapper">' +
      '<input type="number" placeholder="Fälligkeit" class="ausgabe-faelligkeit" min="0" step="1">' +
      '<span class="unit">Jahre</span>' +
    '</div>' +
    '<div class="input-wrapper">' +
      '<input type="text" inputmode="decimal" placeholder="Kosten" class="ausgabe-kosten" data-format="chf">' +
    '</div>' +
    '<div class="toggle-group">' +
      '<button type="button" class="toggle-btn active" data-type="chf">CHF</button>' +
      '<button type="button" class="toggle-btn" data-type="prozent">% GVS</button>' +
    '</div>' +
    '<span class="ausgabe-chf-hint"></span>';
  return div;
}

function updateAddButton() {
  const btn = document.getElementById('addAusgabe');
  const rows = document.querySelectorAll('.ausgabe-row');
  btn.hidden = rows.length >= MAX_AUSGABEN;
}

document.getElementById('addAusgabe').addEventListener('click', function() {
  const container = document.getElementById('ausgaben');
  container.appendChild(createAusgabeRow(ausgabeCount++));
  updateAddButton();
});

function updateAusgabenHints() {
  var gvs = parseNum(document.getElementById('gvs').value) || 0;
  document.querySelectorAll('.ausgabe-row').forEach(function(row) {
    var hint = row.querySelector('.ausgabe-chf-hint');
    var isProzent = row.querySelector('.toggle-btn.active').dataset.type === 'prozent';
    if (isProzent) {
      var kosten = parseNum(row.querySelector('.ausgabe-kosten').value) || 0;
      hint.textContent = '= CHF ' + formatNum(gvs * kosten / 100);
    } else {
      hint.textContent = '';
    }
  });
}

document.getElementById('ausgaben').addEventListener('click', function(e) {
  // Toggle buttons
  if (e.target.classList.contains('toggle-btn')) {
    const group = e.target.closest('.toggle-group');
    group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    updateAusgabenHints();
  }
  // Remove button
  if (e.target.classList.contains('btn-remove')) {
    e.target.closest('.ausgabe-row').remove();
    updateAddButton();
  }
});

document.getElementById('ausgaben').addEventListener('input', function(e) {
  if (e.target.classList.contains('ausgabe-kosten')) {
    updateAusgabenHints();
  }
});

document.getElementById('gvs').addEventListener('input', updateAusgabenHints);

// --- CHF input formatting (blur/focus) ---

document.addEventListener('focusin', function(e) {
  if (e.target.dataset.format === 'chf') {
    var val = parseNum(e.target.value);
    if (!isNaN(val)) e.target.value = val;
  }
});

document.addEventListener('focusout', function(e) {
  if (e.target.dataset.format === 'chf') {
    var val = parseNum(e.target.value);
    if (!isNaN(val)) e.target.value = formatNum(val);
  }
});

// --- Computed CHF display for %-fields ---

function updateComputedCHF() {
  var gvs = parseNum(document.getElementById('gvs').value) || 0;
  var einzPct = parseFloat(document.getElementById('einzahlungProzent').value) || 0;
  var plafPct = parseFloat(document.getElementById('plafonierung').value) || 0;

  document.getElementById('einzahlungCHF').textContent =
    '= CHF ' + formatNum(gvs * einzPct / 100) + ' / Jahr';
  document.getElementById('plafonierungCHF').textContent =
    '= CHF ' + formatNum(gvs * plafPct / 100);
}

['gvs', 'einzahlungProzent', 'plafonierung'].forEach(function(id) {
  document.getElementById(id).addEventListener('input', updateComputedCHF);
});
updateComputedCHF();
updateAusgabenHints();

// --- Form submission ---

function runSimulation() {
  const params = getParams();
  if (isNaN(params.gebaeudeAlter) || isNaN(params.gvs) || params.gvs <= 0) return;
  const results = simulate(params);

  const plafonierungCHF = params.gvs * params.plafonierung / 100;

  document.getElementById('results').hidden = false;
  renderCharts(results, plafonierungCHF);
  renderSonderumlagen(results, params.wertquote);
}

document.getElementById('simForm').addEventListener('submit', function(e) {
  e.preventDefault();
  runSimulation();
  document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
});

// --- Auto-update with 2s debounce ---

var debounceTimer = null;

function scheduleSimulation() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runSimulation, 2000);
}

document.getElementById('simForm').addEventListener('input', scheduleSimulation);
document.getElementById('ausgaben').addEventListener('click', function(e) {
  if (e.target.classList.contains('toggle-btn') || e.target.classList.contains('btn-remove')) {
    scheduleSimulation();
  }
});
