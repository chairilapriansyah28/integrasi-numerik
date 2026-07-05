// ===== CONFIG =====
const API_BASE = '/api/integration';

// ===== STATE =====
let state = {
  method: 'rectangle',
  variant: 'left',
  vizMode: 'both',
  history: JSON.parse(localStorage.getItem('numeri_history') || '[]'),
  lastResult: null,
  stepsVisible: false,
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  renderHistory();
  initNavHighlight();
  drawPlaceholderChart();
});

// ===== METHOD SELECTION =====
function selectMethod(method, btn) {
  state.method = method;
  document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // variant group hanya untuk segiempat
  document.getElementById('variantGroup').style.display = method === 'rectangle' ? 'block' : 'none';
  // rumus hint untuk trapesium
  document.getElementById('trapInfo').style.display = method === 'trapezoid' ? 'block' : 'none';
  // legend trapesium di visualizer
  document.getElementById('legendTrap').style.display = method === 'trapezoid' ? 'flex' : 'none';
}

function selectVariant(v, btn) {
  state.variant = v;
  document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setFunc(f) {
  document.getElementById('funcInput').value = f;
}

// Fungsi untuk auto-calculate n berdasarkan toleransi
function calculateOptimalN(func, a, b, tolerance) {
  const f = parseFunc(func);
  const MAX_N = 100000;

  function rawCompute(n) {
    const h = (b - a) / n;
    let sum;
    if (state.method === 'trapezoid') {
      sum = f(a) + f(b);
      for (let i = 1; i < n; i++) sum += 2 * f(a + i * h);
      return (h / 2) * sum;
    }
    sum = 0;
    for (let i = 0; i < n; i++) {
      let xi;
      if (state.method === 'midpoint')      xi = a + (i + 0.5) * h;
      else if (state.variant === 'right')    xi = a + (i + 1) * h;
      else                                   xi = a + i * h;
      sum += f(xi);
    }
    return h * sum;
  }

  function estimateErr(n) {
    const p = state.method === 'rectangle' ? 1 : 2;
    const rn = rawCompute(n), r2n = rawCompute(n * 2);
    return Math.abs(r2n - rn) / (Math.pow(2, p) - 1);
  }

  let lo = 1, hi = 1;
  let errHi = estimateErr(hi);

  while (errHi > tolerance && hi < MAX_N) {
    lo = hi;
    hi = Math.min(hi * 2, MAX_N);
    errHi = estimateErr(hi);
    if (hi === MAX_N) break;
  }

  if (errHi > tolerance) {
    return null; // Tidak konvergen
  }

  // Binary search halus
  let left = lo, right = hi;
  while (right - left > 1) {
    const mid = Math.floor((left + right) / 2);
    if (estimateErr(mid) <= tolerance) right = mid;
    else left = mid;
  }

  return right;
}

function setVizMode(mode, btn) {
  state.vizMode = mode;
  document.querySelectorAll('.viz-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (state.lastResult) drawVisualization(state.lastResult);
}

// ===== CALCULATE =====
async function calculate() {
  const func = document.getElementById('funcInput').value.trim();
  const a = parseFloat(document.getElementById('lowerBound').value);
  const b = parseFloat(document.getElementById('upperBound').value);
  const tolStr = document.getElementById('targetTolerance').value.trim();
  const tolerance = parseFloat(tolStr);

  if (!func)              return showStatus('Masukkan fungsi f(x)!', 'error');
  if (isNaN(a)||isNaN(b)) return showStatus('Batas a dan b harus angka!', 'error');
  if (a >= b)             return showStatus('Batas bawah harus < batas atas!', 'error');
  if (!tolStr || isNaN(tolerance) || tolerance <= 0) return showStatus('Masukkan toleransi target yang valid, misal 0.001!', 'error');

  showStatus('Menghitung n optimal...', 'loading');
  setLoadingUI(true);

  // Auto-calculate n berdasarkan toleransi
  const n = calculateOptimalN(func, a, b, tolerance);
  
  if (n === null) {
    showStatus('Tidak dapat menemukan n yang memenuhi toleransi. Coba naikkan toleransi.', 'error');
    setLoadingUI(false);
    document.getElementById('autoNValue').textContent = '—';
    document.getElementById('autoNStatus').textContent = 'Gagal hitung';
    document.getElementById('autoNStatus').style.color = '#dc2626';
    return;
  }

  // Update display n yang sudah dihitung
  document.getElementById('autoNValue').textContent = n;
  document.getElementById('autoNStatus').textContent = '✓ Optimal';
  document.getElementById('autoNStatus').style.color = '#10b981';

  showStatus('Menghitung integral...', 'loading');

  const payload = {
    function: func,
    lowerBound: a,
    upperBound: b,
    n: n,
    method: state.method,
    variant: state.variant,
  };

  try {
    const res = await fetch(`${API_BASE}/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Server error');
    }

    const data = await res.json();
    state.lastResult = { ...data, func, a, b, n };
    attachExactClientSide(state.lastResult); // jaga-jaga kalau backend belum kirim field exact
    renderResult(state.lastResult);
    drawVisualization(state.lastResult);
    drawConvergence(state.lastResult);
    addToHistory(state.lastResult);
    showStatus('Berhasil dihitung ✓', 'ok');

  } catch (err) {
    // Fallback lokal jika backend tidak aktif
    const fallback = calculateLocally(func, a, b, n, state.method, state.variant);
    if (fallback) {
      attachExactClientSide(fallback);
      state.lastResult = fallback;
      renderResult(fallback);
      drawVisualization(fallback);
      drawConvergence(fallback);
      addToHistory(fallback);
      showStatus('Mode offline (backend tidak aktif)', 'ok');
    } else {
      showStatus(`Error: ${err.message}`, 'error');
    }
  } finally {
    setLoadingUI(false);
  }
}

// ===== LOCAL CALCULATION (FALLBACK) =====
function parseFunc(expr) {
  const e = expr
    .replace(/\^/g, '**')
    .replace(/e\*\*x/g, 'Math.exp(x)')
    .replace(/e\^x/g, 'Math.exp(x)')
    .replace(/sin\(/g, 'Math.sin(')
    .replace(/cos\(/g, 'Math.cos(')
    .replace(/tan\(/g, 'Math.tan(')
    .replace(/sqrt\(/g, 'Math.sqrt(')
    .replace(/log\(/g, 'Math.log10(')
    .replace(/ln\(/g, 'Math.log(')
    .replace(/pi/g, 'Math.PI')
    .replace(/e(?!\*|\^|x|p)/g, 'Math.E');
  return (x) => {
    try { return eval(e.replace(/x/g, `(${x})`)); }
    catch { return NaN; }
  };
}

// ===== NILAI EKSAK (SYMBOLIC INTEGRATION) — sisi client (fallback offline) =====
// Mengenali suku-suku sederhana yang dipisah +/- pada level teratas.
// Mendukung: x^n, c*x^n, c*x, c, sin(x), cos(x), tan(x), e^x, 1/x, sqrt(x), sinh(x), cosh(x)
function symbolicIntegrate(funcStr, a, b) {
  try {
    const norm = funcStr.toLowerCase().replace(/\s/g, '').replace(/\*\*/g, '^');
    const terms = splitTerms(norm);
    if (!terms || terms.length === 0) return null;

    let value = 0;
    const parts = [];

    for (const t of terms) {
      const ad = antiderivativeOf(t.body);
      if (!ad) return null;
      const coef = t.sign * t.coef;
      value += coef * (ad.eval(b) - ad.eval(a));
      const coefLabel = Math.abs(coef) === 1 ? '' : (Number.isInteger(Math.abs(coef)) ? Math.abs(coef) + '·' : Math.abs(coef).toFixed(3) + '·');
      parts.push((t.sign < 0 ? '-' : (parts.length ? '+' : '')) + coefLabel + ad.label);
    }

    return { available: true, value, antiderivative: parts.join(' ').replace(/^\+/, '') };
  } catch {
    return null;
  }
}

function splitTerms(expr) {
  const terms = [];
  let sign = 1, start = 0, depth = 0;
  for (let i = 0; i <= expr.length; i++) {
    const end = i === expr.length;
    const c = end ? ' ' : expr[i];
    if (c === '(') depth++;
    if (c === ')') depth--;
    const boundary = depth === 0 && (c === '+' || c === '-') && i > start;
    if (boundary || end) {
      const raw = expr.slice(start, i).trim();
      if (raw) {
        const t = parseTerm(sign, raw);
        if (!t) return null;
        terms.push(t);
      }
      if (!end) sign = c === '-' ? -1 : 1;
      start = i + 1;
    }
  }
  return terms;
}

function parseTerm(sign, raw) {
  const m = raw.match(/^(-?\d*\.?\d*)\*?(.*)$/);
  if (!m) return null;
  let coef = 1;
  const coefStr = m[1];
  let body = m[2];
  if (coefStr && coefStr !== '-') {
    const parsed = parseFloat(coefStr);
    if (isNaN(parsed)) return null;
    coef = parsed;
  }
  if (!body) body = '1'; // suku konstan
  return { sign, coef, body };
}

function antiderivativeOf(body) {
  const table = {
    '1':        { eval: x => x,                 label: 'x' },
    'x':        { eval: x => x*x/2,             label: 'x²/2' },
    'sin(x)':   { eval: x => -Math.cos(x),      label: '-cos(x)' },
    'cos(x)':   { eval: x => Math.sin(x),       label: 'sin(x)' },
    'tan(x)':   { eval: x => -Math.log(Math.abs(Math.cos(x))), label: '-ln|cos(x)|' },
    'e^x':      { eval: x => Math.exp(x),       label: 'eˣ' },
    'exp(x)':   { eval: x => Math.exp(x),       label: 'eˣ' },
    '1/x':      { eval: x => Math.log(Math.abs(x)), label: 'ln|x|' },
    'sqrt(x)':  { eval: x => (2/3)*Math.pow(x,1.5), label: '(2/3)x^1.5' },
    'sinh(x)':  { eval: x => Math.cosh(x),      label: 'cosh(x)' },
    'cosh(x)':  { eval: x => Math.sinh(x),      label: 'sinh(x)' },
  };
  if (table[body]) return table[body];

  const pm = body.match(/^x\^(-?\d+\.?\d*)$/);
  if (pm) {
    const n = parseFloat(pm[1]);
    if (n === -1) return null; // sudah ditangani via '1/x'
    const newPow = n + 1;
    const lbl = Number.isInteger(newPow) ? newPow : newPow.toString();
    return { eval: x => Math.pow(x, newPow) / newPow, label: `x^${lbl}/${lbl}` };
  }
  return null;
}

function attachExactClientSide(data) {
  // Jika backend sudah mengirim exactAvailable, jangan timpa
  if (data.exactAvailable !== undefined && data.exactAvailable !== null) return;

  const exact = symbolicIntegrate(data.func, data.a, data.b);
  if (exact && exact.available) {
    data.exactAvailable = true;
    data.exactValue = exact.value;
    data.antiderivative = exact.antiderivative;
    data.trueError = Math.abs(parseFloat(data.result) - exact.value);
    data.trueErrorPercent = exact.value !== 0
      ? (data.trueError / Math.abs(exact.value)) * 100
      : (data.trueError === 0 ? 0 : Infinity);
  } else {
    data.exactAvailable = false;
  }
}

// ===== PENCARIAN N OPTIMAL =====


function calculateLocally(funcStr, a, b, n, method, variant) {
  try {
    const f = parseFunc(funcStr);
    const h = (b - a) / n;
    let sum = 0;
    const steps = [];

    if (method === 'trapezoid') {
      // ---- KAIDAH TRAPESIUM ----
      // I ≈ (h/2) · [f(a) + 2·Σf(xᵢ) + f(b)]
      const fa = f(a), fb = f(b);
      sum = fa + fb;
      steps.push({ index: 0, xi: a.toFixed(6), fxi: fa.toFixed(6), coef: '1' });

      for (let i = 1; i < n; i++) {
        const xi = a + i * h;
        const fxi = f(xi);
        sum += 2 * fxi;
        if (i < 9) steps.push({ index: i, xi: xi.toFixed(6), fxi: fxi.toFixed(6), coef: '2' });
      }

      steps.push({ index: n, xi: b.toFixed(6), fxi: fb.toFixed(6), coef: '1' });
      const result = (h / 2) * sum;

      // Error estimate with 2n
      let sum2 = f(a) + f(b);
      const h2 = h / 2;
      for (let i = 1; i < n * 2; i++) sum2 += 2 * f(a + i * h2);
      const result2 = (h2 / 2) * sum2;
      const errorEst = Math.abs(result - result2) / 3; // Richardson p=2

      return { result, h, n, method, variant: 'trapezoid', func: funcStr, a, b, steps, errorEstimate: errorEst, local: true };

    } else {
      // ---- SEGIEMPAT / TITIK TENGAH ----
      for (let i = 0; i < n; i++) {
        let xi;
        if (method === 'midpoint')        xi = a + (i + 0.5) * h;
        else if (variant === 'right')      xi = a + (i + 1) * h;
        else                               xi = a + i * h;

        const fxi = f(xi);
        sum += fxi;
        if (i < 8) steps.push({ index: i + 1, xi: xi.toFixed(6), fxi: fxi.toFixed(6) });
      }

      const result = h * sum;

      // Error estimate
      let sum2 = 0;
      for (let i = 0; i < n * 2; i++) {
        const h2 = h / 2;
        let xi2;
        if (method === 'midpoint')       xi2 = a + (i + 0.5) * h2;
        else if (variant === 'right')     xi2 = a + (i + 1) * h2;
        else                              xi2 = a + i * h2;
        sum2 += f(xi2);
      }
      const result2 = (h / 2) * sum2;
      const errorEst = Math.abs(result - result2);

      return { result, h, n, method, variant, func: funcStr, a, b, steps, errorEstimate: errorEst, local: true };
    }

  } catch (e) {
    return null;
  }
}

// ===== RENDER RESULT =====
function renderExactPanel(data, numericVal) {
  const panel = document.getElementById('exactPanel');
  const body  = document.getElementById('exactBody');

  if (!data.exactAvailable) {
    panel.style.display = 'block';
    body.innerHTML = `<div class="exact-unavailable">Nilai eksak tidak tersedia untuk fungsi ini (kombinasi terlalu kompleks untuk integrasi simbolik otomatis)</div>`;
    return;
  }

  panel.style.display = 'block';
  const exactVal = parseFloat(data.exactValue);
  const trueErr  = parseFloat(data.trueError);
  const truePct  = parseFloat(data.trueErrorPercent);
  const isGood   = truePct < 1; // < 1% dianggap baik

  body.innerHTML = `
    <div class="exact-antideriv">
      <span class="label">Anti-derivatif F(x)</span>
      <span class="formula">F(x) = ${data.antiderivative}</span>
    </div>
    <div class="exact-compare-grid">
      <div class="exact-compare-card numeric">
        <div class="clabel">Hasil Numerik</div>
        <div class="cval">${numericVal.toFixed(8)}</div>
      </div>
      <div class="exact-compare-card exact">
        <div class="clabel">Nilai Eksak F(b)−F(a)</div>
        <div class="cval">${exactVal.toFixed(8)}</div>
      </div>
    </div>
    <div class="exact-error-row">
      <span class="elabel">True Error |numerik − eksak|</span>
      <span class="eval ${isGood ? 'good' : 'bad'}">${trueErr.toExponential(4)} (${isFinite(truePct) ? truePct.toFixed(4) + '%' : '—'})</span>
    </div>
  `;
}

function renderResult(data) {
  const mainEl   = document.getElementById('resultMain');
  const statsEl  = document.getElementById('statsGrid');
  const stepsEl  = document.getElementById('stepsPanel');

  const val = parseFloat(data.result);
  const methodName = getMethodName(data);

  // Method badge color
  const badgeColor = data.method === 'trapezoid' ? 'var(--accent3)'
                   : data.method === 'midpoint'  ? 'var(--accent2)'
                   : 'var(--accent)';
  const bgColor    = data.method === 'trapezoid' ? 'rgba(22,163,74,0.07)'
                   : data.method === 'midpoint'  ? 'var(--accent2-glow)'
                   : 'var(--accent-glow)';
  const borderColor= data.method === 'trapezoid' ? 'rgba(22,163,74,0.3)'
                   : data.method === 'midpoint'  ? 'rgba(8,145,178,0.3)'
                   : '#bfdbfe';

  mainEl.innerHTML = `
    <div class="result-display">
      <div class="result-value-wrap" style="background:${bgColor};border-color:${borderColor}">
        <div class="result-label">HASIL INTEGRAL</div>
        <div class="result-value animate" id="resultNum" style="color:${badgeColor}">${val.toFixed(8)}</div>
        <div class="result-function">∫ ${data.func} dx  dari ${data.a} ke ${data.b}</div>
      </div>
      ${data.method === 'trapezoid' ? `
      <div class="trap-breakdown">
        <div class="trap-bd-title">RINCIAN TRAPESIUM</div>
        <div class="trap-bd-row">
          <span>h = (b−a)/n</span>
          <span>${parseFloat(data.h).toFixed(6)}</span>
        </div>
        <div class="trap-bd-row">
          <span>f(a) + f(b) (koef 1)</span>
          <span>${(parseFloat(data.steps?.[0]?.fxi||0) + parseFloat(data.steps?.[data.steps.length-1]?.fxi||0)).toFixed(6)}</span>
        </div>
        <div class="trap-bd-row trap-bd-result">
          <span>Hasil = (h/2)·[...]</span>
          <span>${val.toFixed(8)}</span>
        </div>
      </div>` : ''}
    </div>
  `;

  animateValue('resultNum', val);

  statsEl.style.display = 'grid';
  document.getElementById('statMethod').textContent  = methodName;
  document.getElementById('statN').textContent       = data.n;
  document.getElementById('statH').textContent       = parseFloat(data.h).toFixed(6);
  document.getElementById('statError').textContent   =
    data.errorEstimate != null ? parseFloat(data.errorEstimate).toExponential(2) : '—';

  renderExactPanel(data, val);

  // Steps
  if (data.steps && data.steps.length > 0) {
    stepsEl.style.display = 'block';
    const stepsContent = document.getElementById('stepsContent');

    if (data.method === 'trapezoid') {
      stepsContent.innerHTML = data.steps.map(s =>
        `<div class="step-line">
          <span class="step-idx">i=${s.index}</span>
          <span class="step-calc">x=${s.xi}</span>
          <span class="step-result">f(x)=${s.fxi}</span>
          <span class="step-coef" style="color:var(--accent3)">×${s.coef||'2'}</span>
        </div>`
      ).join('') + (data.n > 9 ? `<div class="step-line"><span class="step-idx">...</span><span class="step-calc">(${data.n - 9} titik interior tersembunyi)</span></div>` : '');
    } else {
      stepsContent.innerHTML = data.steps.map(s =>
        `<div class="step-line">
          <span class="step-idx">i=${s.index}</span>
          <span class="step-calc">x=${s.xi}</span>
          <span class="step-result">f(x)=${s.fxi}</span>
        </div>`
      ).join('') + (data.n > 8 ? `<div class="step-line"><span class="step-idx">...</span><span class="step-calc">(${data.n - 8} langkah tersembunyi)</span></div>` : '');
    }
  }
}

function getMethodName(data) {
  if (data.method === 'trapezoid') return 'Kaidah Trapesium';
  if (data.method === 'midpoint')  return 'Titik Tengah';
  return data.variant === 'left' ? 'Segiempat Kiri' : 'Segiempat Kanan';
}

function animateValue(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let start = 0;
  const dur = 600;
  const t0 = performance.now();
  function tick(now) {
    const p = Math.min((now - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = (start + (target - start) * ease).toFixed(8);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target.toFixed(8);
  }
  requestAnimationFrame(tick);
}

function toggleSteps() {
  state.stepsVisible = !state.stepsVisible;
  document.getElementById('stepsContent').style.display = state.stepsVisible ? 'block' : 'none';
  document.querySelector('.toggle-btn').textContent = state.stepsVisible ? 'Sembunyikan ▲' : 'Tampilkan ▼';
}

// ===== VISUALIZATION =====
function drawVisualization(data) {
  const canvas = document.getElementById('vizCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { top: 30, right: 30, bottom: 40, left: 50 };

  ctx.clearRect(0, 0, W, H);

  const f = parseFunc(data.func);
  const a = data.a, b = data.b, n = data.n;
  const drawN = Math.min(n, 60);
  const hDraw = (b - a) / drawN;

  let yMin = Infinity, yMax = -Infinity;
  for (let xi = a; xi <= b + 0.001; xi += (b - a) / 200) {
    const y = f(xi);
    if (!isNaN(y) && isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
  }
  const yPad = (yMax - yMin) * 0.15 || 1;
  yMin -= yPad; yMax += yPad;

  const toX = x => pad.left + ((x - a) / (b - a)) * (W - pad.left - pad.right);
  const toY = y => pad.top + ((yMax - y) / (yMax - yMin)) * (H - pad.top - pad.bottom);

  // Background
  ctx.fillStyle = '#f5f7fa';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(148,163,184,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + (i / 5) * (H - pad.top - pad.bottom);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
  }
  for (let i = 0; i <= 6; i++) {
    const x = pad.left + (i / 6) * (W - pad.left - pad.right);
    ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, H - pad.bottom); ctx.stroke();
  }

  // X-axis
  ctx.strokeStyle = '#d0d7e3'; ctx.lineWidth = 1.5;
  const y0 = toY(0);
  if (y0 >= pad.top && y0 <= H - pad.bottom) {
    ctx.beginPath(); ctx.moveTo(pad.left, y0); ctx.lineTo(W - pad.right, y0); ctx.stroke();
  }

  // Draw areas
  if (state.vizMode === 'bars' || state.vizMode === 'both') {
    for (let i = 0; i < drawN; i++) {
      const x1 = toX(a + i * hDraw);
      const x2 = toX(a + (i + 1) * hDraw);

      if (data.method === 'trapezoid') {
        // ---- TRAPESIUM: gambar trapesoid sebenarnya ----
        const fLeft  = f(a + i * hDraw);
        const fRight = f(a + (i + 1) * hDraw);
        const yL = toY(fLeft), yR = toY(fRight);
        const yZero = toY(Math.min(Math.max(0, yMin), yMax));

        ctx.beginPath();
        ctx.moveTo(x1, yZero);
        ctx.lineTo(x1, yL);
        ctx.lineTo(x2, yR);
        ctx.lineTo(x2, yZero);
        ctx.closePath();
        ctx.fillStyle = 'rgba(22,163,74,0.18)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(22,163,74,0.6)';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Titik-titik simpul trapesium
        ctx.fillStyle = '#16a34a';
        ctx.beginPath(); ctx.arc(x1, yL, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x2, yR, 3, 0, Math.PI*2); ctx.fill();

        // Garis atas trapesium (miring)
        ctx.strokeStyle = 'rgba(22,163,74,0.9)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x1, yL); ctx.lineTo(x2, yR); ctx.stroke();

      } else {
        // ---- SEGIEMPAT / TITIK TENGAH ----
        let xi;
        if (data.method === 'midpoint')      xi = a + (i + 0.5) * hDraw;
        else if (data.variant === 'right')    xi = a + (i + 1) * hDraw;
        else                                  xi = a + i * hDraw;

        const fxi = f(xi);
        const yTop = toY(Math.max(0, fxi)), yBot = toY(Math.min(0, fxi));

        ctx.fillStyle = 'rgba(37,99,235,0.12)';
        ctx.fillRect(x1, yTop, x2 - x1, yBot - yTop);
        ctx.strokeStyle = 'rgba(37,99,235,0.45)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x1, yTop, x2 - x1, yBot - yTop);

        if (data.method === 'midpoint') {
          const midX = (x1 + x2) / 2;
          ctx.fillStyle = '#0891b2';
          ctx.beginPath(); ctx.arc(midX, toY(fxi), 3, 0, Math.PI*2); ctx.fill();
        }
      }
    }
  }

  // Draw curve
  if (state.vizMode === 'curve' || state.vizMode === 'both') {
    ctx.strokeStyle = '#0891b2'; ctx.lineWidth = 2;
    ctx.shadowBlur = 6; ctx.shadowColor = '#0891b2';
    ctx.beginPath();
    let first = true;
    for (let xi = a; xi <= b + 0.001; xi += (b - a) / 300) {
      const y = f(xi);
      if (!isNaN(y) && isFinite(y)) {
        const px = toX(xi), py = toY(y);
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Labels
  ctx.fillStyle = '#94a3b8'; ctx.font = '10px Space Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(a.toFixed(2), toX(a), H - 10);
  ctx.fillText(b.toFixed(2), toX(b), H - 10);
  ctx.fillText(((a + b) / 2).toFixed(2), toX((a + b) / 2), H - 10);
  ctx.textAlign = 'right';
  ctx.fillText(yMax.toFixed(1), pad.left - 5, pad.top + 5);
  ctx.fillText(yMin.toFixed(1), pad.left - 5, H - pad.bottom);

  // Method label top-right
  ctx.textAlign = 'right';
  ctx.fillStyle = data.method === 'trapezoid' ? '#16a34a'
                : data.method === 'midpoint'  ? '#0891b2'
                : '#2563eb';
  ctx.font = 'bold 11px Space Mono';
  ctx.fillText(getMethodName(data), W - pad.right, pad.top - 8);
}

function drawConvergence(data) {
  const canvas = document.getElementById('convCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { top: 20, right: 20, bottom: 40, left: 60 };

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f5f7fa';
  ctx.fillRect(0, 0, W, H);

  const f = parseFunc(data.func);
  const a = data.a, b = data.b;
  const ns = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];

  const pts = ns.map(ni => {
    const hi = (b - a) / ni;
    if (data.method === 'trapezoid') {
      let s = f(a) + f(b);
      for (let i = 1; i < ni; i++) s += 2 * f(a + i * hi);
      return (hi / 2) * s;
    }
    let s = 0;
    for (let i = 0; i < ni; i++) {
      let xi;
      if (data.method === 'midpoint')      xi = a + (i + 0.5) * hi;
      else if (data.variant === 'right')    xi = a + (i + 1) * hi;
      else                                  xi = a + i * hi;
      s += f(xi);
    }
    return hi * s;
  });

  const trueVal = pts[pts.length - 1];
  const errors  = pts.map(p => Math.abs(p - trueVal));
  const maxErr  = Math.max(...errors.slice(0, -1)) || 1;

  const toX = i => pad.left + (i / (ns.length - 1)) * (W - pad.left - pad.right);
  const toY = e => pad.top + (1 - e / maxErr) * (H - pad.top - pad.bottom);

  ctx.strokeStyle = 'rgba(148,163,184,0.5)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * (H - pad.top - pad.bottom);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
  }

  const lineColor = data.method === 'trapezoid' ? '#16a34a'
                  : data.method === 'midpoint'  ? '#0891b2'
                  : '#2563eb';

  ctx.strokeStyle = lineColor; ctx.lineWidth = 2;
  ctx.shadowBlur = 4; ctx.shadowColor = lineColor;
  ctx.beginPath();
  errors.slice(0, -1).forEach((e, i) => {
    if (i === 0) ctx.moveTo(toX(i), toY(e));
    else ctx.lineTo(toX(i), toY(e));
  });
  ctx.stroke();
  ctx.shadowBlur = 0;

  errors.slice(0, -1).forEach((e, i) => {
    ctx.fillStyle = lineColor;
    ctx.beginPath(); ctx.arc(toX(i), toY(e), 4, 0, Math.PI*2); ctx.fill();
  });

  ctx.fillStyle = '#94a3b8'; ctx.font = '9px Space Mono'; ctx.textAlign = 'center';
  ns.slice(0, -1).forEach((ni, i) => ctx.fillText(`n=${ni}`, toX(i), H - 5));
  ctx.textAlign = 'left'; ctx.fillText('Error', 2, 15);
}

function drawPlaceholderChart() {
  const canvas = document.getElementById('vizCanvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f7fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(122,154,191,0.3)';
  ctx.font = '14px Space Mono'; ctx.textAlign = 'center';
  ctx.fillText('Grafik akan muncul setelah perhitungan', canvas.width/2, canvas.height/2);

  const c2 = document.getElementById('convCanvas');
  const ctx2 = c2.getContext('2d');
  ctx2.fillStyle = '#f5f7fa';
  ctx2.fillRect(0, 0, c2.width, c2.height);
  ctx2.fillStyle = 'rgba(122,154,191,0.3)';
  ctx2.font = '12px Space Mono'; ctx2.textAlign = 'center';
  ctx2.fillText('Grafik konvergensi', c2.width/2, c2.height/2);
}

// ===== HISTORY =====
function addToHistory(data) {
  const methodName = getMethodName(data);
  state.history.unshift({
    id: Date.now(),
    method: data.method,
    methodName,
    func: data.func,
    a: data.a, b: data.b, n: data.n,
    result: parseFloat(data.result).toFixed(8),
    time: new Date().toLocaleTimeString('id-ID'),
  });
  if (state.history.length > 20) state.history.pop();
  localStorage.setItem('numeri_history', JSON.stringify(state.history));
  renderHistory();
}

function renderHistory() {
  const el = document.getElementById('historyList');
  if (state.history.length === 0) {
    el.innerHTML = '<div class="history-empty">Belum ada perhitungan</div>';
    return;
  }
  el.innerHTML = state.history.map((h, i) =>
    `<div class="history-item" onclick="reloadHistory(${h.id})">
      <span class="history-num">#${state.history.length - i}</span>
      <span class="history-desc">∫ ${h.func} [${h.a}, ${h.b}], n=${h.n} — ${h.time}</span>
      <span class="history-result">${h.result}</span>
      <span class="history-method ${h.method}">${h.methodName}</span>
    </div>`
  ).join('');
}

function reloadHistory(id) {
  const h = state.history.find(x => x.id === id);
  if (!h) return;
  document.getElementById('funcInput').value = h.func;
  document.getElementById('lowerBound').value = h.a;
  document.getElementById('upperBound').value = h.b;
  // Display n yang sudah digunakan sebelumnya
  document.getElementById('autoNValue').textContent = h.n;
  document.getElementById('autoNStatus').textContent = '✓ Dari riwayat';
  document.getElementById('autoNStatus').style.color = '#0891b2';
  selectMethod(h.method, document.querySelector(`[data-method="${h.method}"]`));
  document.getElementById('calculator').scrollIntoView({ behavior: 'smooth' });
}

function clearHistory() {
  if (confirm('Hapus semua riwayat?')) {
    state.history = [];
    localStorage.removeItem('numeri_history');
    renderHistory();
  }
}

function exportHistory() {
  if (state.history.length === 0) return alert('Tidak ada data untuk diekspor!');
  const header = 'No,Metode,Fungsi,Batas Bawah,Batas Atas,n,Hasil,Waktu';
  const rows = state.history.map((h, i) =>
    `${state.history.length - i},${h.methodName},"${h.func}",${h.a},${h.b},${h.n},${h.result},${h.time}`
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'numeri_history.csv'; a.click();
}

// ===== EXPORT RESULT =====
function exportResult() {
  if (!state.lastResult) return alert('Belum ada hasil untuk diekspor!');
  const d = state.lastResult;
  const text = [
    '=== NumeriCalc — Hasil Integrasi ===',
    `Fungsi   : f(x) = ${d.func}`,
    `Interval : [${d.a}, ${d.b}]`,
    `Metode   : ${getMethodName(d)}`,
    `n        : ${d.n}`,
    `h        : ${parseFloat(d.h).toFixed(8)}`,
    `Hasil    : ${parseFloat(d.result).toFixed(10)}`,
    `Error    : ${d.errorEstimate != null ? parseFloat(d.errorEstimate).toExponential(4) : 'N/A'}`,
    '',
    'Langkah-langkah:',
    ...(d.steps || []).map(s => `  i=${s.index}, x=${s.xi}, f(x)=${s.fxi}${s.coef ? ` (×${s.coef})` : ''}`),
  ].join('\n');

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'hasil_integrasi.txt'; a.click();
}

// ===== UI HELPERS =====
function showStatus(msg, type) {
  document.getElementById('statusText').textContent = msg;
  const dot = document.querySelector('.status-dot');
  dot.className = `status-dot ${type === 'error' ? 'error' : type === 'loading' ? 'loading' : ''}`;
}

function setLoadingUI(loading) {
  const btn = document.querySelector('.calc-btn');
  btn.disabled = loading;
  btn.querySelector('.calc-btn-text').textContent = loading ? 'MENGHITUNG...' : 'HITUNG INTEGRAL';
}

function initNavHighlight() {
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-link');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[href="#${e.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(s => io.observe(s));
}
