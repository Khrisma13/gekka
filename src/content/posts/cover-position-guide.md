---
# 一篇文章 = 这个文件。字段说明见 src/content.config.ts。
#
# 文件名（cover-position-guide）就是 URL 的最后一段：/blog/cover-position-guide/
#   —— 所以**不要**给它加日期前缀，改日期不该让链接失效（这点与动态不同）。
#
# tags 只能从这几个里挑（可多选）：创作手记 / 编曲思路 / 展会Repo / 器材与软件 / 杂感
#   —— 需要新标签时改 src/lib/types.ts 的 POST_TAGS。
#
# summary 是列表卡片上显示的那句话。留空则自动取正文第一段，
#   但正文首段未必适合当摘要，想清楚了写一句更好。
#
# 正文（下面 --- 之后的整段）就是文章内容，写 Markdown。
# 站内链接请写相对路径，如 [去听这张作品](../albums/GKCD-013/) ——
# 绝对路径 /albums/... 在子路径部署下会指错地方。
title: "专辑圣地巡礼指南"
date: "2026-09-16"
summary: "包含社团迄今为止所有能够确定位置的专辑封面取景地。"
tags: [创作手记]
# cover: /images/posts/xxx.webp   # 可选封面
draft: true                     # 还没写完的先标上，不会出现在线上
---

在这里写正文。第一段会被用作摘要的兜底，所以别一上来就写「本文共三节」。
