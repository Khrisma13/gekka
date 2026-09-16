---
# 字段说明见 src/content.config.ts。填错字段名或类型，构建会直接报错并指出是哪一项。
catalog: GKSL-007
title: Sound of Kappa
titleAlt: 重庆工商大学东方同好会 × 月華社

# 类型只能是这三个之一：原创 / 东方Project / 蔚蓝档案
# 需要新类型时，改 src/lib/types.ts 的 ALBUM_TYPES 即可（schema 与筛选顺序都从那里取）
type: 东方Project
releaseDate: "2023-10-02"

# 封面基准路径（不带尺寸后缀与扩展名）。三档 WebP 由 npm run covers 生成
cover: /images/albums/gksl-007/cover

summary: 重庆工商大学东方同好会与月華社联合出品的场限。

tags:
  - 东方Project

credits:
  - role: 编曲
    name: Khrisma

tracks:
  - no: 1
    title: Kappa Sound Chip
    original: 芥川龍之介の河童
    source: 東方風神録　~ Mountain of Faith
    arrange: Khrisma
    duration: 2:56
  - no: 2
    title: "1969"
    original: "ヴォヤージュ1969"
    source: 東方永夜抄　~ Imperishable Night
    arrange: Khrisma
    duration: 4:22
  - no: 3
    title: Rainseeker set.Dune
    original: 紅楼　~ Eastern Dream...
    source: 東方紅魔郷　~ the Embodiment of Scarlet Devil
    arrange: Khrisma
    duration: 1:54

# 外链与购买渠道。不需要的整行删掉，不要留空值
links:
  bilibili: https://www.bilibili.com/video/BV1R94y1p7Ne

# note: 只有 Bonus 这类需要特别点出的曲目才填，写在对应曲目下面
---

重庆工商大学东方同好会与月華社联合出品的场限。
