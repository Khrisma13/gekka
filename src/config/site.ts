/**
 * 站点配置与导航结构
 * 全站唯一的「内容地图」，增删栏目只改这里。
 */

export type Locale = 'zh' | 'ja' | 'en';

export const LOCALES: Locale[] = ['zh', 'ja', 'en'];
export const DEFAULT_LOCALE: Locale = 'zh';

export const LOCALE_LABEL: Record<Locale, string> = {
  zh: '中文',
  ja: '日本語',
  en: 'English',
};

/** 语言切换器上显示的短标记 */
export const LOCALE_SHORT: Record<Locale, string> = {
  zh: 'ZH',
  ja: 'JA',
  en: 'EN',
};

export const SITE = {
  name: '月華社',
  nameLatin: 'GEKKA SOUND',
  /** 上线后替换为真实地址；本地构建时由 astro.config.mjs 的 site 覆盖 */
  url: 'https://gekka.saiba.moe',
  /**
   * 社团正式 slogan（中文版为准）。
   * ja / en 目前是暂译 —— 多语言版本已搁置，这两条没有页面在用，
   * 保留只是为了让 Locale 索引不缺键，等真要开外文版时再定稿。
   */
  tagline: {
    zh: '于虚实交融的缥缈中，探索音乐的更多可能性。',
    ja: '虚実の交じり合う朧げな中で、音楽のさらなる可能性を探る',
    en: 'Exploring the further possibilities of music, amid the ethereal where reality and illusion intertwine.',
  },
  description: {
    zh: '月華社是一个同人音乐社团，目前涉足有原创、东方Project、蔚蓝档案等IP的同人音乐创作。',
    ja: '月華社は同人音楽サークルです。オリジナル楽曲と東方 Project のアレンジを制作しています。',
    en: 'Gekka Sound is a doujin music circle producing original works and Touhou Project arrangements.',
  },
} as const;

export interface NavItem {
  key: string;
  href: string;
  label: Record<Locale, string>;
  /** 动态（news）仅中文站提供，外文导航里隐藏 */
  zhOnly?: boolean;
}

export const NAV: NavItem[] = [
  { key: 'albums', href: '/albums', label: { zh: '专辑', ja: '作品', en: 'Albums' } },
  { key: 'tracks', href: '/tracks', label: { zh: '曲目库', ja: '楽曲', en: 'Tracks' } },
  { key: 'journal', href: '/blog', label: { zh: '杂谈', ja: '雑記', en: 'Journal' } },
  {
    key: 'news',
    href: '/news',
    label: { zh: '动态', ja: 'お知らせ', en: 'News' },
    zhOnly: true,
  },
  // 社团简介 / 成员 / 转载规约合并为「关于」一页（见 DESIGN §21）。
  // 与其各占一个栏目、每页都很薄，不如让「关于这个社团」的所有信息待在一处。
  { key: 'about', href: '/about', label: { zh: '关于', ja: '概要', en: 'About' } },
  { key: 'contact', href: '/contact', label: { zh: '联系', ja: 'お問い合わせ', en: 'Contact' } },
];

/**
 * 社媒账号与群组**不在这里** —— 它们是内容（改得比导航勤），走内容集合 `links`：
 * `src/content/links/*.md`，一个平台一个文件。
 * `/about#links` 与页脚「Elsewhere」消费的是同一份，见 lib/links.ts。
 *
 * 这里原先有一个 href 全空的 `SOCIAL` 数组占位（页脚因此一直显示「待补充」）。
 * 已删除：同一件事有第二个来源，迟早两处对不上。
 */

/** 拼资源路径，兼容「自定义子域（/）」与「子路径（/gekka/）」两种部署 */
export function asset(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** 本地化链接：默认语言挂根路径，其余挂 /ja/ /en/ 前缀 */
export function localePath(locale: Locale, path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const clean = path.startsWith('/') ? path : `/${path}`;
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  const full = `${prefix}${clean}`.replace(/\/{2,}/g, '/');
  return `${base}${full === '/' ? '' : full}` || '/';
}
