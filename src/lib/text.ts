/**
 * 文本处理小工具 —— 与具体内容类型无关，谁都能用。
 *
 * 原先 `excerptOf` 住在 `lib/news.ts` 里，接入杂谈（`lib/posts.ts`）时发现
 * 两边都要「从正文抽一段摘要」，于是搬到这里 —— 摘要口径只留一份，
 * 免得动态与杂谈的摘要规则悄悄分叉。
 */

/**
 * 摘要：取正文第一段，剥掉 Markdown 记号，压成一行纯文本。
 * 首页与列表页不渲染正文 HTML，只显示这一行。
 *
 * 只取**第一段**而不是前 N 个字符：作者写正文时的第一段天然就是引子，
 * 从中间硬切会切出半句话。超长（> max）才截断。
 */
export function excerptOf(markdown: string | undefined, max = 96): string {
  if (!markdown) return '';
  const first = markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find(Boolean);
  if (!first) return '';

  const text = stripMarkdown(first);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * 整篇正文压成一行纯文本 —— 站内搜索的检索串用。
 *
 * 与 `excerptOf` 共用同一套剥记号规则（stripMarkdown），差别只有两点：
 * 不截断、也不只取首段。**只用于检索，不用于显示** ——
 * 换行必须压掉：检索串里多一个换行，跨行的词就搜不到了。
 */
export function plainTextOf(markdown: string | undefined): string {
  return markdown ? stripMarkdown(markdown) : '';
}

/**
 * Markdown 记号剥离。
 * 只服务「一行摘要」这一个用途，所以不追求完备 —— 宁可留下个别记号，
 * 也不要为了完美解析引入一个解析器。
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ') // 围栏代码块
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接只留文字
    .replace(/<[^>]+>/g, ' ') // 行内 HTML（正文里常见 <br>）
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // 标题记号
    .replace(/^\s{0,3}>\s?/gm, '') // 引用记号
    .replace(/^\s{0,3}[-*+]\s+/gm, '') // 列表记号
    .replace(/[*_`~]/g, '') // 强调、行内代码
    .replace(/\s+/g, ' ')
    .trim();
}
