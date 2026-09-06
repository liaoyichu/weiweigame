#!/usr/bin/env node
/* Build detailed B747-8 and A330-300 GLB models and export to assets/.
   Real proportions relative to the in-game procedural An-225 (len 42.2u):
   B747-8: len 76.3m (0.908), span 68.4m (0.774), fuse 6.5m (0.72)
   A330-300: len 63.7m (0.758), span 60.3m (0.682), fuse 5.6m (0.62)
   Nose points toward -Z (same convention as in-game procedural models).
   Textures are built with a minimal software rasterizer (DataTexture),
   so GLTFExporter runs headless in Node. */

const THREE_DIR = process.env.THREE_DIR || null;
if (THREE_DIR) module.paths.unshift(THREE_DIR);
const THREE = require('three');
const { GLTFExporter } = require('three/examples/jsm/exporters/GLTFExporter.js');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, 'assets');

/* ---------- minimal canvas polyfill for GLTFExporter ---------- */
function makeShimCanvas(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  const canvas = {
    width: w, height: h, _data: data,
    toDataURL: () => 'data:image/png;base64,' + Buffer.from(pngEncode(w, h, data)).toString('base64'),
    toBlob: (cb, mimeType) => {
      const buf = pngEncode(w, h, data);
      cb({ size: buf.length, type: mimeType || 'image/png', arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
    },
    getContext: () => makeCtx(data, w, h)
  };
  return canvas;
}
function makeCtx(data, w, h) {
  const ctx = {
    fillStyle: '#000', font: '10px sans-serif', textAlign: 'left', textBaseline: 'alphabetic',
    _fill: { r: 0, g: 0, b: 0, a: 255 },
    _arc: null, _xform: { t: [0, 0], s: [1, 1] },
    set fillStyle(v) { this._setStyle(v); },
    set strokeStyle(v) { this._setStyle(v); },
    set font(v) { this._font = v; },
    get font() { return this._font || '10px sans-serif'; },
    set textAlign(v) { this._textAlign = v; },
    set textBaseline(v) { this._textBaseline = v; },
    _setStyle(s) {
      if (typeof s === 'string' && s[0] === '#') {
        const n = parseInt(s.slice(1), 16);
        this._fill = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 255 };
      } else if (typeof s === 'string' && s.startsWith('rgba(')) {
        const m = s.match(/[\d.]+/g).map(Number);
        this._fill = { r: m[0], g: m[1], b: m[2], a: Math.round((m[3] ?? 1) * 255) };
      }
    },
    _px(x, y) {
      return [Math.round(x * this._xform.s[0] + this._xform.t[0]), Math.round(y * this._xform.s[1] + this._xform.t[1])];
    },
    fillRect(x, y, w2, h2) {
      const c = this._fill;
      for (let py = Math.max(0, y | 0); py < Math.min(h, (y + h2) | 0); py++) {
        for (let px = Math.max(0, x | 0); px < Math.min(w, (x + w2) | 0); px++) {
          const i = (py * w + px) * 4;
          const a = c.a / 255;
          data[i] = data[i] * (1 - a) + c.r * a;
          data[i + 1] = data[i + 1] * (1 - a) + c.g * a;
          data[i + 2] = data[i + 2] * (1 - a) + c.b * a;
          data[i + 3] = Math.max(data[i + 3], c.a);
        }
      }
    },
    fillText(text, x, y) {
      const size = parseInt(this._font || '10', 10) || 10;
      const letterW = size * 0.62, letterH = size;
      const dir = this._textAlign === 'center' ? -0.5 : (this._textAlign === 'right' ? -1 : 0);
      const baselineOff = this._textBaseline === 'middle' ? -0.5 : (this._textBaseline === 'top' ? -1 : 0);
      const chars = String(text);
      let cx = x + dir * chars.length * letterW;
      const cy = y + baselineOff * letterH;
      for (const ch of chars) {
        const dots = CHUNKY_DOTS[ch] || CHUNKY_DOTS['?'];
        for (const [dx, dy] of dots) {
          const px = Math.round(cx + dx), py = Math.round(cy + dy);
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const i = (py * w + px) * 4;
            data[i] = this._fill.r; data[i + 1] = this._fill.g; data[i + 2] = this._fill.b; data[i + 3] = this._fill.a;
          }
        }
        cx += letterW;
      }
    },
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    arc(x, y, r, a0, a1) { this._arc = { x, y, r, a0, a1 }; },
    fill() { this._strokeOrFill(true); },
    stroke() { this._strokeOrFill(false); },
    _strokeOrFill(fill) {
      if (this._arc) {
        const { x, y, r, a0, a1 } = this._arc;
        const steps = Math.max(16, (r * (a1 - a0) * 2) | 0);
        for (let i = 0; i <= steps; i++) {
          const a = a0 + (a1 - a0) * (i / steps);
          const px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r);
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const j = (py * w + px) * 4;
            data[j] = this._fill.r; data[j + 1] = this._fill.g; data[j + 2] = this._fill.b; data[j + 3] = this._fill.a;
          }
        }
        this._arc = null;
      }
    },
    getImageData(x, y, w2, h2) {
      const out = new Uint8ClampedArray(w2 * h2 * 4);
      for (let py = 0; py < h2; py++) for (let px = 0; px < w2; px++) {
        const si = ((y + py) * w + (x + px)) * 4, di = (py * w2 + px) * 4;
        out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2]; out[di + 3] = data[si + 3];
      }
      return { data: out, width: w2, height: h2 };
    },
    putImageData(img, x, y) {
      for (let py = 0; py < img.height; py++) for (let px = 0; px < img.width; px++) {
        const si = (py * img.width + px) * 4;
        const di = ((y + py) * w + (x + px)) * 4;
        if (di < 0 || di + 3 >= data.length) continue;
        data[di] = img.data[si]; data[di + 1] = img.data[si + 1]; data[di + 2] = img.data[si + 2]; data[di + 3] = img.data[si + 3];
      }
    },
    translate(x, y) { this._xform.t = [x, y]; },
    scale(x, y) { this._xform.s = [x, y]; },
    save() {}, restore() {}, rotate() {}
  };
  return ctx;
}
globalThis.ImageData = class ImageData {
  constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
};
globalThis.document = {
  createElement: () => makeShimCanvas(1, 1)
};
globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      if (this.onloadend) this.onloadend();
    });
  }
};

function pngEncode(w, h, data) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w * 4; x++) raw[y * (w * 4 + 1) + 1 + x] = data[y * w * 4 + x];
  }
  const idat = zlib.deflateSync(raw);
  const chunk = (type, payload) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(payload.length);
    const td = Buffer.concat([Buffer.from(type), payload]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))
  ]);
}
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const CHUNKY_DOTS = {};
(() => {
  const F = {
    '0': '01110100011000110001100011000110001100011000101110', '1': '00100011000010000100001000010000100001000010001110',
    '2': '01110100011000100001000010000100001000010000011111', '3': '0111010001100010000011100000100001100011000101110',
    '4': '0001000011001010100101001111110010000100001000010', '5': '11111100001000001111000001000001000011000101110',
    '6': '00111010000100001011110011000110001100011000101110', '7': '1111100001000010001000100001000010000100001000010',
    '8': '01110100011000110001011101000110001100011000101110', '9': '0111010001100011000110111100000100000100001011100',
    'A': '01110100011000110001111111000110001100011000110001', 'B': '111101100011000110001111010000110000110000111110',
    'C': '0111010001100001000001000010000100001000010001110', 'D': '1111011000110001100011000110001100011000111110',
    'E': '1111110000100000100001111000010000100001000011111', 'F': '1111110000100000100001111000010000100001000010000',
    'G': '01110100011000010000101111000110001100011000101110', 'H': '10001100011000110001111111000110001100011000110001',
    'I': '0111000100001000010000100001000010000100001001110', 'J': '0000100000100000100000100001100011000110001011100',
    'K': '100011000110101001110010100110001100011000110001', 'L': '1000010000100001000010000100001000010000100001111',
    'M': '1000111001101111101110011000110001100011000110001', 'N': '10001110011110110111100111000110001100011000110001',
    'O': '01110100011000110001100011000110001100011000101110', 'P': '1111011000110001100011000111101000010000100001000',
    'Q': '0111010001100011000110001100011000110111110000010', 'R': '1111011000110001100011000111101001010011000110001',
    'S': '01110100011000001000001110000001000011000101110', 'T': '1111100100001000010000100001000010000100001000010',
    'U': '10001100011000110001100011000110001100011000101110', 'V': '100011000110001100011000110001100011010101000110',
    'W': '100011000110001100011000110001101110111101110011', 'X': '1000110001100010101000101000110001100011000110001',
    'Y': '1000110001100011000101010001100010000100001000010', 'Z': '111110000100001000100010000100001000010000111111',
    '-': '0000000000000000000000000000000111100000000000000', ' ': '0000000000000000000000000000000000000000000000000',
    '?': '0111010001100010000100001000010000000000000000100'
  };
  for (const [ch, pat] of Object.entries(F)) {
    const dots = [];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) if (pat[r * 5 + col] === '1') dots.push([col, r]);
    CHUNKY_DOTS[ch] = dots;
  }
})();

/* ---------- livery texture builders (canvas bottom = nose / v=0) ---------- */
function makeTexture(w, h, draw) {
  const shim = makeShimCanvas(w, h);
  draw(shim.getContext(), shim);
  const tex = new THREE.DataTexture(shim._data, w, h, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

function paintB747Livery(ctx, c) {
  const W = c.width, H = c.height;
  ctx.fillStyle = '#f5f8fb';
  ctx.fillRect(0, 0, W, H);
  // cockpit glass near nose (bottom of canvas)
  ctx.fillStyle = '#16222e';
  ctx.fillRect(Math.round(W * 0.18), Math.round(H * 0.86), Math.round(W * 0.32), 18);
  // window band (mid fuselage)
  ctx.fillStyle = '#e3eaf1';
  ctx.fillRect(0, Math.round(H * 0.38), W, 26);
  ctx.fillStyle = '#2c4a6e';
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 90; i++) {
      ctx.fillRect(((i * 12) % W) + 2, Math.round(H * 0.38) + 4 + row * 12, 7, 9);
    }
  }
  // belly blue band + red thin stripe
  ctx.fillStyle = '#1e5fa8';
  ctx.fillRect(0, Math.round(H * 0.24), W, 20);
  ctx.fillStyle = '#b91f3a';
  ctx.fillRect(0, Math.round(H * 0.24) + 20, W, 7);
  // tail text near rear (top of canvas)
  ctx.fillStyle = '#1e5fa8';
  ctx.font = '36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('B747-8', Math.round(W * 0.5), Math.round(H * 0.16));
}

function paintA330Livery(ctx, c) {
  const W = c.width, H = c.height;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#16222e';
  ctx.fillRect(Math.round(W * 0.18), Math.round(H * 0.86), Math.round(W * 0.28), 18);
  ctx.fillStyle = '#eef2f6';
  ctx.fillRect(0, Math.round(H * 0.38), W, 26);
  ctx.fillStyle = '#35597a';
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 90; i++) {
      ctx.fillRect(((i * 12) % W) + 2, Math.round(H * 0.38) + 4 + row * 12, 7, 9);
    }
  }
  ctx.fillStyle = '#0d8f5f';
  ctx.fillRect(0, Math.round(H * 0.26), W, 16);
  ctx.fillStyle = '#0a5f8c';
  ctx.fillRect(0, Math.round(H * 0.26) + 16, W, 5);
  ctx.fillStyle = '#0d8f5f';
  ctx.font = '34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A330-300', Math.round(W * 0.5), Math.round(H * 0.17));
}

function paintFin(livery) {
  return makeTexture(256, 512, (ctx, c) => {
    if (livery === 'b747') {
      ctx.fillStyle = '#1e5fa8';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 150, 256, 10);
      ctx.fillRect(0, 260, 256, 10);
      ctx.font = '56px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('B747-8', 128, 400);
    } else {
      ctx.fillStyle = '#0d8f5f';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 170, 256, 8);
      ctx.font = '52px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A330', 128, 390);
    }
  });
}

/* ---------- materials ---------- */
const bodyWhite = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, roughness: 0.38, metalness: 0.05 });
const wingMat = new THREE.MeshStandardMaterial({ color: 0xaeb9c6, roughness: 0.5, metalness: 0.08 });
const nacelleMat = new THREE.MeshStandardMaterial({ color: 0xcfd6dd, roughness: 0.42, metalness: 0.12 });
const intakeMat = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.6, metalness: 0.05 });
const fanMat = new THREE.MeshStandardMaterial({ color: 0x2a3440, roughness: 0.4, metalness: 0.35 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x16222e, roughness: 0.12, metalness: 0.75 });
const strutMat = new THREE.MeshStandardMaterial({ color: 0x8f9aa5, roughness: 0.4, metalness: 0.5 });
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.85, metalness: 0.02 });
const radomeMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.5, metalness: 0.08 });

/* ---------- fuselage (nose at -Z) ---------- */
function buildFuselage(opts) {
  const profile = [
    [0.06, -18.8], [1.5 * opts.body, -17.2], [2.55 * opts.body, -13.8],
    [3.25 * opts.body, -8.6], [3.25 * opts.body, -1.5], [3.05 * opts.body, 9.8],
    [2.55 * opts.body, 16.8], [1.15 * opts.body, 21.2], [0.08 * opts.body, 23.4]
  ].map(([r, y]) => new THREE.Vector2(r, y * opts.len));
  const geo = new THREE.LatheGeometry(profile, 96);
  geo.rotateX(Math.PI / 2);
  return new THREE.Mesh(geo, opts.livery);
}

function buildHump() {
  const cap = new THREE.CapsuleGeometry(0.95, 5.2, 12, 24);
  cap.rotateX(Math.PI / 2);
  const hump = new THREE.Mesh(cap, bodyWhite);
  hump.position.set(0, 2.55, -11.5);
  return hump;
}

function buildWing(opts) {
  const g = new THREE.Group();
  const halfSpan = opts.span / 2;
  const tipX = halfSpan;
  const sweepOff = (tipX - opts.rootX) * Math.tan(opts.sweep);
  const tipFront = opts.rootFront + sweepOff;
  const tipRear = opts.rootRear + (tipX - opts.rootX) * Math.tan(opts.rearSweep);
  const tipChord = opts.tipChord;
  for (const side of [-1, 1]) {
    const s = side === 1 ? 1 : -1;
    const shape = new THREE.Shape();
    shape.moveTo(s * opts.rootX, opts.rootFront);
    shape.lineTo(s * tipX, tipFront);
    shape.lineTo(s * tipX, tipFront + tipChord);
    shape.lineTo(s * opts.rootX, opts.rootRear);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: opts.thickness, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0.4, 0);
    g.add(new THREE.Mesh(geo, wingMat));
  }
  return g;
}

function buildWinglet(opts) {
  const g = new THREE.Group();
  const tipX = opts.span / 2;
  const topZ = opts.wingletHeight;
  for (const side of [-1, 1]) {
    const s = side === 1 ? 1 : -1;
    const shape = new THREE.Shape();
    shape.moveTo(s * tipX, 0);
    shape.lineTo(s * (tipX + opts.wingletChord), 0);
    shape.lineTo(s * (tipX - 0.2), topZ);
    shape.lineTo(s * (tipX - 0.6), topZ);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, 0);
    const wl = new THREE.Mesh(geo, wingMat);
    wl.position.set(0, 1.0, opts.wingletZ);
    g.add(wl);
  }
  return g;
}

function buildTailPlane(opts) {
  const shape = new THREE.Shape();
  const halfSpan = opts.span / 2;
  const sweepOff = halfSpan * Math.tan(opts.sweep);
  shape.moveTo(0, opts.rootFront);
  shape.lineTo(halfSpan, opts.rootFront + sweepOff);
  shape.lineTo(halfSpan, opts.rootFront + sweepOff + opts.tipChord);
  shape.lineTo(0, opts.rootRear);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: opts.thickness, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.15, 0);
  const tp = new THREE.Mesh(geo, wingMat);
  tp.position.set(0, opts.y, opts.z);
  return tp;
}

function buildFin(opts) {
  const shape = new THREE.Shape();
  const sweepOff = opts.height * Math.tan(opts.sweep);
  shape.moveTo(0, 0);
  shape.lineTo(-opts.rootChord, 0);
  shape.lineTo(-opts.tipChord - sweepOff, opts.height);
  shape.lineTo(-sweepOff, opts.height);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: opts.thickness, bevelEnabled: false });
  geo.translate(0, 0, -opts.thickness / 2);
  const fin = new THREE.Mesh(geo, opts.material);
  fin.position.set(0, opts.y, opts.z);
  return fin;
}

function buildEngine(opts) {
  const g = new THREE.Group();
  const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(opts.r, opts.r, opts.len, 48), nacelleMat);
  nacelle.rotation.x = Math.PI / 2;
  g.add(nacelle);
  const inlet = new THREE.Mesh(new THREE.TorusGeometry(opts.r * 0.62, opts.r * 0.1, 12, 48), intakeMat);
  inlet.position.z = -opts.len / 2 - opts.r * 0.06;
  g.add(inlet);
  const fan = new THREE.Mesh(new THREE.CircleGeometry(opts.r * 0.58, 36), fanMat);
  fan.position.z = -opts.len / 2 - opts.r * 0.1;
  g.add(fan);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(opts.r * 0.55, opts.r * 0.5, opts.r * 0.55, 36), intakeMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = opts.len / 2 + opts.r * 0.25;
  g.add(nozzle);
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(opts.pylonW, opts.pylonH, opts.pylonL), strutMat);
  pylon.position.y = opts.pylonY;
  pylon.position.z = opts.pylonZ;
  g.add(pylon);
  g.position.set(opts.x, opts.y, opts.z);
  return g;
}

function buildLandingGear(opts) {
  const g = new THREE.Group();
  const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, opts.noseLen, 10), strutMat);
  noseStrut.position.set(0, -opts.noseLen / 2 - 0.1, opts.noseZ);
  g.add(noseStrut);
  for (const s of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.16, 10, 20), wheelMat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(s * 0.42, -opts.noseLen - 0.05, opts.noseZ);
    g.add(wheel);
  }
  for (const z of opts.bodyGearZ) {
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, opts.gearLen, 10), strutMat);
      strut.position.set(s * opts.bodyGearX, -opts.gearLen / 2 - 0.1, z);
      g.add(strut);
      const bogie = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 1.5), strutMat);
      bogie.position.set(s * opts.bodyGearX, -opts.gearLen - 0.12, z);
      g.add(bogie);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.15, 10, 20), wheelMat);
          wheel.rotation.y = Math.PI / 2;
          wheel.position.set(s * opts.bodyGearX + sx * 0.24, -opts.gearLen - 0.06, z + sz * 0.62);
          g.add(wheel);
        }
      }
    }
  }
  return g;
}

/* ---------- assemble ---------- */
function buildB747() {
  const group = new THREE.Group();
  const livery = new THREE.MeshStandardMaterial({ map: makeTexture(1024, 512, paintB747Livery), roughness: 0.38, metalness: 0.05 });
  group.add(buildFuselage({ len: 0.908, body: 0.72, livery }));

  const radome = new THREE.Mesh(new THREE.SphereGeometry(2.34 * 0.85, 32, 20), radomeMat);
  radome.scale.set(1, 0.9, 0.75);
  radome.position.set(0, 0.1, -18.9);
  group.add(radome);

  const glass = new THREE.Mesh(new THREE.SphereGeometry(2.34, 32, 20), glassMat);
  glass.scale.set(1, 0.55, 0.95);
  glass.position.set(0, 1.15, -16.7);
  group.add(glass);
  const glass2 = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), glassMat);
  glass2.scale.set(1, 0.6, 1.2);
  glass2.position.set(0, 3.0, -15.9);
  group.add(glass2);

  group.add(buildHump());

  group.add(buildWing({
    span: 34.7, rootX: 3.2, rootFront: -1.6, rootRear: 8.2,
    sweep: 37.5 * Math.PI / 180, rearSweep: -2.5 * Math.PI / 180,
    tipChord: 2.2, thickness: 0.95
  }));
  group.add(buildWinglet({ span: 34.7, wingletChord: 1.6, wingletHeight: 1.4, wingletZ: 10.2 }));
  group.add(buildTailPlane({ span: 7.4, rootFront: -1.6, rootRear: 2.4, tipChord: 1.1, sweep: 35 * Math.PI / 180, thickness: 0.3, y: 1.9, z: 11.9 }));
  group.add(buildFin({
    height: 6.4, rootChord: 5.6, tipChord: 1.7, sweep: 40 * Math.PI / 180,
    thickness: 0.5, y: 3.2, z: 12.6,
    material: new THREE.MeshStandardMaterial({ map: paintFin('b747'), roughness: 0.4, metalness: 0.05 })
  }));

  group.add(buildEngine({ r: 1.32, len: 4.5, x: 7.0, y: 0.12, z: 0.6, pylonW: 0.8, pylonH: 0.9, pylonL: 2.2, pylonY: -0.62, pylonZ: 0.8 }));
  group.add(buildEngine({ r: 1.32, len: 4.5, x: -7.0, y: 0.12, z: 0.6, pylonW: 0.8, pylonH: 0.9, pylonL: 2.2, pylonY: -0.62, pylonZ: 0.8 }));
  group.add(buildEngine({ r: 1.28, len: 4.4, x: 13.6, y: 0.05, z: 1.9, pylonW: 0.75, pylonH: 0.85, pylonL: 2.0, pylonY: -0.55, pylonZ: 2.0 }));
  group.add(buildEngine({ r: 1.28, len: 4.4, x: -13.6, y: 0.05, z: 1.9, pylonW: 0.75, pylonH: 0.85, pylonL: 2.0, pylonY: -0.55, pylonZ: 2.0 }));

  const fair = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 16), bodyWhite);
  fair.scale.set(1, 0.6, 2.2);
  fair.position.set(3.4, 0.6, 0.6);
  group.add(fair);
  const fair2 = fair.clone();
  fair2.position.x = -3.4;
  group.add(fair2);

  group.add(buildLandingGear({ noseZ: -11.8, noseLen: 1.9, bodyGearZ: [3.0, 6.8], bodyGearX: 2.5, gearLen: 2.0 }));
  return group;
}

function buildA330() {
  const group = new THREE.Group();
  const livery = new THREE.MeshStandardMaterial({ map: makeTexture(1024, 512, paintA330Livery), roughness: 0.4, metalness: 0.04 });
  group.add(buildFuselage({ len: 0.758, body: 0.62, livery }));

  const radome = new THREE.Mesh(new THREE.SphereGeometry(2.02 * 0.85, 32, 20), radomeMat);
  radome.scale.set(1, 0.9, 0.78);
  radome.position.set(0, 0.1, -18.9 * 0.758);
  group.add(radome);

  const glass = new THREE.Mesh(new THREE.SphereGeometry(2.02, 32, 20), glassMat);
  glass.scale.set(1, 0.55, 0.95);
  glass.position.set(0, 1.0, -17.0 * 0.758);
  group.add(glass);

  group.add(buildWing({
    span: 30.6, rootX: 2.8, rootFront: -1.2, rootRear: 7.0,
    sweep: 30 * Math.PI / 180, rearSweep: -2 * Math.PI / 180,
    tipChord: 1.9, thickness: 0.85
  }));
  group.add(buildWinglet({ span: 30.6, wingletChord: 1.3, wingletHeight: 1.8, wingletZ: 7.8 }));
  group.add(buildTailPlane({ span: 6.6, rootFront: -1.4, rootRear: 2.2, tipChord: 1.0, sweep: 32 * Math.PI / 180, thickness: 0.28, y: 1.7, z: 10.9 }));
  group.add(buildFin({
    height: 5.1, rootChord: 4.8, tipChord: 1.4, sweep: 36 * Math.PI / 180,
    thickness: 0.45, y: 2.55, z: 11.4,
    material: new THREE.MeshStandardMaterial({ map: paintFin('a330'), roughness: 0.42, metalness: 0.04 })
  }));

  group.add(buildEngine({ r: 1.12, len: 4.3, x: 8.2, y: 0.1, z: 0.7, pylonW: 0.7, pylonH: 0.8, pylonL: 2.0, pylonY: -0.5, pylonZ: 0.8 }));
  group.add(buildEngine({ r: 1.12, len: 4.3, x: -8.2, y: 0.1, z: 0.7, pylonW: 0.7, pylonH: 0.8, pylonL: 2.0, pylonY: -0.5, pylonZ: 0.8 }));

  const fair = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 16), bodyWhite);
  fair.scale.set(1, 0.6, 2.0);
  fair.position.set(3.1, 0.5, 0.4);
  group.add(fair);
  const fair2 = fair.clone();
  fair2.position.x = -3.1;
  group.add(fair2);

  group.add(buildLandingGear({ noseZ: -11.8 * 0.758, noseLen: 1.75, bodyGearZ: [3.2], bodyGearX: 2.15, gearLen: 1.9 }));
  return group;
}

async function exportGLB(model, file) {
  const exporter = new GLTFExporter();
  const buffer = await new Promise((resolve, reject) => {
    exporter.parse(model, (res) => resolve(ArrayBuffer.isView(res) ? Buffer.from(res.buffer, res.byteOffset, res.byteLength) : Buffer.from(res)), reject, { binary: true });
  });
  fs.writeFileSync(file, buffer);
  console.log('wrote', file, buffer.length, 'bytes');
}

(async () => {
  await exportGLB(buildB747(), path.join(OUT, 'b747.glb'));
  await exportGLB(buildA330(), path.join(OUT, 'a330.glb'));
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
