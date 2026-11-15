// Phase 22 — the ground and water painted on the graphics card. A fragment shader recreates the
// close-up terrain (painterly dithered ground, wandering biome edges, lit slopes and ridges,
// marsh pools, snow, banded and animated water, wet sand and surf) for the whole view every
// frame, so terrain never "pops in" and the water moves. The result is drawn into the 2D
// canvas as the first layer, so colour grading and night lighting still apply on top.
import { terrainPalette } from './tiles16.js';
import { BIOMES } from '../data/biomes.js';

const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `
precision highp float;
uniform sampler2D uData;   // per tile: r biome, g height, b temp, a flags (1 river, 2 coast, 4 water)
uniform sampler2D uPal;    // 16×16 colour ramps
uniform vec2 uWorld;       // tiles
uniform vec2 uArt0;        // art pixel at the top-left of the GL canvas (one GL pixel = one art pixel)
uniform float uH;          // GL canvas height in px
uniform float uSeason, uSnow, uTime, uSeed;
const float T16 = 16.0;

float h2(vec2 p) { p = mod(p, 4096.0); return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 0.0137) * 43758.5453); }
float vn(vec2 p, float sc, float s) {
  vec2 f = p / sc + vec2(s * 17.13, s * 29.71); vec2 i = floor(f); vec2 u = f - i; u = u * u * (3.0 - 2.0 * u);
  float a = h2(i), b = h2(i + vec2(1.0, 0.0)), c = h2(i + vec2(0.0, 1.0)), d = h2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float bayer(vec2 a) {
  vec2 m = mod(a, 4.0); float x = m.x, y = m.y;
  float b = 0.0;
  if (y < 1.0) b = x < 1.0 ? 0.0 : x < 2.0 ? 8.0 : x < 3.0 ? 2.0 : 10.0;
  else if (y < 2.0) b = x < 1.0 ? 12.0 : x < 2.0 ? 4.0 : x < 3.0 ? 14.0 : 6.0;
  else if (y < 3.0) b = x < 1.0 ? 3.0 : x < 2.0 ? 11.0 : x < 3.0 ? 1.0 : 9.0;
  else b = x < 1.0 ? 15.0 : x < 2.0 ? 7.0 : x < 3.0 ? 13.0 : 5.0;
  return (b + 0.5) / 16.0;
}
vec4 tileAt(vec2 t) { t = clamp(t, vec2(0.0), uWorld - 1.0); return texture2D(uData, (t + 0.5) / uWorld); }
vec2 warp(vec2 a) {
  return vec2((vn(a, 15.0, 21.0) - 0.5) * 17.0 + (vn(a, 5.0, 27.0) - 0.5) * 6.0, (vn(a, 15.0, 22.0) - 0.5) * 17.0 + (vn(a, 5.0, 28.0) - 0.5) * 6.0);
}
vec2 tileOf(vec2 a) { return floor((a + warp(floor(a / 2.0) * 2.0)) / T16); }
float heightAt(vec2 a) { // bilinear height in art px
  vec2 f = a / T16 - 0.5; vec2 i = floor(f); vec2 u = f - i;
  float h00 = tileAt(i).g, h10 = tileAt(i + vec2(1.0, 0.0)).g, h01 = tileAt(i + vec2(0.0, 1.0)).g, h11 = tileAt(i + vec2(1.0, 1.0)).g;
  return mix(mix(h00, h10, u.x), mix(h01, h11, u.x), u.y) * 2.0 - 1.0;
}
vec3 pal(float row, float col) { return texture2D(uPal, (vec2(col, row) + 0.5) / 16.0).rgb; }
vec3 ramp(float set, float biome, float t, vec2 a) {
  float pos = clamp(t, 0.0, 0.9999) * 4.0; float i = floor(pos);
  float k = i + (pos - i > bayer(a) ? 1.0 : 0.0);
  return pal(set * 5.0 + min(k, 4.0), biome);
}
bool isWater(float b) { return b < 2.5 || b > 14.5; }
void main() {
  vec2 a = uArt0 + floor(vec2(gl_FragCoord.x, uH - gl_FragCoord.y)); // art pixel (2 per world px, 16 per tile)
  vec2 t = tileOf(a);
  vec4 d = tileAt(t);
  float b = floor(d.r * 255.0 + 0.5);
  float flags = floor(d.a * 255.0 + 0.5);
  vec3 col;
  if (isWater(b)) {
    float hh = heightAt(a);
    float depth = clamp(-hh * 1.3 + (h2(a) - 0.5) * 0.06, 0.0, 1.0);
    if (b > 14.5) { float pos = clamp(depth * 1.1, 0.0, 0.9999) * 3.0; float i = floor(pos); col = pal(15.0, 8.0 + min(i + (pos - i > bayer(a) ? 1.0 : 0.0), 3.0)); }
    else {
      float pos = clamp(pow(depth, 0.8) * 1.05 + (vn(a, 14.0, 30.0) - 0.5) * 0.08, 0.0, 0.9999) * 5.0; float i = floor(pos);
      col = pal(15.0, min(i + (pos - i > bayer(a) ? 1.0 : 0.0), 5.0));
      if (depth < 0.16) { float cs = abs(vn(a + vec2(uTime * 2.0, 0.0), 5.0, 31.0) - vn(a + vec2(9.0 - uTime * 1.5, -4.0), 5.0, 32.0)); if (cs < 0.035) col = mix(col, vec3(0.745, 0.925, 0.925), 0.45); }
    }
    // moving wave strokes
    float wv = sin(a.x * 0.45 + a.y * 0.9 + uTime * 1.3 + mod(t.y * 3.1, 6.0)) + sin(a.x * 0.17 - a.y * 0.31 - uTime * 0.7);
    if (wv > 1.72 + h2(t) * 0.2 && h2(vec2(floor(a.x / 4.0), a.y)) < 0.6) col = mix(col, vec3(0.9, 0.96, 1.0), 0.2);
    if (b > 14.5 && uSnow > 1.5 && d.b < 0.38) col = mix(col, vec3(0.86, 0.925, 0.97), 0.75); // frozen lake
    // surf: foam where land is near (checks the warped grid a few pixels away), pulsing
    float near = 0.0;
    for (int k = 0; k < 8; k++) { float ang = float(k) * 1.5708 + (k < 4 ? 0.0 : 0.785); vec2 o = vec2(cos(ang), sin(ang)) * (k < 4 ? 2.0 : 4.0); if (!isWater(floor(tileAt(tileOf(a + o)).r * 255.0 + 0.5))) { near = k < 4 ? 2.0 : max(near, 1.0); } }
    if (near > 0.0 && b < 14.5) { float pulse = 0.5 + 0.5 * sin(uTime * 1.6 + h2(t) * 6.0); col = mix(col, vec3(0.93, 0.97, 1.0), near > 1.5 ? 0.45 + 0.2 * pulse : 0.12 + 0.1 * pulse); }
    // sky glints
    if (h2(a + floor(uTime * 0.8)) < 0.0025) col = mix(col, vec3(1.0), 0.6);
  } else {
    float temp = d.b, hgt = d.g * 2.0 - 1.0;
    float set = uSeason > 1.5 && uSeason < 2.5 ? 1.0 : 0.0;
    float sn = temp - max(0.0, hgt - 0.5) * 0.4 + (vn(a, 11.0, 14.0) - 0.5) * 0.2 + (vn(a, 4.0, 15.0) - 0.5) * 0.06;
    bool snowy = b > 10.5 && b < 11.5 || (uSnow > 0.5 && sn < 0.42) || (uSnow > 1.5 && sn < 0.6);
    if (snowy) set = 2.0;
    float big = vn(a, 22.0, 23.0), med = vn(a, 6.0, 24.0);
    float slope = clamp((heightAt(a - 5.0) - heightAt(a + 5.0)) * 5.5, -0.32, 0.32);
    float tt = 0.52 + (big - 0.5) * 0.5 + (med - 0.5) * 0.34 + slope;
    if (b > 11.5 && b < 13.5) { // hills & mountains: ridges
      float rs = b > 12.5 ? 1.0 : 0.5;
      float crest = abs(vn(a, 11.0, 50.0) - 0.5), back = abs(vn(a + 3.0, 11.0, 50.0) - 0.5);
      if (crest < 0.035) tt += 0.3 * rs; else if (back < 0.035) tt -= 0.32 * rs;
      if (b > 12.5) tt += (vn(a, 3.0, 26.0) - 0.5) * 0.25;
    }
    col = ramp(set, b, tt, a);
    if (b > 2.5 && b < 3.5 || b > 8.5 && b < 9.5) { float r = sin(a.x * 0.35 + sin(a.y * 0.2) * 2.0 + a.y * 0.12); if (r > 0.93) col = pal(set * 5.0 + 3.0, b); else if (r < -0.95) col = pal(set * 5.0 + 1.0, b); }
    if (!snowy && (b > 3.5 && b < 6.5 || b > 11.5 && b < 12.5)) { float tb = h2(a + 7.0); if (tb < 0.02) col = pal(set * 5.0 + 4.0, b); else if (tb < 0.032) col = pal(set * 5.0 + 1.0, b); }
    if (b > 13.5 && b < 14.5 && !snowy) { float pv = vn(a, 5.0, 7.0) * 0.7 + vn(a, 13.0, 8.0) * 0.3; if (pv > 0.6) col = pv > 0.66 && h2(a + 9.0) < 0.05 ? pal(15.0, 14.0) : pal(15.0, 13.0); else if (pv > 0.57) col = pal(15.0, 12.0); }
    // wet sand along the shore
    float near = 0.0;
    for (int k = 0; k < 8; k++) { float ang = float(k) * 1.5708 + (k < 4 ? 0.0 : 0.785); vec2 o = vec2(cos(ang), sin(ang)) * (k < 4 ? 2.0 : 4.0); if (isWater(floor(tileAt(tileOf(a + o)).r * 255.0 + 0.5))) { near = k < 4 ? 2.0 : max(near, 1.0); } }
    if (near > 0.0 && !snowy && b != 14.0 && b != 13.0 && b != 11.0) col = mix(col, near > 1.5 ? vec3(0.824, 0.741, 0.518) : vec3(0.941, 0.863, 0.635), 0.92);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export class TerrainGL {
  constructor(world) {
    this.world = world;
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    this.gl = gl;
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    this.pr = pr;
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {}; for (const n of ['uData', 'uPal', 'uWorld', 'uArt0', 'uH', 'uSeason', 'uSnow', 'uTime', 'uSeed']) this.u[n] = gl.getUniformLocation(pr, n);
    // palette texture
    const rows = terrainPalette(); const px = new Uint8Array(16 * 16 * 4);
    rows.forEach((row, y) => row.forEach((c, x) => { const o = (y * 16 + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; }));
    this.palTex = this.tex(16, 16, px);
    this.dataTex = null;
    this.ok = true;
  }
  tex(w, h, data) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  // (re)build the per-tile data texture: call after terrain edits
  setData(waterKinds) {
    if (!this.ok) return;
    const W = this.world, { w, h, N, biome, height, temp, river } = W;
    const px = new Uint8Array(N * 4);
    for (let i = 0; i < N; i++) {
      px[i * 4] = biome[i]; px[i * 4 + 1] = Math.max(0, Math.min(255, Math.round((height[i] + 1) * 127.5))); px[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(temp[i] * 255)));
      px[i * 4 + 3] = (river[i] ? 1 : 0) | (waterKinds?.[i] === 2 ? 2 : 0) | (BIOMES[biome[i]].water ? 4 : 0);
    }
    if (this.dataTex) this.gl.deleteTexture(this.dataTex);
    this.dataTex = this.tex(w, h, px);
  }
  // Render the view at art resolution (one GL pixel per art pixel) and return how to place it:
  // { img, x, y, w, h } in device pixels. camX/camY: world px at the canvas's top-left corner.
  render(cw, ch, camX, camY, zoomDev, season, snow, time, seed) {
    const gl = this.gl;
    const k = zoomDev / 2; // device px per art px
    const ax = camX * 2, ay = camY * 2, ox = Math.floor(ax), oy = Math.floor(ay);
    const gw = Math.ceil(cw / k) + 2, gh = Math.ceil(ch / k) + 2;
    if (this.canvas.width !== gw || this.canvas.height !== gh) { this.canvas.width = gw; this.canvas.height = gh; }
    gl.viewport(0, 0, gw, gh);
    gl.useProgram(this.pr);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.dataTex); gl.uniform1i(this.u.uData, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.palTex); gl.uniform1i(this.u.uPal, 1);
    gl.uniform2f(this.u.uWorld, this.world.w, this.world.h);
    gl.uniform2f(this.u.uArt0, ox, oy);
    gl.uniform1f(this.u.uH, gh);
    gl.uniform1f(this.u.uSeason, season); gl.uniform1f(this.u.uSnow, snow);
    gl.uniform1f(this.u.uTime, time % 1000); gl.uniform1f(this.u.uSeed, seed % 997);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return { img: this.canvas, x: -(ax - ox) * k, y: -(ay - oy) * k, w: gw * k, h: gh * k };
  }
}
