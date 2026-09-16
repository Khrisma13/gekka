#!/usr/bin/env node
/**
 * 字形覆盖检查：扫描构建产物里「实际会显示的字符」，与 MiSans 的字符集对比。
 *
 * 为什么需要这个：
 *   MiSans 覆盖 GB18030-2022，汉字几乎不会缺，但**日文符号有缺口** ——
 *   实测缺 U+30FB「・」（日文中点）、U+301C「〜」（日文波浪线）。
 *   这些字符不会报错，只会悄悄回退到系统字体，或更糟：显示成方框。
 *   社团站会长期加内容，尤其是日文文案，所以让机器每次构建都替人盯一遍。
 *
 * 扫描的是 dist 里的渲染文本（已剔除 HTML 注释、<style>、<script>），
 * 所以组件注释里的符号不会误报。
 *
 * 用法：
 *   node scripts/check-glyphs.mjs          作为构建后检查，缺字只警告
 *   node scripts/check-glyphs.mjs --strict 缺字即失败（CI 用）
 *
 * 缺字了怎么办：
 *   1) 换写法 —— 「・」可换成「·」(U+00B7)，中文间隔号本就用这个码位
 *   2) 若必须保留，系统字体回退链会兜住（tokens.css 的 --font-sans 末尾）
 *   3) 若是常用符号，可在 fetch-fonts.mjs 里补充字源
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const FONT_CSS = path.join(ROOT, 'public', 'fonts', 'misans', 'MiSans.css');

const strict = process.argv.includes('--strict');

/** 从字体 CSS 里解析出 MiSans 支持的码位集合 */
function loadCoverage(css) {
  const cps = new Set();
  for (const [, range] of css.matchAll(/unicode-range:([^;}]+)/g)) {
    for (const part of range.split(',')) {
      const p = part.trim().toLowerCase();
      if (!p.startsWith('u+')) continue;
      const body = p.slice(2);
      if (body.includes('-')) {
        const [a, b] = body.split('-');
        const lo = parseInt(a, 16);
        const hi = parseInt(b, 16);
        if (Number.isFinite(lo) && Number.isFinite(hi)) {
          for (let c = lo; c <= hi; c++) cps.add(c);
        }
      } else {
        const c = parseInt(body, 16);
        if (Number.isFinite(c)) cps.add(c);
      }
    }
  }
  return cps;
}

/** 把 HTML 里「会被用户看到」的文本抓出来 */
function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')      // 注释（组件里的说明文字）
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')              // 标签
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp|copy|middot|mdash);/g, (m) =>
      ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&copy;': '©', '&middot;': '·', '&mdash;': '—' })[m] ?? m,
    );
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// ---- 主流程 --------------------------------------------------------------

try {
  await stat(DIST);
} catch {
  console.error('找不到 dist/，请先运行 npm run build');
  process.exit(1);
}

const coverage = loadCoverage(await readFile(FONT_CSS, 'utf8'));
const pages = await walk(DIST);

/** 码位 → 出现在哪些页面 */
const missing = new Map();
let scanned = 0;

for (const page of pages) {
  const text = visibleText(await readFile(page, 'utf8'));
  const rel = path.relative(DIST, page).replace(/\\/g, '/');
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    scanned++;
    // 跳过空白与不可见控制字符
    if (cp <= 0x20 || cp === 0x7f || (cp >= 0x200b && cp <= 0x200f)) continue;
    if (coverage.has(cp)) continue;
    if (!missing.has(cp)) missing.set(cp, new Set());
    missing.get(cp).add(rel);
  }
}

console.log(`字形检查 · 扫描 ${pages.length} 个页面 / ${scanned} 个字符`);
console.log(`MiSans 覆盖 ${coverage.size} 个码位`);

if (missing.size === 0) {
  console.log('  ✓ 所有字符均在 MiSans 字符集内，不会掉字');
  process.exit(0);
}

console.log(`\n  ⚠ 有 ${missing.size} 个字符不在 MiSans 内，将由系统字体兜底：`);
for (const [cp, files] of [...missing].sort((a, b) => a[0] - b[0])) {
  const ch = String.fromCodePoint(cp);
  const list = [...files].slice(0, 3).join(', ');
  const more = files.size > 3 ? ` 等 ${files.size} 页` : '';
  console.log(`    ${ch}  U+${cp.toString(16).toUpperCase().padStart(4, '0')}  ← ${list}${more}`);
}
console.log(
  '\n  这些字不会显示成方框（系统字体兜底），但与 MiSans 字形不统一。\n' +
    '  若为高频符号，建议换用 MiSans 覆盖的等价字符，见本脚本头部说明。',
);

process.exit(strict ? 1 : 0);
