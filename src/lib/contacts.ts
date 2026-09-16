/**
 * 「联系方式」条目的读取（REQUIREMENTS §2.8 → `/contact`）。
 *
 * 一条入口 = `src/content/contacts/` 下的一个 .md（内容集合 `contacts`），
 * 文件里只有 frontmatter ——「加一个入口」= 放一个文件，不用动页面。
 *
 * **为什么不跟 `links` 合成一个集合**（两者字段形状明明一样）：
 * 它们归两个页面、回答两个问题 ——
 *   · `/about#links`「链接聚合」= 社团对外**露出的地方**（来听、来看、来聊）
 *   · `/contact`「联系方式」    = 找我们**谈事情的地方**（委托、合作）
 * 合成一个就得再加个 `kind` 之类的字段去筛，而那个字段错填的后果是**静默的**：
 * 入口从某一页上消失，构建照样成功。宁可多一个集合，也不要这种「对得上但对错了」
 * 的耦合。字段定义在 `content.config.ts` 里是共用的一份（`entrySchema`）。
 *
 * 排序只按 `order` —— 这里没有分组，不需要像 `lib/links.ts` 那样先按枚举排一遍。
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export type ContactEntry = CollectionEntry<'contacts'>;
export type ContactData = ContactEntry['data'];

/** 全部联系方式（已发布）。顺序即页面上的呈现顺序 */
export async function getContacts(): Promise<ContactEntry[]> {
  const all = await getCollection('contacts', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort(
    (a, b) =>
      a.data.order - b.data.order ||
      // 最后按文件名兜底：两个 order 撞了也有确定的先后，构建两次结果一致
      a.id.localeCompare(b.id),
  );
}
