/**
 * 曲目库的数据派生。
 *
 * 专辑页的曲目表只回答「这一张里有什么」；曲目库要回答的是跨专辑的问题 ——
 * 「这首原曲我们编过几次」「谁编过这首」「这首歌收在哪张盘里」。
 * 所以这里把全部专辑的 `tracks` 摊平成一张索引，顺便把筛选要用的派生量算好。
 *
 * 数据源仍然是内容集合（src/content/albums/*.md），本文件不存任何副本 ——
 * 同一条原则见 DESIGN.md §13.1：能推导的就不存。
 */
import type { Locale } from '../config/site';
import { albumHref, seriesOf, type AlbumEntry, type AlbumSeries } from './albums';
import type { AlbumType } from './types';

export interface IndexedTrack {
  /** 唯一标识：编号 + 曲序，如 GKCD-013-08 */
  id: string;
  /** 在所属专辑里的序号 */
  no: number;
  title: string;
  note?: string;
  vocal?: string;
  duration?: string;
  /** 原曲名（可能是一首曲子多个段落，保持原样不拆） */
  original?: string;
  /** 出处作品，展示用；一曲多原曲时用「;」连接 */
  source?: string;
  /** 出处作品拆开、归一化后的列表 —— 筛选与检索用 */
  works: string[];
  /** 编曲或作曲，两者只会有一个有值 */
  credit?: string;
  /** credit 是「编曲」还是「作曲」（原创曲为作曲） */
  creditRole?: '编曲' | '作曲';
  album: {
    catalog: string;
    title: string;
    type: AlbumType;
    series: AlbumSeries;
    releaseDate: string;
  };
  /** 专辑页里那张曲目表的位置（带 `#tracks`）—— 曲名那一格的链接 */
  href: string;
  /**
   * 专辑页首页（不带锚点）——「收录专辑」那一格的链接。
   * 与 `href` 同页、不同粒度：曲名直达曲目区，专辑名落到页首。
   */
  albumHref: string;
  /** 自由检索用的一整串小写关键字（曲名 / 原曲 / 出处 / 编曲 / 演唱 / 专辑） */
  search: string;
}

/**
 * 出处与原曲里全角波浪号（U+FF5E）与半角（U+007E）人工补录时混用过 ——
 * 例如「東方風神録　～ Mountain of Faith」与「東方風神録　~ Mountain of Faith」。
 *
 * 不归一化的话，同一个作品会在「出处作品」下拉里裂成两项：页面照常渲染，
 * 只是筛不全，属于最难发现的那一类静默故障。展示与筛选都过这一道。
 *
 * 存量数据已在 M3 一次性修齐（3 处），这里保留是为了挡住日后手工补录再写歪。
 */
export function normalizeWork(name: string): string {
  return name.replace(/\uFF5E/g, '~').trim();
}

/** 一曲多原曲写成「東方永夜抄　~ …; 東方風神録　~ …」，拆开才能单独筛到每首 */
export function splitWorks(source?: string): string[] {
  if (!source) return [];
  return source
    .split(/[;；]/)
    .map(normalizeWork)
    .filter(Boolean);
}

/** 展示用的「原曲 / 出处」，与专辑页曲目表同一套写法 */
export function originOf(row: IndexedTrack): string {
  if (!row.original) return '';
  return row.source ? `${row.original} / ${row.source}` : row.original;
}

/**
 * 摊平成索引。
 *
 * 顺序：专辑按发行日期倒序（getAlbums 已排好），专辑内按曲序 ——
 * 索引表的「收录专辑」一列因此是连续分组的，读起来像一份作品目录。
 */
export function indexTracks(albums: AlbumEntry[], locale: Locale = 'zh'): IndexedTrack[] {
  const rows: IndexedTrack[] = [];

  for (const entry of albums) {
    const a = entry.data;
    const page = albumHref(a.catalog, locale);

    for (const t of [...a.tracks].sort((x, y) => x.no - y.no)) {
      const original = t.original ? normalizeWork(t.original) : undefined;
      const source = t.source ? normalizeWork(t.source) : undefined;
      const works = splitWorks(t.source);
      const credit = t.arrange ?? t.compose;

      rows.push({
        id: `${a.catalog}-${String(t.no).padStart(2, '0')}`,
        no: t.no,
        title: t.title,
        note: t.note,
        vocal: t.vocal,
        duration: t.duration,
        original,
        source,
        works,
        credit,
        creditRole: t.arrange ? '编曲' : t.compose ? '作曲' : undefined,
        album: {
          catalog: a.catalog,
          title: a.title,
          type: a.type,
          series: seriesOf(a.catalog),
          releaseDate: a.releaseDate,
        },
        href: `${page}#tracks`,
        albumHref: page,
        // 演唱（vocal）虽然不再单独占一列，仍留在检索串里 ——
        // 搜演唱者名字照样能命中，这是页面上删列时特意保留的行为。
        search: [t.title, original, source, credit, t.vocal, t.note, a.title, a.catalog]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      });
    }
  }

  return rows;
}

/* --------------------------------------------------------------------------
   筛选项
   --------------------------------------------------------------------------
   出处作品与编曲者的取值多寡差得很远：前者 20 出头、后者 20 多，但条目都很长
   （「東方妖々夢　~ Perfect Cherry Blossoms」）。这类不适合铺成芯片，
   页面用下拉承载。
   -------------------------------------------------------------------------- */

/** 按出现次数降序（常用的排前面），同次数按名称 —— 顺序稳定，不随新专辑跳动 */
function facetValues(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
    .map(([value]) => value);
}

/** 下拉用：出现过的出处作品 */
export function worksOf(rows: IndexedTrack[]): string[] {
  return facetValues(rows.flatMap((r) => r.works));
}

/** 下拉用：出现过的编曲 / 作曲者 */
export function creditsOf(rows: IndexedTrack[]): string[] {
  return facetValues(rows.map((r) => r.credit).filter((c): c is string => Boolean(c)));
}

/**
 * 重复数的展示文案 —— **唯一真源**。
 *
 * 括号在页面上出现三处：顶部摘要、表格上方的计数、以及筛选后由客户端脚本重写的
 * 计数。量词「首」与括号写法只在这里写一次 —— 否则三处各写一遍，日后改文案
 * 必然漏掉一两处（这种「同一句话散落多处」正是静默漂移的温床）。
 *
 * 客户端脚本读不到 TS 模块（`is:inline`），所以它不自己拼串，
 * 而是读元素上服务端写好的 `data-dup-note` 属性。
 */
export function dupNoteOf(dups: number): string {
  return dups > 0 ? `（含 ${dups} 首重复乐曲）` : '';
}

/**
 * 索引表用：人读的「N 曲（含 O 首重复乐曲）· M 张专辑」。
 *
 * 括号紧跟在**曲数**后面而不是整串末尾 —— 重复收录是曲目的属性，
 * 挂在「23 张专辑」后面会被读成在修饰专辑。
 */
export function summaryOf(rows: IndexedTrack[], dupNote = ''): string {
  const albums = new Set(rows.map((r) => r.album.catalog)).size;
  return `${rows.length} 曲${dupNote} · ${albums} 张专辑`;
}

/**
 * 重复曲目：**曲名 / 作者 / 所用原曲 / 所属分类 四项全一致** —— 同一首曲子被
 * 多张专辑收录。最常见的来源是试作盘 GKSL 先收、正式盘 GKCD 再收一次。
 *
 * 返回的是「重复收录**多出来的条目数**」= 总条目 − 去重后条目数：
 * 一首出现在 2 张盘上算 1 条，出现在 3 张盘上算 2 条。
 * 取这个口径是为了让「总数 − 重复数 = 实际不同的曲目数」能直接算出来
 * （127 − 8 = 119），括号里的数因此是可用的，而不只是个提醒。
 *
 * 比对刻意较真，两处都不能放宽：
 *   · 曲名**全等**比对，绝不抹掉括号后缀 —— 一放宽就会把 Remix 并进原版
 *     （「Mriya (2023 Rework)」与「Mriya (DJ Tranceair Remix)」是两首不同的曲子，
 *     后者连编曲者都不是同一个人）。
 *   · 作者取 `arrange ?? compose` 的**人名**，不看署名是编曲还是作曲 ——
 *     同一个人把同一首以两种名义署两次，仍是同一首；但换了人就是换了一首
 *     （他人 Remix 与原版常常同名同原曲，差的正是这一项）。
 *   · 只裁首尾空白：人工补录多打一个空格会让重复静默漏判，
 *     这一条纯粹防漏，不会吃掉任何版本后缀。
 */
export function duplicateCountOf(rows: IndexedTrack[]): number {
  const seen = new Set<string>();
  for (const r of rows) {
    seen.add(
      [r.title.trim(), (r.credit ?? '').trim(), r.original ?? '', r.album.type].join('\u0000'),
    );
  }
  return rows.length - seen.size;
}
