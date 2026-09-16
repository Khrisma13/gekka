/**
 * 封面图处理：把原图转成三档 WebP，供页面按需引用。
 *
 * 输入 src/assets/albums/<id>/cover.*   原图（高分辨率、体量大，只在仓库里躺着）
 * 输出 public/images/albums/<id>/cover-<w>.webp
 *
 * 为什么不用 Astro 内置的图片优化？
 * 因为封面是「一次生成、长期不变」的资产，预生成有三个好处：
 *   1. 构建不需要跑图片流水线，`npm run build` 快且可预测
 *   2. 仓库里的产物是**看得见、量得出**的普通文件，体积是否达标一眼可查
 *   3. 非技术维护者换图时，跑一条命令即可，不必理解构建期图片处理
 *
 * 编码策略（质量阶梯 → 缩尺寸的两步让步）抽在 scripts/lib/encode-webp.mjs，
 * 首页主视觉（scripts/build-oc.mjs）共用同一份 —— 理由见那个文件顶部。
 *
 * 注意：缩尺寸时**文件名不变**（仍是 cover-1200.webp）。页面正文、JSON-LD、og:image
 * 都按文件名引用，URL 必须稳定；真实像素宽度记在返回值里，由调用方打印出来。
 * 因此 `srcset` 里的 `1200w` 是**名义档位**，与实际像素可能不一致（源图本身就窄时也会这样）。
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import sharp from 'sharp';
import { SIZE_LIMIT, encodeUnderLimit, kb } from './encode-webp.mjs';

/** 生成的目标宽度。320 卡片 / 640 卡片@2x / 1200 详情页与分享卡 */
export const COVER_WIDTHS = [320, 640, 1200];

const SRC_ROOT = 'src/assets/albums';
const OUT_ROOT = 'public/images/albums';

/**
 * 在目录里找出封面原图（不关心扩展名）。
 * @returns 找到的绝对/相对路径，或 null
 */
async function findSourceCover(dir) {
  if (!existsSync(dir)) return null;
  const files = await readdir(dir);
  const hit = files.find(
    (f) => /^cover\.(jpe?g|png|webp|avif|tiff?)$/i.test(f) && !f.startsWith('.'),
  );
  return hit ? join(dir, hit) : null;
}

/**
 * 为一张专辑生成全部档位的封面。
 *
 * @param {string} id 专辑 id，如 gkcd-010
 * @returns {Promise<{
 *   id: string,
 *   outputs: {width: number, file: string, bytes: number, actual: number, quality: number, shrunk: boolean}[],
 *   warnings: string[],
 *   errors: string[],
 *   sourceInfo?: object,
 * }>}
 *   warnings 是**告知性**的（为了达标做了让步，图已合格）；
 *   errors 是**需要处理**的（压到下限仍超标，图不合格）。
 */
export async function buildCovers(id) {
  const srcDir = join(SRC_ROOT, id);
  const outDir = join(OUT_ROOT, id);
  const source = await findSourceCover(srcDir);
  const warnings = [];
  const errors = [];

  if (!source) {
    return { id, outputs: [], warnings: [`找不到原图：${join(srcDir, 'cover.*')}`], errors: [] };
  }

  await mkdir(outDir, { recursive: true });

  const meta = await sharp(source).metadata();
  const outputs = [];

  for (const nominal of COVER_WIDTHS) {
    // 原图比目标还小时不放大 —— 放大只会变糊并白白增加体积
    const baseWidth = Math.min(nominal, meta.width ?? nominal);
    const file = join(outDir, `cover-${nominal}.webp`);
    const hit = await encodeUnderLimit(source, baseWidth);

    // 永远写出文件：页面 / JSON-LD / og:image 都按文件名引用，缺档会 404
    await writeFile(file, hit.data);

    outputs.push({
      width: nominal, // 名义档位，也是文件名里的数字
      file,
      bytes: hit.data.length,
      actual: hit.width, // 真实像素宽度，可能小于 nominal
      quality: hit.quality,
      shrunk: hit.shrunk,
    });

    if (!hit.withinLimit) {
      errors.push(
        `${basename(file)} 已降到 ${hit.width}px / q${hit.quality}（下限），仍为 ${kb(hit.data.length)}，` +
          `超过 ${SIZE_LIMIT / 1024}KB 上限 —— 需人工介入处理原图`,
      );
    } else if (hit.shrunk) {
      warnings.push(
        `${basename(file)} 为达标由 ${baseWidth}px 降到 ${hit.width}px（q${hit.quality}，${kb(hit.data.length)}）`,
      );
    }
  }

  return { id, outputs, warnings, errors, sourceInfo: { file: source, ...meta } };
}

/** 列出 src/assets/albums 下所有专辑 id */
export async function listAlbumIds() {
  if (!existsSync(SRC_ROOT)) return [];
  const entries = await readdir(SRC_ROOT, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}
