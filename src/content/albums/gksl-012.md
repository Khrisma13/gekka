---
# 字段说明见 src/content.config.ts。填错字段名或类型，构建会直接报错并指出是哪一项。
catalog: GKSL-012
title: REFRACT EP.(i)
# titleAlt: 日文 / 英文标题，可选
# subtitle: 副标题，显示在标题下方，可选

# 类型只能是这三个之一：原创 / 东方Project / 蔚蓝档案
# 需要新类型时，改 src/lib/types.ts 的 ALBUM_TYPES 即可（schema 与筛选顺序都从那里取）
type: 原创
releaseDate: "2026-05-04"

# 封面基准路径（不带尺寸后缀与扩展名）。三档 WebP 由 npm run covers 生成
cover: /images/albums/gksl-012/cover

summary: 应对CP32过审的mini专辑。

tags:
  - 电子音乐

credits:
  - role: 编曲
    name: Khrisma

tracks:
  - no: 1
    title: Refracted Afterimage of Endless Rain
    compose: Khrisma
    duration: 5:08
  - no: 2
    title: Starlit Midnight
    compose: Khrisma
    duration: 5:33
  - no: 3
    title: Fall in Metropolitan Sunset
    compose: Khrisma
    duration: 6:02

# 外链与购买渠道。不需要的整行删掉，不要留空值
links:
  bilibili: https://www.bilibili.com/video/BV1w4416iEFX/

# note: 只有 Bonus 这类需要特别点出的曲目才填，写在对应曲目下面
---

该专辑为非正式mini专辑，最初用于应对CP32过审。<br>
包含3首原创曲，其中第一首是BOF21的参赛曲。
