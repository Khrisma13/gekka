#!/usr/bin/env node
/**
 * 生成首页主视觉（看板娘）素材。
 *
 *   npm run oc
 *
 * 母版是 src/assets/oc.png（4252×3071，15MB）—— 与封面、徽记一致，
 * 母版不进 public/：那是会被整体部署到线上的目录，一张 4252px 的原图
 * 没有任何页面会用到，白白占带宽、拖慢首屏。
 *
 * 产物：public/images/hero/oc-<w>.webp   三档，首屏按视口宽度自己挑
 *
 * 编码策略与封面共用（scripts/lib/encode-webp.mjs）：先降质量、再降尺寸，
 * 单图压到 200KB 以内。看板娘是大片平涂 + 浅底，实测 1920px / q82 只有 160KB，
 * 所以这里通常一步就达标，质量阶梯都不会往下走。
 *
 * ⚠️ 与封面不同的一点：**不做裁剪**。
 * 构图（人物偏右、长发向左飘）交给 CSS 的 object-fit / object-position 决定 ——
 * 裁在文件里就等于把构图焊死在素材上，换版式时必须重新出图；
 * 而 output 宽度固定，裁与不裁的体积差别很小，没必要用素材换这个自由度。
 * 现在主视觉是满幅底图（object-fit: cover），同一张图在宽屏裁上下、窄屏裁左右，
 * 裁进文件更没法两头兼顾。
 *
 * 末尾会**核对档位是否齐**：把 src/lib/media.ts 里的 HERO_WIDTHS 读出来，
 * 逐一确认 public/images/hero/oc-<w>.webp 真的存在。这两处必须成对修改 ——
 * 只改了页面、忘了重跑脚本，页面会静默 404 一张底图（比报错更难发现）。
 *
 * 退出码：0 正常；1 找不到母版、或有档位没生成出来。
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { SIZE_LIMIT, encodeUnderLimit, kb } from './lib/encode-webp.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SRC = join(ROOT, 'src', 'assets', 'oc.png');
const OUT_DIR = join(ROOT, 'public', 'images', 'hero');
const MEDIA_TS = join(ROOT, 'src', 'lib', 'media.ts');

/**
 * 三档宽度 —— 主视觉是满幅底图（100vw），所以按视口宽度铺：
 *   768   手机 2x（390×2 ≈ 780）
 *   1280  平板 / 小笔记本
 *   1920  桌面 1x，以及更大视口用的上限档
 * 与 src/lib/media.ts 的 HERO_WIDTHS 必须一致（末尾会核对）。
 */
const WIDTHS = [768, 1280, 1920];

/**
 * 核对页面用的档位与刚刚生成的产物是否齐。
 * 读不出 HERO_WIDTHS 就只提示（文件可能被改过），读得出而缺文件就是**硬失败**。
 */
async function checkTiers() {
  const src = await readFile(MEDIA_TS, 'utf8');
  const hit = src.match(/HERO_WIDTHS\s*=\s*\[([^\]]*)\]/);
  if (!hit) {
    console.log('ℹ️ media.ts 里没读到 HERO_WIDTHS，跳过档位核对。');
    return;
  }
  const declared = hit[1]
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));

  const missing = declared.filter((w) => !existsSync(join(OUT_DIR, `oc-${w}.webp`)));
  const extra = WIDTHS.filter((w) => !declared.includes(w));

  if (missing.length) {
    console.error(
      `✗ media.ts 声明了 ${declared.join('/')}，但缺 ${missing.map((w) => `oc-${w}.webp`).join('、')}。\n` +
        `  页面会去请求这些文件（首屏底图 404），请让本脚本的 WIDTHS 与之一致。`,
    );
    process.exitCode = 1;
    return;
  }
  if (extra.length) {
    console.warn(`⚠️ 本脚本多生成了一档 ${extra.join('/')}：media.ts 的 HERO_WIDTHS 里没有它。`);
  }
  console.log(`档位与 media.ts 一致（${declared.join(' / ')}）✓`);
}

async function main() {
  if (!existsSync(SRC)) {
    console.error(`找不到母版 ${SRC}`);
    process.exit(1);
  }

  const master = await sharp(SRC).metadata();
  const masterBytes = (await stat(SRC)).size;
  console.log(`母版 oc.png ${master.width}×${master.height} ${(masterBytes / 1024 / 1024).toFixed(1)}MB`);

  await mkdir(OUT_DIR, { recursive: true });

  for (const nominal of WIDTHS) {
    // 原图比目标窄时不放大
    const baseWidth = Math.min(nominal, master.width ?? nominal);
    const file = join(OUT_DIR, `oc-${nominal}.webp`);
    const hit = await encodeUnderLimit(SRC, baseWidth);

    await writeFile(file, hit.data);

    // 缩过尺寸时标出来，避免「以为有 1920px」的错觉（文件名仍是名义档位）
    const note = hit.shrunk ? `  ← 由 ${nominal}px 缩到 ${hit.width}px` : '';
    console.log(`oc-${nominal}.webp  ${hit.width}px q${hit.quality}  ${kb(hit.data.length)}${note}`);

    if (!hit.withinLimit) {
      console.error(
        `  ✗ 已压到 ${hit.width}px / q${hit.quality}（下限）仍超过 ${SIZE_LIMIT / 1024}KB —— 需人工处理母版`,
      );
      process.exitCode = 1;
    }
  }

  console.log(`\n已生成 ${WIDTHS.length} 档到 public/images/hero/`);
  await checkTiers();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
