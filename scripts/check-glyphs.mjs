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
 * 扫两处文本：
 *   ① dist 里的渲染文本（已剔除 HTML 注释、样式表与脚本标签的内容）——
 *      页面上看得见的字全在这儿；
 *   ② public/games/*.js 的字符串字面量 —— 彩蛋玩法是**按需下载**的，
 *      它的字不进任何 HTML，只盯 dist 会整块漏掉（见脚本末尾的 gameScripts）。
 * 两处的注释都会被剔掉，所以组件与脚本注释里的符号不会误报。
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

/** 按需加载的玩法脚本（public/games/*.js）。它们不进 dist 的 HTML，得回源头找 */
async function gameScripts() {
  const dir = path.join(ROOT, 'public', 'games');
  try {
    const files = await readdir(dir);
    return files.filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/**
 * 脚本里「会被读者看到」的字符。只取字符串字面量里的**非 ASCII**：
 *   · 注释是写给维护者的（这个文件头顶就有一大片汉字），不能算数；
 *   · ASCII 全是代码、类名、选择器，界面上不会出现这些形状的字。
 * 两边都卡住，才不会一边漏掉牌面名、一边把注释里的字报成缺字。
 */
function scriptText(js) {
  const out = [];
  const re = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  let m;
  while ((m = re.exec(js))) out.push(m[1] || m[2] || m[3] || '');
  return out.join('\n').replace(/[\x00-\x7F]/g, '');
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
const games = await gameScripts();

/** 码位 → 出现在哪些文件 */
const missing = new Map();
let scanned = 0;

/** 记下一段「会显示给读者的文本」里的码位 */
function note(text, rel) {
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

for (const page of pages) {
  note(visibleText(await readFile(page, 'utf8')), path.relative(DIST, page).replace(/\\/g, '/'));
}

// 按需加载的玩法脚本（public/games/*.js）不在任何 HTML 里，但它的字一样会显示：
// 牌面名、提示文案、通关语。面板改文案最容易漏的就是这一处，所以一并扫上。
for (const file of games) {
  note(scriptText(await readFile(file, 'utf8')), path.relative(ROOT, file).replace(/\\/g, '/'));
}

console.log(
  `字形检查 · 扫描 ${pages.length} 个页面 + ${games.length} 个玩法脚本 / ${scanned} 个字符`,
);
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
