/**
 * 站点图片地址工具（封面 + 首页主视觉）。
 *
 * 图片都不放原图，而是按需预生成几档 WebP：
 *   封面（scripts/build-covers.mjs → public/images/albums/<id>/）
 *     320  列表卡片（手机 1x）
 *     640  列表卡片（桌面 / 手机 2x）、详情页小图
 *     1200 详情页大图 / 分享卡
 *   首页主视觉（scripts/build-oc.mjs → public/images/hero/）
 *     640 / 960 / 1440  见下方 HERO_WIDTHS
 *
 * 这样浏览器只下它真正需要的那个尺寸，仓库里也不必出现「同一张图四个副本」。
 * 档位（文件名里的数字）与生成脚本必须成对修改 —— 只有这里改了、脚本没跑，
 * 页面就会引用到不存在的文件。
 */
import { asset } from '../config/site';

export const COVER_WIDTHS = [320, 640, 1200] as const;

export type CoverWidth = (typeof COVER_WIDTHS)[number];

/** 封面基准路径 + 宽度 → 实际文件地址 */
export function coverUrl(base: string | undefined, width: CoverWidth = 640): string | undefined {
  if (!base) return undefined;
  return asset(`${base}-${width}.webp`);
}

/** srcset：交给浏览器按设备像素比自己挑 */
export function coverSrcset(base?: string): string | undefined {
  if (!base) return undefined;
  return COVER_WIDTHS.map((w) => `${asset(`${base}-${w}.webp`)} ${w}w`).join(', ');
}

/* --- 首页主视觉（看板娘） ---------------------------------------------------
   全站只有这一张，所以不必像封面那样靠 frontmatter 传基准路径，
   直接把基准写在这里 —— 页面少一个可传错的参数。
   档位与 scripts/build-oc.mjs 的 WIDTHS 一一对应（那边跑完会核对文件是否齐）。

   主视觉是**满幅底图**（100vw），所以档位按视口宽度铺，不再按栏宽：
     768   手机 2x（390×2 ≈ 780）
     1280  平板 / 小笔记本
     1920  桌面 1x、以及更大视口的上限档
   最后一次改动：从「右栏插图」改成「满幅底图」，档位随之整体右移。 */
export const HERO_WIDTHS = [768, 1280, 1920] as const;

export type HeroWidth = (typeof HERO_WIDTHS)[number];

const HERO_BASE = '/images/hero/oc';

/** 主视觉 srcset。`sizes` 由页面给出（满幅 → 100vw） */
export function heroArtSrcset(): string {
  return HERO_WIDTHS.map((w) => `${asset(`${HERO_BASE}-${w}.webp`)} ${w}w`).join(', ');
}

/** 主视觉的兜底 src（srcset 不被支持时用最大档） */
export function heroArtSrc(): string {
  return asset(`${HERO_BASE}-1920.webp`);
}

/** 主视觉的最大档像素尺寸，供 <img> 的 width/height 预留版位、避免布局跳动 */
export const HERO_ART_SIZE = { width: 1920, height: 1387 } as const;

