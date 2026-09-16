# 月華社 · 官方网站

同人音乐社团「月華社」的官方网站。全静态，部署在 GitHub Pages，绑自定义域名。

- 技术栈：**Astro**（静态输出，默认零 JS）
- 语言：**暂只做简体中文**。多语言版本搁置中 —— 导航里的 `ZH / JA / EN` 切换已摘掉
  （`/ja/` `/en/` 页面还没做，留着只会点出 404）。`localePath()` 与
  `src/components/LangSwitch.astro` 都保留着，恢复时把 `<LangSwitch />` 放回页头即可。
- 风格：清冷极简 · 见 [DESIGN.md](./DESIGN.md)
- 需求：见 [REQUIREMENTS.md](./REQUIREMENTS.md)

---

## 本地开发

```bash
npm install
npm run dev          # http://localhost:4321
```

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器 |
| `npm run build` | 构建到 `dist/`，并自动跑字形检查（构建前先自动清一遍 frontmatter 里的 Tab 缩进） |
| `npm run preview` | 本地预览构建产物 |
| **`npm run fetch:album -- GKCD-010`** | **从 dizzylab 抓取专辑信息，生成数据文件与封面** |
| `npm run fix:tabs` | 扫 `src/content/**/*.md`，把 frontmatter 里的 Tab 缩进规范化为空格（`--check` 只查不改） |
| `npm run covers` | 重新生成全部专辑的封面 WebP |
| `npm run oc` | 重新生成首页看板娘的三档 WebP（顺带核对页面里的柔光底色与画底是否一致） |
| `npm run brand` | 从徽记母版重新生成页头徽记与 favicon |
| `npm run og` | 重新生成默认社交分享卡（1200×630） |
| `npm run new:album` | 手工新建一张专辑的数据文件（交互式） |
| `npm run fonts` | 重新生成字体分片与 `@font-face`（见 DESIGN.md §3） |
| `npm run check:glyphs` | 只跑字形检查（严格模式） |
| `npm run styleguide` | 导出可离线打开的视觉样张到 `design/` |
| `npm run preview:album` | 导出可离线打开的页面预览到 `design/preview/`（首页、专辑列表、曲目库、每张专辑一页 —— 专辑页自动发现，不用手工维护列表） |

> **`npm run dev` 冷启动报 `[vite] Failed to run dependency scan` / `PARSE_ERROR`？**
> 多半是某个 `.astro` 的注释里写了 HTML 标签的字面量 —— 开标签会被 Vite 的依赖扫描
> 当成「脚本开始」，闭标签会把 `is:inline` 脚本当场切断。改写成「普通脚本」这类说法即可
> （详见 DESIGN §22.7）。**复现要先删 `node_modules/.vite`**：扫描成功过之后就不再扫了。

---

## 目录结构

```
src/
├── content.config.ts        # ★ 全部内容集合的字段定义（zod schema）—— 填错会构建失败并指出位置
├── content/
│   ├── albums/<编号>.md     # ★ 一张专辑一个文件。这就是全部内容源
│   ├── news/YYYY-MM-DD-slug.md  # 动态：一条一个文件（短讯，无详情页）
│   ├── posts/<slug>.md      # 杂谈：一篇一个文件（文件名就是 URL）
│   ├── members/<名字>.md    # 成员：一人一个文件（只有 frontmatter，没有正文）
│   ├── links/<平台>.md      # 链接聚合：一个平台（或一个群）一个文件，同上只有 frontmatter
│   ├── contacts/<入口>.md   # 联系方式：一个入口一个文件，字段与 links 同一套（/contact 用）
│   └── pages/*.md           # 单页长文：社团简介、转载规约（/about）、合作与委托（/contact）
├── config/
│   └── site.ts              # 站点信息、导航、路径工具 —— 内容地图唯一真源（社媒 / 群组 / 联系入口都在 content/ 里）
├── styles/
│   ├── tokens.css           # 设计令牌（配色/字体/间距/动效）—— 视觉唯一真源
│   ├── global.css           # reset、排版基线、布局、筛选条与通用类
│   └── clip.css             # 溢出文字的悬停滚动（曲目表与曲目库共用）
├── layouts/
│   └── BaseLayout.astro     # 全站外壳：head、导航、页脚、滚动淡入、溢出测量脚本
├── components/              # 基础组件，见 DESIGN.md §5
├── lib/
│   ├── types.ts             # 数据模型类型；★ ALBUM_TYPES / NEWS_TAGS / POST_TAGS / MEMBER_STATUS / LINK_GROUPS 枚举的唯一真源
│   ├── albums.ts            # 专辑读取与派生（排序、前后导航、筛选项、系列推导）
│   ├── tracks.ts            # 曲目库：把专辑的曲目摊平成跨专辑索引并派生筛选项
│   ├── news.ts / posts.ts   # 动态与杂谈的读取与派生
│   ├── members.ts           # 成员的读取、排序与分组（正式 / 合作 / 退出）
│   ├── links.ts             # 链接聚合的读取、排序与分组；页脚 Elsewhere 也读它
│   ├── contacts.ts          # 联系方式的读取（/contact 用）
│   ├── pages.ts             # 单页长文的读取（/about 与 /contact 用）
│   └── media.ts             # 封面与首页主视觉的地址、srcset 与档位（COVER_WIDTHS / HERO_WIDTHS）
├── assets/
│   ├── albums/<id>/cover.jpg  # 封面原图（高分辨率，长期留存）
│   ├── brand/logo.png         # 社团徽记母版（3000×3000，不部署）
│   └── oc.png                 # 看板娘母版（4252×3071 / 14.6MB，不部署）
├── data/
│   └── samples.ts           # 只剩专辑的示例数据（供样张页），其余已接真实内容
└── pages/
    ├── index.astro          # 首页
    ├── albums/
    │   ├── index.astro      # 专辑列表（系列 / 年份 / 类型筛选）
    │   └── [catalog].astro  # 专辑详情
    ├── tracks/
    │   └── index.astro      # 曲目库（搜索 / 系列 / 类型 / 出处作品 / 编曲者筛选）
    ├── news/index.astro     # 动态时间线（标签筛选）
    ├── blog/
    │   ├── index.astro      # 杂谈列表
    │   └── [slug].astro     # 文章详情
    ├── about/index.astro    # 关于：社团简介 + 成员 + 链接聚合 + 转载规约（一页）
    ├── contact/index.astro  # 联系：联系方式 + 合作与委托（一页）
    └── styleguide.astro     # M1 视觉样张（noindex）

public/images/albums/<id>/cover-*.webp  # 生成的 320 / 640 / 1200 三档，页面实际引用
public/images/hero/oc-*.webp          # 首页看板娘，由 npm run oc 生成（640 / 960 / 1440）
public/brand/logo-mark.png            # 由 npm run brand 生成，页头 / 页脚 / 分享卡用
public/favicon.png                    # 由 npm run brand 生成
public/fonts/misans/                  # 自托管 MiSans
design/og-card.html                   # 分享卡模板（源文件）
scripts/                              # 抓取、封面、看板娘、品牌素材、分享卡、字体、字形检查
```

---

## 内容维护

### 加一张专辑（推荐：从 dizzylab 抓）

```bash
npm run fetch:album -- GKCD-010
```

这一条命令会：

1. 抓取 `dizzylab.net/d/GKCD-010`，解析标题、社团、发布日期、标签、曲目表（曲名 / 署名 / 时长）、Staff、外链、购买渠道
2. 下载封面原图到 `src/assets/albums/gkcd-010/`
3. 生成三档 WebP 到 `public/images/albums/gkcd-010/`
4. 写出 `src/content/albums/gkcd-010.md`

**dizzylab 上没有的字段需要人工补**（脚本会把这份清单写在文件开头的注释里）：

- 每首曲目：`original` 原曲 / `source` 出处
- 原创曲：用 `compose` 而不是 `arrange`（**不要**加 `note: 原创曲`，见下）
- 专辑级：`stores` 购买渠道（目前只接 dizzylab 一家）

**重抓不会覆盖人工填写的内容。** 再跑一次同一条命令只会更新机器抓得到的字段
（曲名、时长、标签），人工补的原曲等一律保留。脚本是幂等的，可以放心重复执行。

### 加一张专辑（手工）

```bash
npm run new:album
```

生成一个带注释的骨架文件，按注释填即可。

### 曲目的两种写法

```yaml
# 二创曲：original / source 都要填（署名义务）
- no: 2
  title: Bibliophile
  original: Dolce Biblioteca
  source: 蔚蓝档案
  arrange: Khrisma
  duration: 3:25

# 原创曲：用 compose，original / source 留空
- no: 1
  title: Starfall -星降る-
  compose: Khrisma
  duration: 3:25
```

**原创曲不要写 `note: 原创曲`。** 「用 `compose` 还是 `arrange`」已经说明了这件事，
再挂一个标签是重复信息 —— 等到真出了一张整张原创的专辑，每首都顶着「原创曲」会很蠢。
`note` 只留给 Bonus 这类确实需要点出来的曲目。

**出处作品里的波浪号请用半角 `~`**（如 `東方風神録　~ Mountain of Faith`）。
全角 `～` 与半角混用会让同一部作品在曲目库的「出处作品」下拉里裂成两项。
系统会归一化，但写的时候统一一下更省事。

### 曲目库不用单独维护

`/tracks` 的每一行都从专辑文件里推导（`src/lib/tracks.ts`），没有第二份曲目数据 ——
加一张专辑、曲目库自动多出那几首。**不要**再单独维护一份曲目清单。

### 加一名成员 / 维护链接聚合与联系方式 / 改社团简介与规约

前几样都在 `/about` 一页上（顺序：社团简介 → 成员 → 链接聚合 → 转载规约），联系方式在 `/contact`；来源各不相同：

| 要改的 | 文件 | 说明 |
|---|---|---|
| 成员名单 | `src/content/members/<名字>.md` | 一人一个文件，**只有 frontmatter、没有正文**。`status` 取 `正式` / `合作` / `退出`，决定他出现在哪一组、卡片上挂不挂标记；`order` 是同组内的排序号（小的在前） |
| 链接聚合（社媒 / 群组） | `src/content/links/<平台>.md` | 一个平台（或一个群）一个文件，**只有 frontmatter**。详见下一节 |
| 联系方式（邮箱等） | `src/content/contacts/<入口>.md` | 一个入口一个文件，**只有 frontmatter**；字段与链接聚合同一套，但归 `/contact` |
| 社团简介（含沿革） | `src/content/pages/biography.md` | 正文写 Markdown。页面上的「社团简介」小标题是区块头给的，**正文里别再写一遍** |
| 转载规约 | `src/content/pages/terms.md` | 页脚那条「转载规约」指到 `/about#terms`，全站只有这一份文案 |

成员卡片的「正式 / 合作 / 退出」取自 `lib/types.ts` 的 `MEMBER_STATUS` ——
**正式是默认状态**，所以正式成员不挂标记、也不画分组标题；只有合作与退出被标出来。

**给成员加头像**：图放进 `public/images/members/`（建议文件名与成员文件同名），
在成员文件里加一行 `avatar: /images/members/<文件名>` 即可（前导斜杠可有可无，`asset()` 会补）。路径写的是
**public/ 下的路径** —— 不要带 `public/` 前缀（那是磁盘上的位置，进 URL 就成
`/public/images/...`），也不要写完整网址（部署前缀由 `asset()` 拼，写死了换部署方式就整批裂）。
卡片是**圆形裁切**，所以请给**正方形**图；320×320 足够（卡片里只显示 88px），
一张控制在 60KB 以内。不填 `avatar` 就显示占位圆，不会报错、也不用占位图。

### 维护链接聚合（`/about#links` 与页脚「Elsewhere」）

社媒账号与群组在 `src/content/links/`，**一个平台（或一个群）一个文件**，只有 frontmatter：

```yaml
label: Bilibili          # 卡片标题
group: 社交平台          # 三选一：社交平台 / 音乐与发布平台 / 群组（必填）
href: https://space.bilibili.com/12345678   # 外链；填了这张卡就整块可点
handle: '@gekka_sound'   # 账号 / 群号，显示在标题下面
note: 主要投稿与试听都在这里                  # 可选，一句补充
order: 1                 # 同组内的排序号（小的在前）
```

- **有 `href`** → 整张卡是外链；**只有 `handle`** → 卡片给一个「复制」按钮（QQ 群号就是这种）；
  两个都不填 → 卡片显示「待补充」，把值填上就自动生效，不用改代码（`/contact` 的联系方式卡是同一套）。
- 群号**直接写数字**（`handle: 123456789`），别加「QQ 群:」前缀 —— 平台名已经在卡片标题上了。
  YAML 会把不加引号的数字解析成数字，schema 已经兼容这一点。
- `group` **必填**：漏填的条目不属于任何一组，等于从页面上静默消失，所以宁可让构建报错。
- 暂时不想露出的平台，把文件删掉，或在文件里加 `draft: true`。
- **页脚「Elsewhere」读的是同一份数据**（只列有 `href` 的）：这里加一个平台，页脚一起出现，
  不存在两处对不上的可能。

页首那排目录（社团简介 / 成员 / 链接聚合 / 转载规约）与区块 `id` 写在
`src/pages/about/index.astro` 里。**改文案不用碰它**；只有新增一个区块才需要改代码。

### 维护联系方式（`/contact`）

谈合作、谈委托用的入口在 `src/content/contacts/`，**一个入口一个文件**，字段与链接聚合是同一套：

```yaml
label: 邮箱                    # 卡片标题
handle: contact@example.com    # 账号 / 邮箱，显示在标题下面，带「复制」按钮
# href: ...                     # 见下面第一条：邮箱一般别填
# note: 合作与委托请走这里      # 可选，一句补充
order: 1
```

- **邮箱只填 `handle`、不填 `href`**：`mailto:` 在网页邮箱里经常没反应，
  而卡片一旦有 `href` 就整张变成链接、**不再渲染「复制」按钮** ——
  复制恰恰是邮箱最需要的动作（手抄邮箱必错）。理由写在文件注释里，别顺手改回去。
- **社交平台（X、Bilibili）也在这里**，因为谈委托常常先走私信：填了 `href` 就是整张卡可点
  （右上角一枚 `↗`）。⚠ 同一个平台的地址在 `links/` 里**另有一份**（`/about#links` 那份是
  「来看作品」，这条是「来谈事」）—— 换账号时**两处都要改**，理由见 DESIGN §22.6。
- 合作与委托的说明（接什么、不接什么、多久回复）在 `src/content/pages/contact.md`，正文写 Markdown。
  **这一版是初稿**，口径请社团核对后再定 —— 尤其回复时限是一句对外承诺。
- 页面顺序是「联系方式 → 合作与委托」：先给地址，再讲规矩。要调顺序改 `src/pages/contact/index.astro`。

### 社团徽记（Logo）

母版是 `src/assets/brand/logo.png`（3000×3000，四周有大量空白）。
`npm run brand` 会裁去空白，生成：

- `public/brand/logo-mark.png` —— 页头（28px 高）、页脚（32px 高）、分享卡水印
- `public/favicon.png` —— 浅底圆角方 + 徽记居中（180×180，兼作 apple-touch-icon）

母版刻意**不放** `public/`：那是会被整体部署到线上的目录，3000px 的母版没有任何
页面会用到。这与封面的做法一致 —— 原图在 `src/assets/`，产物在 `public/`。

### 专辑编号规则

| 前缀 | 系列 | 含义 |
|---|---|---|
| `GKCD-000` | 正式专辑 | 社团的正式作品 |
| `GKSL-000` | 非正式专辑 | 非正式 / 迷你 / 试作 |

**系列不需要在 frontmatter 里填。** 它由编号前缀推导（`src/lib/albums.ts` 的
`seriesOf()`）—— schema 已经把编号限死为 `GK(CD|SL)-\d{3}`，编号本身唯一决定了
系列归属；再存一个字段就是给自己埋一份「可以填错、且迟早会和编号不一致」的副本。

区分呈现在三处：

- **卡片**（`AlbumCard`）编号旁挂标记：正式带强调色，非正式保持中性灰
- **详情页**头部编号旁，同样的标记，用全称「正式专辑 / 非正式专辑」
- **列表页**可按系列筛选（`全部 / 正式专辑 / 非正式专辑`）

标记由 `src/components/SeriesTag.astro` 渲染，只接编号、自己推导系列。

### 两个必须知道的约定

**1. frontmatter 必须出现在文件的第 0 字节。**
说明性注释请写成 frontmatter 内部的 `#` YAML 注释，**不要**在 `---` 之前放
`<!-- -->`。否则 Astro 解析不到任何字段，构建会报 `catalog: Required` 这类
完全指不到真正原因的错。

**2. 封面走「原图 + 预生成」两步。**
原图放 `src/assets/albums/<id>/`（命名 `cover.jpg` / `.png` / `.webp` 都可以），
页面引用的是 `public/images/albums/<id>/cover-{320,640,1200}.webp`。
换了原图后跑 `npm run covers` 重新生成。脚本自己会把单图压进 200KB
（REQUIREMENTS §4.3 的硬指标）：先降质量（q82→78→75→70），
仍超标才降尺寸（每档 −10%，下限 640px，**文件名不变**）。
为达标做了让步会打 `ℹ️`；压到下限仍超标才打 `✗` 并返回非零退出码。
真实像素小于档位名时，脚本会标出来，如 `1200w 200KB(810px)`。

---

## 部署

### 主方案：自定义子域 `gekka.saiba.moe`

顺序照来，**先在 GitHub 填域名、再去 DNS 加记录** —— 反过来的话，在 DNS 已经指向 GitHub
而仓库还没认领这个域名的窗口期里，别人可以先把这个子域挂到自己的 Pages 上。

1. **仓库** Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。
   不要选 *Deploy from a branch*：产物由 `.github/workflows/deploy.yml` 构建后上传。
2. **仓库** Settings → Pages → Custom domain 填 `gekka.saiba.moe` → **Save**。
   此时 DNS check 会失败，属正常，下一步补上记录就好。
3. **Cloudflare** → DNS → Records 加一条：

   | Type | Name | Target | Proxy status |
   |---|---|---|---|
   | `CNAME` | `gekka` | `<用户名>.github.io` | **DNS only（灰云）** |

   三个易错点：
   - Target **不带斜杠、不带仓库名**。写成 `<用户名>.github.io/gekka` 会被 Cloudflare 拒收
     （记录只能指向一个域名，不能含路径）。
   - **必须灰云**。橙云（Proxied）会让 GitHub 的域名校验看到 Cloudflare 的 IP 而不是它自己的，
     于是校验报 `InvalidDNSError`、Let's Encrypt 证书签不出来、`Enforce HTTPS` 一直是灰的。
   - 若确实要开橙云，Cloudflare 的 SSL/TLS 模式必须是 **Full**；选 Flexible 会无限重定向
     （Cloudflare 用 HTTP 回源，而 GitHub 强制 HTTPS）。
4. 回仓库 Settings → Pages，等 DNS check 变绿后勾 **Enforce HTTPS**
   （证书签发最长 24 小时；等待期间别反复点 Save、别改设置）。
5. **账号** settings（不是仓库）→ Pages → Add a domain，验证一级域 `saiba.moe`。
   验证后所有直接子域（含 `gekka.saiba.moe`）一并受保护，将来仓库被删或降级时
   不会被别人抢注去挂自己的页面。**这条别删**，删了就恢复成未验证状态。
6. push 到 `main` 即自动构建上线。

> **关于 `public/CNAME`**：那是「Deploy from a branch」那种老式发布的机制。用 GitHub Actions
> 发布时 GitHub **不读它** —— 官方文档原话是「不会创建 `CNAME` 文件，现有 `CNAME` 也被忽略」，
> 域名一律以第 2 步的 Settings 为准。文件留着无害（将来若改回分支发布就会生效），
> 但**别把它当成配置入口**。

### 备用方案：子路径 `saiba.moe/gekka`

改构建时的环境变量即可。站点内部路径全部由 `src/config/site.ts` 的
`asset()` / `localePath()` 统一处理，不需要改任何页面代码：

```bash
SITE_BASE=/gekka npm run build
```

---

## 已知待办

- [x] 曲目库 `/tracks`（含搜索与筛选；数据全部从专辑推导，不需单独维护）
- [ ] 导入其余专辑（现有 `GKCD-002`~`013` 与 `GKSL-001`~`010`，已完成 `GKCD-010`、`GKSL-012`）
- [x] 动态 `/news`、杂谈 `/blog`、关于 `/about`（社团简介 + 成员 + 链接聚合 + 转载规约四合一）
- [x] 联系 `/contact`（联系方式 + 合作与委托）。**邮箱还没填** —— 见 `src/content/contacts/email.md`
- [ ] 徽记矢量文件（当前只有 3000px 位图母版，放大会糊）
- [ ] 多语言页面 —— **已搁置**，见文件开头说明
- [ ] 站内搜索（Pagefind）
- [ ] `sitemap.xml` / `robots.txt`
- [ ] 日文字形是否单独引入 Noto Sans JP —— 已决定**不引入**，多语言搁置期间无需处理

字体与分享卡已就绪：MiSans 自托管（3 档字重 / 300 个 unicode-range 分片），
默认分享卡 `public/og-default.png` 由 `npm run og` 生成；专辑页用各自的封面做分享卡。
