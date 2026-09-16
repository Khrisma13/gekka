---
# 「联系」页的联系方式（REQUIREMENTS §2.8 → /contact）。
# 一条入口 = 这个文件，字段说明见 src/content.config.ts（与 links 共用一套字段）。
#
# ⚠ 现在 handle 还空着，所以卡片会显示「待补充」—— 填上就自动生效，不用改代码。
#   邮箱写在 handle，例如：
#     handle: contact@example.com
#
# 邮箱刻意**不填 href**（别的入口那样写 mailto: 的做法在这里不适用）：
#   ① `mailto:` 在网页邮箱环境（Gmail / QQ 邮箱的网页版）里经常没反应，
#      而复制下来粘到哪儿都好使；
#   ② 卡片一旦有 href 就整张变成 <a>，按 LinkCard 的规则就不再渲染复制按钮 ——
#      而复制正是邮箱最需要的那个动作（手抄邮箱必错）。
label: 邮箱
handle: khrisma@qq.com
# note: 合作与委托请走这里
order: 1
---
