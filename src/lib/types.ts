/**
 * 内容数据模型
 * 对应 REQUIREMENTS.md §3。新增专辑时按 Album 结构填一个文件即可。
 */

/**
 * 专辑类型。列表页据此筛选，详情页 facts 表直接显示。
 *
 * 这里是**唯一真源**：schema 直接引用这个数组，`AlbumType` 也从它推导 ——
 * 所以调整类型只改这一处即可（早前需要在 schema 与类型定义之间改两遍）。
 *
 * 数组顺序 = 列表页筛选芯片的显示顺序，按「原创 → 二创」排。
 * 不用「新专辑的类型自动靠前」那种推导法：那样每加一张专辑芯片就会重排，
 * 读者刚记住的位置下次就变了。
 */
export const ALBUM_TYPES = ['原创', '东方Project', '蔚蓝档案'] as const;

export type AlbumType = (typeof ALBUM_TYPES)[number];

/**
 * 动态标签（REQUIREMENTS §2.5）。
 *
 * 与 `ALBUM_TYPES` 同一条原则：**枚举是唯一真源** —— schema（`content.config.ts`）
 * 引用它来校验，筛选芯片按这里的声明顺序排，加一个标签只改这一处。
 *
 * 放这里而不是 `content.config.ts` 的原因也一样：那是 Astro content layer 的配置模块，
 * 执行时带 `defineCollection()` 的全局注册副作用，被页面依赖图拉进去有重复注册风险；
 * 枚举是共享数据，该待在不依赖 Astro 的纯模块里。
 *
 * 注意是「发布」不是「发行」—— 全站统一用「发布」（专辑日期同理）。
 */
export const NEWS_TAGS = ['发布', '参展', '招募', '公告'] as const;

export type NewsTag = (typeof NEWS_TAGS)[number];

/**
 * 杂谈标签（REQUIREMENTS §2.4）。
 *
 * 内容方向由需求定死：创作手记 / 编曲思路 / 展会 repo / 器材与软件 / 杂感。
 * 与 `NEWS_TAGS` 同一条原则 —— 枚举是唯一真源，schema 直接引用它校验。
 *
 * 标签目前**只作展示**：不设分类页、也不做筛选。文章还少，
 * 给五个标签铺一套筛选反而让人以为站上内容很多。等文章数量上去再说。
 */
export const POST_TAGS = ['创作手记', '编曲思路', '展会Repo', '器材与软件', '杂感'] as const;

export type PostTag = (typeof POST_TAGS)[number];

export interface Credit {
  /** 编曲 / 作词 / 演唱 / 插画 / 设计 / 母带 */
  role: string;
  name: string;
  link?: string;
}

export interface Track {
  no: number;
  title: string;
  /** 二创曲：原曲名，原创曲留空 */
  original?: string;
  /** 二创曲：原曲出处作品，原创曲留空 */
  source?: string;
  /**
   * 原创曲：作曲者。
   * 原创曲不需要额外标注「原创曲」—— 用的是 compose 还是 arrange 已经说明了这件事，
   * 整张原创专辑里每首都挂个「原创曲」标签只会显得多余。
   */
  compose?: string;
  /** 二创曲：编曲者 */
  arrange?: string;
  lyrics?: string;
  vocal?: string;
  /** 形如 "4:12" */
  duration?: string;
  /** Bonus / 其他需要点出的标注，以标签形式显示。没有就不填 */
  note?: string;
}

export interface StoreLink {
  url: string;
  inStock: boolean;
}

export interface AlbumLinks {
  bilibili?: string;
  dizzylab?: string;
  netease?: string;
  youtube?: string;
  bandcamp?: string;
  spotify?: string;
  [key: string]: string | undefined;
}

export interface Album {
  /** 文件名与 URL slug，用小写编号，如 gkcd-001 */
  id: string;
  /** 专辑编号：正式 GKCD-000 / 非正式 GKSL-000 */
  catalog: string;
  title: string;
  /** 日文或英文标题 */
  titleAlt?: string;
  type: AlbumType;
  /** ISO 日期 */
  releaseDate: string;
  cover?: string;
  summary?: string;
  description?: string;
  credits?: Credit[];
  tracks?: Track[];
  links?: AlbumLinks;
  stores?: Record<string, StoreLink>;
  tags?: string[];
}

/**
 * 杂谈（posts）与动态（news）都没有独立的 TS 接口 —— 形状由内容集合的 schema 定义，
 * 页面拿到的是 `CollectionEntry<'posts'>`（见 `lib/posts.ts`）。
 * 早前那个 `Post` 是示例数据的形状，杂谈接入内容集合后已删掉 ——
 * 同一个形状留两份定义，迟早对不上。
 */

/**
 * 成员状态（REQUIREMENTS §2.6）。
 *
 * 此前这里是 `Member` 接口上的 `left` / `guest` 两个布尔，而它们的合法组合有 4 种，
 * 实际只有 3 种含义 ——「既退出、又是合作」是个填得出来却毫无意义的状态。
 * 换成三值枚举之后，非法组合在类型上就不存在了。
 * （`Member` 接口本身也一并删掉：形状的真源是内容集合的 schema，
 * 再手写一份迟早对不上 —— 与 `Post` 那次同理。见 lib/members.ts。）
 *
 * 与 `ALBUM_TYPES` / `NEWS_TAGS` 同一条原则：**枚举是唯一真源** ——
 * schema（`content.config.ts`）引用它校验，`/about` 的分组顺序 = 这里的声明顺序。
 * 取值同时是**页面上的字**（分组标题与卡片标记共用 `MEMBER_GROUP_LABEL`），
 * 所以措辞就是面向读者的 —— 别在这里写「客座」「离队」这类内部说法。
 */
export const MEMBER_STATUS = ['正式', '合作', '退出'] as const;

export type MemberStatus = (typeof MEMBER_STATUS)[number];

/**
 * 「链接聚合」的分组（REQUIREMENTS §2.7「联系与社交入口」→ `/about#links`）。
 *
 * 同 `MEMBER_STATUS` 的做法：**取值本身就是页面上的分组标题**，
 * 分组顺序 = 声明顺序（社交平台 → 音乐与发布平台 → 群组）。
 * 这三类就是社团对外的全部入口，所以不再另设 kind / 标签字段。
 */
export const LINK_GROUPS = ['社交平台', '音乐与发布平台', '群组'] as const;

export type LinkGroup = (typeof LINK_GROUPS)[number];

/**
 * 站内搜索的「一条结果属于哪一类」（REQUIREMENTS §4.8 → `/search`）。
 *
 * 同 `MEMBER_STATUS` / `LINK_GROUPS` 的做法：**取值本身就是页面上的字** ——
 * 结果分组标题与范围筛选芯片共用这一份，所以措辞是面向读者的；
 * 且**声明顺序 = 页面上分组的先后**。
 *
 * 顺序按「查的人多半想找什么」排：作品（专辑 / 曲目）在前，社团的其他内容在后。
 * 「说明」放最后 —— 它是 `/about`、`/contact` 上成篇的说明文字，
 * 多数查询并不冲着它来（真冲着来的人会直接看那一页）。
 */
export const SEARCH_KINDS = ['专辑', '曲目', '杂谈', '动态', '成员', '说明'] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

/** 把 ISO 日期格式化为 2024.08.11 —— 全站统一的日期写法 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y}.${m}.${d}`;
}

/** 分组到「年.月」，动态页时间线用 */
export function groupKey(iso: string): string {
  const [y, m] = iso.split('-');
  return `${y}.${m}`;
}
