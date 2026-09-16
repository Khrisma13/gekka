#!/usr/bin/env node
/**
 * 从 dizzylab 抓取专辑信息，生成内容集合的数据文件 + 封面。
 *
 *   npm run fetch:album -- GKCD-010              # 抓一张
 *   npm run fetch:album -- GKCD-010 GKCD-011     # 抓多张
 *   npm run fetch:album -- GKCD-010 --dry        # 只看解析结果，不写盘
 *   npm run fetch:album -- GKCD-010 --force      # 覆盖已有文件（会丢人工标注，慎用）
 *
 * 产出：
 *   src/content/albums/<id>.md                    数据文件
 *   src/assets/albums/<id>/cover.jpg              封面原图
 *   public/images/albums/<id>/cover-<w>.webp      三档 WebP
 *
 * ⚠️ 重要：dizzylab 上**没有**「原曲 / 出处」这类二创署名信息，也常缺首发场合、版本、特典。
 *    这些必须人工补。脚本因此做了保护：已存在的文件默认**不覆盖**，
 *    而是把抓到的字段与现有文件合并 —— 人工填过的字段一律保留。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import yaml from 'js-yaml';
import { buildCovers } from './lib/covers.mjs';
import { fixFrontmatterTabs } from './lib/fix-tabs.mjs';

const DZL_BASE = 'https://www.dizzylab.net';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const CONTENT_DIR = 'src/content/albums';
const ASSET_DIR = 'src/assets/albums';

/** 能从简介里识别出来的 Staff 角色 */
const ROLE_HINTS = [
  '编曲', '作曲', '作词', '演唱', '和声', '混音', '母带',
  '插画', '封面绘画', '设计', '艺术总监', '美术',
  '吉他', '贝斯', '鼓', '钢琴', '弦乐', '小提琴', '大提琴', '长笛', '二胡', '琵琶', '古筝',
  '翻译', '摄影', '校对', '企划', '制作', '母盘',
];

/**
 * Staff 角色显示名的归一化。
 * dizzylab 上写「封面绘画」，站内统一叫「绘画」—— 职责是同一件事，
 * 且「封面」这层限定在画师署名里未必成立（内页、周边也常归同一人）。
 * 注意 ROLE_HINTS 必须保留「封面绘画」，否则以 ^ 锚定的角色行会漏识别、
 * 整行掉进简介正文里。
 */
const ROLE_ALIAS = {
  封面绘画: '绘画',
};

/** 这些字段以人工填写为准，抓取时永不覆盖 */
const HUMAN_TRACK_FIELDS = [
  'original', 'source', 'compose', 'arrange', 'lyrics', 'vocal', 'note',
];

/** 曲目字段的输出顺序 —— 固定下来，多人/多次编辑时 diff 才干净 */
const TRACK_FIELD_ORDER = [
  'no', 'title', 'original', 'source',
  'compose', 'arrange', 'lyrics', 'vocal', 'duration', 'note',
];
/**
 * 专辑级的人工字段。
 * 首发场合 / 版本 / 特典已从 schema 里去掉（社团不维护这三项），
 * 这里同步移除，否则脚本会一直往文件里写 schema 不认的键。
 */
const HUMAN_ALBUM_FIELDS = ['subtitle', 'titleAlt'];

// ---------------------------------------------------------------- 工具

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** 去掉标签，把 <br> 换成换行，再解实体 */
function htmlToLines(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function escapeDouble(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function needsQuote(s) {
  if (s === '') return true;
  if (/^\s|\s$/.test(s)) return true;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)) return true;
  if (/:\s/.test(s) || /\s#/.test(s)) return true;
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(s)) return true;
  if (/^-?\d+(\.\d+)?$/.test(s)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/[\n\t]/.test(s)) return true;
  return false;
}

function scalar(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const s = String(value);
  return needsQuote(s) ? `"${escapeDouble(s)}"` : s;
}

// ---------------------------------------------------------------- 解析

function parseAlbumPage(html, catalog) {
  const pick = (re) => {
    const m = html.match(re);
    return m ? decodeEntities(m[1]).trim() : undefined;
  };

  const title = pick(/<h1 style='margin-top:18px'>([\s\S]*?)<\/h1>/);
  const circle = pick(/<h4 class="text-truncate">\s*<a href="\/l\/[^"]*">@\s*([\s\S]*?)<\/a>/);
  const coverRemote = pick(/id="imgsrc0"[^>]*data-src="([^"]+)"/);
  const metaDescription = pick(/<meta name="description" content='([^']*)'/);
  const tagline = pick(/<p class="text-left" style="margin-top:32px">\s*([\s\S]*?)\s*<\/p>/);
  const descHtml = pick(/<h3 class="text-left">([\s\S]*?)<\/h3>/);

  // 发布日期：发布于2025年4月23日
  const dm = html.match(/发布于\s*(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const releaseDate = dm
    ? `${dm[1]}-${String(dm[2]).padStart(2, '0')}-${String(dm[3]).padStart(2, '0')}`
    : undefined;

  // 标签
  const tags = [
    ...new Set(
      [...html.matchAll(/\/albums\/tags\/\?tag=([^"]+)"[^>]*>\s*#([^<]+)</g)].map((m) =>
        decodeEntities(m[2]).trim(),
      ),
    ),
  ];

  // 曲目表
  const tracks = [];
  for (const m of html.matchAll(/<span class="t-title">([\s\S]*?)<\/span>/g)) {
    const raw = decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
    const tm = raw.match(/^(\d+)\.\s*(.*?)\s*\((\d{1,2}:\d{2})\)\s*$/);
    if (!tm) {
      // 样式变了也别丢数据，原样留着并标记，方便人工核对
      tracks.push({ no: tracks.length + 1, title: raw, _unparsed: true });
      continue;
    }
    const [, noStr, middle, rawDuration] = tm;
    let title = middle;
    let artist;
    const sep = middle.lastIndexOf(' - ');
    if (sep > 0) {
      title = middle.slice(0, sep).trim();
      artist = middle.slice(sep + 3).trim();
    }
    // dizzylab 给的是 03:25，站内统一写 3:25
    const duration = rawDuration.replace(/^0(\d:)/, '$1');
    tracks.push({ no: Number(noStr), title, artist, duration });
  }

  // 简介正文 + Staff
  const credits = [];
  const bodyLines = [];
  for (const line of htmlToLines(descHtml ?? '')) {
    if (/^-{4,}$/.test(line)) continue;

    const cm = line.match(new RegExp(`^(${ROLE_HINTS.join('|')})\\s*[:：]\\s*(.+)$`));
    if (cm) {
      const role = ROLE_ALIAS[cm[1]] ?? cm[1];
      const name = cm[2].trim();
      if (name && !credits.some((c) => c.role === role && c.name === name)) {
        credits.push({ role, name });
      }
      continue;
    }

    // 「B站试听： url」「也欢迎关注我们社团的dizzylab： url」这类行，链接已被单独提取，
    // 剩下的提示语没有信息量，丢掉
    const withoutUrl = line
      .replace(/https?:\/\/\S+/g, '')
      .replace(/^(也)?欢迎关注我们社团的\s*/, '')
      .replace(/[：:]\s*$/, '')
      .trim();
    if (/^(B站试听|bilibili|dizzylab|bandcamp|网易云.{0,3}|YouTube|Spotify)$/i.test(withoutUrl)) {
      continue;
    }
    if (/^https?:\/\/\S+$/.test(line)) continue;

    bodyLines.push(line.replace(/\s*https?:\/\/\S+\s*$/, '').trim());
  }

  // 外链
  const links = {};
  const bilibili = html.match(/https:\/\/www\.bilibili\.com\/video\/([A-Za-z0-9]+)/);
  if (bilibili) links.bilibili = bilibili[0];
  links.dizzylab = `${DZL_BASE}/d/${catalog}`;

  // 购买渠道：dizzylab 上有「现在购买」按钮即视为在售
  const stores = {};
  if (/现在购买/.test(html)) {
    stores.dizzylab = { url: `${DZL_BASE}/d/${catalog}`, inStock: true };
  }

  // 类型推断：抓不到就留空，由人补
  let type;
  const tagText = tags.join(' ');
  if (/蔚蓝档案|ブルーアーカイブ|Blue Archive/i.test(tagText)) type = '蔚蓝档案';
  else if (/东方|東方|Touhou/i.test(tagText)) type = '东方Project';
  else if (/原创|オリジナル/i.test(tagText)) type = '原创';

  return {
    catalog,
    title,
    circle,
    coverRemote,
    metaDescription,
    tagline,
    releaseDate,
    tags,
    tracks,
    credits,
    links,
    stores,
    body: bodyLines.join('\n\n'),
    type,
  };
}

// ---------------------------------------------------------------- YAML 输出

function emitFrontmatter(data) {
  const L = [];
  const put = (k, v) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v) && v.length === 0) return;
    L.push(`${k}: ${scalar(v)}`);
  };

  put('catalog', data.catalog);
  put('title', data.title);
  put('titleAlt', data.titleAlt);
  put('subtitle', data.subtitle);
  put('type', data.type);
  put('releaseDate', data.releaseDate);
  put('cover', data.cover);
  put('summary', data.summary);

  if (data.tags?.length) {
    L.push('tags:');
    for (const t of data.tags) L.push(`  - ${scalar(t)}`);
  }

  if (data.credits?.length) {
    L.push('credits:');
    for (const c of data.credits) {
      L.push(`  - role: ${scalar(c.role)}`);
      L.push(`    name: ${scalar(c.name)}`);
      if (c.link) L.push(`    link: ${scalar(c.link)}`);
    }
  }

  if (data.tracks?.length) {
    L.push('tracks:');
    for (const t of data.tracks) {
      const keys = TRACK_FIELD_ORDER.filter(
        (k) => t[k] !== undefined && t[k] !== null && t[k] !== '',
      );
      // 顺序表之外的字段兜底，别丢
      for (const k of Object.keys(t)) {
        if (!keys.includes(k) && t[k] !== undefined && t[k] !== null && t[k] !== '') keys.push(k);
      }
      keys.forEach((k, i) => {
        L.push(`  ${i === 0 ? '- ' : '  '}${k}: ${k === 'no' ? t[k] : scalar(t[k])}`);
      });
    }
  }

  if (data.links && Object.keys(data.links).length) {
    L.push('links:');
    for (const [k, v] of Object.entries(data.links)) {
      if (v) L.push(`  ${k}: ${scalar(v)}`);
    }
  }

  if (data.stores && Object.keys(data.stores).length) {
    L.push('stores:');
    for (const [k, v] of Object.entries(data.stores)) {
      L.push(`  ${k}:`);
      L.push(`    url: ${scalar(v.url)}`);
      L.push(`    inStock: ${v.inStock !== false}`);
    }
  }

  return L.join('\n');
}

// ---------------------------------------------------------------- 主流程

async function readExisting(id) {
  const file = join(CONTENT_DIR, `${id}.md`);
  if (!existsSync(file)) return null;
  const raw = await readFile(file, 'utf8');

  // 人工补字段时，编辑器常把缩进敲成 Tab，而 YAML 禁止 Tab 缩进，js-yaml 读到
  // 直接抛错（报错行号还指向下一行）。先规范化再解析，让这一步永不因 Tab 崩掉。
  // 注意：这里只清洗、不落盘 —— 真正的写回在 processOne 末尾统一发生，
  // 那时 emitFrontmatter 用空格重新序列化，Tab 自然消失。
  const fixed = fixFrontmatterTabs(raw);
  if (fixed.changed) {
    console.log(`  ⚠️ ${file} 有 ${fixed.linesFixed} 行 Tab 缩进，已按空格解析（写回时一并修正）。`);
  }
  const text = fixed.text;

  // ⚠️ 这里必须容忍 frontmatter 之前的说明性注释 —— 本脚本自己生成的文件头就是注释。
  //    最初写成 /^---/ 锚定文件开头，结果自己的产物读不出来，
  //    合并逻辑静默失效、人工标注被覆盖。所以：匹配任意行首的 ---，
  //    并且**解析不出来就直接抛错中止**，绝不带着空 prev 往下写。
  const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n([\s\S]*)$/m);
  if (!m) {
    throw new Error(
      `已存在 ${file} 但找不到 YAML frontmatter（--- 分隔块）。\n` +
        `  为避免覆盖其中的人工填写内容，已中止。请检查文件格式，或删掉该文件重新抓取。`,
    );
  }

  let frontmatter;
  try {
    frontmatter = yaml.load(m[1]) ?? {};
  } catch (err) {
    throw new Error(
      `已存在 ${file} 但 frontmatter 解析失败：${err.message}\n` +
        `  为避免覆盖其中的人工填写内容，已中止。`,
    );
  }
  return { file, frontmatter, body: (m[2] ?? '').trim() };
}

/** 把抓取结果与已有文件合并：机器字段更新，人工字段保留 */
function merge(existing, scraped, id) {
  const prev = existing?.frontmatter ?? {};

  const prevTracks = new Map((prev.tracks ?? []).map((t) => [t.no, t]));
  const tracks = scraped.tracks.map((t) => {
    const merged = { no: t.no, title: t.title, duration: t.duration };
    const p = prevTracks.get(t.no);

    // 抓来的署名放进 arrange，**除非**这首已被人工标注成原创曲（有 compose）。
    // 否则会出现 arrange 与 compose 同时存在的自相矛盾记录。
    const humanSaysOriginal = Boolean(p?.compose);
    if (t.artist && !humanSaysOriginal) merged.arrange = t.artist;

    if (p) {
      for (const f of HUMAN_TRACK_FIELDS) {
        if (p[f] !== undefined && p[f] !== '') merged[f] = p[f];
      }
    }
    if (t._unparsed) merged.note = '⚠️ 曲目格式未能自动解析，请人工核对';
    return merged;
  });

  const out = {
    catalog: scraped.catalog,
    title: prev.title || scraped.title,
    titleAlt: prev.titleAlt,
    subtitle: prev.subtitle,
    type: prev.type || scraped.type,
    releaseDate: scraped.releaseDate ?? prev.releaseDate,
    cover: `/images/albums/${id}/cover`,
    summary: prev.summary || scraped.tagline || scraped.metaDescription,
    tags: scraped.tags.length ? scraped.tags : prev.tags,
    credits: prev.credits?.length ? prev.credits : scraped.credits,
    tracks,
    links: { ...scraped.links, ...(prev.links ?? {}) },
    stores: Object.keys(prev.stores ?? {}).length ? prev.stores : scraped.stores,
  };

  // 人工字段整体优先（即使抓取这次没给值）
  for (const f of HUMAN_ALBUM_FIELDS) {
    if (prev[f] !== undefined && prev[f] !== '') out[f] = prev[f];
  }
  return out;
}

async function fetchHtml(catalog) {
  const res = await fetch(`${DZL_BASE}/d/${catalog}`, {
    headers: { 'user-agent': UA, accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function downloadCover(url, id) {
  const ext = (url.match(/\.(jpe?g|png|webp)$/i)?.[1] ?? 'jpg').toLowerCase();
  const dir = join(ASSET_DIR, id);
  await mkdir(dir, { recursive: true });
  const file = join(dir, `cover.${ext}`);
  const res = await fetch(url, { headers: { 'user-agent': UA, referer: `${DZL_BASE}/d/${id}` } });
  if (!res.ok) throw new Error(`封面下载失败 HTTP ${res.status}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

async function processOne(catalog, opts) {
  const id = catalog.toLowerCase();
  console.log(`\n▶ ${catalog}`);

  const html = await fetchHtml(catalog);
  const scraped = parseAlbumPage(html, catalog);

  if (!scraped.title) throw new Error('未能解析出标题，dizzylab 页面结构可能变了');
  if (!scraped.releaseDate) console.log('  ⚠️ 未找到发布日期，需人工补');
  if (!scraped.type) console.log('  ⚠️ 未能推断类型，需人工补（原创 / 东方Project / 蔚蓝档案）');

  const existing = await readExisting(id);
  const data = merge(existing, scraped, id);

  if (opts.dry) {
    console.log(JSON.stringify({ ...data, body: scraped.body }, null, 2));
    return;
  }

  // 封面：下载原图 + 生成 WebP
  if (scraped.coverRemote) {
    const src = await downloadCover(scraped.coverRemote, id);
    console.log(`  封面原图 → ${src}`);
    const { outputs, warnings, errors } = await buildCovers(id);
    for (const o of outputs) {
      const size = `WebP ${String(o.width).padStart(4)}w → ${(o.bytes / 1024).toFixed(0)}KB`;
      console.log(o.actual === o.width ? `  ${size}` : `  ${size}（实际 ${o.actual}px）`);
    }
    // ℹ️ 是为了达标做了让步（图已合格）；✗ 是压到下限仍超标（需人工处理原图）。
    // 两者都只报告、不中止 —— 封面不理想不该让整张专辑的抓取结果丢掉，
    // frontmatter 已经解析好了，写出去比半途退出有用。
    for (const w of warnings) console.log(`  ℹ️ ${w}`);
    for (const e of errors) console.log(`  ✗ ${e}`);
  }

  // 正文：已存在则保留（可能已被人工改写），否则写入抓取到的文案
  const body = existing?.body ? existing.body : scraped.body;

  const frontmatter = emitFrontmatter(data);

  // 说明性文件头：给维护者看的「哪些字段机器抓不到」检查清单。
  //
  // ⚠️ 必须写成 YAML 注释、放在 frontmatter **内部**。
  //    早先版本把说明写成 <!-- --> 放在 frontmatter 之前，结果 Astro 的内容集合
  //    解析不出任何字段（它要求 frontmatter 出现在文件第 0 字节），
  //    构建直接报「catalog: Required」—— 报错信息完全指向不到真正的原因。
  const header = [
    '# =============================================================================',
    '# 本文件由 scripts/fetch-dizzylab.mjs 从 dizzylab 抓取生成。',
    '#',
    '# dizzylab 上没有、需要人工补的字段：',
    '#   · 每首曲目：原曲 original / 出处 source',
    '#               （原创曲请用 compose 而不是 arrange，**不要**加 note: 原创曲）',
    '#   · 专辑级：购买渠道 stores',
    '#',
    '# 重新抓取本文件时，以上人工填写的字段会被保留，不会被覆盖。',
    '# =============================================================================',
  ].join('\n');

  const file = join(CONTENT_DIR, `${id}.md`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(
    file,
    `---\n${header}\n${frontmatter}\n---\n\n${body ? `${body}\n` : ''}`,
    'utf8',
  );
  console.log(`  ✓ 写入 ${file}`);
  if (existing) console.log('  （已存在，人工填写的字段已保留）');
}

async function main() {
  const argv = process.argv.slice(2);
  const opts = {
    dry: argv.includes('--dry'),
    force: argv.includes('--force'),
  };
  const catalogs = argv.filter((a) => !a.startsWith('--')).map((s) => s.toUpperCase());

  if (catalogs.length === 0) {
    console.error('用法：npm run fetch:album -- GKCD-010 [GKCD-011 ...] [--dry] [--force]');
    process.exit(1);
  }

  let failed = 0;
  for (const catalog of catalogs) {
    try {
      await processOne(catalog, opts);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${catalog} 失败：${err.message}`);
    }
  }
  if (failed) process.exit(1);
}

main();
