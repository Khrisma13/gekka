/**
 * 站内搜索的索引（REQUIREMENTS §4.8 → `/search`）。
 *
 * 站点是纯静态的、没有后端，所以搜索走的是「构建时把全部条目排进 HTML、
 * 客户端只做过与不过的判定」这条路 —— 与曲目库 / 动态的筛选是同一套做法，
 * 连 `data-search` 这个属性名都一样。**没有引 Pagefind / Fuse.js**：
 *   · 索引本来就能从内容集合推导出来，引一个搜索库等于给同一份数据再养一份副本；
 *   · 这个体量（百来条）用不着倒排索引，子串匹配足够快，而且是同步的；
 *   · 不多一个二进制依赖（Pagefind 要下载一个 Rust 二进制），也不多一次网络请求，
 *     离线预览（design/preview/）照常能用。
 * 代价是**没有模糊匹配与拼写纠错**。中文查询本身就是连续子串，这个代价落不到实处 ——
 * 哪天真要加权排序，改的也只有 `search` 这一串。
 *
 * 三件事刻意不在这里做：
 *   · **不存副本** —— 标题 / 日期 / 链接全部现场从各集合推导（同 DESIGN §13.1）。
 *   · **不排序** —— 分组顺序 = `SEARCH_KINDS` 的声明顺序，组内顺序沿用各集合本来的
 *     顺序（专辑按发布倒序、曲目按专辑再按曲序、成员按 order…）。客户端只负责藏与显：
 *     一旦让它自己排，同一套规则就等于有了两份，迟早对不上。
 *   · **不做摘要** —— 结果行只有「标题 + 一行次要信息」，正文不进搜索页。
 *     这一页的职责是把人送到正确的那一页，不是变成第二个列表页。
 */
import { NAV, localePath } from '../config/site';
import { albumHref, getAlbums } from './albums';
import { getMembers } from './members';
import { getNews } from './news';
import { getPages, type PageEntry } from './pages';
import { getPosts, postHref } from './posts';
import { excerptOf, plainTextOf } from './text';
import { indexTracks } from './tracks';
import { formatDate, SEARCH_KINDS, type SearchKind } from './types';

export interface SearchHit {
  kind: SearchKind;
  /** 结果行的主文字 */
  title: string;
  /** 主文字右侧的次要信息（编号 / 日期 / 担当）。没有就不给 */
  meta?: string;
  href: string;
  /** 检索串：全小写、空格相连 */
  search: string;
}

export interface SearchGroup {
  kind: SearchKind;
  hits: SearchHit[];
}

/**
 * `pages` 集合里的每篇成篇文案，住在哪个页面的哪一节。
 *
 * 这是本文件里**唯一写死的站内位置**，也是唯一的例外 —— 其余链接全部由各集合
 * 推导（`albumHref` / `postHref` / `#members`）。文案本身是内容、藏在 Markdown 里，
 * 「它显示在哪一页」这件事没有别的来源可推。
 *
 * 正因为写死了，下面 `assertPageTargetsComplete()` 会把两个方向都卡住：
 * 漏登记一篇、或登记一个不存在的 id，都**构建失败**。不卡的话，
 * 漏掉的那篇会静默地搜不到（页面照常渲染，只是没人找得到它）。
 */
const PAGE_TARGETS: Record<string, string> = {
  biography: '/about/#biography',
  terms: '/about/#terms',
  contact: '/contact/#commission',
};

/** 检索串：全小写、空格相连。判定规则只有一条 —— 查询里的每个词都得出现 */
function haystack(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * 结果行右侧那行说明：「这一条住在哪个栏目」。
 *
 * 栏目名从 `NAV` 现推（拿路径去比前缀），不手写一份 ——
 * 手写的话，`NAV` 里改了栏目名，这里会悄悄留着一个旧名字。
 * 只用于「说明」这一类：专辑 / 曲目那一列给的是编号与专辑名，信息量更足。
 */
function sectionLabelOf(href: string): string | undefined {
  const path = href.split('#')[0];
  return NAV.find((item) => path === item.href || path.startsWith(`${item.href}/`))?.label.zh;
}

/** 每篇成篇文案都得登记去处，多一个少一个都让构建停下来（理由见 PAGE_TARGETS） */
function assertPageTargetsComplete(docs: PageEntry[]): void {
  const known = new Set(docs.map((doc) => doc.id));

  for (const id of new Set([...known, ...Object.keys(PAGE_TARGETS)])) {
    if (!known.has(id)) {
      throw new Error(
        `lib/search.ts 的 PAGE_TARGETS 登记了不存在的单页文案 pages/${id}：` +
          'src/content/pages/ 下没有这个文件，请删掉这条登记或改对文件名。',
      );
    }
    if (!PAGE_TARGETS[id]) {
      throw new Error(
        `src/content/pages/${id}.md 还没登记在 lib/search.ts 的 PAGE_TARGETS 里 ——` +
          '它会从站内搜索里静默消失。请补上它显示在哪一页的哪一节（形如 /about#terms）。',
      );
    }
  }
}

/** 全站可检索的条目，顺序 = SEARCH_KINDS 的声明顺序，组内沿用各集合本来的顺序 */
export async function buildSearchIndex(): Promise<SearchHit[]> {
  const [albums, posts, news, members, docs] = await Promise.all([
    getAlbums(),
    getPosts(),
    getNews(),
    getMembers(),
    getPages(),
  ]);

  assertPageTargetsComplete(docs);

  const tracks = indexTracks(albums);

  /**
   * `Record<SearchKind, …>` 而不是数组是刻意的：`SEARCH_KINDS` 里加一个取值，
   * 这里会当场编译不过 ——「加了枚举却忘了往搜索里接」不能是静默的。
   */
  const byKind: Record<SearchKind, SearchHit[]> = {
    专辑: albums.map((entry) => {
      const a = entry.data;
      return {
        kind: '专辑' as const,
        title: a.title,
        meta: [a.catalog, formatDate(a.releaseDate)].join(' · '),
        href: albumHref(a.catalog),
        // 曲目**不**进专辑的检索串：每首曲目自己就是一条结果，
        // 再挂到专辑上会让「搜某首曲子」同时冒出专辑与曲目两条重复结果。
        search: haystack(
          a.title,
          a.titleAlt,
          a.subtitle,
          a.catalog,
          a.type,
          a.summary,
          a.tags.join(' '),
          a.credits.map((c) => `${c.role} ${c.name}`).join(' '),
        ),
      };
    }),

    曲目: tracks.map((row) => ({
      kind: '曲目' as const,
      title: row.title,
      meta: [row.album.catalog, row.album.title].join(' · '),
      // 指向专辑页的曲目区（带 #tracks）—— 与曲目库里的曲名同一去处
      href: row.href,
      // 检索串由 lib/tracks.ts 拼好（曲名 / 原曲 / 出处 / 编曲 / 演唱 / 专辑），
      // 这里不重新拼一遍。
      search: row.search,
    })),

    杂谈: posts.map((entry) => ({
      kind: '杂谈' as const,
      title: entry.data.title,
      meta: [formatDate(entry.data.date), entry.data.tags.join(' / ')].filter(Boolean).join(' · '),
      href: postHref(entry.id),
      // 正文**全量**进检索串 —— 这是搜索的主要价值所在（「那篇讲混音的文章」）。
      // 代价是搜索页会随文章一起变长；真到拖慢页面的那天，正确的做法是把索引挪去
      // 构建产出的 JSON 按需取，而不是把正文从检索里砍掉。
      search: haystack(entry.data.title, entry.data.tags.join(' '), plainTextOf(entry.body)),
    })),

    动态: news.map((entry) => ({
      kind: '动态' as const,
      // 动态没有标题（短讯），拿正文首段充当结果行的主文字
      title: excerptOf(entry.body, 56),
      meta: [formatDate(entry.data.date), entry.data.tag].join(' · '),
      // 深链到这一条：/news 的每个条目都带自己的 id（见 components/Timeline.astro），
      // 否则六条动态的结果全都指向页首，等于没搜出来。
      href: `${localePath('zh', '/news/')}#${entry.id}`,
      search: haystack(entry.data.tag, entry.data.date, plainTextOf(entry.body)),
    })),

    成员: members.map((entry) => ({
      kind: '成员' as const,
      title: entry.data.name,
      meta: entry.data.role,
      href: `${localePath('zh', '/about/')}#members`,
      search: haystack(entry.data.name, entry.data.role, entry.data.bio),
    })),

    说明: docs.map((entry) => {
      const href = PAGE_TARGETS[entry.id];
      return {
        kind: '说明' as const,
        title: entry.data.title,
        meta: sectionLabelOf(href),
        href: localePath('zh', href),
        search: haystack(entry.data.title, entry.id, plainTextOf(entry.body)),
      };
    }),
  };

  return SEARCH_KINDS.flatMap((kind) => byKind[kind]);
}

/**
 * 按 `SEARCH_KINDS` 分组，空组不出现（页面上不会留下一个光有标题的空分组）。
 * 与 `groupMembers()` / `groupLinks()` 同一套做法 —— 分组规则留在 lib 里，
 * 页面只消费。
 */
export function groupHits(hits: SearchHit[]): SearchGroup[] {
  return SEARCH_KINDS.map((kind) => ({
    kind,
    hits: hits.filter((hit) => hit.kind === kind),
  })).filter((group) => group.hits.length > 0);
}
