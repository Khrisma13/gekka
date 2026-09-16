/**
 * 成员数据的读取与派生。
 *
 * 一名成员 = `src/content/members/` 下的一个 .md（内容集合 `members`），
 * 文件里只有 frontmatter —— 成员的「一句话」是 `bio` 字段，不是一段文章。
 * 页面不直接碰文件，「加一名成员」= 放一个文件。
 *
 * 分组与排序都在这里，页面只消费：**分组顺序 = `MEMBER_STATUS` 的声明顺序**
 * （正式 → 合作 → 退出），组内按 `order`。与 `typesOf()` 按 `ALBUM_TYPES` 声明顺序排
 * 是同一条理由 —— 顺序不该随数据的写法漂移。
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { MEMBER_STATUS, type MemberStatus } from './types';

export type MemberEntry = CollectionEntry<'members'>;
export type MemberData = MemberEntry['data'];

/** 全部成员（已发布）。顺序即页面上的呈现顺序。 */
export async function getMembers(): Promise<MemberEntry[]> {
  const all = await getCollection('members', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort(
    (a, b) =>
      MEMBER_STATUS.indexOf(a.data.status) - MEMBER_STATUS.indexOf(b.data.status) ||
      a.data.order - b.data.order ||
      // 最后按文件名兜底：两个 order 相同的人也有确定的先后，构建两次结果一致
      a.id.localeCompare(b.id),
  );
}

/**
 * 分组标题。同时也是卡片上那枚状态标记的文案 —— 同一件事只写一处。
 * 正式那组就叫「成员」—— 与区块标题同词是有意的：这一组人就是成员本身，
 * 另两组才是需要被标出来的例外。
 */
export const MEMBER_GROUP_LABEL: Record<MemberStatus, string> = {
  正式: '成员',
  合作: '合作',
  退出: '退出',
};

export interface MemberGroup {
  status: MemberStatus;
  label: string;
  items: MemberEntry[];
}

/** 按状态分组，空组不出现（页面上不会留下一个光有标题的分组） */
export function groupMembers(list: MemberEntry[]): MemberGroup[] {
  return MEMBER_STATUS.map((status) => ({
    status,
    label: MEMBER_GROUP_LABEL[status],
    items: list.filter((e) => e.data.status === status),
  })).filter((group) => group.items.length > 0);
}
