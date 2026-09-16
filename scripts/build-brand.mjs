#!/usr/bin/env node
/**
 * 生成站点品牌素材。
 *
 *   npm run brand
 *
 * 母版是 src/assets/brand/logo.png（3000×3000，黑底透明白的社团徽记）。
 * 母版不放进 public/ —— 那是会被整体部署到线上的目录，
 * 一张 3000px 的母版没有任何页面会用到，白白占带宽。
 * 这与封面的做法一致：原图在 src/assets/，产物在 public/。
 *
 * 产物：
 *   public/brand/logo-mark.png   页头 / 页脚用的徽记，已裁去四周空白
 *   public/favicon.png           浏览器标签页图标（浅底圆角方 + 徽记居中）
 *
 * 徽记是纯黑单色的，直接用（不染色）—— 与站点的 ink-900 几乎同色，
 * 但保留原样能让品牌素材在任何地方复用。
 */
import { mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SRC = join(ROOT, 'src', 'assets', 'brand', 'logo.png');
const OUT_DIR = join(ROOT, 'public', 'brand');
const MARK_OUT = join(OUT_DIR, 'logo-mark.png');
const FAVICON_OUT = join(ROOT, 'public', 'favicon.png');

/** 页头最大按 28px 显示，512 已经远超 2x，再大没有意义 */
const MARK_WIDTH = 512;
const FAVICON_SIZE = 180;
/** 标签页图标底色。取页面底色，深色主题下也不会变成一团黑 */
const FAVICON_BG = '#FAFBFC';
/** 徽记在图标里占的比例，四周留一圈呼吸 */
const FAVICON_INSET = 0.72;

const kb = async (p) => `${((await stat(p)).size / 1024).toFixed(1)} KB`;

async function main() {
  try {
    await readFile(SRC);
  } catch {
    console.error(`找不到母版 ${SRC}。`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  // 母版四周有大量空白（内容只占约 1813×1649 / 3000×3000），
  // 不裁掉的话页头里徽记会缩得很小、还偏在一边。
  const trimmed = await sharp(SRC).trim({ threshold: 10 }).toBuffer();
  const tMeta = await sharp(trimmed).metadata();

  await sharp(trimmed)
    .resize({ width: MARK_WIDTH, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(MARK_OUT);

  const inner = Math.round(FAVICON_SIZE * FAVICON_INSET);
  const markForIcon = await sharp(trimmed)
    .resize({ width: inner, height: inner, fit: 'inside' })
    .toBuffer();

  const bg = Buffer.from(
    `<svg width="${FAVICON_SIZE}" height="${FAVICON_SIZE}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${FAVICON_SIZE}" height="${FAVICON_SIZE}" rx="${Math.round(FAVICON_SIZE * 0.22)}" fill="${FAVICON_BG}"/>` +
      `</svg>`,
  );

  await sharp(bg)
    .composite([{ input: markForIcon, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(FAVICON_OUT);

  console.log(`母版裁边后：${tMeta.width}×${tMeta.height}`);
  console.log(`已生成 public/brand/logo-mark.png（${await kb(MARK_OUT)}）`);
  console.log(`已生成 public/favicon.png（${await kb(FAVICON_OUT)}）`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
