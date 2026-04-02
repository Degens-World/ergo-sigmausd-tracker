// SigmaUSD Tracker — Ergo Stablecoin Dashboard
// Data from Ergo Explorer API (SigmaUSD bank box) + CoinGecko

const EXPLORER = 'https://api.ergoplatform.com';
const COINGECKO = 'https://api.coingecko.com/api/v3';

// SigmaUSD bank contract address (main-net)
const BANK_ADDRESS = 'MUbV38YgqHy7XbsoXWF5z7EZm524Ybdwe5p9WDrbhruZRtehkRPT6trRcLrJq9fR1pcqEPfbHawcGECa7BN4Ypib2hfQmHPKF5JVJVGrYF6BSMXiHdSSm2FiPsTaZDa5p8BoMHvHBinm3WKZM5W1KiDGhBGcBpJ9i8ZuBCDX8JX5U6bB5MMDV5R2Bj5Gn1L5F1GrP5YW5RKd7wAG6iuhyiJDJP3s2aDKzd8FNPiQHWrE3qVMQ9FbdmGnG6E6X4gy3iQ6E6QHbiVJQz2L4W1FcK4Ey9qcJF5PnkxmqmFWpN5P4fY';

// Known SigmaUSD bank NFT ID (identifies the bank box)
const BANK_NFT = '7d672d1def471720ca5782fd6473e47e796d9ac32c3852e2d4a5be3104f2c03';

// SigUSD token ID
const SIGUSD_TOKEN = '03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04';
// SigRSV token ID
const SIGRSV_TOKEN = '003bd19d0187117f130b62e1bcab0939929ff5c7709f843c5c4dd158949285d0';

// Nano ERG per 1 ERG
const NANO = 1e9;

// History for chart (simulated from ratio drift since we can't fetch historical on-chain data easily)
let historyData = [];

let reserveChart = null;

async function fetchBankBox() {
  // Fetch unspent boxes at bank address filtered by bank NFT
  const url = `${EXPLORER}/api/v1/boxes/unspent/byTokenId/${BANK_NFT}?limit=1&offset=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Explorer error: ${res.status}`);
  const data = await res.json();
  if (!data.items || data.items.length === 0) throw new Error('Bank box not found');
  return data.items[0];
}

async function fetchErgPrice() {
  try {
    const res = await fetch(`${COINGECKO}/simple/price?ids=ergo&vs_currencies=usd`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ergo?.usd ?? null;
  } catch { return null; }
}

function parseBankBox(box) {
  // SigmaUSD bank box registers:
  // R4: Long — circulating SigUSD (in cents, i.e. 1 SigUSD = 100)
  // R5: Long — circulating SigRSV (in nanoERG units, but actually in base units)
  // The value of the box is the ERG reserve
  const reserveNano = box.value; // nanoERG
  const reserveErg = reserveNano / NANO;

  // Extract from registers
  const r4 = box.additionalRegisters?.R4?.renderedValue;
  const r5 = box.additionalRegisters?.R5?.renderedValue;

  // SigUSD circulating in cents (divide by 100 for SigUSD)
  const sigUsdCents = r4 ? BigInt(r4) : 0n;
  const sigUsdCirc = Number(sigUsdCents) / 100;

  // SigRSV circulating (units)
  const sigRsvCirc = r5 ? Number(r5) : 0;

  return { reserveErg, sigUsdCirc, sigRsvCirc };
}

function calcPrices(reserveErg, sigUsdCirc, sigRsvCirc, ergUsd) {
  // SigmaUSD protocol pricing:
  // 1 SigUSD = 1 USD worth of ERG = 1/ergUsd ERG (oracle price)
  // Reserve ratio = reserveUSD / sigUsdSupplyUSD
  const reserveUsd = reserveErg * (ergUsd || 0);
  const sigUsdSupplyUsd = sigUsdCirc; // 1 SigUSD = 1 USD

  const reserveRatio = sigUsdSupplyUsd > 0 ? (reserveUsd / sigUsdSupplyUsd) * 100 : 0;

  // SigUSD price in ERG = 1 / ergUsd (target peg)
  const sigUsdPriceErg = ergUsd ? (1 / ergUsd) : 0;

  // SigRSV price = (Reserve - SigUSD liabilities) / SigRSV supply
  const liabilitiesErg = sigUsdSupplyUsd / (ergUsd || 1);
  const equityErg = reserveErg - liabilitiesErg;
  const sigRsvPriceErg = sigRsvCirc > 0 ? Math.max(0, equityErg / sigRsvCirc) : 0;

  return { reserveRatio, sigUsdPriceErg, sigRsvPriceErg, reserveUsd };
}

function drawGauge(ratio) {
  const canvas = document.getElementById('gaugeCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H - 20;
  const r = 130;

  // Background arc (full semicircle)
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0, false);
  ctx.lineWidth = 22;
  ctx.strokeStyle = '#1e2d40';
  ctx.stroke();

  // Colored arc segments
  const segments = [
    { min: 0,   max: 200, color: '#ef4444' },
    { min: 200, max: 400, color: '#f59e0b' },
    { min: 400, max: 800, color: '#10b981' },
  ];

  const maxRatio = 800;
  for (const seg of segments) {
    const startAngle = Math.PI + (seg.min / maxRatio) * Math.PI;
    const endAngle   = Math.PI + (Math.min(seg.max, maxRatio) / maxRatio) * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle, false);
    ctx.lineWidth = 22;
    ctx.strokeStyle = seg.color;
    ctx.stroke();
  }

  // Needle
  const clampedRatio = Math.min(ratio, maxRatio);
  const needleAngle = Math.PI + (clampedRatio / maxRatio) * Math.PI;
  const nx = cx + (r - 10) * Math.cos(needleAngle);
  const ny = cy + (r - 10) * Math.sin(needleAngle);

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Labels
  ctx.fillStyle = '#64748b';
  ctx.font = '11px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('0%', cx - r - 4, cy + 4);
  ctx.fillText('400%', cx, cy - r - 8);
  ctx.fillText('800%+', cx + r + 4, cy + 4);
}

function healthLabel(ratio) {
  if (ratio >= 400) return { text: 'Healthy', cls: 'healthy' };
  if (ratio >= 200) return { text: 'Warning', cls: 'warning' };
  return { text: 'Critical', cls: 'critical' };
}

function oracleText(ratio, sigUsdCirc, reserveErg, ergUsd) {
  const reserveUsd = (reserveErg * (ergUsd || 0)).toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (ratio >= 600) {
    return `The reserve crystal shows brilliant green — a ${ratio.toFixed(0)}% reserve ratio means the SigmaUSD protocol is overflowing with collateral. With $${reserveUsd} USD locked in reserve and only ${sigUsdCirc.toLocaleString()} SigUSD in circulation, SigRSV holders are feasting on pure equity gains. The peg is fortress-strong. Diamond hands are justified.`;
  }
  if (ratio >= 400) {
    return `The oracle sees stability. At ${ratio.toFixed(0)}% reserve ratio, the SigmaUSD bank holds comfortable margins above the 400% healthy threshold. The ${sigUsdCirc.toLocaleString()} SigUSD in circulation is backed more than 4× over in ERG reserves. Peg is intact — steady as she goes.`;
  }
  if (ratio >= 300) {
    return `The reserve ratio stands at ${ratio.toFixed(0)}% — healthy but trending toward the yellow zone. With $${reserveUsd} in reserve backing ${sigUsdCirc.toLocaleString()} SigUSD, the protocol still runs comfortably. Keep an eye on ERG price volatility — a sharp correction could compress the ratio quickly.`;
  }
  if (ratio >= 200) {
    return `Warning signals flicker at ${ratio.toFixed(0)}% reserve ratio. The protocol is still solvent but approaching the danger zone. SigRSV redemptions are temporarily blocked when ratio drops below 200%. With ${sigUsdCirc.toLocaleString()} SigUSD outstanding and only $${reserveUsd} in reserve, every ERG price tick matters. Watch closely.`;
  }
  return `ALERT: Reserve ratio at ${ratio.toFixed(0)}% — CRITICAL TERRITORY. SigRSV redemptions are BLOCKED (ratio < 200%). The protocol is solvent but under severe stress. New SigUSD minting is also paused. Recovery depends entirely on ERG price appreciation. This is a rare and precarious moment for the SigmaUSD ecosystem.`;
}

function updateHistory(ratio) {
  const now = Date.now();
  // Load persisted history from sessionStorage
  const stored = sessionStorage.getItem('sigUsdHistory');
  if (stored) {
    historyData = JSON.parse(stored);
  }
  // Prune to last 20 entries
  if (historyData.length >= 20) historyData.shift();
  historyData.push({ t: now, ratio });
  sessionStorage.setItem('sigUsdHistory', JSON.stringify(historyData));
}

function renderChart() {
  const ctx = document.getElementById('reserveChart').getContext('2d');
  const labels = historyData.map(d => {
    const dt = new Date(d.t);
    return `${dt.getHours()}:${String(dt.getMinutes()).padStart(2,'0')}`;
  });
  const values = historyData.map(d => d.ratio);

  if (reserveChart) reserveChart.destroy();

  reserveChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Reserve Ratio (%)',
        data: values,
        borderColor: '#00d4ff',
        backgroundColor: 'rgba(0,212,255,0.08)',
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: '#00d4ff',
        tension: 0.35,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.y.toFixed(1)}%`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 11 } },
          grid: { color: '#1e2d40' }
        },
        y: {
          min: 0,
          ticks: {
            color: '#64748b',
            font: { size: 11 },
            callback: v => v + '%'
          },
          grid: { color: '#1e2d40' },
          // Reference lines
          afterDraw(chart) {
            const ctx2 = chart.ctx;
            const yAxis = chart.scales.y;
            const xAxis = chart.scales.x;
            const lines = [
              { y: 200, color: '#ef4444', label: 'Critical 200%' },
              { y: 400, color: '#10b981', label: 'Healthy 400%' },
            ];
            for (const line of lines) {
              const yPx = yAxis.getPixelForValue(line.y);
              if (yPx < yAxis.top || yPx > yAxis.bottom) continue;
              ctx2.save();
              ctx2.beginPath();
              ctx2.moveTo(xAxis.left, yPx);
              ctx2.lineTo(xAxis.right, yPx);
              ctx2.strokeStyle = line.color;
              ctx2.lineWidth = 1;
              ctx2.setLineDash([4, 4]);
              ctx2.stroke();
              ctx2.fillStyle = line.color;
              ctx2.font = '10px Segoe UI, sans-serif';
              ctx2.fillText(line.label, xAxis.right - 80, yPx - 4);
              ctx2.restore();
            }
          }
        }
      }
    }
  });
}

function fmt(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(decimals);
}

async function loadAll() {
  document.getElementById('refresh-btn').textContent = '⟳ Loading…';
  document.getElementById('last-updated').textContent = 'Fetching…';

  try {
    const [box, ergUsd] = await Promise.all([fetchBankBox(), fetchErgPrice()]);
    const { reserveErg, sigUsdCirc, sigRsvCirc } = parseBankBox(box);
    const { reserveRatio, sigUsdPriceErg, sigRsvPriceErg } = calcPrices(reserveErg, sigUsdCirc, sigRsvCirc, ergUsd);

    // Update gauge
    drawGauge(reserveRatio);
    document.getElementById('reserve-ratio-val').textContent = reserveRatio.toFixed(1) + '%';

    // Health badge
    const { text, cls } = healthLabel(reserveRatio);
    const badge = document.getElementById('health-badge');
    badge.textContent = text;
    badge.className = 'health-badge ' + cls;

    // Stats
    document.getElementById('sigusd-price').textContent = sigUsdPriceErg.toFixed(4);
    document.getElementById('sigrsv-price').textContent = sigRsvPriceErg < 0.001
      ? sigRsvPriceErg.toExponential(3)
      : sigRsvPriceErg.toFixed(6);
    document.getElementById('reserve-erg').textContent = fmt(reserveErg, 0);
    document.getElementById('sigusd-supply').textContent = fmt(sigUsdCirc, 0);
    document.getElementById('sigrsv-supply').textContent = fmt(sigRsvCirc, 0);
    document.getElementById('erg-price-usd').textContent = ergUsd ? '$' + ergUsd.toFixed(2) : '—';

    // Oracle
    document.getElementById('oracle-text').textContent =
      oracleText(reserveRatio, sigUsdCirc, reserveErg, ergUsd);

    // History + chart
    updateHistory(reserveRatio);
    renderChart();

    // Timestamp
    const now = new Date();
    document.getElementById('last-updated').textContent =
      `Last updated: ${now.toLocaleTimeString()}`;

  } catch (err) {
    console.error(err);
    document.getElementById('oracle-text').textContent =
      'The oracle is temporarily silent — could not reach the Ergo Explorer. ' + err.message;
    document.getElementById('last-updated').textContent = 'Error fetching data';
  }

  document.getElementById('refresh-btn').textContent = '⟳ Refresh';
}

// Auto-refresh every 2 minutes
loadAll();
setInterval(loadAll, 120_000);
