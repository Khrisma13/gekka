#!/usr/bin/env node
/**
 * 重建全部专辑的封面 WebP。
 *
 *   npm run covers
 *
 * 用途：换了原图、或想调整体积/画质时重跑一次。
 * 也用于检查体积是否达标（REQUIREMENTS §4.3 要求单图 ≤200KB）——
 * 编码器会自己走「降质量 → 降尺寸」两步让步来达标，见 scripts/lib/covers.mjs 顶部说明。
 *
 * 退出码：
 *   0  产出全部合格（可能伴随 ℹ️ 告知：为了达标做了让步）
 *   1  有图**压到下限仍超标**，需要人工处理原图
 * 即「告警不阻断、真失败才阻断」（DESIGN §9.3）。
 */
import { buildCovers, listAlbumIds } from './lib/covers.mjs';

const ids = await listAlbumIds();

if (ids.length === 0) {
  console.log('src/assets/albums/ 下还没有专辑，无需处理。');
  process.exit(0);
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)}KB`;

let clean = 0;
let degraded = 0;
let failed = 0;

for (const id of ids) {
  const { outputs, warnings, errors } = await buildCovers(id);

  if (outputs.length === 0) {
    console.error(`✗ ${id}: 跳过 —— ${warnings.join('；')}`);
    failed += 1;
    continue;
  }

  // 真实像素与名义档位不一致时标出来（源图窄、或为了达标缩过），避免「以为有 1200px」的错觉
  const detail = outputs
    .map((o) => {
      const size = `${o.width}w ${kb(o.bytes)}`;
      return o.actual === o.width ? size : `${size}(${o.actual}px)`;
    })
    .join('  ');
  console.log(`${id}  ${detail}`);

  for (const w of warnings) console.log(`  ℹ️ ${w}`);
  for (const e of errors) console.log(`  ✗ ${e}`);

  if (warnings.length) degraded += 1;
  if (errors.length) failed += 1;
  if (!warnings.length && !errors.length) clean += 1;
}

console.log(
  `\n共 ${ids.length} 张专辑：完全达标 ${clean} 张，做过让步 ${degraded} 张，仍超标 ${failed} 张。`,
);

process.exit(failed ? 1 : 0);
