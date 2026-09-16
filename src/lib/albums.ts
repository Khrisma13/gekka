/**
 * 专辑数据的读取与派生。
 *
 * 内容集合是唯一数据源（src/content/albums/*.md），页面不直接碰文件。
 * 加一张专辑 = 放一个 .md 文件，这里自动认得。
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { localePath, type Locale } from '../config/site';
import { ALBUM_TYPES } from './types';

export type AlbumEntry = CollectionEntry<'albums'>;
export type AlbumData = AlbumEntry['data'];

/**
 * 详情页地址。用专辑编号做 slug，肉眼可读、和实体 CD 对得上。
 *
 * 走 localePath 而不是直接拼字符串：D1 的备用部署方案是 saiba.moe/gekka 子路径，
 * 写死的根路径 `/albums/...` 在那种情况下会整站失效。所有站内链接都从这里出。
 */
export function albumHref(catalog: string, locale: Locale = 'zh'): string {
  return localePath(locale, `/albums/${catalog}/`);
}

/**
 * 全部已发布专辑，按发行日期倒序（新 → 旧）。
 * draft: true 的条目只在开发环境出现，方便预览还没写完的专辑。
 */
export async function getAlbums(): Promise<AlbumEntry[]> {
  const all = await getCollection('albums', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort((a, b) => b.data.releaseDate.localeCompare(a.data.releaseDate));
}

export interface Neighbours {
  /** 更早发行的一张 */
  previous?: AlbumEntry;
  /** 更晚发行的一张 */
  next?: AlbumEntry;
}

/**
 * 按发行顺序取前后相邻专辑。
 * 传入的列表应当是 getAlbums() 的结果（新 → 旧）。
 */
export function neighboursOf(list: AlbumEntry[], catalog: string): Neighbours {
  const i = list.findIndex((e) => e.data.catalog === catalog);
  if (i < 0) return {};
  return { next: list[i - 1], previous: list[i + 1] };
}

/** 列表页筛选用：所有出现过的年份，倒序 */
export function yearsOf(list: AlbumEntry[]): string[] {
  return [...new Set(list.map((e) => e.data.releaseDate.slice(0, 4)))].sort((a, b) =>
    b.localeCompare(a),
  );
}

/**
 * 列表页筛选用：所有出现过的类型。
 *
 * 按 ALBUM_TYPES 的声明顺序排，而不是按「哪个类型的专辑最新」——
 * 后者的顺序会随着新专辑上架而变，芯片位置不稳定。
 */
export function typesOf(list: AlbumEntry[]): string[] {
  const present = new Set(list.map((e) => e.data.type));
  return ALBUM_TYPES.filter((t) => present.has(t));
}

/* --------------------------------------------------------------------------
   专辑系列：正式（GKCD） / 非正式（GKSL）
   --------------------------------------------------------------------------
   系列由编号前缀推导，**不写进 frontmatter**。
   schema 已经把编号限死为 /^GK(CD|SL)-\d{3}$/，编号本身唯一决定了系列归属；
   再存一个 series 字段就是给自己埋一份「可以填错、且迟早会和编号不一致」的副本。
   编号这种自带语义的东西，能推就别存。
   -------------------------------------------------------------------------- */

export type AlbumSeries = 'GKCD' | 'GKSL';

export function seriesOf(catalog: string): AlbumSeries {
  return catalog.startsWith('GKSL') ? 'GKSL' : 'GKCD';
}

/** 系列全称 —— 筛选按钮、事实表这类有空间的地方用 */
export const SERIES_LABELS: Record<AlbumSeries, string> = {
  GKCD: '正式专辑',
  GKSL: '非正式专辑',
};

/** 系列短名 —— 卡片、页头这类空间紧张的地方用 */
export const SERIES_SHORT: Record<AlbumSeries, string> = {
  GKCD: '正式',
  GKSL: '非正式',
};

/** 列表页筛选用：实际出现过的系列，正式在前（编号顺序即此意） */
export function seriesListOf(list: AlbumEntry[]): AlbumSeries[] {
  const order: AlbumSeries[] = ['GKCD', 'GKSL'];
  return order.filter((s) => list.some((e) => seriesOf(e.data.catalog) === s));
}

/** "3:25" → "PT3M25S"（结构化数据要 ISO 8601 时长） */
export function toIsoDuration(mmss: string | undefined): string | undefined {
  if (!mmss) return undefined;
  const m = mmss.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  return `PT${Number(m[1])}M${Number(m[2])}S`;
}
