/**
 * WebP 编码核心：把一张原图编码到体积上限以内，供站点的预生成图产物共用。
 *
 * 被谁用：
 *   · scripts/lib/covers.mjs  封面三档（320/640/1200）
 *   · scripts/build-oc.mjs    首页主视觉三档
 * 抽出来的理由：两处的「两步让步」策略必须完全一致 —— 各写一份，迟早只会修一处。
 *
 * ── 体积与画质（REQUIREMENTS §4.3：单图 ≤200KB）────────────────────────────
 *
 * 上限是硬约束，用两步让步达成，**顺序刻意如此**：
 *
 *   第一步 降质量：q82 → 78 → 75 → 70，达标即停。
 *          绝大多数图这一步就够了，且肉眼无损。
 *
 *   第二步 降尺寸：还超标才缩，每档 −10%，下限 640px（同样每档重跑一遍质量阶梯）。
 *          宁可「清晰但小一号」，也不要「原尺寸但糊」。
 *
 * 为什么不是「一路降质量到底」：
 *   细节密集的图降质量几乎不省体积。实测 GKCD-005（背景是整片樱花树冠）
 *   q82=389KB → q78=355KB → q60 **仍 290KB**，最后只会得到一张又大又糊的图。
 * 为什么不是「一开始就降尺寸」：
 *   多数图根本不需要，白丢分辨率。
 *
 * 注意：缩尺寸时**调用方要保持文件名不变**（档位名写在文件名里）。
 * 页面正文、JSON-LD、og:image 都按文件名引用，URL 必须稳定；
 * 真实像素宽度记在返回值里，由调用方打印出来。
 */
import sharp from 'sharp';

/** 单图体积上限（字节），来自 REQUIREMENTS §4.3 */
export const SIZE_LIMIT = 200 * 1024;

/** 质量阶梯，从好到差。第一步让步就在这串数字里走 */
export const QUALITY_LADDER = [82, 78, 75, 70];

/** 第二步让步的缩尺寸比例（每档 −10%） */
const SHRINK_RATIO = 0.9;

/** 缩尺寸下限。档位本身就比它窄时（如 320）不再缩 */
const MIN_WIDTH = 640;

/** 缩尺寸最多尝试的档数，防止病态图片把编码跑成分钟级 */
const MAX_SHRINK_STEPS = 6;

/** 编码器固定参数。effort 5 → 6 只省 1% 体积却明显变慢，不值 */
const ENCODE = { format: 'webp', effort: 5 };

/** 字节 → 「123KB」 */
export const kb = (bytes) => `${(bytes / 1024).toFixed(0)}KB`;

/**
 * 把一张图编码到 `limit` 以内：先走质量阶梯，再走缩尺寸阶梯。
 *
 * **一定会返回一张图**。若所有尝试都超标，返回其中最小的那张并置
 * `withinLimit: false` —— 宁可交一张略超标的图，也不能让页面缺档 404。
 *
 * @param {string} source 原图路径
 * @param {number} baseWidth 该档的目标宽度（已按「不放大」夹过）
 * @param {{limit?: number, ladder?: number[]}} [options] 覆盖默认上限/质量阶梯
 * @returns {Promise<{data: Buffer, width: number, quality: number, shrunk: boolean, withinLimit: boolean}>}
 */
export async function encodeUnderLimit(source, baseWidth, options = {}) {
  const limit = options.limit ?? SIZE_LIMIT;
  const ladder = options.ladder ?? QUALITY_LADDER;
  const floor = Math.min(MIN_WIDTH, baseWidth);
  let width = baseWidth;
  let best = null; // 兜底：所有尝试里最小的那张

  for (let step = 0; ; step += 1) {
    for (const quality of ladder) {
      const data = await sharp(source)
        .resize({ width, withoutEnlargement: true })
        .webp({ ...ENCODE, quality })
        .toBuffer();

      const candidate = { data, width, quality, shrunk: width < baseWidth, withinLimit: true };
      if (!best || data.length < best.data.length) best = candidate;
      if (data.length <= limit) return candidate;
    }

    // 质量已压到底仍超标 → 缩一档尺寸，重跑质量阶梯（缩了之后往往 q82 就够用了）
    const next = Math.round(width * SHRINK_RATIO);
    if (next < floor || step >= MAX_SHRINK_STEPS) break;
    width = next;
  }

  return { ...best, withinLimit: false };
}
