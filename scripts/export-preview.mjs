#!/usr/bin/env node
/**
 * 导出可离线查看的页面预览。
 *
 *   npm run preview:album
 *
 * 构建产物里的资源都是根绝对路径（/fonts/...、/images/...），
 * 直接双击打开会全部 404。这里把它们改成相对仓库的路径，
 * 并把字体 CSS 内联，得到一个「不依赖服务器」的单文件预览。
 *
 * 产物：design/preview/home.html、albums.html、tracks.html、news.html、blog.html、
 *       about.html、contact.html、search.html、<专辑编号>.html（每张专辑一个）、
 *       <文章 slug>.html（每篇文章一个）
 * 专辑页与文章页都是**自动发现**的 —— 数量会一直涨，写死列表迟早漏掉新加的那个。
 *
 * 注意：预览里的顶栏链接指向真实站点的栏目。导航上的栏目（专辑 / 曲目库 / 杂谈 / 动态 /
 *       关于 / 联系）与页头的搜索都已导出，点得通；样张页（/styleguide/，noindex）不在其列。
 *       预览只用来核对排版与数据，不代表真实 URL。搜索页的筛选在预览里也照常能跑
 *       （内联脚本不受 file:// 限制，只有模块脚本会被 CORS 拦）。
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'design', 'preview');

/** 预览文件位于 design/preview/，回仓库根是两级 */
const UP = '../../';

/** 固定页面：dist 内路径 -> 预览文件名 */
const STATIC_PAGES = [
  { src: ['index.html'], out: 'home.html' },
  { src: ['albums', 'index.html'], out: 'albums.html' },
  { src: ['tracks', 'index.html'], out: 'tracks.html' },
  { src: ['news', 'index.html'], out: 'news.html' },
  { src: ['blog', 'index.html'], out: 'blog.html' },
  { src: ['about', 'index.html'], out: 'about.html' },
  { src: ['contact', 'index.html'], out: 'contact.html' },
  { src: ['search', 'index.html'], out: 'search.html' },
];

/** dist/<dir>/ 下的子目录名（专辑编号 / 文章 slug）。目录名即 URL 片段 */
async function subdirsOf(dir) {
  try {
    const entries = await readdir(join(DIST, dir), { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * 站内链接映射：构建产物里的绝对路径 -> 预览内文件。
 *
 * ⚠️ 顺序要紧：具体条目（`/albums/<编号>/`、`/blog/<slug>/`）必须排在栏目通用规则之前，
 * 否则会被 `/albums/`、`/blog/` 先吃掉。
 * （专辑链接带 #tracks 锚点，改写时只吃路径、锚点原样接回去 —— 见 relativize。）
 */
function linkMapFor(catalogs, postSlugs) {
  return [
    ...catalogs.map((c) => [new RegExp(`/albums/${c}/?`, 'g'), `./${c}.html`]),
    ...postSlugs.map((s) => [new RegExp(`/blog/${s}/?`, 'g'), `./${s}.html`]),
    [/\/albums\/?/g, './albums.html'],
    [/\/tracks\/?/g, './tracks.html'],
    [/\/news\/?/g, './news.html'],
    [/\/blog\/?/g, './blog.html'],
    [/\/about\/?/g, './about.html'],
    [/\/contact\/?/g, './contact.html'],
    [/\/search\/?/g, './search.html'],
  ];
}

function relativize(html, linkMap) {
  let out = html;

  // 正文里的站内链接是**相对路径**（动态正文写 `../albums/<编号>/`，
  // 见 src/content.config.ts 的说明）。预览产物是摊平的 —— 每个页面都落在预览根目录，
  // 所以先把「相对站点根」的前缀去掉、当成绝对路径，交给下面的映射表统一吃掉。
  // 不做这一步的话，`../albums/GKCD-013/` 会被 `/albums/` 那条规则吃半截，
  // 改写成一个 `../GKCD-013.html`：指到预览目录之外，且是静默的 ——
  // 链接照常渲染，只有真去点才发现。
  out = out.replace(/(href|src)="(?:\.\.\/)+/g, '$1="/');

  // 站内链接先在原始 HTML 上改写（此时还是绝对路径）。
  //
  // ⚠️ 锚点必须单独接回来。曾经的写法是 `(href|src)="(${re.source})"` —— 那要求
  // 属性值在路径后**立刻**结束，于是 `/albums/GKCD-013/#tracks` 这种带锚点的链接
  // 整条漏改，预览里点曲名会跳到不存在的路径。这类漏改是静默的：链接照常渲染，
  // 只有真的点下去才发现。（曲目库的曲名链接正是这个形状。）
  for (const [re, to] of linkMap) {
    const attr = new RegExp(`(href|src)="(${re.source})(#[^"]*)?"`, 'g');
    out = out.replace(attr, (_m, name, _path, hash) => `${name}="${to}${hash || ''}"`);
  }

  // 字体 / 图片 / 品牌素材 / 图标：指回仓库里的 public 目录
  out = out
    .replace(/(href|src)="\/fonts\//g, `$1="${UP}public/fonts/`)
    .replace(/(href|src)="\/images\//g, `$1="${UP}public/images/`)
    .replace(/(href|src)="\/brand\//g, `$1="${UP}public/brand/`)
    .replace(/(?:srcset|imagesrcset)="([^"]*)"/g, (_m, list) => {
      const rewritten = String(list)
        .split(',')
        .map((part) => part.trim().replace(/^(\/images\/)/, UP + 'public/images/'))
        .join(', ');
      return `srcset="${rewritten}"`;
    })
    .replace(/(href|src)="\/favicon\.png"/g, `$1="${UP}public/favicon.png"`)
    .replace(/(href|src)="\/_assets\//g, `$1="${UP}dist/_assets/`);

  return out;
}

async function inlineFontCss(html) {
  const linkRe = /<link[^>]*href="[^"]*\/fonts\/misans\/MiSans\.css"[^>]*>/;
  const stripped = html.replace(/<link[^>]*\bas="font"[^>]*>/g, '');
  if (!linkRe.test(stripped)) return stripped;

  const css = await readFile(join(ROOT, 'public', 'fonts', 'misans', 'MiSans.css'), 'utf8');
  const rewritten = css.replace(
    /url\('([^']+\.woff2)'\)/g,
    `url('${UP}public/fonts/misans/$1')`,
  );
  return stripped.replace(linkRe, `<style id="misans">\n${rewritten}\n</style>`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const catalogs = await subdirsOf('albums');
  const postSlugs = await subdirsOf('blog');
  const pages = [
    ...STATIC_PAGES,
    ...catalogs.map((c) => ({ src: ['albums', c, 'index.html'], out: `${c}.html` })),
    ...postSlugs.map((s) => ({ src: ['blog', s, 'index.html'], out: `${s}.html` })),
  ];
  const linkMap = linkMapFor(catalogs, postSlugs);

  for (const page of pages) {
    const src = join(DIST, ...page.src);
    let html;
    try {
      html = await readFile(src, 'utf8');
    } catch {
      console.error(`找不到 ${src}。请先运行：npm run build`);
      process.exit(1);
    }

    // 内联字体要在改写路径之前做（内联后 font url 由上面统一加前缀）
    html = await inlineFontCss(html);
    html = relativize(html, linkMap);

    const out = join(OUT_DIR, page.out);
    await writeFile(out, html, 'utf8');
    const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
    console.log(`已导出：${out}（${kb} KB）`);
  }

  console.log(`\n专辑页 ${catalogs.length} 张：${catalogs.join('、') || '（无）'}`);
  console.log(`文章页 ${postSlugs.length} 篇：${postSlugs.join('、') || '（无）'}`);
  console.log('可直接用浏览器打开 design/preview/home.html 查看。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
