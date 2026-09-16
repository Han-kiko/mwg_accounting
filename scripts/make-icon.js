/**
 * 生成应用图标：圆角蓝底 + 金色钱币。
 * 输出 images/icon.png（512x512）和 images/icon.ico（Windows 多尺寸）。
 * 运行：node scripts/make-icon.js
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** 在 512 坐标系里计算每个像素的颜色（RGBA 数组） */
function drawIcon(size) {
  const png = new PNG({ width: size, height: size });
  const s = size / 512;

  // 圆角矩形参数（512 坐标系）
  const corner = 112;
  // 金币参数
  const coinCx = 256;
  const coinCy = 278;
  const coinR = 168;
  const rimW = 30;
  // 高光参数
  const shineCx = 208;
  const shineCy = 208;
  const shineR = 64;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const X = x / s;
      const Y = y / s;

      // --- 圆角矩形遮罩（抗锯齿） ---
      const dx = Math.max(Math.abs(X - 256) - (256 - corner), 0);
      const dy = Math.max(Math.abs(Y - 256) - (256 - corner), 0);
      const cornerDist = Math.sqrt(dx * dx + dy * dy);
      const bgAlpha = clamp(corner - cornerDist + 0.5, 0, 1);

      // 背景：蓝色垂直渐变（上浅下深）
      const t = Y / 512;
      let r = lerp(80, 52, t);
      let g = lerp(108, 64, t);
      let b = lerp(241, 198, t);

      // --- 金币 ---
      const coinDist = Math.sqrt((X - coinCx) ** 2 + (Y - coinCy) ** 2);
      const coinEdge = clamp((coinR - coinDist) * 1.5 + 0.5, 0, 1); // 外缘抗锯齿
      if (coinDist < coinR) {
        if (coinDist > coinR - rimW) {
          // 外圈（深金）
          const rimT = (coinDist - (coinR - rimW)) / rimW;
          r = lerp(212, 156, rimT);
          g = lerp(165, 118, rimT);
          b = lerp(46, 32, rimT);
        } else {
          // 内盘（亮金，带径向明暗）
          const radial = coinDist / (coinR - rimW);
          r = lerp(255, 236, radial);
          g = lerp(219, 186, radial);
          b = lerp(82, 62, radial);
        }
        // 高光（左上柔光）
        const shineDist = Math.sqrt((X - shineCx) ** 2 + (Y - shineCy) ** 2);
        const shineA = clamp((1 - shineDist / shineR) * 0.55, 0, 0.55);
        r = lerp(r, 255, shineA);
        g = lerp(g, 255, shineA);
        b = lerp(b, 250, shineA);
      } else {
        // 币外区域略压暗边缘
      }

      const idx = (size * y + x) << 2;
      png.data[idx] = Math.round(r);
      png.data[idx + 1] = Math.round(g);
      png.data[idx + 2] = Math.round(b);
      png.data[idx + 3] = Math.round(bgAlpha * 255);
    }
  }
  return png;
}

/** 把多张 PNG 打包成 Windows ICO（PNG 压缩条目，Vista+ 通用） */
function makeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + 16 * pngs.length;
  const entries = [];
  const blobs = [];
  for (const [size, png] of pngs) {
    const buf = PNG.sync.write(png, { colorType: 6 });
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    blobs.push(buf);
    offset += buf.length;
  }
  return Buffer.concat([header, ...entries, ...blobs]);
}

const outDir = path.join(__dirname, '..', 'images');
fs.mkdirSync(outDir, { recursive: true });

// 主图标 512（PNG，以后打 Mac 包也用它）
fs.writeFileSync(path.join(outDir, 'icon.png'), PNG.sync.write(drawIcon(512), { colorType: 6 }));

// Windows ICO：多尺寸
const sizes = [16, 24, 32, 48, 64, 128, 256];
fs.writeFileSync(path.join(outDir, 'icon.ico'), makeIco(sizes.map((s) => [s, drawIcon(s)])));

console.log('图标已生成：images/icon.png (512x512), images/icon.ico (' + sizes.join('/') + ')');
