/* Colour maths, shared.

   test/palette.js judges the palette with it and the art-direction
   tools measure candidate colours with it, and those two must agree or
   the guardrail is arguing with the thing it guards.

   Everything happens in linear light. sRGB values are what a screen
   stores, not what an eye receives, and every step below — luminance,
   Lab, and the colour-blindness transform especially — is wrong if it
   is done on the stored numbers.
*/
const hex2rgb = h => {
  const s = String(h).replace('#', '').trim();
  const n = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
  return [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16));
};

/* sRGB companding, so everything below happens in light rather than in
   the numbers a screen happens to store */
const toLinear = v => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const fromLinear = v => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
};

function relLuminance(rgb) {
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = relLuminance(hex2rgb(a)), lb = relLuminance(hex2rgb(b));
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/* Lab, via D65 XYZ */
function lab(hex) {
  const [r, g, b] = hex2rgb(hex).map(toLinear);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const deltaE = (a, b) => {
  const A = lab(a), B = lab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
};

/* Colour vision deficiency, Viénot–Brettel–Mollon 1999: project onto the
   plane the missing cone cannot distinguish. Applied in linear light,
   which is the whole point of the transform and the step most
   implementations skip. */
const CVD = {
  /* no long-wave cone: reds darken and slide toward the yellows */
  protanopia: [[0.11238, 0.88762, 0], [0.07276, 0.92724, 0], [-0.00399, 0.00399, 1]],
  /* no medium-wave cone: the commonest, about 1 man in 16 */
  deuteranopia: [[0.29275, 0.70725, 0], [0.34557, 0.65443, 0], [-0.02174, 0.02174, 1]],
  /* no short-wave cone: rare, and the one that eats blues and teals */
  tritanopia: [[1, 0.14461, -0.14461], [0, 0.85659, 0.14341], [0, 0.85659, 0.14341]]
};

function simulate(hex, kind) {
  if (!kind) return hex;
  const m = CVD[kind];
  const [r, g, b] = hex2rgb(hex).map(toLinear);
  const out = m.map(row => row[0] * r + row[1] * g + row[2] * b);
  return '#' + out.map(v => fromLinear(v).toString(16).padStart(2, '0')).join('');
}


module.exports = { hex2rgb, toLinear, fromLinear, relLuminance, contrast, lab, deltaE, CVD, simulate };
