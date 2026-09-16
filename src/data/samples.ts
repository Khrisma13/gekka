/**
 * 样张与开发期用的示例数据。
 * 真实内容接入后（M2）删掉这个文件即可，页面不依赖它。
 * 动态、杂谈、成员都已接入内容集合（`src/content/news/`、`posts/`、`members/`），
 * 所以 sampleNews / samplePosts / sampleMembers 都已删除 ——
 * 这里只剩专辑的示例，供样张页展示卡片与曲目表的排版。
 */
import type { Album } from '../lib/types';

export const sampleAlbum: Album = {
  id: 'gkcd-001',
  catalog: 'GKCD-001',
  title: '月華抄',
  titleAlt: 'Gekka-shō',
  type: '东方Project',
  releaseDate: '2024-08-11',
  summary: '以「月」为线索串起的东方 Project 编曲集，全六曲。',
  credits: [
    { role: '编曲', name: '霜月', link: '#' },
    { role: '作词', name: '澪' },
    { role: '演唱', name: '澪' },
    { role: '插画', name: '白夜' },
    { role: '设计', name: '霜月' },
    { role: '母带', name: 'K.' },
  ],
  tracks: [
    {
      no: 1,
      title: '月華抄',
      compose: '霜月',
      duration: '4:12',
    },
    {
      no: 2,
      title: '竹取飛翔',
      original: '竹取飛翔 ～ Lunatic Princess',
      source: '东方永夜抄',
      arrange: '霜月',
      duration: '3:48',
    },
    {
      no: 3,
      title: '千年幻想郷',
      original: '千年幻想郷 ～ History of the Moon',
      source: '东方永夜抄',
      arrange: '霜月',
      lyrics: '澪',
      vocal: '澪',
      duration: '4:35',
    },
    {
      no: 4,
      title: '少女綺想曲',
      original: '少女綺想曲 ～ Dream Battle',
      source: '东方永夜抄',
      arrange: '霜月',
      duration: '3:56',
    },
    {
      no: 5,
      title: '恋色マスタースパーク',
      original: '恋色マスタースパーク',
      source: '东方永夜抄',
      arrange: '霜月',
      duration: '3:20',
    },
    {
      no: 6,
      title: '月の見えない夜に',
      compose: '霜月',
      duration: '5:02',
    },
  ],
  links: { bilibili: '#', dizzylab: '#' },
  stores: {
    dizzylab: { url: '#', inStock: true },
    booth: { url: '#', inStock: false },
  },
  tags: ['和风', '钢琴', '弦乐'],
};

export const sampleAlbums: Album[] = [
  sampleAlbum,
  {
    id: 'gkcd-002',
    catalog: 'GKCD-002',
    title: '宵闇のオルゴール',
    type: '东方Project',
    releaseDate: '2025-05-05',
    summary: '八音盒编制的幻想乡夜曲集。',
  },
  {
    id: 'gksl-001',
    catalog: 'GKSL-001',
    title: '月華社 Demo Vol.1',
    type: '原创',
    releaseDate: '2023-12-30',
    summary: '社团成立初期的三曲试作集。',
  },
  {
    id: 'gkcd-003',
    catalog: 'GKCD-003',
    title: '蒼の記憶',
    type: '蔚蓝档案',
    releaseDate: '2026-04-26',
    summary: '蔚蓝档案主题企划编曲集。',
  },
];

/* sampleMembers 已删 —— 成员现在是真实内容（内容集合 `members`，
   一人一个文件，见 src/content/members/）。样张页也改用真实数据。 */
