/**
 * 单页长文（内容集合 `pages`）的读取。
 *
 * 目前三篇：社团简介与转载规约（由 `/about` 拼成一页，见 DESIGN §21）、
 * 合作与委托（`/contact` 的正文，见 §22）。取不到就抛错 —— 这一处管全部，
 * 而不是每个页面各写一遍、各报一种错。
 *
 * 注意集合名 `pages` 指的是**页面级成篇文案**，不是路由。
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export type PageEntry = CollectionEntry<'pages'>;

/**
 * 全部已发布的单页文案（草稿只在开发环境出现）。
 *
 * 站内搜索要按它核对「每一篇都登记了去处」——见 `lib/search.ts` 的 `PAGE_TARGETS`。
 * 过滤条件只有这一处，`getPage()` 也从这里取，免得日后改草稿规则要改两遍。
 */
export async function getPages(): Promise<PageEntry[]> {
  return getCollection('pages', ({ data }) => import.meta.env.DEV || !data.draft);
}

/**
 * 按文件名取一篇文案（`src/content/pages/<id>.md`）。
 *
 * 取不到时**直接抛错**，不做「空文案静默通过」——
 * 这类文案是页面的骨架（比如 /about 的简介与规约），
 * 少了一篇就该让构建停下来，而不是上线一个只剩标题的空区块。
 */
export async function getPage(id: string): Promise<PageEntry> {
  const all = await getPages();
  const entry = all.find((e) => e.id === id);

  if (!entry) {
    throw new Error(
      `找不到单页文案 pages/${id}：请新建 src/content/pages/${id}.md（字段见 src/content.config.ts）。` +
        '（若该文件标了 draft: true，线上构建里它会缺席。）',
    );
  }

  return entry;
}
