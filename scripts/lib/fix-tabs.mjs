/**
 * 规范化 Markdown frontmatter 里的制表符缩进。
 *
 * 背景：YAML 规范禁止用 Tab 做缩进。手工编辑专辑 md 文件时，编辑器很容易把
 * 「对齐缩进」敲成 Tab（肉眼和 4 空格几乎看不出差别），而 js-yaml 读到 Tab
 * 会直接抛错 —— 报错行号还往往指向**下一行**（读完这行才判定缩进异常），
 * 排查非常坑。所以与其每次报错再手改，不如在读取/构建前统一洗掉。
 *
 * 设计要点（刻意保守，避免误伤内容）：
 *   · 只处理 frontmatter 区块（首个 `---` 到第二个 `---` 之间），正文不碰。
 *   · 只替换**行首**的 Tab（缩进位），行中间的 Tab 属于字符串内容，不动 ——
 *     那类值本就会被 scalar() 的 needsQuote 转义成 `\t`，无需干预。
 *   · 一个 Tab 展开成 4 空格。这里不追求「列对齐」，因为 YAML 的缩进语义
 *     只看层级，不看绝对列位；等宽展开后层级关系保持不变，语义等价。
 *   · 幂等：已全是空格的 frontmatter 原样返回（不产生无谓 diff）。
 *
 * 返回值：
 *   { changed, text, linesFixed }  changed=false 表示无需改动。
 * 抛错场景：
 *   找不到 frontmatter 分隔块时不抛错（可能不是专辑文件），返回 changed=false。
 */

const TAB = '\t';
const INDENT = '    '; // 4 空格，与 fetch-dizzylab.mjs 的缩进一致

/**
 * 把单行「行首连续 Tab」展开成等宽空格。行中间的内容原样保留。
 * @param {string} line
 * @returns {{ text: string, fixed: boolean }}
 */
function fixLineIndent(line) {
  const m = line.match(/^\t+/);
  if (!m) return { text: line, fixed: false };
  const tabs = m[0].length;
  const rest = line.slice(tabs);
  return { text: INDENT.repeat(tabs) + rest, fixed: true };
}

/**
 * 规范化一段完整 md 文本里的 frontmatter 缩进。
 * @param {string} text 文件全文
 * @returns {{ changed: boolean, text: string, linesFixed: number }}
 */
export function fixFrontmatterTabs(text) {
  const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n([\s\S]*)$/m);
  if (!m) return { changed: false, text, linesFixed: 0 };

  const [full, frontmatter, body] = m;
  const openLine = text.slice(0, m.index); // `---` 之前的内容（正常应为空）

  let linesFixed = 0;
  const fixedLines = frontmatter.split('\n').map((line) => {
    const r = fixLineIndent(line);
    if (r.fixed) linesFixed += 1;
    return r.text;
  });

  return {
    changed: linesFixed > 0,
    text: `${openLine}---\n${fixedLines.join('\n')}\n---\n${body}`,
    linesFixed,
  };
}
