// Електричний розрахунок накладного трансформаторного ВСП (розд. 2.2 дисертації).
// Вхід: довжини в мм, γ у МСм/м, струм у мА. Вихід: SI (Гц, м, Ом, м², А, В).
function calcVSP(p) {
  const mu0 = 4 * Math.PI * 1e-7;
  const D1 = p.D1 * 1e-3, D2 = p.D2 * 1e-3, L = p.L * 1e-3;
  const gamma = p.gamma * 1e6;

  // (2.13) робоча частота, (2.14) глибина проникнення
  const f = 2 * p.beta ** 2 / (D1 ** 2 * Math.PI * gamma * mu0);
  const w = 2 * Math.PI * f;
  const delta = Math.sqrt(2 / (w * gamma * mu0));

  // опір обмотки збудження: ρ в Ом·мм²/м, D1 в м, d1 в мм
  const R = 4 * p.rho * p.W1 * D1 / p.d1 ** 2;
  // (2.10) площа охолодження, (2.9) граничний струм, (2.8) рекомендований
  const S = 2 * Math.PI * (D1 / 2) * (L + D1 / 2);
  const Ipr = Math.sqrt(p.lambda * S * p.theta / R);
  const Irec = p.k * Ipr;

  // (2.16), (2.15) напруга холостого ходу
  const m = D1 / D2;
  const Uxx = 1.35 * w * p.mu * mu0 * p.W1 * p.W2 * (m - 0.3) * (p.I * 1e-3) * Math.sqrt(D1 * D2);

  // (2.17) внесена напруга; De, h1, h2 в мм
  const De = p.D1 + 1.5 * p.h1;
  const xi = (p.h1 + p.h2) / De;
  const kvn = Uxx * Math.exp(-3 * xi);
  const Uvn = { re: kvn * p.re, im: kvn * p.im };

  // (2.19), (2.18) ЕРС без ОК, (2.20) вихідна напруга
  const c = p.h2 - p.h1;
  const E0 = { re: 0, im: Uxx * Math.exp(-3 * c / p.D1) };
  const Uout = { re: E0.re + Uvn.re, im: E0.im + Uvn.im };

  return { f, delta, R, S, Ipr, Irec, m, Uxx, De, xi, Uvn, c, E0, Uout };
}

function besselJ1(x) {
  if (x < 12) {   // ряд Тейлора
    let term = x / 2, s = term;
    for (let k = 1; Math.abs(term) > 1e-17; k++) s += term *= -(x * x / 4) / (k * (k + 1));
    return s;
  }
  // асимптотика Ганкеля
  const w = 8 * x, chi = x - 3 * Math.PI / 4;
  const P = 1 + 7.5 / w ** 2 - 590.625 / w ** 4;
  const Q = 3 / w - 52.5 / w ** 3 + 9095.625 / w ** 5;
  return Math.sqrt(2 / (Math.PI * x)) * (P * Math.cos(chi) - Q * Math.sin(chi));
}

// Відносна внесена напруга двох співвісних витків R_в = R_и над немагнітним провідним півпростором (рис. 2.6):
// U* = jπ ∫ J1²(x)·e^(−x·h*)·(x − q)/(x + q) dx,  q = √(x² + jβ²),  h* = (h1 + h2)/R.
// Нормування рис. 2.6: при β → ∞ Im U* = −Q_{1/2}(1 + h*²/2).
const UX0 = 60, UN = 1200, UM = 600;
let ugrid;   // J1² на сітці [0, UX0], рахується один раз
function ustar(beta, h) {
  if (!(beta > 0 && h > 0)) return { re: NaN, im: NaN };
  ugrid ??= Array.from({ length: UN + 1 }, (_, i) => besselJ1(i * UX0 / UN) ** 2);
  const b2 = beta * beta, b4 = b2 * b2;
  let re = 0, im = 0;
  const add = (x, j2, wt) => {
    const m = Math.sqrt(x ** 4 + b4), qr = Math.sqrt((m + x * x) / 2), qi = b2 / (2 * qr);
    const e = wt * j2 * Math.exp(-x * h) / ((x + qr) ** 2 + qi * qi);
    re += 2 * x * qi * e;
    im -= b4 / (x * x + m) * e;   // x² − |q|², записане без втрати точності
  };
  const dx = UX0 / UN;   // Сімпсон на [0, 60]
  for (let i = 0; i <= UN; i++) add(i * dx, ugrid[i], (i === 0 || i === UN ? 1 : i % 2 ? 4 : 2) * dx / 3);
  const dl = Math.log(1e6 / UX0) / UM;   // хвіст до 10⁶: J1² ≈ 1/(πx), логарифмічна сітка
  for (let i = 0; i <= UM; i++) {
    const x = UX0 * Math.exp(i * dl);
    add(x, 1 / (Math.PI * x), (i === 0 || i === UM ? 0.5 : 1) * dl * x);
  }
  return { re: Math.PI * re, im: Math.PI * im };
}

// Вимірювальний канал і швидкість сканування; r — результат calcVSP.
// Інженерні правила, не з дисертації: сигнал займає 80 % діапазону АЦП, за час проходження дефекту
// має вкластися ≥ 10 періодів несучої та ≥ 3 вибірки по N відліків (одна вибірка — одна оцінка амплітуди й фази).
// Вхід: U_АЦП у В, f_д у кГц, l_деф і D1 у мм.
function calcChannel(p, r) {
  const Umax = Math.max(Math.hypot(r.E0.re, r.E0.im), Math.hypot(r.Uout.re, r.Uout.im));
  const K = 0.8 * p.Uadc / Umax;
  const q = 2 * p.Uadc / 2 ** p.bits;
  const fs = p.fs * 1e3, T = p.N / fs;
  const leff = (p.ldef + p.D1) * 1e-3;   // зона чутливості: дефект + діаметр обмотки
  const vCarrier = r.f * leff / 10, vBlock = leff / (3 * T);
  const v = Math.min(vCarrier, vBlock);
  return { Umax, K, q, ppp: fs / r.f, T, periods: r.f * T, leff, vCarrier, vBlock, v, df: v / leff };
}

if (typeof module !== 'undefined') module.exports = { calcVSP, ustar, besselJ1, calcChannel };
