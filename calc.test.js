// node calc.test.js — перевірка на вихідних даних розд. 2.2 і рис. 2.6
const assert = require('node:assert');
const { calcVSP, ustar, besselJ1, calcChannel } = require('./calc.js');

const near = (got, want, name, tol = 0.01) =>
  assert(Math.abs(got - want) <= tol * Math.abs(want), `${name}: ${got} ≠ ${want}`);

const r = calcVSP({
  gamma: 35, beta: 3.5, D1: 20, D2: 20, L: 4, d1: 0.1, W1: 40, W2: 100,
  rho: 0.0175, lambda: 10, theta: 5, k: 0.9, mu: 1, I: 2.85,
  h1: 0.2, h2: 4, re: 0.625, im: -0.625,
});

near(r.R, 5.6, 'R');
near(r.S * 1e6, 879.2, 'S_охл, мм²');
near(r.Ipr * 1e3, 88.6, 'I_пр, мА');
near(r.Irec * 1e3, 79.74, 'I, мА');
near(r.f, 443, 'f, Гц');
near(r.delta * 1e3, 4.04, 'δ, мм');
near(r.Uxx * 1e3, 0.754, 'U_хх, мВ');    // μ = 1: котушки без осердя
near(r.xi, 0.207, 'ξ');
near(r.Uvn.re * 1e3, 0.253, 'Re U_вн, мВ');  // U* = 0,625 − j0,625, зчитане з рис. 2.6
near(r.Uvn.im * 1e3, -0.253, 'Im U_вн, мВ');
near(r.E0.im * 1e3, 0.426, 'Im E0, мВ');
near(r.Uout.im * 1e3, 0.173, 'Im U_вих, мВ');

// канал: АЦП ±5 В, 16 біт; f_д = 100 кГц і N = 1700 з розд. 3.1; дефект 1 мм
const ch = calcChannel({ Uadc: 5, bits: 16, fs: 100, N: 1700, ldef: 1, D1: 20 }, r);
near(ch.Umax * 1e3, 0.4265, 'U_max = |E0|, мВ');
near(ch.K, 9379, 'K');
near(ch.q * 1e6, 152.6, 'q, мкВ');
near(ch.ppp, 225.6, 'відліків на період');
near(ch.periods, 7.536, 'періодів у вибірці');
near(ch.vCarrier, 0.931, 'v за несучою, м/с');
near(ch.vBlock, 0.4118, 'v за вибіркою, м/с');
near(ch.v, 0.4118, 'v_max, м/с');
near(ch.df, 19.61, 'Δf, Гц');

near(besselJ1(5), -0.3275791376, 'J1(5)', 1e-8);
near(besselJ1(20), 0.0668331242, 'J1(20)', 1e-7);

// β → ∞: Im U* = −Q_{1/2}(1 + h*²/2); Q через повні еліптичні інтеграли (AGM)
function legendreQhalf(z) {
  const k = Math.sqrt(2 / (z + 1));
  let a = 1, b = Math.sqrt(1 - k * k), c = k, s = k * k / 2, p = 0.5;
  while (c > 1e-15) { const an = (a + b) / 2; c = (a - b) / 2; b = Math.sqrt(a * b); a = an; p *= 2; s += p * c * c; }
  const K = Math.PI / (2 * a), E = K * (1 - s);
  return z * k * K - Math.sqrt(2 * (z + 1)) * E;
}
for (const h of [1, 0.5, 0.25, 0.125]) near(-ustar(1e5, h).im, legendreQhalf(1 + h * h / 2), `U*(β→∞, h*=${h})`, 0.002);

// точки кривої h* = 0,01 на рис. 2.6, зчитані з рисунка
near(ustar(3.54, 0.01).re, 0.62, 'Re U*(3,54)', 0.03);
near(ustar(3.54, 0.01).im, -0.76, 'Im U*(3,54)', 0.03);
near(ustar(10, 0.01).im, -1.72, 'Im U*(10)', 0.03);

console.log('ok');
