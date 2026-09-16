#!/usr/bin/env node
/**
 * 导出可离线查看的视觉样张。
 *
 *   npm run styleguide
 *
 * 两件事：
 *   1. astro.config.mjs 里设了 inlineStylesheets: 'always'，
 *      构建产物中的组件样式已内联，复制出来即可；
 *   2. 字体样式是 public/ 下的静态文件，不会被 Astro 内联，
 *      这里手工把它塞进 <style>，并把字体 url 改成指向仓库里的
 *      public/fonts/misans/ —— 这样双击打开样张也能看到真实字形。
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SRC = join(ROOT, 'dist', 'styleguide', 'index.html');
const OUT_DIR = join(ROOT, 'design');
const OUT = join(OUT_DIR, 'styleguide.html');

/** 把根绝对路径改成相对路径，让 file:// 下也能加载 */
function relativize(html) {
  return html
    .replace(/(href|src)="\/favicon\.svg"/g, '$1="./favicon.svg"')
    .replace(/(href|src)="\/(_assets\/[^"]+)"/g, '$1="./$2"');
}

/**
 * 把字体 <link> 换成内联 <style>，url 指回仓库的 public 目录。
 * 顺带删掉字体 preload —— 内联后已经没有额外请求，preload 只会 404。
 */
async function inlineFontCss(html) {
  const linkRe = /<link[^>]*href="[^"]*\/fonts\/misans\/MiSans\.css"[^>]*>/;
  const stripped = html.replace(/<link[^>]*\bas="font"[^>]*>/g, '');
  if (!linkRe.test(stripped)) return stripped;

  const css = await readFile(join(ROOT, 'public', 'fonts', 'misans', 'MiSans.css'), 'utf8');
  const rewritten = css.replace(
    /url\('([^']+\.woff2)'\)/g,
    "url('../public/fonts/misans/$1')",
  );
  return stripped.replace(linkRe, `<style id="misans">\n${rewritten}\n</style>`);
}

async function main() {
  let html;
  try {
    html = await readFile(SRC, 'utf8');
  } catch {
    console.error(`找不到 ${SRC}。请先运行：npm run build`);
    process.exit(1);
  }

  html = await inlineFontCss(html);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, relativize(html), 'utf8');

  // 图标一并带上，避免离线预览报 404
  try {
    await copyFile(join(ROOT, 'dist', 'favicon.svg'), join(OUT_DIR, 'favicon.svg'));
  } catch {
    /* 图标不是必须的，失败就跳过 */
  }

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
  console.log(`已导出：${OUT}（${kb} KB，样式已内联，可直接用浏览器打开）`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
