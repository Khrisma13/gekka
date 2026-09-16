---
# 字段说明见 src/content.config.ts。填错字段名或类型，构建会直接报错并指出是哪一项。
catalog: GKSL-006
title: A Visit to Shanghai
# titleAlt: 日文 / 英文标题，可选
# subtitle: 副标题，显示在标题下方，可选

# 类型只能是这三个之一：原创 / 东方Project / 蔚蓝档案
# 需要新类型时，改 src/lib/types.ts 的 ALBUM_TYPES 即可（schema 与筛选顺序都从那里取）
type: 东方Project
releaseDate: "2023-08-19"

# 封面基准路径（不带尺寸后缀与扩展名）。三档 WebP 由 npm run covers 生成
cover: /images/albums/gksl-006/cover

summary: 魅知幻想博览会2023的社团场限。

tags:
  - 电子音乐
  - 东方Project

credits:
  - role: 编曲
    name: Khrisma

tracks:
  - no: 1
    title: 蒼天
    original: 広有射怪鳥事　~ Till When?
    source: 東方妖々夢　~ Perfect Cherry Blossoms
    arrange: Khrisma
    duration: 7:34
  - no: 2
    title: 514.flp
    original: ハルトマンの妖怪少女
    source: 東方地霊殿　~ Subterranean Animism
    arrange: Khrisma
    duration: 2:17
  - no: 3
    title: Fortune Kitten Rag
    original: 大吉キトゥン
    source: 東方虹龍洞　~ Unconnected Marketeers
    arrange: Khrisma
    duration: 2:20

links:
  bilibili: https://www.bilibili.com/video/BV1Ej411B7XY/

# note: 只有 Bonus 这类需要特别点出的曲目才填，写在对应曲目下面
---

魅知幻想博览会2023的社团场限。