#!/usr/bin/env node
/**
 * 新杂谈文章模板生成器
 *
 *   npm run new:post
 *   npm run new:post -- --title "写歌之前我先做的一张表" --date 2026-09-20 --tags 创作手记 --slug before-writing
 *
 * 生成一个填好骨架的 Markdown 到 src/content/posts/，只需要补正文
 * （对应 REQUIREMENTS.md §2.4）。
 *
 * 与 `new-news.mjs` 的两点不同，都是刻意的：
 *   · **slug 是必填的** —— 文件名会原样出现在 URL（`/blog/<slug>/`）里，
 *     所以不能像动态那样「没有短名就用日期当文件名」。
 *   · 文件名**不带日期前缀**。日期进 URL 只会在改期时让链接失效。
 *
 * 标签的合法取值从 `src/lib/types.ts` 的 POST_TAGS 里读出来，不在这里再抄一份 ——
 * 抄一份就迟早会与枚举对不上。读不到时只提示、不阻断。
 */
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const POSTS_DIR = join(ROOT, 'src', 'content', 'posts');

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? argv[i + 1] : undefined;
};

/** 标签枚举的唯一真源在 src/lib/types.ts，这里从源码里抠出来用 */
async function readTags() {
  try {
    const src = await readFile(join(ROOT, 'src', 'lib', 'types.ts'), 'utf8');
    const block = src.match(/POST_TAGS\s*=\s*\[([^\]]*)\]/);
    if (!block) return [];
    return [...block[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
  } catch {
    return [];
  }
}

async function prompt(question, fallback = '') {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(question)).trim();
  rl.close();
  return answer || fallback;
}

/** 拉丁化：只服务「标题是英文时顺手生成 slug」，中文标题会得到空串 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function exists(path) {
  return access(path).then(
    () => true,
    () => false
  );
}

async function main() {
  const tags = await readTags();

  let title = arg('title');
  let date = arg('date');
  let slug = arg('slug');
  let tagInput = arg('tags');

  if (!title) {
    console.log('\n新建杂谈文章\n');
    title = await prompt('标题：');
  }

  if (slug === undefined) {
    const guess = slugify(title ?? '');
    slug = await prompt(
      `URL 短名（英文，出现在 /blog/ 之后）${guess ? `（回车用 ${guess}）` : ''}：`,
      guess,
    );
  }
  slug = slugify(slug ?? '');
  if (!slug) {
    console.error('必须有英文短名 —— 文件名就是 URL，中文会被转义成一串乱码。');
    process.exit(1);
  }

  if (!date) {
    date = await prompt('日期（YYYY-MM-DD）：', new Date().toISOString().slice(0, 10));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.warn(`⚠ 日期 "${date}" 不是 YYYY-MM-DD 格式，构建时会被 schema 拦下。`);
  }

  if (tagInput === undefined) {
    const hint = tags.length ? `（可多选，逗号分隔：${tags.join(' / ')}）` : '';
    tagInput = await prompt(`标签${hint}：`, tags[0] ?? '');
  }
  const chosen = String(tagInput)
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const unknown = chosen.filter((t) => tags.length && !tags.includes(t));
  if (unknown.length) {
    console.warn(
      `⚠ 标签 ${unknown.join('、')} 不在枚举里（${tags.join(' / ')}），构建时会被 schema 拦下。`,
    );
  }

  const target = join(POSTS_DIR, `${slug}.md`);
  if (await exists(target)) {
    console.error(`文件已存在，未覆盖：${target}`);
    process.exit(1);
  }

  const template = `---
# 一篇文章 = 这个文件。字段说明见 src/content.config.ts。
#
# 文件名（${slug}）就是 URL 的最后一段：/blog/${slug}/
#   —— 所以**不要**给它加日期前缀，改日期不该让链接失效（这点与动态不同）。
#
# tags 只能从这几个里挑（可多选）：${tags.length ? tags.join(' / ') : '见 src/lib/types.ts 的 POST_TAGS'}
#   —— 需要新标签时改 src/lib/types.ts 的 POST_TAGS。
#
# summary 是列表卡片上显示的那句话。留空则自动取正文第一段，
#   但正文首段未必适合当摘要，想清楚了写一句更好。
#
# 正文（下面 --- 之后的整段）就是文章内容，写 Markdown。
# 站内链接请写相对路径，如 [去听这张作品](../albums/GKCD-013/) ——
# 绝对路径 /albums/... 在子路径部署下会指错地方。
title: "${title}"
date: "${date}"
summary: ""
tags: [${chosen.join(', ')}]
# cover: /images/posts/xxx.webp   # 可选封面
# draft: true                     # 还没写完的先标上，不会出现在线上
---

在这里写正文。第一段会被用作摘要的兜底，所以别一上来就写「本文共三节」。
`;

  await mkdir(POSTS_DIR, { recursive: true });
  await writeFile(target, template, 'utf8');

  console.log(`\n已创建：${target}`);
  console.log('\n下一步：');
  console.log('  1. 补上 summary（或让它自动取正文首段）与正文');
  console.log('  2. npm run build 预览，或 npm run dev 实时看\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
