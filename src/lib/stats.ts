/**
 * Statistics for solve times. Pure functions, no React.
 *
 * Times are in milliseconds. A DNF is `Infinity`: it sorts last, counts as the
 * worst time in an average, and is dropped from anything that needs a real number
 * (mean, standard deviation, distribution fits).
 */

export const DNF = Infinity;

const finite = (xs: number[]) => xs.filter(Number.isFinite);
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

export function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function mean(xs: number[]): number {
  return xs.length ? sum(xs) / xs.length : NaN;
}

/** Linear-interpolated quantile of an already sorted array, q in [0, 1]. */
export function quantileSorted(s: number[], q: number): number {
  if (!s.length) return NaN;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export const quantile = (xs: number[], q: number) => quantileSorted(sorted(xs), q);
export const median = (xs: number[]) => quantile(xs, 0.5);

/** Sample variance (n - 1). */
export function variance(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return s / (xs.length - 1);
}

export const stdev = (xs: number[]) => Math.sqrt(variance(xs));

/** Sample skewness (adjusted Fisher-Pearson). Positive means a long slow tail. */
export function skewness(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const m = mean(xs);
  const sd = stdev(xs);
  let s = 0;
  for (const x of xs) s += ((x - m) / sd) ** 3;
  return (n / ((n - 1) * (n - 2))) * s;
}

/** Sample excess kurtosis. 0 for a normal distribution. */
export function kurtosis(xs: number[]): number {
  const n = xs.length;
  if (n < 4) return NaN;
  const m = mean(xs);
  const sd = stdev(xs);
  let s = 0;
  for (const x of xs) s += ((x - m) / sd) ** 4;
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * s - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

// ---------------------------------------------------------------------------
// Cubing averages (WCA rules)

/** How many solves an average of n drops from each end: 1 for ao5 and ao12, 5% above that. */
export const trimFor = (n: number) => (n <= 12 ? 1 : Math.ceil(n * 0.05));

/**
 * Average of the given times with the best and worst `trimFor(n)` dropped.
 * More DNFs than can be trimmed makes the whole average a DNF.
 * Returns null when there are too few times.
 */
export function trimmedAverage(times: number[]): number | null {
  const n = times.length;
  if (n < 3) return null;
  const trim = n < 5 ? 0 : trimFor(n);
  const s = sorted(times);
  const kept = s.slice(trim, n - trim);
  if (kept.some((t) => !Number.isFinite(t))) return DNF;
  return mean(kept);
}

/** aoN of the last n times (mo3 when n is 3). */
export function averageOf(times: number[], n: number): number | null {
  if (times.length < n) return null;
  const last = times.slice(-n);
  if (n === 3) return last.some((t) => !Number.isFinite(t)) ? DNF : mean(last);
  return trimmedAverage(last);
}

/** aoN ending at every index; null until there are n times. */
export function rollingAverage(times: number[], n: number): (number | null)[] {
  return times.map((_, i) => (i + 1 < n ? null : averageOf(times.slice(i + 1 - n, i + 1), n)));
}

/** Best (lowest) aoN anywhere in the list, with the index it ends at. */
export function bestAverage(times: number[], n: number): { value: number; end: number } | null {
  let best: { value: number; end: number } | null = null;
  rollingAverage(times, n).forEach((v, i) => {
    if (v !== null && (best === null || v < best.value)) best = { value: v, end: i };
  });
  return best;
}

export function best(times: number[]): number | null {
  const f = finite(times);
  return f.length ? Math.min(...f) : null;
}

// ---------------------------------------------------------------------------
// Outlier filters. Each returns a keep mask for the input (finite values only are judged).

export type OutlierRule = { kind: "none" } | { kind: "iqr"; k: number } | { kind: "z"; k: number } | { kind: "mad"; k: number } | { kind: "trim"; pct: number };

export function outlierMask(xs: number[], rule: OutlierRule): boolean[] {
  const f = finite(xs);
  if (rule.kind === "none" || f.length < 4) return xs.map(() => true);
  const s = sorted(f);
  let lo = -Infinity;
  let hi = Infinity;
  if (rule.kind === "iqr") {
    const q1 = quantileSorted(s, 0.25);
    const q3 = quantileSorted(s, 0.75);
    lo = q1 - rule.k * (q3 - q1);
    hi = q3 + rule.k * (q3 - q1);
  } else if (rule.kind === "z") {
    const m = mean(f);
    const sd = stdev(f);
    lo = m - rule.k * sd;
    hi = m + rule.k * sd;
  } else if (rule.kind === "mad") {
    const med = quantileSorted(s, 0.5);
    // 1.4826 scales MAD to match σ for normal data.
    const mad = 1.4826 * median(f.map((x) => Math.abs(x - med)));
    lo = med - rule.k * mad;
    hi = med + rule.k * mad;
  } else {
    lo = quantileSorted(s, rule.pct / 100);
    hi = quantileSorted(s, 1 - rule.pct / 100);
  }
  return xs.map((x) => !Number.isFinite(x) || (x >= lo && x <= hi));
}

// ---------------------------------------------------------------------------
// Distributions

/** Complementary error function, fractional error < 1.2e-7 (Numerical Recipes erfcc). */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

export function normalCdf(x: number, mu = 0, sigma = 1): number {
  return 0.5 * erfc(-(x - mu) / (sigma * Math.SQRT2));
}

export function normalPdf(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Inverse standard normal CDF (Acklam), relative error < 1.2e-9. */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function logGamma(x: number): number {
  // Lanczos approximation, g = 7.
  const g = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = g[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += g[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta (Numerical Recipes betacf). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const eps = 1e-14;
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(a, b, x)) / a;
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** CDF of Student's t with df degrees of freedom. */
export function tCdf(t: number, df: number): number {
  const x = df / (df + t * t);
  const tail = 0.5 * incompleteBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** Two-sided p-value for a t statistic. */
export const tTwoSided = (t: number, df: number) => 2 * (1 - tCdf(Math.abs(t), df));

/** Inverse t CDF by bisection; plenty for confidence intervals. */
export function tQuantile(p: number, df: number): number {
  let lo = -1000;
  let hi = 1000;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Tests

/** Mean with a 95% (or other) t confidence interval. */
export function meanInterval(xs: number[], confidence = 0.95) {
  const n = xs.length;
  const m = mean(xs);
  if (n < 2) return { mean: m, low: NaN, high: NaN };
  const half = tQuantile(1 - (1 - confidence) / 2, n - 1) * (stdev(xs) / Math.sqrt(n));
  return { mean: m, low: m - half, high: m + half };
}

const poly = (c: number[], x: number) => c.reduceRight((acc, k) => acc * x + k, 0);

/**
 * Shapiro-Wilk normality test (Royston 1995, as in R's swilk.c), n from 3 to 5000.
 * A small p-value means the data is unlikely to be normal.
 */
export function shapiroWilk(xs: number[]): { w: number; p: number } | null {
  const n = xs.length;
  if (n < 3 || n > 5000) return null;
  const x = sorted(xs);
  const range = x[n - 1] - x[0];
  if (range === 0) return null;
  const nn2 = Math.floor(n / 2);
  const a: number[] = new Array(nn2);

  if (n === 3) {
    a[0] = Math.SQRT1_2;
  } else {
    const m: number[] = [];
    let summ2 = 0;
    for (let i = 1; i <= nn2; i++) {
      m.push(normalQuantile((i - 0.375) / (n + 0.25)));
      summ2 += m[i - 1] ** 2;
    }
    summ2 *= 2;
    const ssumm2 = Math.sqrt(summ2);
    const rsn = 1 / Math.sqrt(n);
    const a1 = poly([0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056], rsn) - m[0] / ssumm2;
    let i1: number;
    let fac: number;
    if (n > 5) {
      i1 = 3;
      const a2 = -m[1] / ssumm2 + poly([0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633], rsn);
      fac = Math.sqrt((summ2 - 2 * m[0] ** 2 - 2 * m[1] ** 2) / (1 - 2 * a1 ** 2 - 2 * a2 ** 2));
      a[1] = a2;
    } else {
      i1 = 2;
      fac = Math.sqrt((summ2 - 2 * m[0] ** 2) / (1 - 2 * a1 ** 2));
    }
    a[0] = a1;
    for (let i = i1; i <= nn2; i++) a[i - 1] = -m[i - 1] / fac;
  }

  let num = 0;
  for (let i = 0; i < nn2; i++) num += a[i] * (x[n - 1 - i] - x[i]);
  const m0 = mean(x);
  let ss = 0;
  for (const v of x) ss += (v - m0) ** 2;
  const w = Math.min(1, (num * num) / ss);

  if (n === 3) {
    const p = Math.max(0, (6 / Math.PI) * (Math.asin(Math.sqrt(w)) - Math.asin(Math.sqrt(0.75))));
    return { w, p };
  }
  let w1 = Math.log(1 - w);
  let mu: number;
  let sigma: number;
  if (n <= 11) {
    const gamma = poly([-2.273, 0.459], n);
    if (w1 >= gamma) return { w, p: 1e-99 };
    w1 = -Math.log(gamma - w1);
    mu = poly([0.544, -0.39978, 0.025054, -6.714e-4], n);
    sigma = Math.exp(poly([1.3822, -0.77857, 0.062767, -0.0020322], n));
  } else {
    const ln = Math.log(n);
    mu = poly([-1.5861, -0.31082, -0.083751, 0.0038915], ln);
    sigma = Math.exp(poly([-0.4803, -0.082676, 0.0030302], ln));
  }
  return { w, p: 1 - normalCdf(w1, mu, sigma) };
}

/** Ordinary least squares y = intercept + slope * x, with a t-test on the slope. */
export function linearRegression(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const ssRes = Math.max(0, syy - slope * sxy);
  const r2 = syy === 0 ? 0 : 1 - ssRes / syy;
  const se = Math.sqrt(ssRes / (n - 2) / sxx);
  const t = se === 0 ? (slope === 0 ? 0 : Infinity) : slope / se;
  return { slope, intercept, r2, se, t, p: Number.isFinite(t) ? tTwoSided(t, n - 2) : 0, n };
}

/** Welch's two-sample t-test, plus Cohen's d. diff is mean(a) - mean(b). */
export function welchTTest(a: number[], b: number[]) {
  if (a.length < 2 || b.length < 2) return null;
  const va = variance(a) / a.length;
  const vb = variance(b) / b.length;
  const diff = mean(a) - mean(b);
  const se = Math.sqrt(va + vb);
  if (se === 0) return null;
  const t = diff / se;
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  const half = tQuantile(0.975, df) * se;
  const pooled = Math.sqrt(((a.length - 1) * variance(a) + (b.length - 1) * variance(b)) / (a.length + b.length - 2));
  const less = tCdf(t, df);
  return { diff, t, df, p: tTwoSided(t, df), less, greater: 1 - less, low: diff - half, high: diff + half, d: diff / pooled };
}

/**
 * One-sided p-values for a statistic where small means a is lower (faster) than b.
 * `less` is the p-value for "a is lower", `greater` for "a is higher".
 */
export type Sided = { p: number; less: number; greater: number };

/** Student's two-sample t-test, assuming both groups share one spread. diff is mean(a) - mean(b). */
export function studentTTest(a: number[], b: number[]): (Sided & { diff: number; t: number; df: number; low: number; high: number }) | null {
  const na = a.length;
  const nb = b.length;
  if (na < 2 || nb < 2) return null;
  const df = na + nb - 2;
  const pooled = ((na - 1) * variance(a) + (nb - 1) * variance(b)) / df;
  const se = Math.sqrt(pooled * (1 / na + 1 / nb));
  if (se === 0) return null;
  const diff = mean(a) - mean(b);
  const t = diff / se;
  const half = tQuantile(0.975, df) * se;
  const less = tCdf(t, df);
  return { diff, t, df, p: tTwoSided(t, df), less, greater: 1 - less, low: diff - half, high: diff + half };
}

/** Average ranks (1-based) of the combined values, ties sharing their mean rank. DNFs rank last. */
function ranks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((x, y) => (x[0] === y[0] ? 0 : x[0] < y[0] ? -1 : 1));
  const r = new Array<number>(values.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

/**
 * Mann-Whitney U (Wilcoxon rank-sum) with the normal approximation, tie and
 * continuity corrections. Works on ranks, so DNFs can stay in as the slowest.
 * `superiority` is the chance a random time from a beats one from b (ties half).
 */
export function mannWhitneyU(a: number[], b: number[]): (Sided & { u: number; z: number; superiority: number }) | null {
  const na = a.length;
  const nb = b.length;
  if (na < 3 || nb < 3) return null;
  const all = [...a, ...b];
  const r = ranks(all);
  let ra = 0;
  for (let i = 0; i < na; i++) ra += r[i];
  const u = ra - (na * (na + 1)) / 2;
  const n = na + nb;
  // Tie correction: sum of t^3 - t over tied groups.
  const counts = new Map<number, number>();
  for (const v of all) counts.set(v, (counts.get(v) ?? 0) + 1);
  let ties = 0;
  for (const t of counts.values()) ties += t ** 3 - t;
  const sigma = Math.sqrt(((na * nb) / 12) * (n + 1 - ties / (n * (n - 1))));
  if (sigma === 0) return null;
  const mu = (na * nb) / 2;
  const z = (u - mu) / sigma;
  // Large u means a is slower. Continuity correction of 0.5 towards the middle.
  const less = normalCdf((u - mu + 0.5) / sigma);
  const greater = 1 - normalCdf((u - mu - 0.5) / sigma);
  return { u, z, p: Math.min(1, 2 * Math.min(less, greater)), less, greater, superiority: 1 - u / (na * nb) };
}

/** Kolmogorov distribution tail Q(λ) = 2 Σ (-1)^(k-1) e^(-2k²λ²). */
function kolmogorovQ(lambda: number): number {
  if (lambda < 0.2) return 1;
  let s = 0;
  for (let k = 1; k <= 100; k++) {
    const term = 2 * (k % 2 ? 1 : -1) * Math.exp(-2 * k * k * lambda * lambda);
    s += term;
    if (Math.abs(term) < 1e-12) break;
  }
  return Math.max(0, Math.min(1, s));
}

/**
 * Two-sample Kolmogorov-Smirnov test on the whole distribution (asymptotic p, Stephens' correction).
 * `dLess` is the largest gap where a's times are ahead (a faster), `dGreater` where b's are.
 */
export function ksTest(a: number[], b: number[]): (Sided & { d: number; dLess: number; dGreater: number }) | null {
  const na = a.length;
  const nb = b.length;
  if (na < 5 || nb < 5) return null;
  const sa = sorted(a);
  const sb = sorted(b);
  let i = 0;
  let j = 0;
  let dLess = 0;
  let dGreater = 0;
  while (i < na || j < nb) {
    const x = Math.min(i < na ? sa[i] : Infinity, j < nb ? sb[j] : Infinity);
    if (x === Infinity) break;
    while (i < na && sa[i] === x) i++;
    while (j < nb && sb[j] === x) j++;
    const gap = i / na - j / nb;
    dLess = Math.max(dLess, gap);
    dGreater = Math.max(dGreater, -gap);
  }
  const ne = (na * nb) / (na + nb);
  const scale = Math.sqrt(ne) + 0.12 + 0.11 / Math.sqrt(ne);
  const d = Math.max(dLess, dGreater);
  const oneSided = (dd: number) => Math.min(1, Math.exp(-2 * ne * dd * dd));
  return { d, dLess, dGreater, p: kolmogorovQ(scale * d), less: oneSided(dLess), greater: oneSided(dGreater) };
}

/**
 * Brown-Forsythe test for equal spread (Levene's test around the median). With two
 * groups the F statistic is the square of a pooled t on the distances from each median.
 * `less` is the p-value for "a is more consistent".
 */
export function brownForsythe(a: number[], b: number[]): (Sided & { f: number; df: number; spreadA: number; spreadB: number }) | null {
  if (a.length < 3 || b.length < 3) return null;
  const ma = median(a);
  const mb = median(b);
  const da = a.map((x) => Math.abs(x - ma));
  const db = b.map((x) => Math.abs(x - mb));
  const t = studentTTest(da, db);
  if (!t) return null;
  return { f: t.t ** 2, df: t.df, p: t.p, less: t.less, greater: t.greater, spreadA: mean(da), spreadB: mean(db) };
}

/** Small seeded generator so simulated results don't flicker between renders. */
export function seededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Permutation test on any statistic of the two groups (diff = stat(a) - stat(b)):
 * shuffle the labels many times and see how often chance alone gives a gap this big.
 * Also a bootstrap 95% interval for the gap.
 */
export function permutationTest(a: number[], b: number[], stat: (xs: number[]) => number, rounds = 4000, seed = 1): (Sided & { diff: number; low: number; high: number }) | null {
  const na = a.length;
  const nb = b.length;
  if (na < 3 || nb < 3) return null;
  const diff = stat(a) - stat(b);
  if (!Number.isFinite(diff)) return null;
  const random = seededRandom(seed * 7919 + na * 31 + nb);
  const all = [...a, ...b];
  let lessHits = 0;
  let greaterHits = 0;
  let twoHits = 0;
  const eps = 1e-9 * Math.max(1, Math.abs(diff));
  for (let k = 0; k < rounds; k++) {
    // Partial Fisher-Yates: the first na after shuffling form the new a.
    for (let i = 0; i < na; i++) {
      const j = i + Math.floor(random() * (all.length - i));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const d = stat(all.slice(0, na)) - stat(all.slice(na));
    if (d <= diff + eps) lessHits++;
    if (d >= diff - eps) greaterHits++;
    if (Math.abs(d) >= Math.abs(diff) - eps) twoHits++;
  }
  const boot: number[] = [];
  const draw = (xs: number[]) => xs.map(() => xs[Math.floor(random() * xs.length)]);
  for (let k = 0; k < 2000; k++) {
    const d = stat(draw(a)) - stat(draw(b));
    if (Number.isFinite(d)) boot.push(d);
  }
  const s = sorted(boot);
  const p = (hits: number) => (hits + 1) / (rounds + 1);
  return { diff, p: p(twoHits), less: p(lessHits), greater: p(greaterHits), low: quantileSorted(s, 0.025), high: quantileSorted(s, 0.975) };
}

/** Wilson score interval for a proportion. */
export function proportionInterval(successes: number, n: number, z = 1.96) {
  if (n === 0) return { p: NaN, low: NaN, high: NaN };
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { p, low: centre - half, high: centre + half };
}

// ---------------------------------------------------------------------------
// Histogram

export type Bin = { from: number; to: number; count: number };

/** Histogram with Freedman-Diaconis bin width, clamped to 6-40 bins, on round edges. */
export function histogram(xs: number[], binCount?: number): Bin[] {
  const f = sorted(finite(xs));
  if (!f.length) return [];
  const min = f[0];
  const max = f[f.length - 1];
  if (min === max) return [{ from: min - 50, to: max + 50, count: f.length }];
  let width: number;
  if (binCount) width = (max - min) / binCount;
  else {
    const iqr = quantileSorted(f, 0.75) - quantileSorted(f, 0.25);
    width = iqr > 0 ? (2 * iqr) / Math.cbrt(f.length) : (max - min) / 10;
    const bins = (max - min) / width;
    if (bins > 40) width = (max - min) / 40;
    if (bins < 6) width = (max - min) / 6;
  }
  width = niceStep(width);
  const start = Math.floor(min / width) * width;
  const count = Math.max(1, Math.ceil((max - start) / width + 1e-9));
  const bins: Bin[] = Array.from({ length: count }, (_, i) => ({ from: start + i * width, to: start + (i + 1) * width, count: 0 }));
  for (const x of f) bins[Math.min(count - 1, Math.floor((x - start) / width))].count++;
  return bins;
}

/** Round a step up to 1, 2, 2.5 or 5 times a power of ten. */
export function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

/** About `count` round tick values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const step = niceStep((max - min) / count);
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}
