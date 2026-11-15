export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return '0';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  if (a >= 100) return Math.round(n).toString();
  if (a >= 10) return n.toFixed(0);
  return (Math.round(n * 10) / 10).toString();
}
export function fmtSigned(n) {
  const s = fmt(n);
  return n > 0.05 ? '+' + s : s;
}

// Binary min-heap keyed by float priority, storing integer values.
export class MinHeap {
  constructor() { this.v = []; this.p = []; }
  get size() { return this.v.length; }
  push(val, pri) {
    const v = this.v, p = this.p;
    v.push(val); p.push(pri);
    let i = v.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (p[par] <= p[i]) break;
      [v[par], v[i]] = [v[i], v[par]];
      [p[par], p[i]] = [p[i], p[par]];
      i = par;
    }
  }
  pop() {
    const v = this.v, p = this.p;
    const top = v[0];
    const lv = v.pop(), lp = p.pop();
    if (v.length > 0) {
      v[0] = lv; p[0] = lp;
      let i = 0;
      const n = v.length;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < n && p[l] < p[m]) m = l;
        if (r < n && p[r] < p[m]) m = r;
        if (m === i) break;
        [v[m], v[i]] = [v[i], v[m]];
        [p[m], p[i]] = [p[i], p[m]];
        i = m;
      }
    }
    return top;
  }
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
export function shade([r, g, b], f) {
  return f >= 0
    ? [r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f]
    : [r * (1 + f), g * (1 + f), b * (1 + f)];
}
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
