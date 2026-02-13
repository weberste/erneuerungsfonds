'use strict';

// --- localStorage persistence ---

var STORAGE_KEY = 'erneuerungsfonds_params';

function saveToLocalStorage() {
  return; // disabled
  var data = {
    fields: {},
    ausgaben: []
  };

  // Save simple fields
  ['gebaeudeAlter', 'fondsstand', 'gvs', 'einzahlungProzent', 'plafonierung', 'wertquote'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) data.fields[id] = el.value;
  });

  // Save ausgaben
  document.querySelectorAll('.ausgabe-row').forEach(function(row) {
    data.ausgaben.push({
      name: row.querySelector('.ausgabe-name').value,
      faelligkeit: row.querySelector('.ausgabe-faelligkeit').value,
      kosten: row.querySelector('.ausgabe-kosten').value,
      typ: row.querySelector('.toggle-btn.active').dataset.type
    });
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromLocalStorage() {
  return; // disabled
  var json = localStorage.getItem(STORAGE_KEY);
  if (!json) return;

  try {
    var data = JSON.parse(json);

    // Restore simple fields
    if (data.fields) {
      Object.keys(data.fields).forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
          el.value = data.fields[id];
          // Format CHF fields
          if (el.dataset.format === 'chf') {
            var val = parseNum(el.value);
            if (!isNaN(val)) el.value = formatNum(val);
          }
        }
      });
    }

    // Restore ausgaben
    if (data.ausgaben && data.ausgaben.length > 0) {
      var container = document.getElementById('ausgaben');
      container.innerHTML = '';

      data.ausgaben.forEach(function(ausgabe, index) {
        var row = createAusgabeRow(index);
        row.querySelector('.ausgabe-name').value = ausgabe.name || '';
        row.querySelector('.ausgabe-faelligkeit').value = ausgabe.faelligkeit || '';
        row.querySelector('.ausgabe-kosten').value = ausgabe.kosten || '';

        // Set toggle
        var toggleBtns = row.querySelectorAll('.toggle-btn');
        toggleBtns.forEach(function(btn) {
          btn.classList.remove('active');
          if (btn.dataset.type === ausgabe.typ) {
            btn.classList.add('active');
          }
        });

        container.appendChild(row);
      });

      ausgabeCount = data.ausgaben.length;
      updateAddButton();
    }
  } catch (e) {
    console.warn('Could not load saved data:', e);
  }
}

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
  const plafonierungCHF = plafonierung > 0 ? gvs * plafonierung / 100 : Infinity;

  // Determine simulation end: last expense year + 2, or at least current age + 1
  const maxAlter = ausgaben.length > 0
    ? Math.max(...ausgaben.map(a => a.faelligkeit))
    : gebaeudeAlter;
  const endAlter = Math.max(maxAlter + 2, gebaeudeAlter + 1);

  let fondsstand = fondsstandStart;
  const results = [];

  for (let alter = gebaeudeAlter; alter <= endAlter; alter++) {
    // 1. Einzahlung (nicht im ersten Jahr, da bereits im Fondsstand enthalten)
    let einzahlung = 0;
    if (alter > gebaeudeAlter && fondsstand < plafonierungCHF) {
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
  const plafonierung = parseFloat(document.getElementById('plafonierung').value) || 0;
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

let chartCombined = null;

// External tooltip handler
function getOrCreateTooltip(chart) {
  var tooltipEl = chart.canvas.parentNode.querySelector('.chart-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'chart-tooltip';
    chart.canvas.parentNode.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function externalTooltipHandler(context) {
  var chart = context.chart;
  var tooltip = context.tooltip;
  var tooltipEl = getOrCreateTooltip(chart);

  if (tooltip.opacity === 0 || !tooltip.body || tooltip.body.length === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  // Build tooltip content
  var titleLines = tooltip.title || [];
  var bodyLines = tooltip.body.map(function(b) { return b.lines; });

  // Check if there's actual content
  var hasContent = bodyLines.some(function(lines) { return lines.length > 0; });
  if (!hasContent) {
    tooltipEl.style.opacity = 0;
    return;
  }

  var html = '';
  if (titleLines.length) {
    html += '<div class="chart-tooltip-title">' + titleLines.join('<br>') + '</div>';
  }
  bodyLines.forEach(function(lines, i) {
    var colors = tooltip.labelColors[i];
    lines.forEach(function(line) {
      html += '<div class="chart-tooltip-item">';
      html += '<span class="chart-tooltip-color" style="background:' + colors.backgroundColor + ';border-color:' + colors.borderColor + '"></span>';
      html += '<span>' + line + '</span>';
      html += '</div>';
    });
  });
  tooltipEl.innerHTML = html;

  // Position tooltip above chart at crosshair x
  var position = chart.canvas.getBoundingClientRect();
  var x = tooltip.caretX;
  var chartTop = chart.scales.y.top;

  tooltipEl.style.opacity = 1;
  tooltipEl.style.left = x + 'px';
  tooltipEl.style.bottom = (chart.canvas.offsetHeight - chartTop + 8) + 'px';
  tooltipEl.style.transform = 'translateX(-50%)';
}

// Crosshair plugin for vertical line on hover
const crosshairPlugin = {
  id: 'crosshair',
  afterDraw: function(chart) {
    if (chart.tooltip._active && chart.tooltip._active.length) {
      var activePoint = chart.tooltip._active[0];
      var ctx = chart.ctx;
      var x = activePoint.element.x;
      var topY = chart.scales.y.top;
      var bottomY = chart.scales.y.bottom;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.stroke();
      ctx.restore();
    }
  }
};

function formatCHF(val) {
  return val.toLocaleString('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 });
}

function renderCharts(results, plafonierung) {
  const flowsResults = results.slice(1);
  const startAlter = results[0].gebaeudeAlter;
  const hasPlafonierung = plafonierung > 0 && isFinite(plafonierung);

  // Destroy previous chart
  if (chartCombined) chartCombined.destroy();

  // Build datasets array
  var datasets = [
    {
      type: 'line',
      label: 'Fondsstand',
      data: results.map((r, i) => ({ x: i, y: r.fondsstand })),
      borderColor: '#0071e3',
      backgroundColor: 'rgba(0, 113, 227, 0.08)',
      fill: true,
      tension: 0.1,
      order: 0,
    },
  ];

  if (hasPlafonierung) {
    datasets.push({
      type: 'line',
      label: 'Plafonierung',
      data: results.map((r, i) => ({ x: i, y: plafonierung })),
      borderColor: '#aeaeb2',
      borderDash: [6, 4],
      pointRadius: 0,
      fill: false,
      order: 1,
    });
  }

  datasets.push(
    {
      label: 'Reguläre Einzahlungen',
      data: flowsResults.map((r, i) => ({ x: i + 0.5, y: r.einzahlung })),
      backgroundColor: 'rgba(52, 199, 89, 0.7)',
      hoverBackgroundColor: '#34c759',
      hoverBorderColor: '#2da44e',
      hoverBorderWidth: 2,
      stack: 'flows',
      order: 2,
    },
    {
      label: 'Einzahlungen Erneuerungen',
      data: flowsResults.map((r, i) => ({ x: i + 0.5, y: r.sonderumlage > 0 ? r.sonderumlage : null })),
      backgroundColor: 'rgba(255, 149, 0, 0.7)',
      hoverBackgroundColor: '#ff9500',
      hoverBorderColor: '#e08600',
      hoverBorderWidth: 2,
      stack: 'flows',
      order: 3,
    },
    {
      label: 'Erneuerungen',
      data: flowsResults.map((r, i) => ({ x: i + 0.5, y: r.ausgaben > 0 ? -r.ausgaben : null })),
      backgroundColor: 'rgba(255, 59, 48, 0.7)',
      hoverBackgroundColor: '#ff3b30',
      hoverBorderColor: '#e0352b',
      hoverBorderWidth: 2,
      stack: 'flows',
      order: 4,
    }
  );

  chartCombined = new Chart(document.getElementById('chartCombined'), {
    type: 'bar',
    plugins: [crosshairPlugin],
    data: {
      datasets: datasets,
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true,
            sort: function(a, b) {
              // Fondsstand first, then Plafonierung, then the rest
              var order = ['Fondsstand', 'Plafonierung', 'Reguläre Einzahlungen', 'Einzahlungen Erneuerungen', 'Erneuerungen'];
              return order.indexOf(a.text) - order.indexOf(b.text);
            }
          }
        },
        tooltip: {
          enabled: false,
          external: externalTooltipHandler,
          filter: function(item) {
            if (item.dataset.type !== 'line' && (item.parsed.y === 0 || item.parsed.y === null)) return false;
            return true;
          },
          callbacks: {
            title: function(items) {
              if (items.length === 0) return '';
              var ctx = items[0];
              var xVal = ctx.parsed.x;
              // For bars (at x.5 positions), show "Jahr X"
              // For lines (at integer positions), show "Nach X Jahren"
              if (ctx.dataset.type === 'line') {
                var alter = startAlter + Math.round(xVal);
                return 'Nach ' + alter + ' Jahren';
              } else {
                var alter = startAlter + Math.round(xVal);
                return 'Jahr ' + alter;
              }
            },
            label: function(ctx) {
              var value = Math.abs(ctx.parsed.y);
              if (ctx.dataset.type === 'line') {
                return ctx.dataset.label + ': ' + formatCHF(value);
              }
              // For Ausgaben, show expense names
              if (ctx.dataset.label === 'Erneuerungen' && ctx.parsed.y !== null && ctx.parsed.y !== 0) {
                var idx = Math.round(ctx.parsed.x - 0.5);
                var r = flowsResults[idx];
                if (r && r.ausgabenDetails.length > 0) {
                  return r.ausgabenDetails.map(a => a.name + ': -' + formatCHF(a.kosten));
                }
              }
              if (ctx.dataset.label === 'Einzahlungen Erneuerungen' && ctx.parsed.y !== null && ctx.parsed.y !== 0) {
                var idx = Math.round(ctx.parsed.x - 0.5);
                var r = flowsResults[idx];
                if (r && r.ausgabenDetails.length > 0) {
                  return r.ausgabenDetails.map(a => a.name + ': ' + formatCHF(r.sonderumlage * (a.kosten / r.ausgaben)));
                }
              }
              return ctx.dataset.label + ': ' + formatCHF(value);
            }
          }
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Gebäudealter (Jahre)' },
          min: 0,
          max: results.length - 0.5,
          offset: false,
          afterBuildTicks: function(axis) {
            // Generate ticks at bar positions (0.5, 1.5, 2.5, ...)
            axis.ticks = [];
            for (var i = 0; i < flowsResults.length; i++) {
              axis.ticks.push({ value: i + 0.5 });
            }
          },
          ticks: {
            callback: function(value) {
              var idx = Math.round(value - 0.5);
              if (idx >= 0 && idx < flowsResults.length) {
                return flowsResults[idx].gebaeudeAlter;
              }
              return '';
            }
          },
          grid: {
            display: false,
          },
        },
        y: {
          title: { display: false },
          ticks: {
            callback: v => formatCHF(v),
          },
          beginAtZero: true,
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

  // Get all results that have expenses
  const mitAusgaben = results.filter(r => r.ausgabenDetails.length > 0);
  if (mitAusgaben.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  var totalSonderumlage = 0;
  var totalProEigentuemer = 0;

  mitAusgaben.forEach(r => {
    r.ausgabenDetails.forEach(a => {
      const tr = document.createElement('tr');
      // Proportional share of shortfall based on expense's share of total
      const anteil = a.kosten / r.ausgaben;
      const anteilSonderumlage = r.sonderumlage * anteil;
      const anteilProEigentuemer = anteilSonderumlage * wertquote / 10000;
      tr.innerHTML =
        '<td>' + a.name + '</td>' +
        '<td>' + r.gebaeudeAlter + ' Jahre</td>' +
        '<td>' + formatCHF(anteilSonderumlage) + '</td>' +
        '<td>' + formatCHF(anteilProEigentuemer) + '</td>';
      tbody.appendChild(tr);
    });
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

let ausgabeCount = 4;
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
    '<div class="toggle-group">' +
      '<button type="button" class="toggle-btn active" data-type="chf">CHF</button>' +
      '<button type="button" class="toggle-btn" data-type="prozent">% GVS</button>' +
    '</div>' +
    '<div class="input-wrapper">' +
      '<input type="text" inputmode="decimal" placeholder="Kosten" class="ausgabe-kosten" data-format="chf">' +
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
  saveToLocalStorage();
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
    plafPct > 0 ? '= CHF ' + formatNum(gvs * plafPct / 100) : '= Keine';
}

['gvs', 'einzahlungProzent', 'plafonierung'].forEach(function(id) {
  document.getElementById(id).addEventListener('input', updateComputedCHF);
});

// --- Form submission ---

function renderEigentuemerInfo(params, results) {
  const jaehrlicherBeitrag = params.gvs * params.einzahlungProzent / 100;
  const beitragProEigentuemer = jaehrlicherBeitrag * params.wertquote / 10000;
  const beitragProQuartal = beitragProEigentuemer / 4;

  // Gesamtsumme der regulären Einzahlungen über die Simulationsdauer
  const gesamtEinzahlungenFonds = results.reduce((sum, r) => sum + r.einzahlung, 0);
  const gesamtEinzahlungenEigentuemer = gesamtEinzahlungenFonds * params.wertquote / 10000;
  const anzahlJahre = results.length;

  document.getElementById('einzahlungProEigentuemer').textContent = formatCHF(beitragProEigentuemer);
  document.getElementById('einzahlungProQuartal').textContent = formatCHF(beitragProQuartal);
  document.getElementById('gesamtEinzahlungen').textContent = formatCHF(gesamtEinzahlungenEigentuemer);
  document.getElementById('gesamtEinzahlungenZeitraum').textContent = anzahlJahre + ' Jahre';
  document.getElementById('wertquoteHinweis').textContent =
    'Berechnung basierend auf Wertquote ' + params.wertquote + ' / 10\u2019000';
}

function runSimulation() {
  const params = getParams();
  if (isNaN(params.gebaeudeAlter) || isNaN(params.gvs) || params.gvs <= 0) return;
  const results = simulate(params);

  const plafonierungCHF = params.gvs * params.plafonierung / 100;

  renderCharts(results, plafonierungCHF);
  renderEigentuemerInfo(params, results);
  renderSonderumlagen(results, params.wertquote);
}

document.getElementById('simForm').addEventListener('submit', function(e) {
  e.preventDefault();
  runSimulation();
  updateParamsSummary();
  closeModal();
  document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
});

// --- Save on input ---

document.getElementById('simForm').addEventListener('input', function() {
  saveToLocalStorage();
});
document.getElementById('ausgaben').addEventListener('click', function(e) {
  if (e.target.classList.contains('toggle-btn') || e.target.classList.contains('btn-remove')) {
    saveToLocalStorage();
  }
});

// --- Reset to defaults ---

var defaultValues = {
  gebaeudeAlter: '4',
  fondsstand: "181'000",
  gvs: "18'102'000",
  einzahlungProzent: '0.5',
  plafonierung: '2',
  wertquote: '243'
};

var defaultAusgaben = [
  { name: 'Sanierung Aussenhülle', faelligkeit: '30', kosten: "1'992'000", typ: 'chf' },
  { name: 'Heizanlage ohne Leitungen & UV', faelligkeit: '25', kosten: "158'000", typ: 'chf' },
  { name: 'Photovoltaikanlage', faelligkeit: '20', kosten: "111'000", typ: 'chf' },
  { name: 'Aufzugsanlagen', faelligkeit: '30', kosten: "111'000", typ: 'chf' }
];

function resetToDefaults() {
  // Reset simple fields
  Object.keys(defaultValues).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = defaultValues[id];
  });

  // Reset ausgaben
  var container = document.getElementById('ausgaben');
  container.innerHTML = '';
  defaultAusgaben.forEach(function(ausgabe, index) {
    var row = createAusgabeRow(index);
    row.querySelector('.ausgabe-name').value = ausgabe.name;
    row.querySelector('.ausgabe-faelligkeit').value = ausgabe.faelligkeit;
    row.querySelector('.ausgabe-kosten').value = ausgabe.kosten;

    var toggleBtns = row.querySelectorAll('.toggle-btn');
    toggleBtns.forEach(function(btn) {
      btn.classList.remove('active');
      if (btn.dataset.type === ausgabe.typ) {
        btn.classList.add('active');
      }
    });

    container.appendChild(row);
  });

  ausgabeCount = defaultAusgaben.length;
  updateAddButton();
  updateComputedCHF();
  updateAusgabenHints();
  localStorage.removeItem(STORAGE_KEY);
}

document.getElementById('resetDefaults').addEventListener('click', resetToDefaults);

// --- Modal ---

var modalOverlay = document.getElementById('modalOverlay');

document.getElementById('openModal').addEventListener('click', function() {
  modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
});

function closeModal() {
  modalOverlay.hidden = true;
  document.body.style.overflow = '';
}

document.getElementById('closeModal').addEventListener('click', closeModal);

modalOverlay.addEventListener('click', function(e) {
  if (e.target === modalOverlay) {
    closeModal();
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && !modalOverlay.hidden) {
    closeModal();
  }
});

// --- Params Summary ---

function updateParamsSummary() {
  var params = getParams();
  var gvs = params.gvs;

  var html = '<div class="params-summary-grid">';

  html += '<div class="params-summary-card">';
  html += '<span class="params-summary-label">Gebäudealter</span>';
  html += '<span class="params-summary-value">' + params.gebaeudeAlter + ' Jahre</span>';
  html += '</div>';

  html += '<div class="params-summary-card">';
  html += '<span class="params-summary-label">Aktueller Fondsstand</span>';
  html += '<span class="params-summary-value">CHF ' + formatNum(params.fondsstandStart) + '</span>';
  html += '</div>';

  html += '<div class="params-summary-card">';
  html += '<span class="params-summary-label">Einzahlung pro Jahr (' + params.einzahlungProzent + '%)</span>';
  html += '<span class="params-summary-value">CHF ' + formatNum(gvs * params.einzahlungProzent / 100) + '</span>';
  html += '</div>';

  html += '<div class="params-summary-card">';
  if (params.plafonierung > 0) {
    html += '<span class="params-summary-label">Plafonierung (' + params.plafonierung + '%)</span>';
    html += '<span class="params-summary-value">CHF ' + formatNum(gvs * params.plafonierung / 100) + '</span>';
  } else {
    html += '<span class="params-summary-label">Plafonierung</span>';
    html += '<span class="params-summary-value">Keine</span>';
  }
  html += '</div>';

  html += '</div>';

  if (params.ausgaben.length > 0) {
    html += '<div class="ausgaben-summary-section">';
    html += '<h4>Erwartete grosse Erneuerungen</h4>';
    html += '<table class="summary-table">';
    html += '<thead><tr><th>Erneuerung</th><th>Gebäudealter</th><th>Kosten</th></tr></thead>';
    html += '<tbody>';
    params.ausgaben.forEach(function(a) {
      var kosten = a.typ === 'prozent' ? gvs * a.kosten / 100 : a.kosten;
      html += '<tr>';
      html += '<td>' + a.name + '</td>';
      html += '<td>' + a.faelligkeit + ' Jahre</td>';
      html += '<td>' + formatCHF(kosten) + '</td>';
      html += '</tr>';
    });
    html += '</tbody>';
    html += '</table>';
    html += '</div>';
  }

  document.getElementById('paramsSummary').innerHTML = html;
}

// --- Initialize from localStorage ---

loadFromLocalStorage();
updateComputedCHF();
updateAusgabenHints();
updateParamsSummary();
runSimulation();
