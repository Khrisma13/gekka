/**
 * 杂谈（posts）数据的读取与派生。
 *
 * 一篇文章 = `src/content/posts/` 下的一个 .md（内容集合 `posts`，见 content.config.ts）。
 * 页面不直接碰文件，「加一篇文章」= 放一个文件 + 写正文，不碰 HTML/CSS。
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { localePath, type Locale } from '../config/site';
import { excerptOf } from './text';

export type PostEntry = CollectionEntry<'posts'>;
export type PostData = PostEntry['data'];

/**
 * 详情页地址。slug 就是文件名（**不带日期前缀**，见 content.config.ts 的说明）。
 *
 * 与专辑一样走 `localePath`：D1 的备用部署方案是 saiba.moe/gekka 子路径，
 * 写死的根路径 `/blog/...` 在那种情况下会整站失效。
 */
export function postHref(slug: string, locale: Locale = 'zh'): string {
  return localePath(locale, `/blog/${slug}/`);
}

/**
 * 全部已发布文章，按日期倒序（新 → 旧）。
 * draft: true 的条目只在开发环境出现，方便预览还没写完的稿子。
 */
export async function getPosts(): Promise<PostEntry[]> {
  const all = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort((a, b) => b.data.date.localeCompare(a.data.date));
}

/**
 * 列表卡片与页头用的一句话摘要。
 *
 * **手写的 summary 优先**，没写才回落到正文第一段 —— 正文首段是给读者进入文章的，
 * 未必适合当摘要（可能一上来就是一句反问）。回落只是兜底，不是推荐用法。
 */
export function summaryOf(entry: PostEntry, max = 120): string {
  return entry.data.summary?.trim() || excerptOf(entry.body, max);
}

export interface PostNeighbours {
  /** 更早发布的一篇 */
  previous?: PostEntry;
  /** 更晚发布的一篇 */
  next?: PostEntry;
}

/**
 * 按时间顺序取前后相邻的文章。
 * 传入的列表应当是 getPosts() 的结果（新 → 旧）。
 * 与 `lib/albums.ts` 的 `neighboursOf` 方向一致：previous = 更早的那一篇。
 */
export function neighboursOf(list: PostEntry[], id: string): PostNeighbours {
  const i = list.findIndex((e) => e.id === id);
  if (i < 0) return {};
  return { next: list[i - 1], previous: list[i + 1] };
}
