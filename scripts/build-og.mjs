#!/usr/bin/env node
/**
 * 生成默认社交分享卡 public/og-default.png（1200×630）。
 *
 *   npm run og
 *
 * 做法是用无头浏览器渲染 design/og-card.html —— 而不是用图形库画。
 * 理由：字体必须是 MiSans 且与站点完全一致，图形库要重新实现一遍排版，
 * 字重字距对不上，换字体还得改两处。
 *
 * 需要本机装有 Chrome / Edge / Chromium。找不到会明确报错，不会静默失败。
 */
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const TEMPLATE = join(ROOT, 'design', 'og-card.html');
const OUTPUT = join(ROOT, 'public', 'og-default.png');

const CANDIDATES = [
  // Windows
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
];

function findBrowser() {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const hit = CANDIDATES.find((p) => existsSync(p));
  if (hit) return hit;
  console.error(
    '找不到 Chrome / Edge / Chromium。\n' +
      '  可以装一个，或用 CHROME_PATH 环境变量指定可执行文件路径后重试。',
  );
  process.exit(1);
}

function toFileUrl(p) {
  return `file:///${p.replace(/\\/g, '/').replace(/^\//, '')}`;
}

const browser = findBrowser();
console.log(`浏览器：${browser}`);

await run(browser, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  // 字体是相对路径引用的本地 woff2，file:// 下需要这个开关才稳定
  '--allow-file-access-from-files',
  '--force-device-scale-factor=1',
  '--virtual-time-budget=9000',
  '--window-size=1200,630',
  `--screenshot=${OUTPUT}`,
  toFileUrl(TEMPLATE),
]);

if (!existsSync(OUTPUT)) {
  console.error('渲染失败，未生成输出文件。');
  process.exit(1);
}

const { size } = await import('node:fs').then((fs) => fs.promises.stat(OUTPUT));
console.log(`✓ 已生成 ${OUTPUT}（${(size / 1024).toFixed(0)}KB）`);
