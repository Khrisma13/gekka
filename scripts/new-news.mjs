#!/usr/bin/env node
/**
 * 新动态模板生成器
 *
 *   npm run new:news
 *   npm run new:news -- --date 2026-09-13 --tag 发布 --slug autumn-live
 *
 * 生成一个填好骨架的 Markdown 到 src/content/news/，
 * 只需要补正文，不用碰任何 HTML/CSS（对应 REQUIREMENTS.md §2.5）。
 *
 * 文件名约定 `YYYY-MM-DD-slug.md` —— 只是为了让目录按时间排，
 * 排序与分组以 frontmatter 的 date 为准（有 schema 校验，写错会构建失败）。
 *
 * 标签的合法取值从 `src/lib/types.ts` 的 NEWS_TAGS 里读出来，不在这里再抄一份 ——
 * 抄一份就迟早会与枚举对不上。读不到时只提示、不阻断。
 */
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const NEWS_DIR = join(ROOT, 'src', 'content', 'news');

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? argv[i + 1] : undefined;
};

/** 标签枚举的唯一真源在 src/lib/types.ts，这里从源码里抠出来用 */
async function readTags() {
  try {
    const src = await readFile(join(ROOT, 'src', 'lib', 'types.ts'), 'utf8');
    const block = src.match(/NEWS_TAGS\s*=\s*\[([^\]]*)\]/);
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

  let date = arg('date');
  let tag = arg('tag');
  let slug = arg('slug');

  if (!date) {
    console.log('\n新建动态\n');
    date = await prompt('日期（YYYY-MM-DD）：', new Date().toISOString().slice(0, 10));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.warn(`⚠ 日期 "${date}" 不是 YYYY-MM-DD 格式，构建时会被 schema 拦下。`);
  }

  if (!tag) {
    const hint = tags.length ? `（${tags.join(' / ')}）` : '';
    tag = await prompt(`标签${hint}：`, tags[0] ?? '公告');
  }
  if (tags.length && !tags.includes(tag)) {
    console.warn(`⚠ 标签 "${tag}" 不在枚举里（${tags.join(' / ')}），构建时会被 schema 拦下。`);
  }

  if (slug === undefined) {
    slug = await prompt('英文短名（可留空，会拼进文件名）：', '');
  }
  const suffix = slugify(slug ?? '');
  const id = suffix ? `${date}-${suffix}` : date;
  const target = join(NEWS_DIR, `${id}.md`);

  if (await exists(target)) {
    console.error(`文件已存在，未覆盖：${target}`);
    process.exit(1);
  }

  const template = `---
# 一条动态 = 这个文件。字段说明见 src/content.config.ts。
#
# tag 只能是这四个之一：${tags.length ? tags.join(' / ') : '见 src/lib/types.ts 的 NEWS_TAGS'}
#   —— 需要新标签时改 src/lib/types.ts 的 NEWS_TAGS，筛选芯片会跟着出来。
#   （不要在这里自己写一个没见过的标签，构建会直接报错。）
#
# 正文（下面 --- 之后的整段）就是这条动态显示的内容，写 Markdown。
# 站内链接请写相对路径，如 [去听这张作品](../albums/GKCD-013/) ——
# 绝对路径 /albums/... 在子路径部署下会指错地方。
date: "${date}"
tag: ${tag}
# image: /images/news/xxx.webp   # 可选配图，宽度上限 420px，别放超宽大图
# draft: true                    # 还没到日子发的，标上它就不会出现在线上
---

在这里写这条动态。短讯一两句就够；真要写成一大篇，那应该去「杂谈」。
`;

  await mkdir(NEWS_DIR, { recursive: true });
  await writeFile(target, template, 'utf8');

  console.log(`\n已创建：${target}`);
  console.log('\n下一步：');
  console.log('  1. 补上正文（文件里那段「在这里写这条动态」的位置）');
  console.log('  2. npm run build 预览，或 npm run dev 实时看\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
