/* ═══════════════════════════════════════════════════
   PROPEDGE v1.1 — Application Logic
   Futures Sizing Calculator + Monte Carlo Simulator
   + Prop Rules Tracker + Trade Journal
═══════════════════════════════════════════════════ */

'use strict';

/* ─── CONTRACT SPECS ─────────────────────────────── */
// All tick sizes and tick values verified against CME Group & AMP Futures specs
const CONTRACTS = {
  MES: {
    name: 'Micro E-mini S&P 500',
    tickSize: 0.25,
    tickValue: 1.25,
    pointValue: 5,
    desc: 'MES · $5/pt · Tick $1.25 · 0.25pt min move',
    decimals: 2
  },
  ES: {
    name: 'E-mini S&P 500',
    tickSize: 0.25,
    tickValue: 12.50,
    pointValue: 50,
    desc: 'ES · $50/pt · Tick $12.50 · 0.25pt min move',
    decimals: 2
  },
  MNQ: {
    name: 'Micro E-mini Nasdaq-100',
    tickSize: 0.25,
    tickValue: 0.50,
    pointValue: 2,
    desc: 'MNQ · $2/pt · Tick $0.50 · 0.25pt min move',
    decimals: 2
  },
  NQ: {
    name: 'E-mini Nasdaq-100',
    tickSize: 0.25,
    tickValue: 5.00,
    pointValue: 20,
    desc: 'NQ · $20/pt · Tick $5.00 · 0.25pt min move',
    decimals: 2
  },
  MGC: {
    name: 'Micro Gold',
    tickSize: 0.10,
    tickValue: 1.00,
    pointValue: 10,
    desc: 'MGC · $10/pt · Tick $1.00 · $0.10/oz min move',
    decimals: 1
  },
  GC: {
    name: 'Gold (Full)',
    tickSize: 0.10,
    tickValue: 10.00,
    pointValue: 100,
    desc: 'GC · $100/pt · Tick $10.00 · $0.10/oz min move',
    decimals: 1
  },
  MCL: {
    name: 'Micro Crude Oil',
    tickSize: 0.01,
    tickValue: 1.00,
    pointValue: 100,
    desc: 'MCL · $100/pt · Tick $1.00 · $0.01/bbl min move',
    decimals: 2
  },
  CL: {
    name: 'WTI Crude Oil',
    tickSize: 0.01,
    tickValue: 10.00,
    pointValue: 1000,
    desc: 'CL · $1,000/pt · Tick $10.00 · $0.01/bbl min move',
    decimals: 2
  },
  '6B': {
    name: 'British Pound Futures',
    tickSize: 0.0001,
    tickValue: 6.25,
    pointValue: 62500,
    desc: '6B · 62,500 GBP · Tick $6.25 · 0.0001 min move',
    decimals: 4
  },
  // 6C: CME spec = 0.00005 per tick = $5.00 per tick (100,000 CAD × 0.00005)
  '6C': {
    name: 'Canadian Dollar Futures',
    tickSize: 0.00005,
    tickValue: 5.00,
    pointValue: 100000,
    desc: '6C · 100,000 CAD · Tick $5.00 · 0.00005 min move',
    decimals: 5
  },
  '6J': {
    name: 'Japanese Yen Futures',
    tickSize: 0.0000005,
    tickValue: 6.25,
    pointValue: 12500000,
    desc: '6J · 12.5M JPY · Tick $6.25 · 0.0000005 min move',
    decimals: 7
  },
  // 6E: CME spec = 125,000 EUR, Globex outright tick = 0.00005 = $6.25
  '6E': {
    name: 'Euro FX (EUR/USD)',
    tickSize: 0.00005,
    tickValue: 6.25,
    pointValue: 125000,
    desc: '6E · 125,000 EUR · Tick $6.25 · 0.00005 min move',
    decimals: 5
  },
  // MBT: 0.1 BTC per contract. Outright tick = $5 per BTC = $0.50 per contract
  MBT: {
    name: 'Micro Bitcoin Futures',
    tickSize: 5,
    tickValue: 0.50,
    pointValue: 0.1,  // 0.1 BTC per contract; not used for notional in fiat directly
    desc: 'MBT · 0.1 BTC · Tick $0.50 · $5/BTC min move',
    decimals: 0,
    isCrypto: true   // notional = price × 0.1
  }
};

/* ─── STATE ──────────────────────────────────────── */
let state = {
  instrument: 'MES',
  accountSize: 50000,
  riskType: 'absolute',
  sidebarCollapsed: false,
  trades: [],
  equityChart: null,
  simTimer: null
};

/* ─── SIDEBAR TOGGLE ──────────────────────────────── */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const menuIcon = sidebar.querySelector('.icon-menu');
  const closeIcon = sidebar.querySelector('.icon-close');
  const labels = sidebar.querySelectorAll('.nav-label');
  const logoText = sidebar.querySelector('.logo-text');

  state.sidebarCollapsed = !state.sidebarCollapsed;

  if (state.sidebarCollapsed) {
    sidebar.style.width = '60px';
    sidebar.style.minWidth = '60px';
    menuIcon.classList.add('hidden');
    closeIcon.classList.remove('hidden');
    labels.forEach(l => l.style.display = 'none');
    if (logoText) logoText.style.display = 'none';
  } else {
    sidebar.style.width = '220px';
    sidebar.style.minWidth = '220px';
    menuIcon.classList.remove('hidden');
    closeIcon.classList.add('hidden');
    labels.forEach(l => l.style.display = '');
    if (logoText) logoText.style.display = '';
  }
}

/* ─── THEME TOGGLE ────────────────────────────────── */
document.querySelector('[data-theme-toggle]').addEventListener('click', () => {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  if (state.equityChart) {
    updateChartTheme();
    state.equityChart.update();
  }
});

/* ─── TAB SWITCHING ───────────────────────────────── */
function switchTab(name, el) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  el.classList.add('active');
  if (name === 'rulebook') updateRules();
  if (name === 'journal') renderJournal();
}

/* ═══════════════════════════════════════════════════
   SIZING CALCULATOR
═══════════════════════════════════════════════════ */

function setAccount(val, btn) {
  state.accountSize = val;
  document.getElementById('accountSize').value = val;
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  calculate();
}

function clearAccountPreset() {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  state.accountSize = parseFloat(document.getElementById('accountSize').value) || 0;
}

function setInstrument(symbol, btn) {
  state.instrument = symbol;
  document.querySelectorAll('.instrument-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('instrDetail').textContent = CONTRACTS[symbol].desc;
  calculate();
}

function toggleRiskType(type) {
  state.riskType = type;
  document.getElementById('riskAbsWrap').classList.toggle('hidden', type !== 'absolute');
  document.getElementById('riskPctWrap').classList.toggle('hidden', type !== 'percent');
  calculate();
}

function getRiskUSD() {
  const acct = parseFloat(document.getElementById('accountSize').value) || 0;
  if (state.riskType === 'absolute') {
    return parseFloat(document.getElementById('riskAbsolute').value) || 0;
  } else {
    const pct = parseFloat(document.getElementById('riskPercent').value) || 0;
    return (pct / 100) * acct;
  }
}

function formatPrice(val, decimals) {
  return val.toFixed(decimals);
}

function fmtUSD(val) {
  if (isNaN(val) || !isFinite(val)) return '—';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1000) return sign + '$' + abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + '$' + abs.toFixed(2);
}

function calculate() {
  const contract = CONTRACTS[state.instrument];
  const entry = parseFloat(document.getElementById('entryPrice').value);
  const sl    = parseFloat(document.getElementById('stopLoss').value);
  const customTP = parseFloat(document.getElementById('customTP').value);
  const riskUSD = getRiskUSD();
  const acct = parseFloat(document.getElementById('accountSize').value) || 0;

  // Clear if no valid entry/SL
  if (!entry || !sl || isNaN(entry) || isNaN(sl)) {
    document.getElementById('resultContracts').textContent = '—';
    document.getElementById('resultDirection').textContent = '';
    ['statRiskUSD','statStopDist','statStopTicks','statPerContract','statRiskPct','statNotional'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    ['rr1','rr2','rr3','rr5','rr1p','rr2p','rr3p','rr5p'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    document.getElementById('warningBox').classList.add('hidden');
    document.getElementById('customTPResult').classList.add('hidden');
    return;
  }

  const stopDist = Math.abs(entry - sl);
  const direction = entry > sl ? 'LONG' : 'SHORT';
  const isLong = direction === 'LONG';

  // Stop distance in ticks
  const stopTicks = Math.round(stopDist / contract.tickSize);

  // Risk per contract = ticksInStop × tickValue
  const riskPerContract = stopTicks * contract.tickValue;

  // Number of contracts
  let contracts = 0;
  if (riskPerContract > 0 && riskUSD > 0) {
    contracts = Math.floor(riskUSD / riskPerContract);
  }
  contracts = Math.max(0, contracts);

  // Actual risk (may differ slightly due to floor)
  const actualRisk = contracts * riskPerContract;
  const riskPct = acct > 0 ? (actualRisk / acct) * 100 : 0;

  // Notional value
  let notional;
  if (contract.isCrypto) {
    notional = entry * 0.1 * contracts; // BTC price × 0.1 BTC/contract
  } else {
    notional = entry * contract.pointValue * contracts;
  }

  // Update result number
  const numEl = document.getElementById('resultContracts');
  numEl.textContent = contracts;
  numEl.style.color = contracts === 0 ? 'var(--color-error)' : 'var(--color-primary)';

  // Direction badge
  const dirEl = document.getElementById('resultDirection');
  dirEl.textContent = contracts > 0 ? direction : '';
  dirEl.style.color = isLong ? 'var(--color-up)' : 'var(--color-down)';

  // Stats
  document.getElementById('statRiskUSD').textContent = fmtUSD(actualRisk);
  document.getElementById('statStopDist').textContent = formatPrice(stopDist, contract.decimals);
  document.getElementById('statStopTicks').textContent = stopTicks.toFixed(0) + ' ticks';
  document.getElementById('statPerContract').textContent = fmtUSD(riskPerContract);
  document.getElementById('statRiskPct').textContent = riskPct.toFixed(2) + '%';
  document.getElementById('statNotional').textContent = fmtUSD(notional);

  // RR targets
  const rrMultiples = [1, 2, 3, 5];
  const rrIds = ['rr1','rr2','rr3','rr5'];
  const rrProfitIds = ['rr1p','rr2p','rr3p','rr5p'];

  rrMultiples.forEach((r, i) => {
    const tp = isLong ? entry + stopDist * r : entry - stopDist * r;
    document.getElementById(rrIds[i]).textContent = formatPrice(tp, contract.decimals);
    const profit = contracts * stopTicks * contract.tickValue * r;
    document.getElementById(rrProfitIds[i]).textContent = '+' + fmtUSD(profit);
  });

  // Custom TP calculation
  const ctpEl = document.getElementById('customTPResult');
  if (!isNaN(customTP) && customTP > 0 && contracts > 0) {
    const tpDist = isLong ? (customTP - entry) : (entry - customTP);
    const tpTicks = Math.round(tpDist / contract.tickSize);
    const tpProfit = contracts * tpTicks * contract.tickValue;
    const tpRR = stopTicks > 0 ? tpTicks / stopTicks : 0;
    const isValidTP = isLong ? customTP > entry : customTP < entry;

    if (isValidTP && tpTicks > 0) {
      ctpEl.classList.remove('hidden');
      const profitColor = 'var(--color-up)';
      ctpEl.innerHTML = `
        <div class="ctp-row">
          <span class="ctp-label">Custom TP @ <strong>${formatPrice(customTP, contract.decimals)}</strong></span>
          <span class="ctp-rr">${tpRR.toFixed(2)}R</span>
        </div>
        <div class="ctp-row">
          <span class="ctp-stat"><span class="ctp-stat-label">Profit</span> <span style="color:${profitColor};font-family:var(--font-mono);font-weight:700">${fmtUSD(tpProfit)}</span></span>
          <span class="ctp-stat"><span class="ctp-stat-label">Ticks</span> <span style="font-family:var(--font-mono)">${tpTicks}</span></span>
          <span class="ctp-stat"><span class="ctp-stat-label">Distance</span> <span style="font-family:var(--font-mono)">${formatPrice(Math.abs(tpDist), contract.decimals)}</span></span>
        </div>
      `;
    } else {
      ctpEl.classList.remove('hidden');
      ctpEl.innerHTML = `<span style="color:var(--color-warning);font-size:var(--text-xs)">⚠ TP price is on the wrong side of entry for a ${direction} trade.</span>`;
    }
  } else {
    ctpEl.classList.add('hidden');
  }

  // Warnings
  const warnEl = document.getElementById('warningBox');
  const warnings = [];

  if (contracts === 0) {
    warnings.push('Stop too wide for this risk amount — 0 contracts. Tighten your stop or increase risk.');
  }
  if (riskPct > 2) {
    warnings.push(`Risk is ${riskPct.toFixed(1)}% of account — above the recommended 1-2% per trade.`);
  }
  if (contracts > 10 && (state.instrument === 'ES' || state.instrument === 'NQ')) {
    warnings.push('Large position size — double-check your prop firm contract limit.');
  }

  if (warnings.length > 0) {
    warnEl.classList.remove('hidden');
    warnEl.textContent = warnings.join(' ');
  } else {
    warnEl.classList.add('hidden');
  }
}

// Init
calculate();

/* ═══════════════════════════════════════════════════
   EQUITY CURVE SIMULATOR (Monte Carlo)

   DRAWDOWN LOGIC:
   ─ "Trailing DD" (like Topstep): account blows when
     equity drops more than maxDD from its peak balance.
     The limit tracks up with profits but never down.
   ─ "Fixed DD" (like FTMO): account blows when equity
     drops more than maxDD from starting balance only.
     The limit is always: starting_capital - maxDD.

   DAILY LOSS:
   ─ Simulated by grouping trades into "days" (iterations / tradingDays).
   ─ If intra-day losses exceed maxDaily, the day ends
     (no more trades that day) and the blown check is applied.
═══════════════════════════════════════════════════ */

function syncSlider(inputId, sliderId) {
  const val = document.getElementById(sliderId).value;
  document.getElementById(inputId).value = val;
}

function syncInput(inputId, sliderId) {
  const val = document.getElementById(inputId).value;
  document.getElementById(sliderId).value = val;
}

function scheduleSimulate() {
  if (state.simTimer) clearTimeout(state.simTimer);
  state.simTimer = setTimeout(runSimulation, 400);
}

// Listen to sim risk type radio
document.querySelectorAll('input[name="simRiskType"]').forEach(r => {
  r.addEventListener('change', () => {
    const isPct = r.value === 'pct';
    document.getElementById('simRiskPctWrap').classList.toggle('hidden', !isPct);
    document.getElementById('simRiskAbsWrap').classList.toggle('hidden', isPct);
    scheduleSimulate();
  });
});

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getChartColors() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    grid: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    axis: isDark ? '#7a8499' : '#5c6474',
    text: isDark ? '#d8dde8' : '#141820'
  };
}

function updateChartTheme() {
  if (!state.equityChart) return;
  const c = getChartColors();
  state.equityChart.options.scales.x.ticks.color = c.axis;
  state.equityChart.options.scales.y.ticks.color = c.axis;
  state.equityChart.options.scales.x.grid.color = c.grid;
  state.equityChart.options.scales.y.grid.color = c.grid;
}

function runSimulation() {
  const capital    = parseFloat(document.getElementById('simCapital').value) || 50000;
  const winRate    = parseFloat(document.getElementById('simWinRate').value) / 100;
  const rrr        = parseFloat(document.getElementById('simRRR').value) || 2;
  const iterations = Math.min(Math.max(parseInt(document.getElementById('simIterations').value) || 100, 10), 1000);
  const numLines   = Math.min(Math.max(parseInt(document.getElementById('simLines').value) || 50, 5), 200);
  const maxDailyRaw = parseFloat(document.getElementById('simMaxDaily').value);
  const maxDDRaw    = parseFloat(document.getElementById('simMaxDD').value);
  const maxDaily    = (!isNaN(maxDailyRaw) && maxDailyRaw > 0) ? maxDailyRaw : Infinity;
  const maxDD       = (!isNaN(maxDDRaw) && maxDDRaw > 0) ? maxDDRaw : Infinity;
  const isRiskFixed = document.querySelector('input[name="simRiskType"]:checked').value === 'abs';
  const isTrailingDD = document.querySelector('input[name="ddType"]:checked').value === 'trailing';
  const tradingDays  = Math.max(parseInt(document.getElementById('simTradingDays').value) || 20, 1);

  // How many trades per simulated "day"
  const tradesPerDay = Math.max(1, Math.round(iterations / tradingDays));

  const simResults = [];
  const finalValues = [];
  let blownCount = 0;

  for (let s = 0; s < numLines; s++) {
    let equity = capital;
    const curve = [capital];
    let blown = false;
    let peakEquity = capital; // used for trailing DD

    let tradeInDay = 0;
    let dayLoss = 0;
    let dayDone = false; // hit daily limit today

    for (let t = 0; t < iterations; t++) {
      if (blown) {
        curve.push(equity);
        continue;
      }

      // Start of new day
      if (tradeInDay === 0) {
        dayLoss = 0;
        dayDone = false;
      }

      // If daily limit already hit today, skip remaining trades in the day
      if (dayDone) {
        tradeInDay = (tradeInDay + 1) % tradesPerDay;
        curve.push(equity);
        continue;
      }

      // Compute risk for this trade
      const riskAmount = isRiskFixed
        ? (parseFloat(document.getElementById('simRiskAbs').value) || 300)
        : equity * (parseFloat(document.getElementById('simRiskPct').value) / 100);

      const win = Math.random() < winRate;
      const pnl = win ? riskAmount * rrr : -riskAmount;

      equity += pnl;
      curve.push(equity);

      // Track daily loss (only losses count toward the daily limit)
      if (!win) {
        dayLoss += riskAmount;
        if (dayLoss >= maxDaily) {
          dayDone = true; // stop trading for today
        }
      }

      // Update peak for trailing DD
      if (equity > peakEquity) peakEquity = equity;

      // Check blown conditions
      if (isTrailingDD) {
        // Trailing: blown if equity drops more than maxDD from peak
        if (peakEquity - equity >= maxDD) {
          blown = true;
          equity = peakEquity - maxDD;
        }
      } else {
        // Fixed: blown if equity drops more than maxDD from starting capital
        if (capital - equity >= maxDD) {
          blown = true;
          equity = capital - maxDD;
        }
      }

      // Hard floor: can't go below 0
      if (equity <= 0) {
        blown = true;
        equity = 0;
      }

      tradeInDay = (tradeInDay + 1) % tradesPerDay;
    }

    simResults.push({ curve, blown });
    finalValues.push(equity);
    if (blown) blownCount++;
  }

  // Sort: blown lines first (behind), then profitable
  simResults.sort((a, b) => Number(b.blown) - Number(a.blown));

  // Build Chart.js datasets
  const labels = Array.from({ length: iterations + 1 }, (_, i) => i);
  const datasets = [];

  simResults.forEach(sim => {
    const alpha = sim.blown ? 0.10 : 0.15;
    const color = sim.blown ? `rgba(240,82,82,${alpha})` : `rgba(61,187,110,${alpha})`;
    datasets.push({
      data: sim.curve,
      borderColor: color,
      backgroundColor: 'transparent',
      borderWidth: 1,
      pointRadius: 0,
      tension: 0.2
    });
  });

  // Median line
  const medianCurve = labels.map(t => {
    const vals = simResults.map(s => s.curve[t] ?? s.curve[s.curve.length - 1]);
    return median(vals);
  });
  datasets.push({
    data: medianCurve,
    borderColor: 'rgba(77,159,255,0.9)',
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    pointRadius: 0,
    tension: 0.3,
    borderDash: [6, 3]
  });

  // Starting capital baseline
  datasets.push({
    data: Array(iterations + 1).fill(capital),
    borderColor: 'rgba(122,132,153,0.3)',
    backgroundColor: 'transparent',
    borderWidth: 1,
    pointRadius: 0,
    borderDash: [4, 4]
  });

  // Render chart
  const canvas = document.getElementById('equityChart');
  const placeholder = document.getElementById('chartPlaceholder');
  placeholder.style.display = 'none';
  canvas.style.display = 'block';

  const c = getChartColors();
  if (state.equityChart) state.equityChart.destroy();

  state.equityChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          filter: item => item.datasetIndex === datasets.length - 2,
          callbacks: {
            label: ctx => ' Median: $' + ctx.parsed.y.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
          }
        }
      },
      scales: {
        x: {
          grid: { color: c.grid },
          ticks: { color: c.axis, maxTicksLimit: 10, font: { family: "'JetBrains Mono', monospace", size: 11 } },
          title: { display: true, text: 'Trade #', color: c.axis, font: { size: 11 } }
        },
        y: {
          grid: { color: c.grid },
          ticks: { color: c.axis, font: { family: "'JetBrains Mono', monospace", size: 11 }, callback: v => '$' + (v / 1000).toFixed(0) + 'k' },
          title: { display: true, text: 'Equity', color: c.axis, font: { size: 11 } }
        }
      }
    }
  });

  // Stats
  const profitCount = numLines - blownCount;
  const profitPct   = ((profitCount / numLines) * 100).toFixed(0);
  const blownPct    = ((blownCount / numLines) * 100).toFixed(0);
  const medFinal    = median(finalValues);
  const bestFinal   = Math.max(...finalValues);
  const worstFinal  = Math.min(...finalValues);

  const riskVal = isRiskFixed
    ? (parseFloat(document.getElementById('simRiskAbs').value) || 300)
    : (parseFloat(document.getElementById('simRiskPct').value) / 100 * capital);

  const evPerTrade = (winRate * riskVal * rrr) - ((1 - winRate) * riskVal);

  document.getElementById('ssProfit').textContent = profitCount + ' / ' + numLines + ' (' + profitPct + '%)';
  document.getElementById('ssBlown').textContent  = blownCount + ' / ' + numLines + ' (' + blownPct + '%)';
  document.getElementById('ssMedian').textContent = fmtUSD(medFinal);
  document.getElementById('ssBest').textContent   = fmtUSD(bestFinal);
  document.getElementById('ssWorst').textContent  = fmtUSD(worstFinal);
  document.getElementById('ssEV').textContent     = fmtUSD(evPerTrade);
  document.getElementById('ssEV').className = 'stat-value sim-stat-value ' + (evPerTrade >= 0 ? 'success' : 'danger');

  renderTargetAnalysis(capital, winRate, rrr, riskVal, iterations, finalValues, blownCount, numLines);
}

function renderTargetAnalysis(capital, winRate, rrr, riskPerTrade, iterations, finalValues, blownCount, numLines) {
  const target = parseFloat(document.getElementById('simMonthlyTarget').value) || 0;
  const tradingDays = parseInt(document.getElementById('simTradingDays').value) || 20;
  if (!target) return;

  const evPerTrade  = (winRate * riskPerTrade * rrr) - ((1 - winRate) * riskPerTrade);
  const monthlyEV   = evPerTrade * iterations;
  const targetCapital = capital + target;
  const hitTarget   = finalValues.filter(v => v >= targetCapital).length;
  const hitPct      = ((hitTarget / numLines) * 100).toFixed(0);
  const isOnTrack   = monthlyEV >= target;

  // Required win rate at current RRR to hit target in iterations trades
  const reqRisk = riskPerTrade;
  const reqWR   = ((target / iterations) + reqRisk) / ((1 + rrr) * reqRisk);
  const reqWRPct = Math.min(reqWR * 100, 99.9).toFixed(1);

  // Required RRR at current win rate
  const reqRRR = winRate > 0 ? ((target / iterations) / (winRate * riskPerTrade)) + (1 - winRate) / winRate : null;

  // Trades per day needed
  const reqTradesPerDay = evPerTrade > 0 ? Math.ceil((target / monthlyEV) * (iterations / tradingDays)) : null;

  let html = `
    <div class="target-analysis-grid">
      <div class="target-item">
        <div class="target-label">Monthly Target</div>
        <div class="target-value">${fmtUSD(target)}</div>
      </div>
      <div class="target-item">
        <div class="target-label">Expected Monthly P&L</div>
        <div class="target-value" style="color:${monthlyEV >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${fmtUSD(monthlyEV)}</div>
      </div>
      <div class="target-item">
        <div class="target-label">Simulations Hitting Target</div>
        <div class="target-value">${hitTarget} / ${numLines} (${hitPct}%)</div>
      </div>
      <div class="target-item">
        <div class="target-label">EV per Trade</div>
        <div class="target-value" style="color:${evPerTrade >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${fmtUSD(evPerTrade)}</div>
      </div>
      <div class="target-item">
        <div class="target-label">Min Win Rate Needed (current RRR)</div>
        <div class="target-value">${reqWRPct}%</div>
      </div>
      <div class="target-item">
        <div class="target-label">Trades Needed / Day</div>
        <div class="target-value">${reqTradesPerDay !== null && isFinite(reqTradesPerDay) && reqTradesPerDay > 0 ? reqTradesPerDay : 'N/A'}</div>
      </div>
    </div>
  `;

  if (isOnTrack) {
    html += `<div class="analysis-insight">Your edge is sufficient for a ${fmtUSD(target)}/month target. ${(winRate*100).toFixed(0)}% WR at ${rrr}:1 RRR gives expected monthly P&L of ${fmtUSD(monthlyEV)}. ${hitPct}% of simulations hit the target.</div>`;
  } else {
    const improvementNeeded = target - monthlyEV;
    html += `<div class="analysis-insight warning">
      Expected P&L (${fmtUSD(monthlyEV)}) is ${fmtUSD(improvementNeeded)} short of your target. To close the gap:
      <br>• Raise win rate to ≥ <strong>${reqWRPct}%</strong> at current ${rrr}:1 RRR, OR
      <br>• Improve RRR to ≥ <strong>${reqRRR !== null ? reqRRR.toFixed(2) : '?'}:1</strong> at current ${(winRate*100).toFixed(0)}% WR, OR
      <br>• Increase risk per trade (increases drawdown risk proportionally)
    </div>`;
  }

  document.getElementById('targetContent').innerHTML = html;
}

/* ═══════════════════════════════════════════════════
   PROP FIRM RULES TRACKER
═══════════════════════════════════════════════════ */

const FIRM_PRESETS = {
  topstep: { maxDaily: 1000, maxDD: 2000, profitTarget: 3000, name: 'Topstep $50K' },
  ftmo50:  { maxDaily: 2500, maxDD: 5000, profitTarget: 5000, name: 'FTMO $50K' },
  apex:    { maxDaily: 1000, maxDD: 2500, profitTarget: 3000, name: 'Apex Trader $50K' }
};

function loadFirmPreset() {
  const preset = document.getElementById('firmPreset').value;
  if (!FIRM_PRESETS[preset]) return;
  const p = FIRM_PRESETS[preset];
  document.getElementById('ruleMaxDaily').value = p.maxDaily;
  document.getElementById('ruleMaxDD').value = p.maxDD;
  document.getElementById('ruleProfitTarget').value = p.profitTarget;
  updateRules();
}

function updateRules() {
  const balance      = parseFloat(document.getElementById('ruleBalance').value) || 0;
  const startBalance = parseFloat(document.getElementById('ruleStartBalance').value) || 0;
  const dailyPnl     = parseFloat(document.getElementById('ruleDailyPnl').value) || 0;
  const maxDaily     = parseFloat(document.getElementById('ruleMaxDaily').value) || 1;
  const maxDD        = parseFloat(document.getElementById('ruleMaxDD').value) || 1;
  const target       = parseFloat(document.getElementById('ruleProfitTarget').value) || 0;

  const totalDD  = Math.max(0, startBalance - balance);
  const totalPnl = balance - startBalance;
  const dayLoss  = Math.max(0, -dailyPnl);

  const dailyUsedPct  = Math.min((dayLoss / maxDaily) * 100, 100);
  const ddUsedPct     = Math.min((totalDD / maxDD) * 100, 100);
  const targetPct     = target > 0 ? Math.min((totalPnl / target) * 100, 100) : 0;

  function getStatus(pct) {
    if (pct >= 90) return 'danger';
    if (pct >= 60) return 'warn';
    return 'ok';
  }
  function barColor(status) {
    if (status === 'danger') return 'var(--color-error)';
    if (status === 'warn') return 'var(--color-warning)';
    return 'var(--color-success)';
  }

  const dailyStatus = getStatus(dailyUsedPct);
  const ddStatus    = getStatus(ddUsedPct);

  const dailyRemaining = Math.max(0, maxDaily - dayLoss);
  const ddRemaining    = Math.max(0, maxDD - totalDD);
  const targetRemaining = Math.max(0, target - totalPnl);

  document.getElementById('rulesStatusGrid').innerHTML = `
    <div class="rule-status-card ${dailyStatus}">
      <span class="rule-name">Daily Loss Used</span>
      <span class="rule-value" style="color:${barColor(dailyStatus)}">${fmtUSD(dayLoss)}</span>
      <div class="rule-bar-wrap"><div class="rule-bar" style="width:${dailyUsedPct}%;background:${barColor(dailyStatus)}"></div></div>
      <div class="rule-sub"><span>Limit: ${fmtUSD(maxDaily)}</span><span>Remaining: ${fmtUSD(dailyRemaining)}</span></div>
    </div>
    <div class="rule-status-card ${ddStatus}">
      <span class="rule-name">Total Drawdown</span>
      <span class="rule-value" style="color:${barColor(ddStatus)}">${fmtUSD(totalDD)}</span>
      <div class="rule-bar-wrap"><div class="rule-bar" style="width:${ddUsedPct}%;background:${barColor(ddStatus)}"></div></div>
      <div class="rule-sub"><span>Limit: ${fmtUSD(maxDD)}</span><span>Remaining: ${fmtUSD(ddRemaining)}</span></div>
    </div>
    <div class="rule-status-card ok">
      <span class="rule-name">Profit Target Progress</span>
      <span class="rule-value" style="color:${totalPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${fmtUSD(totalPnl)}</span>
      <div class="rule-bar-wrap"><div class="rule-bar" style="width:${targetPct}%;background:var(--color-primary)"></div></div>
      <div class="rule-sub"><span>Target: ${fmtUSD(target)}</span><span>Needed: ${fmtUSD(targetRemaining)}</span></div>
    </div>
    <div class="rule-status-card ok">
      <span class="rule-name">Current Balance</span>
      <span class="rule-value">${fmtUSD(balance)}</span>
      <div class="rule-bar-wrap"><div class="rule-bar" style="width:${startBalance > 0 ? Math.min((balance/startBalance)*100,100) : 0}%;background:var(--color-primary)"></div></div>
      <div class="rule-sub"><span>Start: ${fmtUSD(startBalance)}</span><span>P&L: ${fmtUSD(totalPnl)}</span></div>
    </div>
    <div class="rule-status-card ${dailyStatus === 'danger' ? 'danger' : ddStatus === 'danger' ? 'danger' : 'ok'}">
      <span class="rule-name">Account Status</span>
      <span class="rule-value" style="font-size:var(--text-base);color:${dailyStatus === 'danger' || ddStatus === 'danger' ? 'var(--color-error)' : targetPct >= 100 ? 'var(--color-up)' : 'var(--color-up)'}">
        ${dailyStatus === 'danger' ? 'DAILY LIMIT HIT' : ddStatus === 'danger' ? 'MAX DD BREACHED' : targetPct >= 100 ? 'TARGET HIT ✓' : 'ACTIVE'}
      </span>
      <div class="rule-bar-wrap"><div class="rule-bar" style="width:100%;background:${dailyStatus === 'danger' || ddStatus === 'danger' ? 'var(--color-error)' : targetPct >= 100 ? 'var(--color-success)' : 'var(--color-primary)'}"></div></div>
      <div class="rule-sub"><span>Daily: ${dailyUsedPct.toFixed(0)}%</span><span>DD: ${ddUsedPct.toFixed(0)}%</span></div>
    </div>
    <div class="rule-status-card ok">
      <span class="rule-name">Today's P&L</span>
      <span class="rule-value" style="color:${dailyPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${fmtUSD(dailyPnl)}</span>
      <div class="rule-bar-wrap">
        <div class="rule-bar" style="width:${Math.min(Math.abs(dailyPnl)/maxDaily*100,100)}%;background:${dailyPnl >= 0 ? 'var(--color-success)' : 'var(--color-error)'}"></div>
      </div>
      <div class="rule-sub"><span>Max loss: ${fmtUSD(maxDaily)}</span></div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════
   TRADE JOURNAL
═══════════════════════════════════════════════════ */

function openTradeModal() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('jtDate').value = today;
  document.getElementById('tradeModal').classList.remove('hidden');
}

function closeTradeModal() {
  document.getElementById('tradeModal').classList.add('hidden');
}

function saveTradeEntry() {
  const date       = document.getElementById('jtDate').value;
  const instrument = document.getElementById('jtInstrument').value;
  const direction  = document.getElementById('jtDirection').value;
  const contracts  = parseInt(document.getElementById('jtContracts').value) || 1;
  const entry      = parseFloat(document.getElementById('jtEntry').value);
  const exit       = parseFloat(document.getElementById('jtExit').value);
  const stopLoss   = parseFloat(document.getElementById('jtStopLoss').value);
  const notes      = document.getElementById('jtNotes').value;

  if (!date || !entry || !exit) {
    alert('Please fill in at least: date, entry price, and exit price.');
    return;
  }

  const contract = CONTRACTS[instrument];
  let pnlOverride = parseFloat(document.getElementById('jtPnl').value);

  let pnl;
  if (!isNaN(pnlOverride) && pnlOverride !== 0) {
    pnl = pnlOverride;
  } else {
    const priceDiff = direction === 'LONG' ? (exit - entry) : (entry - exit);
    const ticks = Math.round(priceDiff / contract.tickSize);
    pnl = ticks * contract.tickValue * contracts;
  }

  let rMultiple = null;
  if (!isNaN(stopLoss) && stopLoss) {
    const riskDist  = Math.abs(entry - stopLoss);
    const priceDiff = direction === 'LONG' ? (exit - entry) : (entry - exit);
    rMultiple = riskDist > 0 ? priceDiff / riskDist : null;
  }

  state.trades.unshift({ date, instrument, direction, contracts, entry, exit, pnl, rMultiple, notes, id: Date.now() });
  renderJournal();
  closeTradeModal();
  ['jtEntry','jtExit','jtStopLoss','jtPnl','jtNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

function deleteTrade(id) {
  state.trades = state.trades.filter(t => t.id !== id);
  renderJournal();
}

function clearJournal() {
  if (confirm('Clear all trade entries?')) {
    state.trades = [];
    renderJournal();
  }
}

function renderJournal() {
  const tbody = document.getElementById('tradeTableBody');
  const emptyRow = document.getElementById('emptyJournal');

  if (state.trades.length === 0) {
    tbody.innerHTML = '';
    tbody.appendChild(emptyRow);
    emptyRow.style.display = '';
    renderJournalStats([]);
    return;
  }

  tbody.innerHTML = '';
  state.trades.forEach((t, i) => {
    const isWin = t.pnl > 0;
    const contract = CONTRACTS[t.instrument];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--color-text-muted)">${state.trades.length - i}</td>
      <td>${t.date}</td>
      <td><strong>${t.instrument}</strong></td>
      <td><span class="badge badge-${t.direction.toLowerCase()}">${t.direction}</span></td>
      <td>${isNaN(t.entry) ? '—' : t.entry.toFixed(contract?.decimals ?? 2)}</td>
      <td>${isNaN(t.exit) ? '—' : t.exit.toFixed(contract?.decimals ?? 2)}</td>
      <td>${t.contracts}</td>
      <td class="${isWin ? 'badge-win' : 'badge-loss'}" style="font-weight:700">${fmtUSD(t.pnl)}</td>
      <td style="color:${t.rMultiple === null ? 'var(--color-text-faint)' : t.rMultiple >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">
        ${t.rMultiple === null ? '—' : (t.rMultiple >= 0 ? '+' : '') + t.rMultiple.toFixed(2) + 'R'}
      </td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;color:var(--color-text-muted);font-family:var(--font-body)">${t.notes || '—'}</td>
      <td><button class="btn-icon" onclick="deleteTrade(${t.id})" style="font-size:12px;color:var(--color-error)">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  renderJournalStats(state.trades);
}

function renderJournalStats(trades) {
  const el = document.getElementById('journalStats');
  if (trades.length === 0) { el.innerHTML = ''; return; }

  const wins   = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const winRate  = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const avgWin   = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss  = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const rrr      = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
  const maxWin   = wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0;
  const maxLoss  = losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0;

  el.innerHTML = `
    <div class="stat-card"><span class="stat-label">Total P&L</span><span class="stat-value ${totalPnl >= 0 ? 'success' : 'danger'}">${fmtUSD(totalPnl)}</span></div>
    <div class="stat-card"><span class="stat-label">Win Rate</span><span class="stat-value">${winRate.toFixed(0)}% (${wins.length}/${trades.length})</span></div>
    <div class="stat-card"><span class="stat-label">Avg Win / Avg Loss</span><span class="stat-value">${fmtUSD(avgWin)} / ${fmtUSD(Math.abs(avgLoss))}</span></div>
    <div class="stat-card"><span class="stat-label">RRR (avg)</span><span class="stat-value">${rrr.toFixed(2)}</span></div>
    <div class="stat-card"><span class="stat-label">Best / Worst</span><span class="stat-value">${fmtUSD(maxWin)} / ${fmtUSD(maxLoss)}</span></div>
    <div class="stat-card"><span class="stat-label">Trades Logged</span><span class="stat-value">${trades.length}</span></div>
  `;
}

/* ─── INIT ───────────────────────────────────────── */
updateRules();
renderJournal();
setTimeout(runSimulation, 300);
