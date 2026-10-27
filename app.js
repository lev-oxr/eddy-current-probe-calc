// Інтерфейс калькулятора: читає форму, рахує через calc.js і малює графіки.
// Розміри графіків — у px системи координат viewBox. Поля графіків названо константами;
// невеликі зсуви підписів відносно своїх ліній лишено числами на місці.

const form = document.getElementById('f');
const el = form.elements;
const $ = id => document.getElementById(id);
let last, lastP;

const fmt = (x, digits = 3) => Number.isFinite(x) ? x.toLocaleString('uk-UA', { maximumSignificantDigits: digits }) : '—';
const cx = z => `${fmt(z.re)} ${z.im < 0 ? '−' : '+'} j${fmt(Math.abs(z.im))}`;
const mV = z => `${fmt(z.re * 1e3)} ${z.im < 0 ? '−' : '+'} j${fmt(Math.abs(z.im) * 1e3)} мВ`;
const polar = z => `|U| = ${fmt(Math.hypot(z.re, z.im) * 1e3)} мВ, φ = ${fmt(Math.atan2(z.im, z.re) * 180 / Math.PI)}°`;
const volts = x => x >= 1 ? `${fmt(x)} В` : x >= 1e-3 ? `${fmt(x * 1e3)} мВ` : x >= 1e-6 ? `${fmt(x * 1e6)} мкВ` : `${fmt(x * 1e9)} нВ`;

const VW = 560;   // ширина viewBox перерізу, графіків f(β), δ(β) і сигналу

// ── Переріз ВСП над ОК ──
const GEO = {
  top: 34,         // поле над обмотками під розмір D_ср1
  bottom: 6,
  side: 10,        // поле зліва й справа
  coilHalf: 110,   // найбільша відстань від осі до обмотки
  height: 220,     // найбільша висота від верху обмоток до низу ОК
  axisTop: 8,      // початок осі симетрії
  coilMin: 4,      // найменша товщина обмотки збудження
  coilR: 5,        // радіус перерізу вимірювальної обмотки
  dimAbove: 14,    // розмір D_ср1 над обмотками
  dimGap: 10,      // від обмотки до розмірної лінії
  dimLabel: 75,    // місце під підпис розміру L перед лінією h₂
  tick: 3,         // півдовжина засічки розмірної лінії
  deltaW: 130,     // ширина підпису δ: його опущено на прогин дуги під ним
};

// x — уздовж поверхні, y — вгору від вершини поверхні, усе в мм
function drawGeo(p, r) {
  const d = r.delta * 1e3;
  const R = p.Dok > 0 ? p.Dok / 2 : Infinity;
  const Dmax = Math.max(p.D1, p.D2);
  const t = Math.ceil(p.W1 * p.d1 / p.L) * p.d1;   // товщина обмотки збудження: шари × d₁
  const top = Math.max(p.h1 + p.L, p.h2);
  const depth0 = Math.max(3 * d, 0.6 * Dmax);       // на глибині 3δ густина струму спадає до 5 %
  const s = Math.min(GEO.coilHalf / (Dmax / 2 + t), GEO.height / (top + depth0));   // px на мм
  if (!(s > 0 && Number.isFinite(s))) return;
  const mid = VW / 2;
  const hw = Math.min((mid - GEO.side) / s, R * 0.999);
  const sag = x => Number.isFinite(R) ? R - Math.sqrt(R * R - x * x) : 0;
  const depth = Math.max(depth0, 3 * d + sag(hw));
  const X = x => mid + x * s, Y = y => GEO.top + (top - y) * s;
  const arc = off => {   // поверхня ОК, зміщена вглиб на off
    if (!Number.isFinite(R)) return `M${X(-hw)} ${Y(-off)} H${X(hw)}`;
    const rr = R - off, x = Math.min(hw, rr * 0.999);
    if (rr <= 0) return '';
    const y = -off - (rr - Math.sqrt(rr * rr - x * x));
    return `M${X(-x)} ${Y(y)} A${rr * s} ${rr * s} 0 0 1 ${X(x)} ${Y(y)}`;
  };
  $('geo').setAttribute('viewBox', `0 0 ${VW} ${Y(-depth) + GEO.bottom}`);
  const body = `${arc(0)} L${X(hw)} ${Y(-depth)} H${X(-hw)} Z`;
  $('g-ok').setAttribute('d', body);
  $('g-eddy').setAttribute('d', body);
  $('eddy').setAttribute('y1', Y(0));
  $('eddy').setAttribute('y2', Y(-3 * d));
  $('g-delta').setAttribute('d', arc(d));
  $('g-tan').setAttribute('d', Number.isFinite(R) ? `M${X(-hw)} ${Y(0)} H${X(hw)}` : '');
  ['x1', 'x2'].forEach(k => $('g-axis').setAttribute(k, X(0)));
  $('g-axis').setAttribute('y1', GEO.axisTop);
  $('g-axis').setAttribute('y2', Y(-depth));

  const tp = Math.max(t * s, GEO.coilMin);
  $('g-coils').innerHTML = [-1, 1].map(k =>
    `<rect class="w1" x="${X(k * p.D1 / 2) - tp / 2}" y="${Y(p.h1 + p.L)}" width="${tp}" height="${p.L * s}"/>` +
    `<circle class="w2" cx="${X(k * p.D2 / 2)}" cy="${Y(p.h2)}" r="${GEO.coilR}"/>`).join('');

  const tk = GEO.tick;
  const vdim = (x, y1, y2, label, end, ty = (Y(y1) + Y(y2)) / 2 + 4) =>
    `<line x1="${x}" y1="${Y(y1)}" x2="${x}" y2="${Y(y2)}"/>` +
    `<line x1="${x - tk}" y1="${Y(y1)}" x2="${x + tk}" y2="${Y(y1)}"/>` +
    `<line x1="${x - tk}" y1="${Y(y2)}" x2="${x + tk}" y2="${Y(y2)}"/>` +
    `<text x="${x + (end ? -6 : 6)}" y="${ty}" text-anchor="${end ? 'end' : 'start'}">${label}</text>`;
  const xl = X(-Dmax / 2) - tp / 2, xr = X(Dmax / 2) + tp / 2;
  const x1 = X(-p.D1 / 2), x2 = X(p.D1 / 2), yD = Y(top) - GEO.dimAbove;
  const dip = R > d ? (GEO.deltaW / s) ** 2 / (2 * (R - d)) * s : 0;   // прогин дуги δ під підписом, наближення параболою
  $('g-dims').innerHTML =
    `<line x1="${x1}" y1="${yD}" x2="${x2}" y2="${yD}"/>` +
    `<line x1="${x1}" y1="${yD - tk}" x2="${x1}" y2="${yD + tk}"/>` +
    `<line x1="${x2}" y1="${yD - tk}" x2="${x2}" y2="${yD + tk}"/>` +
    `<text x="${X(0) + 6}" y="${yD - 5}">D<tspan dy="3" font-size="9">ср1</tspan><tspan dy="-3"> = ${fmt(p.D1)} мм</tspan></text>` +
    vdim(xl - GEO.dimGap, p.h1, p.h1 + p.L, `L = ${fmt(p.L)} мм`, true) +
    vdim(xl - GEO.dimGap - GEO.dimLabel, 0, p.h2, `h₂ = ${fmt(p.h2)} мм`, true) +
    vdim(xr + GEO.dimGap, 0, p.h1, `h₁ = ${fmt(p.h1)} мм`, false, Y(p.h1) - 8) +
    `<text x="${X(0) + 6}" y="${Y(-d) + 15 + dip}">δ = ${fmt(d)} мм · 37 %</text>` +
    `<text x="${X(-hw) + 8}" y="${Y(-depth) - 8}">ОК · γ = ${fmt(p.gamma)} МСм/м</text>`;

  const dh = sag(p.D1 / 2);
  $('geoNote').innerHTML = 'δ = D<sub>ср1</sub> / (√2·β), тож за фіксованого β матеріал ОК змінює робочу частоту, але не глибину проникнення.' +
    (dh > 0 ? ` У площині кривизни ОК зазор під обмоткою на ${fmt(dh, 2)} мм більший за h<sub>1</sub> — тому й умова (2.3).` : '');
}

// ── f(β) і δ(β): два графіки зі спільною віссю β ──
const PL = 52, PR = 16, PT = 8, PW = VW - PL - PR;   // поля; нижнє поле — у кожного графіка своє
const B_AXIS = 15;   // вісь β щонайменше до 15
const B_N = 140;     // кроків кривої
const Y_TICKS = 4;   // приблизна кількість поділок осі y
const VAL_W = 114;   // підпис значення ставимо праворуч від точки, якщо вміщується
let bMax = B_AXIS;
const bX = b => PL + (b - 1) / (bMax - 1) * PW;
const charts = [
  { id: 'ch-f', H: 130, PB: 6, cls: 'e0', unit: 'Гц', fn: (p, b) => calcVSP({ ...p, beta: b }).f },
  { id: 'ch-d', H: 150, PB: 24, cls: 'vn', unit: 'мм', fn: (p, b) => calcVSP({ ...p, beta: b }).delta * 1e3, xAxis: true },
];
const niceStep = m => { const e = 10 ** Math.floor(Math.log10(m)), n = m / e; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * e; };

function drawBeta(p) {
  bMax = Math.max(B_AXIS, Math.ceil(p.beta * 1.1));
  const bs = Array.from({ length: B_N + 1 }, (_, i) => 1 + (bMax - 1) * i / B_N);
  const z1 = +el.beta.min, z2 = +el.beta.max;   // рекомендована зона (2.2) — з меж поля β
  for (const c of charts) {
    const svg = $(c.id);
    const ys = bs.map(b => c.fn(p, b));
    if (!ys.every(Number.isFinite)) { svg.innerHTML = ''; continue; }
    const step = niceStep(Math.max(...ys) / Y_TICKS), top = Math.ceil(Math.max(...ys) / step) * step;
    const Y = v => PT + (1 - v / top) * (c.H - PT - c.PB);
    let g = `<rect class="zone" x="${bX(z1)}" y="${PT}" width="${bX(z2) - bX(z1)}" height="${c.H - PT - c.PB}"/>`;
    for (let v = 0; v <= top + step / 2; v += step)
      g += `<line class="grid" x1="${PL}" x2="${PL + PW}" y1="${Y(v)}" y2="${Y(v)}"/>` +
        `<text x="${PL - 6}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
    if (c.xAxis) {
      g += `<text x="4" y="${c.H - 6}">β →</text>`;
      for (const b of [1, 3.5, 5, 10, 15, 20, 30, 50].filter(b => b <= bMax))
        g += `<text x="${bX(b)}" y="${c.H - 6}" text-anchor="middle">${fmt(b)}</text>`;
    } else g += `<text x="${bX(z1) + 6}" y="${PT + 13}">рекомендовано ${fmt(z1)} – ${fmt(z2)} · (2.2)</text>`;
    g += `<path class="ln ${c.cls}" d="M${bs.map((b, i) => `${bX(b)} ${Y(ys[i])}`).join('L')}"/>`;
    if (p.beta >= 1) {
      const x = bX(p.beta), v = c.fn(p, p.beta), right = x < PL + PW - VAL_W;
      g += `<circle class="pt ${c.cls}" cx="${x}" cy="${Y(v)}" r="5"/>` +
        `<text class="val" x="${x + (right ? 9 : -9)}" y="${Math.max(Y(v) - 8, 14)}" text-anchor="${right ? 'start' : 'end'}">${fmt(v)} ${c.unit}</text>`;
    }
    g += `<line class="xh" y1="${PT}" y2="${c.H - c.PB}"/><rect class="hit" x="${PL}" y="0" width="${PW}" height="${c.H}"/>`;
    svg.innerHTML = g;
  }
  readBeta();
}

// без аргументу — поточне β, інакше значення під курсором
function readBeta(b) {
  const cur = b === undefined;
  if (cur) b = lastP.beta;
  const r = calcVSP({ ...lastP, beta: b });
  $('bRead').textContent = (cur ? 'Зараз: ' : '') +
    `β = ${fmt(b)} → f = ${fmt(r.f)} Гц, δ = ${fmt(r.delta * 1e3)} мм` +
    (cur ? '. Наведіть курсор на графік, щоб порівняти, і клацніть, щоб обрати β.' : '');
  for (const c of charts) {
    const xh = document.querySelector(`#${c.id} .xh`);
    if (!xh) continue;
    xh.style.visibility = cur ? '' : 'visible';
    xh.setAttribute('x1', bX(b));
    xh.setAttribute('x2', bX(b));
  }
}

// ── Годограф U*вн (рис. 2.6): сітка й криві рахуються один раз, робоча точка — на кожну зміну ──
const HL = 40, HT = 24, HS = 170;     // лівий і верхній край поля; px на одиницю U*
const RE_MAX = 0.8, IM_MIN = -2.5;    // межі поля, як на рис. 2.6
const HOVER_R = 15;                   // радіус захоплення найближчої точки курсором
const HX = re => HL + re * HS, HY = im => HT - im * HS;
const hBox = `x="${HL}" y="${HT}" width="${HX(RE_MAX) - HL}" height="${HY(IM_MIN) - HT}"`;
const hLog = (a, b, n) => Array.from({ length: n }, (_, i) => a * (b / a) ** (i / (n - 1)));
const hPath = pts => 'M' + pts.map(u => `${HX(u.re).toFixed(1)} ${HY(u.im).toFixed(1)}`).join('L');
const GAPS = hLog(0.01, 8, 25), BETAS = hLog(0.2, 2000, 90);   // h* уздовж ліній сталого β і β уздовж кривих сталого h*
const hSamples = [];   // точки кривих для наведення курсору
let hStatic;

function hodoStatic() {
  let g = `<defs><clipPath id="hclip"><rect ${hBox}/></clipPath></defs>`, labels = '';
  for (let im = 0; im >= IM_MIN; im -= 0.5)
    g += `<line class="grid" x1="${HL}" x2="${HX(RE_MAX)}" y1="${HY(im)}" y2="${HY(im)}"/>` +
      `<text x="${HL - 4}" y="${HY(im) + 3}" text-anchor="end">${fmt(im)}</text>`;
  for (const re of [0, 0.5])
    g += `<line class="grid" x1="${HX(re)}" x2="${HX(re)}" y1="${HT}" y2="${HY(IM_MIN)}"/>` +
      `<text x="${HX(re)}" y="${HT - 8}" text-anchor="middle">${fmt(re)}</text>`;
  g += `<text x="${HX(RE_MAX)}" y="${HT - 8}" text-anchor="end">Re U*</text>` +
    `<text x="4" y="${HY(IM_MIN) + 17}">Im U*</text><g clip-path="url(#hclip)">`;
  for (const b of [1.25, 1.77, 2.5, 3.54, 5, 7.07, 10, 14.1, 20]) {
    const pts = GAPS.map(h => ({ ...ustar(b, h), b, h }));
    hSamples.push(...pts);
    g += `<path class="hl" d="${hPath(pts)}"/>`;
    labels += `<circle class="bp" cx="${HX(pts[0].re)}" cy="${HY(pts[0].im)}" r="2.5"/>` +
      `<text x="${HX(pts[0].re) + 6}" y="${HY(pts[0].im) + 3}">${fmt(b)}</text>`;
  }
  for (const h of [0.01, 0.125, 0.25, 0.5, 1]) {
    const pts = BETAS.map(b => ({ ...ustar(b, h), b, h }));
    hSamples.push(...pts);
    g += `<path class="hc" d="${hPath(pts)}"/>`;
    const end = h === 0.01 ? pts.findLast(u => u.im >= IM_MIN) : pts.at(-1);
    labels += h === 0.01
      ? `<text x="${HX(end.re) - 5}" y="${HY(end.im) - 4}" text-anchor="end">h* = 0,01</text>`
      : `<text x="${HX(end.re) + 4}" y="${HY(end.im) + 12}">${h === 1 ? 'h* = ' : ''}${fmt(h)}</text>`;
  }
  return g + '</g>' + labels;
}

// u0 — U*вн, використана в (2.17); повертає реальний h*, U* для нього та кут між годографами
function drawHodo(p, u0) {
  hStatic ??= hodoStatic();
  const hr = (p.h1 + p.h2) / (p.D1 / 2), ur = ustar(p.beta, hr);
  let g = hStatic + '<g clip-path="url(#hclip)">';
  if (Number.isFinite(ur.re))
    g += `<path class="cur lo" d="${hPath(GAPS.map(h => ustar(p.beta, h)))}"/>` +
      `<path class="cur" d="${hPath(BETAS.map(b => ustar(b, hr)))}"/>`;
  g += '</g>';
  if (Number.isFinite(u0.re)) g += `<circle class="pt" cx="${HX(u0.re)}" cy="${HY(u0.im)}" r="5"/>`;
  if (Number.isFinite(ur.re)) g += `<circle class="pt real" cx="${HX(ur.re)}" cy="${HY(ur.im)}" r="5"/>`;
  $('hodo').innerHTML = g + `<circle class="xh" r="7"/><rect class="hit" ${hBox}/>`;

  const k = 1.02;   // ±2 % для чисельних похідних уздовж β і h*
  const d = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
  const db = d(ustar(p.beta * k, hr), ustar(p.beta / k, hr));
  const dh = d(ustar(p.beta, hr * k), ustar(p.beta, hr / k));
  const a = Math.abs(Math.atan2(db.im, db.re) - Math.atan2(dh.im, dh.re)) * 180 / Math.PI % 180;
  return { hr, ur, angle: Math.min(a, 180 - a) };
}

// ── Сигнал у часі на v_max: вікно 2τ, дефект посередині, вибірки по N відліків зафарбовано через одну ──
const TL = 10, TT = 6, TB = 104;   // ліве поле; верх і низ смуги вибірок
const TW = VW - 2 * TL;
const TMID = 55, TAMP = 28;        // середня лінія сигналу; px на одиницю амплітуди (обвідна сягає 1,6)
const T_N = 1100;                  // кроків кривої
const MAX_BLOCKS = 400;            // більше вибірок не малюємо
const MAX_PERIODS = 120;           // більше періодів несучої — показуємо обвідну смугою

function drawTime(p, r, ch) {
  const svg = $('ch-t'), note = $('tNote');
  const tau = ch.leff / ch.v, Tw = 2 * tau;
  if (!(tau > 0 && Number.isFinite(tau) && ch.T > 0)) { svg.innerHTML = ''; note.textContent = ''; return; }
  const X = t => TL + t / Tw * TW, Y = y => TMID - y * TAMP;
  const env = t => 1 + 0.6 * Math.exp(-(((t - tau) / (tau / 4)) ** 2));   // умовна форма: +60 % над дефектом
  let g = '';
  for (let k = 0, t = 0; t < Tw && k < MAX_BLOCKS; k++, t += ch.T)
    if (k % 2 === 0) g += `<rect class="blk" x="${X(t)}" y="${TT}" width="${X(Math.min(t + ch.T, Tw)) - X(t)}" height="${TB - TT}"/>`;
  const ts = Array.from({ length: T_N + 1 }, (_, i) => i * Tw / T_N);
  const pt = (t, y) => `${X(t).toFixed(1)} ${Y(y).toFixed(1)}`;
  const dense = r.f * Tw > MAX_PERIODS;
  g += dense
    ? `<path class="band" d="M${ts.map(t => pt(t, env(t))).join('L')}L${[...ts].reverse().map(t => pt(t, -env(t))).join('L')}Z"/>`
    : `<path class="sig" d="M${ts.map(t => pt(t, env(t) * Math.cos(2 * Math.PI * r.f * t))).join('L')}"/>`;
  g += `<path class="zone-d" d="M${X(tau / 2)} ${TB + 4}V${TB + 10}H${X(1.5 * tau)}V${TB + 4}"/>` +
    `<text x="${X(tau)}" y="${TB + 23}" text-anchor="middle">τ = l<tspan dy="3" font-size="8">еф</tspan>` +
    `<tspan dy="-3"> / v</tspan><tspan dy="3" font-size="8">max</tspan><tspan dy="-3"> = ${fmt(tau * 1e3)} мс</tspan></text>`;
  svg.innerHTML = g;
  note.textContent = `За час проходження дефекту: періодів несучої — ${fmt(r.f * tau)}, вибірок по N = ${fmt(p.N, 6)} відліків — ${fmt(tau / ch.T)} (зафарбовано через одну).` +
    (dense ? ' Несучу показано смугою, бо періодів забагато для малюнка.' : '');
}

// ── Векторна діаграма ──
const PH_R = 100;   // довжина найбільшого вектора; viewBox ±120

function drawPhasor(r) {
  const s = PH_R / Math.max(Math.hypot(r.E0.re, r.E0.im), Math.hypot(r.Uout.re, r.Uout.im), Math.hypot(r.Uvn.re, r.Uvn.im));
  const seg = (id, a, b) => {
    const l = $(id);
    [['x1', a.re * s], ['y1', -a.im * s], ['x2', b.re * s], ['y2', -b.im * s]]
      .forEach(([k, x]) => l.setAttribute(k, Number.isFinite(x) ? x : 0));
  };
  const O = { re: 0, im: 0 };
  seg('v-e0', O, r.E0);
  seg('v-vn', r.E0, r.Uout);
  seg('v-out', O, r.Uout);
}

function update() {
  const p = lastP = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, parseFloat(v)]));
  const ua = ustar(p.beta, 0.01);
  el.re.readOnly = el.im.readOnly = el.auto.checked;
  if (el.auto.checked) {
    p.re = ua.re;
    p.im = ua.im;
    el.re.value = +ua.re.toFixed(3);
    el.im.value = +ua.im.toFixed(3);
  }
  const hd = drawHodo(p, { re: p.re, im: p.im });
  const r = last = calcVSP(p);
  const ch = calcChannel(p, r);

  // рекомендовані діапазони, що залежать від інших параметрів
  el.D1.max = p.Dok > 0 ? 0.1 * p.Dok : '';
  el.L.min = 0.15 * p.D1;
  el.L.max = 0.3 * p.D1;
  el.I.max = r.Irec * 1e3;
  $('hD1').textContent = p.Dok > 0 ? `рек. ≤ 0,1·D_ок = ${fmt(0.1 * p.Dok)} мм · (2.3)` : 'площина — обмеження немає · (2.3)';
  $('hL').textContent = `рек. ${fmt(0.15 * p.D1)} – ${fmt(0.3 * p.D1)} мм (0,15…0,3·D_ср1) · (2.4)`;
  $('hI').textContent = `рек. ≤ k·I_пр = ${fmt(r.Irec * 1e3)} мА · (2.8)`;
  el.fs.min = 2 * r.f / 1e3;
  el.N.min = Math.ceil(p.fs * 1e3 / r.f);
  $('hFs').textContent = `рек. ≥ 2f = ${fmt(2 * r.f / 1e3)} кГц (Найквіст)`;
  $('hN').textContent = `рек. ≥ f_д / f = ${fmt(Math.ceil(p.fs * 1e3 / r.f), 6)} (хоча б один період)`;

  const v = {
    f: `${fmt(r.f)} Гц`, delta: `${fmt(r.delta * 1e3)} мм`, R: `${fmt(r.R)} Ом`, S: `${fmt(r.S * 1e6)} мм²`,
    Ipr: `${fmt(r.Ipr * 1e3)} мА`, Irec: `${fmt(r.Irec * 1e3)} мА`, I: `${fmt(p.I)} мА`, m: fmt(r.m),
    Ipct: `${fmt(p.I / (r.Ipr * 1e3) * 100, 2)} %`,
    Uxx: `${fmt(r.Uxx * 1e3)} мВ`, De: `${fmt(r.De)} мм`, xi: fmt(r.xi), c: `${fmt(r.c)} мм`,
    Uvn: mV(r.Uvn), E0: mV(r.E0), Uout: mV(r.Uout),
    Uvnp: polar(r.Uvn), E0p: polar(r.E0), Uoutp: polar(r.Uout),
    beta: fmt(p.beta), Ustar: cx({ re: p.re, im: p.im }), hReal: fmt(hd.hr), UstarReal: cx(hd.ur),
    attA: fmt(Math.hypot(hd.ur.re, hd.ur.im) / Math.hypot(ua.re, ua.im)), attE: fmt(Math.exp(-3 * r.xi)),
    angle: `${fmt(hd.angle, 2)}°`,
    Umax: volts(ch.Umax), K: fmt(ch.K), KdB: `${fmt(20 * Math.log10(ch.K))} дБ`, q: `${volts(ch.q)}; ${volts(ch.q / ch.K)}`,
    ppp: fmt(ch.ppp), T: `${fmt(ch.T * 1e3)} мс; ${fmt(ch.periods)}`, leff: `${fmt(ch.leff * 1e3)} мм`,
    v1: `${fmt(ch.vCarrier)} м/с`, v2: `${fmt(ch.vBlock)} м/с`, v: `${fmt(ch.v)} м/с`,
    vLim: ch.vBlock < ch.vCarrier ? 'обмежує тривалість вибірки N / f_д' : 'обмежує частота несучої f',
    band: `${fmt(r.f)} ± ${fmt(ch.df)} Гц`,
  };
  for (const o of document.querySelectorAll('[data-o]')) o.textContent = v[o.dataset.o];

  // зелений до k·I_пр, червоний вище
  const mI = $('mI');
  if (r.Ipr > 0 && p.I >= 0) {   // сетери meter кидають помилку на NaN
    mI.max = r.Ipr * 1e3;
    mI.low = mI.high = r.Irec * 1e3;
    mI.value = p.I;
  }
  drawGeo(p, r);
  drawBeta(p);
  drawTime(p, r, ch);
  drawPhasor(r);
}

const toBeta = (svg, e) => {
  const x = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()).x;
  return Math.round(Math.min(bMax, Math.max(1, 1 + (x - PL) / PW * (bMax - 1))) * 10) / 10;
};
for (const c of charts) {
  const svg = $(c.id);
  svg.addEventListener('pointermove', e => readBeta(toBeta(svg, e)));
  svg.addEventListener('pointerleave', () => readBeta());
  svg.addEventListener('click', e => { el.beta.value = toBeta(svg, e); update(); });
}

const hodo = $('hodo');
const hRead = $('hRead');
const hDefault = 'Наведіть курсор на годограф, щоб прочитати U*вн у будь-якій точці.';
hodo.addEventListener('pointermove', e => {
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(hodo.getScreenCTM().inverse());
  let best, bd = HOVER_R;
  for (const u of hSamples) {
    const dd = Math.hypot(HX(u.re) - pt.x, HY(u.im) - pt.y);
    if (dd < bd) { bd = dd; best = u; }
  }
  const xh = hodo.querySelector('.xh');
  xh.style.visibility = best ? 'visible' : '';
  if (!best) { hRead.textContent = hDefault; return; }
  xh.setAttribute('cx', HX(best.re));
  xh.setAttribute('cy', HY(best.im));
  hRead.textContent = `β = ${fmt(best.b)}, h* = ${fmt(best.h)} → U*вн = ${cx(best)}`;
});
hodo.addEventListener('pointerleave', () => { hRead.textContent = hDefault; });
hRead.textContent = hDefault;

el.auto.addEventListener('change', () => {
  if (el.auto.checked) return;
  el.re.value = el.re.defaultValue;
  el.im.value = el.im.defaultValue;
  update();
});
form.addEventListener('input', update);
form.addEventListener('reset', () => setTimeout(update));
$('useIrec').addEventListener('click', () => {
  el.I.value = +(last.Irec * 1e3).toFixed(2);
  update();
});
update();
