// Seeded 2D gradient (Perlin) noise + fractal brownian motion.
export function makeNoise2D(rng) {
  const perm = [];
  for (let i = 0; i < 256; i++) perm.push(i);
  rng.shuffle(perm);
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t, a, b) => a + t * (b - a);
  const grad = (h, x, y) => {
    switch (h & 7) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  };

  return function noise(x, y) {
    let X = Math.floor(x), Y = Math.floor(y);
    x -= X; y -= Y;
    X &= 255; Y &= 255;
    const u = fade(x), v = fade(y);
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
    return lerp(v,
      lerp(u, grad(aa, x, y), grad(ba, x - 1, y)),
      lerp(u, grad(ab, x, y - 1), grad(bb, x - 1, y - 1)));
  };
}

export function fbm(noise, x, y, octaves = 5, lacunarity = 2, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq + o * 17.3, y * freq - o * 9.1);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
