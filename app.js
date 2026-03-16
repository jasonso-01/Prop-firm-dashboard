/* ═══════════════════════════════════════════════════
   PROPEDGE — Application Logic
   Futures Sizing Calculator + Monte Carlo Simulator
   + Prop Rules Tracker + Trade Journal
═══════════════════════════════════════════════════ */

'use strict';

/* ─── CONTRACT SPECS ─────────────────────────────── */
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
  '6C': {
    name: 'Canadian Dollar Futures',
    tickSize: 0.0001,
    tickValue: 10.00,
    pointValue: 100000,
    desc: '6C · 100,000 CAD · Tick $10.00 · 0.0001 min move',
    decimals: 4
  },
  '6J': {
    name: 'Japanese Yen Futures',
    tickSize: 0.0000005,
    tickValue: 6.25,
    pointValue: 12500000,
    desc: '6J · 12.5M JPY · Tick $6.25 · 0.0000005 min move',
    decimals: 7
  }
};

/* ─── STATE ──────────────────────────────────────── */
let state = {
  instrument: 'MES',
  accountSize: 50000,
  riskType: 'absolute',
  trades: [],
  equityChart: null,
  simTimer: null
};

/* ─── SIDEBAR TOGGLE ──────────────────────────────── */
document.getElementById('sidebarToggle').addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  const w = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width').trim();
  const collapsed = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-collapsed').trim();
  if (sidebar.style.width === collapsed) {
    sidebar.style.width = w;
    sidebar.style.minWidth = w;
  } else {
    sidebar.style.width = collapsed;
    sidebar.style.minWidth = collapsed;
  }
});

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

function fmt(val, decimals = 2) {
  if (isNaN(val) || !isFinite(val)) return '—';
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
  const riskUSD = getRiskUSD();
  const acct = parseFloat(document.getElementById('accountSize').value) || 0;

  // Update risk percent stat
  if (state.riskType === 'percent') {
    const pct = parseFloat(document.getElementById('riskPercent').value) || 0;
    const abs = (pct / 100) * acct;
    // show in input area — skip
  }

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
    return;
  }

  const stopDist = Math.abs(entry - sl);
  const direction = entry > sl ? 'LONG' : 'SHORT';
  const isLong = direction === 'LONG';

  // Stop distance in ticks
  const stopTicks = stopDist / contract.tickSize;

  // Risk per contract = ticksInStop × tickValue
  const riskPerContract = stopTicks * contract.tickValue;

  // Number of contracts
  let contracts = 0;
  if (riskPerContract > 0 && riskUSD > 0) {
    contracts = Math.floor(riskUSD / riskPerContract);
  }

  // Clamp to at least 0
  contracts = Math.max(0, contracts);

  // Actual risk (may differ slightly due to floor)
  const actualRisk = contracts * riskPerContract;
  const riskPct = acct > 0 ? (actualRisk / acct) * 100 : 0;

  // Notional value
  const notional = entry * contract.pointValue * contracts;

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
    let tp;
    if (isLong) {
      tp = entry + stopDist * r;
    } else {
      tp = entry - stopDist * r;
    }
    document.getElementById(rrIds[i]).textContent = formatPrice(tp, contract.decimals);

    const profit = contracts * stopTicks * contract.tickValue * r;
    document.getElementById(rrProfitIds[i]).textContent = '+' + fmtUSD(profit);
  });

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
═══════════════════════════════════════════════════ */

function syncSlider(inputId, sliderId) {
  const val = document.getElementById(sliderId).value;
  document.getElementById(inputId).value = val;
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

function getSimRiskPerTrade(capital) {
  const type = document.querySelector('input[name="simRiskType"]:checked').value;
  if (type === 'pct') {
    const pct = parseFloat(document.getElementById('simRiskPct').value) / 100;
    return capital * pct;
  } else {
    return parseFloat(document.getElementById('simRiskAbs').value) || 300;
  }
}

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
  const lines      = Math.min(Math.max(parseInt(document.getElementById('simLines').value) || 50, 5), 200);
  const maxDaily   = parseFloat(document.getElementById('simMaxDaily').value) || Infinity;
  const maxDD      = parseFloat(document.getElementById('simMaxDD').value) || Infinity;
  const isRiskFixed = document.querySelector('input[name="simRiskType"]:checked').value === 'abs';

  const simLines = [];
  const finalValues = [];
  let blownCount = 0;

  for (let s = 0; s < lines; s++) {
    let equity = capital;
    const curve = [capital];
    let blown = false;
    let peakEquity = capital;
    let consecutiveLoss = 0;

    for (let t = 0; t < iterations; t++) {
      if (blown) { curve.push(equity); continue; }

      const risk = isRiskFixed
        ? (parseFloat(document.getElementById('simRiskAbs').value) || 300)
        : equity * (parseFloat(document.getElementById('simRiskPct').value) / 100);

      const win = Math.random() < winRate;
      const pnl = win ? risk * rrr : -risk;

      // Simulate daily loss limit — use grouping of ~5 trades as "day"
      if (!win) {
        consecutiveLoss += risk;
        if (consecutiveLoss >= maxDaily) {
          equity -= consecutiveLoss;
          consecutiveLoss = 0;
          if (equity < capital - maxDD) {
            blown = true;
          }
          curve.push(equity);
          continue;
        }
      } else {
        consecutiveLoss = 0;
      }

      equity += pnl;

      if (equity > peakEquity) peakEquity = equity;
      if (peakEquity - equity > maxDD || equity <= 0) {
        blown = true;
        equity = Math.max(0, capital - maxDD);
      }
      curve.push(equity);
    }

    simLines.push({ curve, blown });
    finalValues.push(equity);
    if (blown) blownCount++;
  }

  // Sort: blown lines first (faded), then profitable
  simLines.sort((a, b) => Number(b.blown) - Number(a.blown));

  // Build Chart.js datasets
  const labels = Array.from({ length: iterations + 1 }, (_, i) => i);
  const datasets = [];

  simLines.forEach((sim, i) => {
    const alpha = sim.blown ? 0.08 : 0.12;
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

  // Compute & add median line
  const medianCurve = labels.map(t => {
    const vals = simLines.map(s => s.curve[t] ?? s.curve[s.curve.length - 1]);
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

  // Capital baseline
  datasets.push({
    data: Array(iterations + 1).fill(capital),
    borderColor: 'rgba(122,132,153,0.3)',
    backgroundColor: 'transparent',
    borderWidth: 1,
    pointRadius: 0,
    borderDash: [4, 4]
  });

  // Render or update chart
  const canvas = document.getElementById('equityChart');
  const placeholder = document.getElementById('chartPlaceholder');
  placeholder.style.display = 'none';
  canvas.style.display = 'block';

  const c = getChartColors();

  if (state.equityChart) {
    state.equityChart.destroy();
  }

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
          filter: (item) => item.datasetIndex === datasets.length - 2,
          callbacks: {
            label: (ctx) => {
              return ' Median: $' + ctx.parsed.y.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: c.grid },
          ticks: {
            color: c.axis,
            maxTicksLimit: 10,
            font: { family: "'JetBrains Mono', monospace", size: 11 }
          },
          title: {
            display: true,
            text: 'Trade #',
            color: c.axis,
            font: { size: 11 }
          }
        },
        y: {
          grid: { color: c.grid },
          ticks: {
            color: c.axis,
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: v => '$' + (v / 1000).toFixed(0) + 'k'
          },
          title: {
            display: true,
            text: 'Equity',
            color: c.axis,
            font: { size: 11 }
          }
        }
      }
    }
  });

  // Stats
  const profitCount = lines - blownCount;
  const blownPct = ((blownCount / lines) * 100).toFixed(0);
  const profitPct = ((profitCount / lines) * 100).toFixed(0);
  const medFinal = median(finalValues);
  const bestFinal = Math.max(...finalValues);
  const worstFinal = Math.min(...finalValues);

  // Expected value per trade
  const ev = (winRate * (parseFloat(document.getElementById('simRiskPct').value) / 100 * capital || 300) * rrr)
    - ((1 - winRate) * (parseFloat(document.getElementById('simRiskPct').value) / 100 * capital || 300));

  document.getElementById('ssProfit').textContent = profitCount + ' / ' + lines + ' (' + profitPct + '%)';
  document.getElementById('ssBlown').textContent = blownCount + ' / ' + lines + ' (' + blownPct + '%)';
  document.getElementById('ssMedian').textContent = fmtUSD(medFinal);
  document.getElementById('ssBest').textContent = fmtUSD(bestFinal);
  document.getElementById('ssWorst').textContent = fmtUSD(worstFinal);

  // EV per trade
  const riskVal = isRiskFixed
    ? (parseFloat(document.getElementById('simRiskAbs').value) || 300)
    : (parseFloat(document.getElementById('simRiskPct').value) / 100 * capital);
  const evPerTrade = (winRate * riskVal * rrr) - ((1 - winRate) * riskVal);
  document.getElementById('ssEV').textContent = fmtUSD(evPerTrade);
  document.getElementById('ssEV').className = 'stat-value sim-stat-value ' + (evPerTrade >= 0 ? 'success' : 'danger');

  // Monthly target analysis
  renderTargetAnalysis(capital, winRate, rrr, riskVal, iterations, finalValues, blownCount, lines);
}

function renderTargetAnalysis(capital, winRate, rrr, riskPerTrade, iterations, finalValues, blownCount, lines) {
  const target = parseFloat(document.getElementById('simMonthlyTarget').value) || 0;
  const tradingDays = parseInt(document.getElementById('simTradingDays').value) || 20;

  if (!target) return;

  const evPerTrade = (winRate * riskPerTrade * rrr) - ((1 - winRate) * riskPerTrade);
  const tradesPerDay = iterations / tradingDays;
  const monthlyEV = evPerTrade * iterations;

  // How many of our final values exceed target?
  const targetCapital = capital + target;
  const hitTarget = finalValues.filter(v => v >= targetCapital).length;
  const hitPct = ((hitTarget / lines) * 100).toFixed(0);

  // Required win rate to hit target with current RRR
  // target/iterations = winRate*rrr*risk - (1-winRate)*risk
  // target/iterations = winRate*(1+rrr)*risk - risk
  // winRate = (target/iterations + risk) / ((1+rrr)*risk)
  const reqWR = ((target / iterations) + riskPerTrade) / ((1 + rrr) * riskPerTrade);
  const reqWRPct = (reqWR * 100).toFixed(1);

  // Required trades per day
  const reqTradesPerDay = evPerTrade > 0 ? Math.ceil((target / monthlyEV) * tradesPerDay) : null;

  const isOnTrack = monthlyEV >= target;
  const insightClass = isOnTrack ? '' : 'warning';

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
        <div class="target-label">Sim Runs Hitting Target</div>
        <div class="target-value">${hitTarget} / ${lines} (${hitPct}%)</div>
      </div>
      <div class="target-item">
        <div class="target-label">EV per Trade</div>
        <div class="target-value" style="color:${evPerTrade >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${fmtUSD(evPerTrade)}</div>
      </div>
      <div class="target-item">
        <div class="target-label">Required Win Rate (current RRR)</div>
        <div class="target-value">${reqWRPct}%</div>
      </div>
      <div class="target-item">
        <div class="target-label">Trades Needed / Day</div>
        <div class="target-value">${reqTradesPerDay !== null && isFinite(reqTradesPerDay) ? reqTradesPerDay : 'N/A'}</div>
      </div>
    </div>
  `;

  if (isOnTrack) {
    html += `<div class="analysis-insight">Your edge is sufficient to achieve $${target.toLocaleString()} / month on expectation with ${(winRate*100).toFixed(0)}% WR and ${rrr}:1 RRR. ${hitPct}% of simulations hit target.</div>`;
  } else {
    const improvementNeeded = target - monthlyEV;
    const rrNeeded = ((target / iterations) + riskPerTrade) / ((1 - (winRate)) * riskPerTrade) - 1;

    html += `<div class="analysis-insight warning">
      Expected P&L (${fmtUSD(monthlyEV)}) falls ${fmtUSD(improvementNeeded)} short of your target. To fix this:
      <br>• Raise win rate to ≥ ${reqWRPct}%, OR
      <br>• Improve RRR to ≥ ${rrNeeded > 0 ? rrNeeded.toFixed(1) : '?'}:1 at current win rate, OR
      <br>• Increase risk per trade (caution: higher drawdown risk)
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
  const balance = parseFloat(document.getElementById('ruleBalance').value) || 0;
  const startBalance = parseFloat(document.getElementById('ruleStartBalance').value) || 0;
  const dailyPnl = parseFloat(document.getElementById('ruleDailyPnl').value) || 0;
  const maxDaily = parseFloat(document.getElementById('ruleMaxDaily').value) || 1;
  const maxDD = parseFloat(document.getElementById('ruleMaxDD').value) || 1;
  const target = parseFloat(document.getElementById('ruleProfitTarget').value) || 0;

  const totalDD = startBalance - balance;
  const totalPnl = balance - startBalance;
  const dayLoss = Math.max(0, -dailyPnl);

  // Status calculations
  const dailyUsedPct = Math.min((dayLoss / maxDaily) * 100, 100);
  const ddUsedPct = Math.min((totalDD / maxDD) * 100, 100);
  const targetPct = target > 0 ? Math.min((totalPnl / target) * 100, 100) : 0;

  function getStatus(pct) {
    if (pct >= 80) return 'danger';
    if (pct >= 50) return 'warn';
    return 'ok';
  }

  function barColor(status) {
    if (status === 'danger') return 'var(--color-error)';
    if (status === 'warn') return 'var(--color-warning)';
    return 'var(--color-success)';
  }

  const dailyStatus = getStatus(dailyUsedPct);
  const ddStatus = getStatus(ddUsedPct);
  const targetStatus = targetPct >= 100 ? 'ok' : (targetPct >= 50 ? 'warn' : 'ok');

  // Remaining
  const dailyRemaining = Math.max(0, maxDaily - dayLoss);
  const ddRemaining = Math.max(0, maxDD - totalDD);
  const targetRemaining = Math.max(0, target - totalPnl);

  const grid = document.getElementById('rulesStatusGrid');
  grid.innerHTML = `
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

    <div class="rule-status-card ${targetStatus}">
      <span class="rule-name">Profit Target Progress</span>
      <span class="rule-value" style="color:${totalPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${fmtUSD(totalPnl)}</span>
      <div class="rule-bar-wrap"><div class="rule-bar" style="width:${targetPct}%;background:var(--color-primary)"></div></div>
      <div class="rule-sub"><span>Target: ${fmtUSD(target)}</span><span>Needed: ${fmtUSD(targetRemaining)}</span></div>
    </div>

    <div class="rule-status-card ok">
      <span class="rule-name">Current Balance</span>
      <span class="rule-value">${fmtUSD(balance)}</span>
      <div class="rule-bar-wrap"><div class="rule-bar" style="width:${Math.min((balance/startBalance)*100,100)}%;background:var(--color-primary)"></div></div>
      <div class="rule-sub"><span>Start: ${fmtUSD(startBalance)}</span><span>P&L: ${fmtUSD(totalPnl)}</span></div>
    </div>

    <div class="rule-status-card ${dailyStatus === 'danger' ? 'danger' : ddStatus === 'danger' ? 'danger' : 'ok'}">
      <span class="rule-name">Account Status</span>
      <span class="rule-value" style="font-size:var(--text-base); color:${dailyStatus === 'danger' || ddStatus === 'danger' ? 'var(--color-error)' : 'var(--color-up)'}">
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
      <div class="rule-sub"><span>Max loss: ${fmtUSD(maxDaily)}</span><span>&nbsp;</span></div>
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
  const date      = document.getElementById('jtDate').value;
  const instrument= document.getElementById('jtInstrument').value;
  const direction = document.getElementById('jtDirection').value;
  const contracts = parseInt(document.getElementById('jtContracts').value) || 1;
  const entry     = parseFloat(document.getElementById('jtEntry').value);
  const exit      = parseFloat(document.getElementById('jtExit').value);
  const stopLoss  = parseFloat(document.getElementById('jtStopLoss').value);
  const notes     = document.getElementById('jtNotes').value;

  if (!date || !entry || !exit) {
    alert('Please fill in at least: date, entry price, and exit price.');
    return;
  }

  const contract = CONTRACTS[instrument];
  let pnlOverride = parseFloat(document.getElementById('jtPnl').value);

  // Auto-calculate P&L if not overridden
  let pnl;
  if (!isNaN(pnlOverride) && pnlOverride !== 0) {
    pnl = pnlOverride;
  } else {
    const priceDiff = direction === 'LONG' ? (exit - entry) : (entry - exit);
    const ticks = priceDiff / contract.tickSize;
    pnl = ticks * contract.tickValue * contracts;
  }

  // R multiple
  let rMultiple = null;
  if (!isNaN(stopLoss) && stopLoss) {
    const riskDist = Math.abs(entry - stopLoss);
    const priceDiff = direction === 'LONG' ? (exit - entry) : (entry - exit);
    rMultiple = priceDiff / riskDist;
  }

  state.trades.unshift({ date, instrument, direction, contracts, entry, exit, pnl, rMultiple, notes, id: Date.now() });
  renderJournal();
  closeTradeModal();

  // Clear fields
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
    const tr = document.createElement('tr');
    const isWin = t.pnl > 0;
    tr.innerHTML = `
      <td style="color:var(--color-text-muted)">${state.trades.length - i}</td>
      <td>${t.date}</td>
      <td><strong>${t.instrument}</strong></td>
      <td><span class="badge badge-${t.direction.toLowerCase()}">${t.direction}</span></td>
      <td>${isNaN(t.entry) ? '—' : t.entry.toFixed(CONTRACTS[t.instrument]?.decimals ?? 2)}</td>
      <td>${isNaN(t.exit) ? '—' : t.exit.toFixed(CONTRACTS[t.instrument]?.decimals ?? 2)}</td>
      <td>${t.contracts}</td>
      <td class="${isWin ? 'badge-win' : 'badge-loss'}" style="font-weight:700">${fmtUSD(t.pnl)}</td>
      <td style="color:${t.rMultiple === null ? 'var(--color-text-faint)' : t.rMultiple >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">
        ${t.rMultiple === null ? '—' : (t.rMultiple >= 0 ? '+' : '') + t.rMultiple.toFixed(2) + 'R'}
      </td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;color:var(--color-text-muted);font-family:var(--font-body)">${t.notes || '—'}</td>
      <td><button class="btn-icon" onclick="deleteTrade(${t.id})" style="font-size:12px;color:var(--color-error)">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  renderJournalStats(state.trades);
}

function renderJournalStats(trades) {
  const el = document.getElementById('journalStats');

  if (trades.length === 0) {
    el.innerHTML = '';
    return;
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const rrr = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
  const maxWin = wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0;
  const maxLoss = losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0;

  el.innerHTML = `
    <div class="stat-card">
      <span class="stat-label">Total P&L</span>
      <span class="stat-value ${totalPnl >= 0 ? 'success' : 'danger'}">${fmtUSD(totalPnl)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Win Rate</span>
      <span class="stat-value">${winRate.toFixed(0)}% (${wins.length}/${trades.length})</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Avg Win / Avg Loss</span>
      <span class="stat-value">${fmtUSD(avgWin)} / ${fmtUSD(Math.abs(avgLoss))}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">RRR (avg)</span>
      <span class="stat-value">${rrr.toFixed(2)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Best / Worst</span>
      <span class="stat-value">${fmtUSD(maxWin)} / ${fmtUSD(maxLoss)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Trades Logged</span>
      <span class="stat-value">${trades.length}</span>
    </div>
  `;
}

/* ─── INIT ───────────────────────────────────────── */
updateRules();
renderJournal();
// Pre-run a simulation on load for visual appeal
setTimeout(runSimulation, 300);
