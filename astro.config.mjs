import { defineConfig } from 'astro/config';

// 部署地址与路径前缀集中在这里，便于在「自定义子域」与「子路径」两种方案间切换。
//
//   D1 主方案：https://gekka.saiba.moe      -> SITE_URL 默认值，base 为 '/'
//   D1 备用方案：https://saiba.moe/gekka    -> 构建时设 SITE_BASE=/gekka 即可
//
// 切换方式（GitHub Actions 里改环境变量，或本地临时构建）：
//   SITE_BASE=/gekka npm run build
const base = process.env.SITE_BASE ?? '/';
const site = process.env.SITE_URL ?? 'https://gekka.saiba.moe';

export default defineConfig({
  site,
  base,

  // 目录式输出：/albums/GKCD-001/ -> index.html，静态托管友好
  build: {
    format: 'directory',
    // 全站 CSS 内联进 HTML。站点体量小，省一次请求、首屏更快，
    // 同时让导出的样张页可以脱离服务器直接打开。
    inlineStylesheets: 'always',
    assets: '_assets',
  },

  // 三语：简体中文为默认语言，挂在根路径；日文 / 英文挂子路径
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'ja', 'en'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },

  devToolbar: { enabled: false },
});
