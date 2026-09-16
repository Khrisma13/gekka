/**
 * 「链接聚合」条目的读取、排序与分组（REQUIREMENTS §2.7 → `/about#links`）。
 *
 * 一条入口 = `src/content/links/` 下的一个 .md（内容集合 `links`），
 * 文件里只有 frontmatter ——「加一个平台 / 一个群」= 放一个文件，不用动页面。
 *
 * 分组与排序都在这里，页面只消费：**分组顺序 = `LINK_GROUPS` 的声明顺序**
 * （社交平台 → 音乐与发布平台 → 群组），组内按 `order`，最后按 id 兜底 ——
 * 与 `lib/members.ts` 同一条理由：顺序不该随数据的写法漂移。
 *
 * 分组标题不另写映射：`LINK_GROUPS` 的取值本身就是页面上的字。
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { LINK_GROUPS, type LinkGroup } from './types';

export type LinkEntry = CollectionEntry<'links'>;
export type LinkData = LinkEntry['data'];

/** 全部入口（已发布）。顺序即页面上的呈现顺序。 */
export async function getLinks(): Promise<LinkEntry[]> {
  const all = await getCollection('links', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort(
    (a, b) =>
      LINK_GROUPS.indexOf(a.data.group) - LINK_GROUPS.indexOf(b.data.group) ||
      a.data.order - b.data.order ||
      // 最后按文件名兜底：两个 order 撞了也有确定的先后，构建两次结果一致
      a.id.localeCompare(b.id),
  );
}

/**
 * 只有外链的条目 —— 页脚「Elsewhere」与 /about 的 JSON-LD `sameAs` 都用它。
 *
 * 两处都**只认 href**：群号不是 URL（塞进 sameAs 会让搜索引用的实体信息出错），
 * 而页脚在每一页底部，一份抄不走的群号摆在那里既点不动又占地方。
 * 想看群号去 `/about#links`。
 */
export function externalLinks(list: LinkEntry[]): { label: string; href: string }[] {
  return list.flatMap((entry) =>
    entry.data.href ? [{ label: entry.data.label, href: entry.data.href }] : [],
  );
}

export interface LinkGroupBucket {
  group: LinkGroup;
  items: LinkEntry[];
}

/** 按分组归类，空组不出现（页面上不会留下一个光有标题的分组） */
export function groupLinks(list: LinkEntry[]): LinkGroupBucket[] {
  return LINK_GROUPS.map((group) => ({
    group,
    items: list.filter((e) => e.data.group === group),
  })).filter((bucket) => bucket.items.length > 0);
}
