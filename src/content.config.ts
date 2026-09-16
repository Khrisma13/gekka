/**
 * 内容集合定义（Astro Content Layer）
 *
 * 这是「加一张专辑 = 新建一个文件」的落地点。
 * 新增专辑只要在 src/content/albums/ 下放一个 .md，frontmatter 按下面的 schema 填，
 * 页面会自动生成。字段填错时**构建会直接报错**并指出是哪个文件哪一项 —— 这是刻意的：
 * 宁可构建失败，也不要静默产出一个信息缺失的页面。
 *
 * 字段含义与 REQUIREMENTS.md §3 一一对应。
 * 注意 schema 要**尽量瘦**：加一个字段就等于给每张专辑增加一份长期维护义务。
 * 首发场合、版本、特典、价格、原曲作曲者这几项已经拿掉 —— 社团不打算维护或展示它们。
 */
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
// 取值枚举的真源在 lib/types.ts —— 那边还要用它推导类型与排筛选顺序。
// 不在这里原地声明，是为了避免「加一个取值要改两处」的经典失配。
import { ALBUM_TYPES, LINK_GROUPS, MEMBER_STATUS, NEWS_TAGS, POST_TAGS } from './lib/types';

const trackSchema = z.object({
  no: z.number().int().positive(),
  title: z.string(),
  /** 二创曲：原曲名。原创曲留空 */
  original: z.string().optional(),
  /** 二创曲：原曲出处作品。原创曲留空 */
  source: z.string().optional(),
  /** 原创曲的作曲者 */
  compose: z.string().optional(),
  /** 二创曲的编曲者 */
  arrange: z.string().optional(),
  lyrics: z.string().optional(),
  vocal: z.string().optional(),
  /** 形如 "4:12" */
  duration: z.string().regex(/^\d{1,2}:\d{2}$/, '时长格式应为 m:ss 或 mm:ss').optional(),
  /**
   * 备注：Bonus / 特殊说明。
   * 原创曲**不要**填 —— 「用 compose 还是 arrange」已经说明了它是原创曲，
   * 每首都挂一个「原创曲」标签，等真出了整张原创专辑的时候会很蠢。
   */
  note: z.string().optional(),
});

const creditSchema = z.object({
  /** 编曲 / 作词 / 演唱 / 插画 / 设计 / 母带 */
  role: z.string(),
  name: z.string(),
  link: z.string().optional(),
});

const storeSchema = z.object({
  url: z.string(),
  inStock: z.boolean().default(true),
});

const albums = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/albums' }),
  schema: z.object({
    /** 专辑编号：正式 GKCD-000 / 非正式 GKSL-000。同时作为 URL 片段 */
    catalog: z.string().regex(/^GK(CD|SL)-\d{3}$/, '编号格式应为 GKCD-000 或 GKSL-000'),
    title: z.string(),
    /** 日文 / 英文标题 */
    titleAlt: z.string().optional(),
    /** 副标题，显示在标题下方 */
    subtitle: z.string().optional(),
    type: z.enum(ALBUM_TYPES),
    /** ISO 日期 YYYY-MM-DD */
    releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
    /**
     * 封面基准路径（不含尺寸后缀与扩展名）。
     * 例如 /images/albums/gkcd-010/cover 会指向 cover-320.webp / -640 / -1200。
     * 由 scripts/fetch-dizzylab.mjs 或 scripts/build-covers.mjs 生成。
     */
    cover: z.string().optional(),
    /** 一句话简介，列表页用 */
    summary: z.string().optional(),
    /** 完整 Staff 名单 */
    credits: z.array(creditSchema).default([]),
    /** 曲目表 */
    tracks: z.array(trackSchema).default([]),
    /** 试听外链 */
    links: z.record(z.string(), z.string()).default({}),
    /** 购买渠道。目前只接 dizzylab 一家 */
    stores: z.record(z.string(), storeSchema).default({}),
    tags: z.array(z.string()).default([]),
    /** 未完成的内容标 draft，构建时排除 */
    draft: z.boolean().default(false),
  }),
});

/**
 * 社团动态（REQUIREMENTS §2.5）。一条动态 = 一个 .md 文件。
 *
 * **正文就是文件的 Markdown 正文**，没有单独的 body 字段 ——
 * 于是「一句话短讯」和「几段公告」是同一套写法，页面用 render() 渲染。
 * 正文里的站内链接请写**相对路径**（`../albums/GKCD-013/`）：
 * 绝对路径 `/albums/...` 在 saiba.moe/gekka 子路径部署下会整条指错地方。
 *
 * 文件名只是约定用 `YYYY-MM-DD-slug.md`（让目录按时间排），排序仍以 date 为准 ——
 * 日期写在 frontmatter 里才有 schema 校验与统一的报错信息。
 */
const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    /** ISO 日期 YYYY-MM-DD */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
    /** 标签：发布 / 参展 / 招募 / 公告（真源见 lib/types.ts 的 NEWS_TAGS） */
    tag: z.enum(NEWS_TAGS),
    /**
     * 可选配图，public/ 下的路径（如 /images/news/2026-08-16.webp）。
     * 宽度上限 420px、按原始比例显示，别放超宽大图。
     */
    image: z.string().optional(),
    /** 提前写好等发布 / 还没定稿的，标 draft，构建时排除 */
    draft: z.boolean().default(false),
  }),
});

/**
 * 社团杂谈（REQUIREMENTS §2.4）。一篇文章 = 一个 .md 文件。
 *
 * 与动态的分工：**动态 = 短讯（一两句），杂谈 = 长文** —— 这是需求里点名的边界。
 * 所以杂谈有标题、有摘要、有自己的详情页，动态三样都没有。
 *
 * **正文就是文件的 Markdown 正文**，没有 body 字段（同动态）。
 * 正文里的站内链接照样写**相对路径**。
 *
 * 文件名 = URL 里的 slug（如 `making-of-gkcd-003.md`），**刻意不带日期前缀** ——
 * 这点与动态不同：动态没有详情页，文件名只是内部约定（让目录按时间排）；
 * 杂谈的文件名会原样出现在 URL 里，而日期进 URL 只会在改期时让链接失效。
 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    /** ISO 日期 YYYY-MM-DD */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
    /**
     * 列表卡片上的一句话摘要。
     * 不填时自动取正文第一段（`lib/text.ts` 的 excerptOf）—— 但正文首段未必适合当摘要，
     * 想清楚了写一句更好；这也是列表页唯一能「外显」的东西。
     */
    summary: z.string().optional(),
    /** 标签，取值见 lib/types.ts 的 POST_TAGS */
    tags: z.array(z.enum(POST_TAGS)).default([]),
    /** 可选封面，public/ 下的路径 */
    cover: z.string().optional(),
    /** 还没写完的先标 draft，构建时排除 */
    draft: z.boolean().default(false),
  }),
});

/**
 * 社团成员（REQUIREMENTS §2.6）。一名成员 = 一个 .md 文件。
 *
 * 与其它集合不同的两点，都是刻意的：
 *   · **文件里只有 frontmatter，正文留空。** 成员的「一句话」是 `bio` 字段，
 *     不是一段文章 —— 卡片是按字段排版的，塞进段落里就得靠人肉排版。
 *   · **排序靠 `order`，不靠时间。** 社员的先后没有天然依据（加入日期社团不维护），
 *     与其硬凑一个「按拼音 / 按文件名字母序」，不如直接给一个数。
 *
 * `status` 决定他出现在 `/about` 的哪一组（正式 / 合作 / 退出），
 * 取值真源是 lib/types.ts 的 `MEMBER_STATUS`。
 */
const members = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/members' }),
  schema: z.object({
    name: z.string(),
    /** 担当，如「代表 / 编曲 · 设计」 */
    role: z.string(),
    /**
     * 一句话。**没想好就空着** —— 别写「这个人很懒，什么都没留下」这类占位文案，
     * 卡片不写 bio 时本来就很好看。
     */
    bio: z.string().optional(),
    /**
     * 头像。填 **public/ 下的路径**（如 `/images/members/khrisma.webp`）：
     * 不要带 `public/` 前缀 —— 那是磁盘上的位置，进 URL 就成了 `/public/images/...`；
     * 也不要写完整网址 —— 部署前缀（自定义子域 `/` 或子路径 `/gekka/`）由 `asset()` 拼，
     * 写死了换部署方式就整批裂掉。
     * 图会被**圆形裁切**（`object-fit: cover`），请给正方形图。缺省时卡片显示占位圆。
     */
    avatar: z.string().optional(),
    links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
    /** 正式 / 合作 / 退出 */
    status: z.enum(MEMBER_STATUS).default('正式'),
    /** 同一状态组内的排序号，小的在前 */
    order: z.number().default(100),
    draft: z.boolean().default(false),
  }),
});

/**
 * 单页长文 —— 目前是社团简介与转载规约，由 `/about` 拼成一页。
 *
 * ⚠ 集合名 `pages` 指的是「页面级的成篇文案」，**不是路由**。
 *   路由仍然在 `src/pages/`；这里只是把那两段要长期维护的中文从模板里挪出来。
 *   写成 .astro 的代价是：改一句话要动组件，而这类文案恰恰是改得最勤的
 *   （规约尤其）。所以它和专辑、动态、杂谈一样，按「内容」对待。
 *
 * 正文里的站内链接同样写**相对路径**。
 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    /** 区块标题，页面上直接显示（正文里不要再写一遍） */
    title: z.string(),
    description: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

/**
 * 「一个入口 = 一张卡」的公共字段（`links` 与 `contacts` 共用）。
 *
 * 两个集合的**形状确实一样** —— 都是卡片要的那几项，页面也都走
 * `components/LinkCard.astro`；差别只在用途与归处：
 *   · `links`    → `/about#links`「链接聚合」：社团对外露出的地方（另加一个 `group`）
 *   · `contacts` → `/contact`「联系方式」：找我们谈事情的地方
 * 所以共享这一份字段定义，而不是各写一遍 —— 同一个形状留两份，迟早对不上
 * （同 `Post` / `Member` 接口被删掉的理由）。
 *
 * 也不合并成「一个集合 + 一个 kind 字段」：那样分组标题就得从 kind 推导，
 * 而两边的分组规则本来不同（`links` 必须分组、`contacts` 平铺），
 * 错填一个 kind 会让入口从某一页**静默消失**。
 */
const entrySchema = z.object({
  /** 平台名 / 入口名，卡片标题 */
  label: z.string(),
  /**
   * 账号 / 群号 / 邮箱，显示在标题下方、可一键复制。
   * 群号直接写数字（`123456789`），别再写「QQ 群:」这类前缀 —— 入口名已经在上面了。
   *
   * 类型写成 `string | number` 是有原因的，不是随手加的：
   * **YAML 里不加引号的 `123456789` 是数字**，纯 `z.string()` 会因此报
   * 「Expected type "string", received "number"」—— 而群号恰恰是最容易被这么写的一项。
   * 这里直接收下再转成字符串：显示与复制要的都是那几个字符，不存在歧义。
   */
  handle: z
    .union([z.string(), z.number()])
    .transform((value) => String(value))
    .optional(),
  /** 外链地址。留空时这张卡不可点（只剩账号可复制） */
  href: z.string().optional(),
  /** 一句补充，如「主要投稿与试听在这里」 */
  note: z.string().optional(),
  /** 同组内的排序号，小的在前 */
  order: z.number().default(100),
  draft: z.boolean().default(false),
});

/**
 * 链接聚合（REQUIREMENTS §2.7「联系与社交入口」→ `/about#links`）。
 * 一条入口 = 一个 .md 文件，只有 frontmatter（同 members）。
 *
 * ⚠ 集合名 `links` 指的是「社团对外的入口」，与需求 §1 里预留的
 *   **友链页 `/links`（P2）** 无关 —— 那是和别社交换链接，不是一回事。
 *   真要开友链时另起一个集合名，别往这里塞。
 *
 * 字段的分工直接决定卡片长什么样（见 components/LinkCard.astro）：
 *   · `label`  平台名，卡片标题
 *   · `handle` 账号 / 群号。**纯文本**，页面上配一键复制 —— 群号跳不过去，只能抄
 *   · `href`   外链。有值 → 整张卡可点；没有 → 卡片不可点（只剩账号可复制）
 * 两者都空 ⇒ 卡片显示「待补充」：素材未到位时先占位，填上值就自动生效。
 *
 * `group` 刻意**不给默认值**：漏填的话这条不属于任何一组，等于从页面上静默消失，
 * 宁可构建报错。分组顺序由 `LINK_GROUPS` 的声明顺序定。
 */
const links = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/links' }),
  schema: entrySchema.extend({
    /** 社交平台 / 音乐与发布平台 / 群组（真源见 lib/types.ts 的 LINK_GROUPS） */
    group: z.enum(LINK_GROUPS),
  }),
});

/**
 * 联系方式（REQUIREMENTS §2.8 → `/contact`）。一条入口 = 一个 .md 文件。
 *
 * 与 `links` 分开存 —— 尽管字段形状相同 —— 是因为**用途不同**：
 * `/about#links` 回答「去哪儿找我们玩」，`/contact` 回答「怎么找我们谈事」。
 * 前者是一份清单，后者要配一段委托说明，两件事的形状本来就不一样（见 DESIGN §22）。
 *
 * 这里**没有 `group`**：入口就那么几个，一律平铺，不需要分组标题。
 */
const contacts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/contacts' }),
  schema: entrySchema,
});

export const collections = { albums, news, posts, members, pages, links, contacts };
