#!/usr/bin/env node
/**
 * 扫描 src/content/ 下所有 .md，把 frontmatter 里的制表符缩进规范化为空格。
 *
 *   npm run fix:tabs          # 就地修复并报告改了哪些文件
 *   npm run fix:tabs -- --check   # 只检查，不改写；发现 Tab 则退出码 1
 *
 * 为什么要单独一条命令：
 *   手工补 frontmatter 字段时，编辑器很容易把缩进敲成 Tab（肉眼和 4 空格几乎
 *   看不出差别），而 YAML 禁止 Tab 缩进，js-yaml 读到会抛错、且报错行号往往
 *   指向下一行。本脚本一次扫干净所有文件，比逐条手改可靠。
 *
 * 这个脚本是「随时可跑、幂等」的：没有 Tab 时零改动、退出码 0。
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fixFrontmatterTabs } from './lib/fix-tabs.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CONTENT_DIR = join(ROOT, 'src', 'content');

const CHECK_ONLY = process.argv.includes('--check');

async function collect(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await collect(p, out);
    else if (entry.name.endsWith('.md')) out.push(p);
  }
  return out;
}

async function main() {
  if (!existsSync(CONTENT_DIR)) {
    console.log('无 src/content 目录，跳过。');
    return;
  }

  const files = await collect(CONTENT_DIR);
  let changedFiles = 0;
  let totalLines = 0;

  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const r = fixFrontmatterTabs(text);
    if (!r.changed) continue;

    changedFiles += 1;
    totalLines += r.linesFixed;

    if (CHECK_ONLY) {
      console.log(`✗ ${file.replace(ROOT, '')} 有 ${r.linesFixed} 行 Tab 缩进`);
    } else {
      await writeFile(file, r.text, 'utf8');
      console.log(`✓ ${file.replace(ROOT, '')} 修正 ${r.linesFixed} 行`);
    }
  }

  if (changedFiles === 0) {
    console.log(CHECK_ONLY ? '✓ 无制表符缩进。' : '✓ 没有需要修正的文件。');
    return;
  }

  console.log(`\n共 ${changedFiles} 个文件、${totalLines} 行。`);
  if (CHECK_ONLY) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
