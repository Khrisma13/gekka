/**
 * 动态（news）数据的读取与派生。
 *
 * 一条动态 = `src/content/news/` 下的一个 .md（内容集合 `news`，见 content.config.ts）。
 * 页面不直接碰文件，「加一条动态」= 放一个文件 + 写几行正文，不碰 HTML/CSS。
 *
 * 摘要工具（`excerptOf`）已搬到 `lib/text.ts` —— 杂谈也要用，两边共用一份口径。
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { NEWS_TAGS, type NewsTag } from './types';

export type NewsEntry = CollectionEntry<'news'>;
export type NewsData = NewsEntry['data'];

/**
 * 全部动态，按日期倒序（新 → 旧）。
 * draft: true 的条目只在开发环境出现，方便预览还没到日子发的公告。
 */
export async function getNews(): Promise<NewsEntry[]> {
  const all = await getCollection('news', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort((a, b) => b.data.date.localeCompare(a.data.date));
}

/**
 * 页面上筛选用：实际出现过的标签。
 *
 * 按 `NEWS_TAGS` 的声明顺序排，而不是「按数据里首次出现的顺序」——
 * 后者会随新动态的标签而变，芯片位置不稳定（同 `typesOf()`）。
 */
export function tagsOf(list: NewsEntry[]): NewsTag[] {
  const present = new Set(list.map((e) => e.data.tag));
  return NEWS_TAGS.filter((t) => present.has(t));
}
