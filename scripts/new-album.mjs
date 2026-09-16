#!/usr/bin/env node
/**
 * 新专辑模板生成器
 *
 *   npm run new:album
 *   npm run new:album -- --catalog GKCD-004 --title "蒼の記憶"
 *
 * 生成一个填好骨架的 Markdown 文件到 src/content/albums/，
 * 只需要补曲目表和图片，不用碰任何 HTML。
 *
 * 编号规则（见 REQUIREMENTS.md §2.2）：
 *   GKCD-000  正式专辑
 *   GKSL-000  非正式 / 试作 / 限定
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ALBUM_DIR = join(ROOT, 'src', 'content', 'albums');

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? argv[i + 1] : undefined;
};

const TYPE_HINT = ['原创', '东方Project', '蔚蓝档案'];

async function prompt(question, fallback = '') {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(question)).trim();
  rl.close();
  return answer || fallback;
}

function slugify(catalog) {
  return catalog.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function exists(path) {
  return access(path).then(
    () => true,
    () => false
  );
}

async function main() {
  let catalog = arg('catalog');
  let title = arg('title');
  let releaseDate = arg('date');
  let type = arg('type');

  if (!catalog) {
    console.log('\n新建专辑\n');
    catalog = await prompt('专辑编号（如 GKCD-004）：');
  }
  if (!catalog) {
    console.error('缺少专辑编号，已取消。');
    process.exit(1);
  }

  if (!/^GK(CD|SL)-\d{3}$/i.test(catalog)) {
    console.warn(`⚠ 编号 "${catalog}" 不符合 GKCD-000 / GKSL-000 格式，仍继续。`);
  }

  const id = slugify(catalog);
  const target = join(ALBUM_DIR, `${id}.md`);

  if (await exists(target)) {
    console.error(`文件已存在，未覆盖：${target}`);
    process.exit(1);
  }

  if (!title) title = await prompt('专辑标题：', '未命名专辑');
  if (!releaseDate) {
    releaseDate = await prompt('发布日期（YYYY-MM-DD）：', new Date().toISOString().slice(0, 10));
  }
  if (!type) type = await prompt(`类型（${TYPE_HINT.join(' / ')}）：`, TYPE_HINT[1]);

  const template = `---
# 字段说明见 src/content.config.ts。填错字段名或类型，构建会直接报错并指出是哪一项。
catalog: ${catalog.toUpperCase()}
title: ${title}
# titleAlt: 日文 / 英文标题，可选
# subtitle: 副标题，显示在标题下方，可选

# 类型只能是这三个之一：原创 / 东方Project / 蔚蓝档案
# 需要新类型时，改 src/lib/types.ts 的 ALBUM_TYPES 即可（schema 与筛选顺序都从那里取）
type: ${type}
releaseDate: "${releaseDate}"

# 封面基准路径（不带尺寸后缀与扩展名）。三档 WebP 由 npm run covers 生成
cover: /images/albums/${id}/cover

summary: 一句话简介，显示在列表页与分享卡上。

tags:
  - 和风

credits:
  - role: 编曲
    name: 霜月

tracks:
  # 二创曲：填 original / source，署名用 arrange
  - no: 1
    title: 曲名
    original: 原曲名
    source: 出处作品
    arrange: 霜月
    duration: "3:00"

  # 原创曲：用 compose，original / source 留空。
  # 不要加 note: 原创曲 —— 用哪个字段已经说明了一切。
  - no: 2
    title: 曲名
    compose: 霜月
    duration: "3:00"

# 外链与购买渠道。不需要的整行删掉，不要留空值
links:
  bilibili: https://www.bilibili.com/video/
  dizzylab: https://www.dizzylab.net/d/${catalog.toUpperCase()}/

stores:
  dizzylab:
    url: https://www.dizzylab.net/d/${catalog.toUpperCase()}/
    inStock: true

# note: 只有 Bonus 这类需要特别点出的曲目才填，写在对应曲目下面
---

在这里写专辑的宣传文案。这一段是 Markdown 正文，会渲染在「关于这张作品」区。
`;

  await mkdir(ALBUM_DIR, { recursive: true });
  await writeFile(target, template, 'utf8');

  const assetDir = join(ROOT, 'src', 'assets', 'albums', id);
  await mkdir(assetDir, { recursive: true });

  console.log(`\n已创建：${target}`);
  console.log(`封面原图目录：src/assets/albums/${id}/`);
  console.log('\n下一步：');
  console.log(`  1. 把封面原图命名为 cover.jpg（或 .png / .webp）放进 src/assets/albums/${id}/`);
  console.log('  2. 跑 npm run covers 生成三档 WebP');
  console.log('  3. 补曲目表与正文文案，然后 npm run build\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
