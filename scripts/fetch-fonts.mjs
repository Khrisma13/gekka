#!/usr/bin/env node
/**
 * 拉取 MiSans 网页字体并生成本地 @font-face 样式。
 *
 * 为什么不用 Google Fonts / CDN：
 *   - fonts.googleapis.com 在中国大陆访问不稳定，而本站主要受众在国内
 *   - 本站是纯静态站，字体必须和页面一起部署，不依赖任何第三方域名
 *
 * 做法：
 *   MiSans 完整字库约 3 万字符，单个 woff2 有 5MB 以上，不能整包下发。
 *   因此按 Unicode 码位切成 100 个分片，用 @font-face + unicode-range 声明；
 *   浏览器只会下载「当前页面实际用到的字符」所在的那几个分片，通常 5–10 个。
 *
 * 分片产物来自开源项目 dsrkafuu/misans（Apache-2.0），
 * 它按 Unicode 码位切片，并把 MiSans 不支持的码位从 unicode-range 中剔除。
 *
 * 用法：
 *   npm run fonts            使用已缓存的文件重新生成 CSS（快）
 *   npm run fonts -- --force  重新下载字体包（版本升级时用）
 *
 * 字体许可（重要）：
 *   MiSans 由小米科技免费授权商用，但有两条硬约束 ——
 *     1) 使用方须在使用处注明使用了 MiSans 字体（本站已在页脚署名）
 *     2) 不得对字体本身进行改编或二次开发，不得单独分发/售卖字体文件
 *   子集化仅用于网页传输，未改动字形本身。完整协议：
 *   https://hyperos.mi.com/font-download/MiSans字体知识产权许可协议.pdf
 */

import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

/** 字体包版本。升级时改这里，然后 `npm run fonts -- --force` */
const VERSION = '4.1.0';

/**
 * 本站只用三档字重（见 tokens.css）。
 * MiSans 内部的字重值与站点语义值不同，这里做显式映射；
 * 映射错了会导致 font-weight 匹配不到对应文件，浏览器就会自己合成假粗体。
 */
const WEIGHTS = [
  { file: 'Light', weight: 300 },   // MiSans 内部 250，用于大标题
  { file: 'Regular', weight: 400 }, // 内部 330，正文
  { file: 'Medium', weight: 500 },  // 内部 380，导航与强调
];

/** @font-face 里暴露给 CSS 的字体族名 */
const FAMILY = 'MiSans';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache', 'misans');
const OUT = path.join(ROOT, 'public', 'fonts', 'misans');

const force = process.argv.includes('--force');

/** 极简 tar 解析：npm tarball 是 ustar 格式，够用且免依赖 */
function untar(buf) {
  const files = [];
  let off = 0;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break; // 结束块

    const name = header.subarray(0, 100).toString('utf8').replace(/\0[\s\S]*$/, '');
    const size = parseInt(header.subarray(124, 136).toString('utf8').replace(/\0[\s\S]*$/, '').trim(), 8) || 0;
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0[\s\S]*$/, '');
    const full = prefix ? `${prefix}/${name}` : name;
    const dataStart = off + 512;

    if (name) files.push({ name: full, data: buf.subarray(dataStart, dataStart + size) });
    off = dataStart + Math.ceil(size / 512) * 512;
  }
  return files;
}

async function download() {
  const url = `https://registry.npmjs.org/misans/-/misans-${VERSION}.tgz`;
  process.stdout.write(`下载 MiSans ${VERSION} …\n`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败：HTTP ${res.status} ${url}`);

  const tgz = Buffer.from(await res.arrayBuffer());
  const files = untar(gunzipSync(tgz));

  await mkdir(CACHE, { recursive: true });
  const needed = [];
  for (const w of WEIGHTS) {
    // 100 个 woff2：编号分片 + latin / latin-ext / cyrillic / vietnamese
    needed.push(...files.filter((f) => f.name.includes(`/Normal/MiSans-${w.file}.`) && f.name.endsWith('.woff2')));
    needed.push(...files.filter((f) => f.name.endsWith(`/Normal/MiSans-${w.file}.min.css`)));
  }

  for (const f of needed) {
    const base = path.basename(f.name);
    await writeFile(path.join(CACHE, base), f.data);
  }
  process.stdout.write(`  已缓存 ${needed.length} 个文件\n`);
}

/** 从 min.css 里抽出 @font-face 规则 */
function parseFaces(css) {
  return (
    css
      .replace(/\/\*\[[^\]]*\]\*\//g, '') // 去掉 /*[5]*/ 这类切片序号注释
      .match(/@font-face\s*\{[^}]*\}/g) || []
  );
}

async function buildCss() {
  await mkdir(OUT, { recursive: true });

  const blocks = [];
  let copied = 0;

  for (const w of WEIGHTS) {
    const minCss = await readFile(path.join(CACHE, `MiSans-${w.file}.min.css`), 'utf8');
    const faces = parseFaces(minCss);

    for (const face of faces) {
      // 把文件复制到 public，同时把 font-weight 改写成站点语义值
      const src = face.match(/url\(['"]?([^'")]+)['"]?\)/);
      if (!src) continue;
      const fileName = path.basename(src[1]);
      const from = path.join(CACHE, fileName);
      if (!existsSync(from)) continue;

      const buf = await readFile(from);
      await writeFile(path.join(OUT, fileName), buf);
      copied++;

      blocks.push(
        face
          .replace(/font-weight\s*:\s*[0-9.]+/, `font-weight:${w.weight}`)
          .replace(/font-family\s*:\s*[^;]+/, `font-family:${FAMILY}`)
          .replace(/\s+/g, ''),
      );
    }
  }

  const banner =
    `/* 月華社 · MiSans 网页字体\n` +
    ` *\n` +
    ` * 由 scripts/fetch-fonts.mjs 生成，请勿手工编辑。\n` +
    ` * 字体：MiSans ${VERSION}（小米科技）· 免费商用，须署名，不得改编或单独分发字体文件。\n` +
    ` * 许可全文：https://hyperos.mi.com/font-download/MiSans字体知识产权许可协议.pdf\n` +
    ` * 分片方案：dsrkafuu/misans（Apache-2.0）按 Unicode 码位切片。\n` +
    ` *\n` +
    ` * 共 ${blocks.length} 个分片 / ${WEIGHTS.length} 档字重。\n` +
    ` * 浏览器只会下载页面实际用到字符所在的分片。\n` +
    ` */\n`;

  await writeFile(path.join(OUT, 'MiSans.css'), banner + blocks.join('\n') + '\n');

  const sizes = await readdir(OUT);
  process.stdout.write(
    `  已生成 public/fonts/misans/MiSans.css\n` +
      `    ${blocks.length} 条 @font-face，复制 ${copied} 个 woff2，目录共 ${sizes.length} 个文件\n`,
  );
}

// ---- 主流程 --------------------------------------------------------------

const cacheReady =
  existsSync(path.join(CACHE, 'MiSans-Light.min.css')) &&
  existsSync(path.join(CACHE, 'MiSans-Regular.min.css')) &&
  existsSync(path.join(CACHE, 'MiSans-Medium.min.css'));

if (force || !cacheReady) {
  await download();
} else {
  process.stdout.write('使用已缓存的字体包（要重新下载请加 --force）\n');
}

await buildCss();
