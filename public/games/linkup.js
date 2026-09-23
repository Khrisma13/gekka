/* ==========================================================================
   月華社 · 彩蛋小游戏 · 连连看
   --------------------------------------------------------------------------
   由同目录的 shell.js 在**挑中这个玩法时**才拉进来
   （触发是页脚徽记连点三下，见 components/EasterEgg.astro）。
   外壳（遮罩、对话框、页脚、通关面板、计时、提示泡）归 shell.js，
   面板骨架归那个组件，本文件只管**规则与棋盘**；样式在同目录的 linkup.css。

   · 玩法（经典连连看）：两张图案相同的牌，若能用在**至多两个折点**的折线连通、
     且折线上除两端外全是空格，就能消掉。
   · 棋盘四周刻意留一圈空位（ring）—— 折线可以绕到牌阵外面走，
     这是「两折」能成立的前提，也是判定里那个 (COLS+2)×(ROWS+2) 的来源。
   · 死局（剩下的牌一张都连不上）自动重排，不把局面卡死。
   · 时长只有一个真源：淡出与连线的节奏都从样式里**读回来**（见 msOf），
     样式与脚本不各写一个数字 —— 同 Intro.astro / BaseLayout.astro 的做法。

   为什么这个文件不在 src/ 里：Astro 的 script 会被打包成 module，file:// 下被 CORS 拦
   （见 DESIGN §24 复制按钮那条），而离线预览与视觉验证走的正是 file://。
   为什么不做成内联脚本：全站每一页都会背上这十几 KB，而它 99.9% 的访问都用不上。
   ========================================================================== */

window.GekkaGames = window.GekkaGames || {};

window.GekkaGames.linkup = function (ctx) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  /* --- 规则参数 ---------------------------------------------------------- */
  var COLS = 6; // 内圈列数
  var ROWS = 6; // 内圈行数（6×6 = 36 张 = 18 对）
  var GAP = 3; // 牌面之间留的缝（px）
  var MIN_CELL = 26; // 一格的边长下限 / 上限：小屏点得中，大屏不至于铺成一张巨毯
  var MAX_CELL = 58;
  var VIEW_PAD = 24; // 棋盘之外至少留这么多，别顶着面板边框

  /**
   * 九种图案：全部是 24×24 里的线稿（描边色取牌面文字色），不引任何图标库、
   * 也不用 emoji —— emoji 的字形由系统给，站点的极简线稿味会当场散掉。
   * 九种是算出来的：36 张 / 每种 4 张 = 每种两对，数量对得上就不会出现「落单的图案」。
   * name 是给读屏用的（牌面是图形，读屏读不到图案，只能靠这个名字）。
   */
  var SYMBOLS = [
    { name: '月', g: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>' },
    { name: '音符', g: '<circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/>' },
    {
      name: '双音符',
      g: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    },
    {
      name: '星',
      g: '<path d="M12 3.6c.8 4.6 3.8 7.6 8.4 8.4-4.6.8-7.6 3.8-8.4 8.4-.8-4.6-3.8-7.6-8.4-8.4 4.6-.8 7.6-3.8 8.4-8.4Z"/>',
    },
    {
      name: '唱片',
      g: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="5.2"/><circle cx="12" cy="12" r="1.2"/>',
    },
    { name: '播放', g: '<path d="M8.6 5.4 19 12l-10.4 6.6Z"/>' },
    { name: '声波', g: '<path d="M5.6 10v4M9.4 6.4v11.2M13.2 8.8v6.4M17 4.6v14.8"/>' },
    {
      name: '耳机',
      g: '<path d="M4.6 15.4v-2.8a7.4 7.4 0 0 1 14.8 0v2.8"/><rect x="2.8" y="13.6" width="4.2" height="6.4" rx="2.1"/><rect x="17" y="13.6" width="4.2" height="6.4" rx="2.1"/>',
    },
    {
      name: '磁带',
      g: '<rect x="3.2" y="6" width="17.6" height="12" rx="1.6"/><circle cx="9" cy="12" r="2.2"/><circle cx="15" cy="12" r="2.2"/>',
    },
  ];

  /* --- 自己那几个节点 ----------------------------------------------------- */
  var slot = ctx.slot;
  var elLeft = ctx.foot.querySelector('[data-llk-left]');
  var elDone = slot.querySelector('[data-llk-done]');
  var elDoneTime = slot.querySelector('[data-llk-done-time]');
  var elDoneHints = slot.querySelector('[data-llk-done-hints]');

  /**
   * 从样式里读时长。**按单位算**：自定义属性取回来的是「写出来的那个字符串」，
   * 构建时的压缩器会把 320ms 压成 .32s —— parseFloat('.32s') 是 0.32，
   * 当成毫秒用就差了一千倍（dev 下完全看不出来）。同 Intro.astro 里的 msOf。
   */
  function msOf(el, name, fallback) {
    var v = getComputedStyle(el).getPropertyValue(name).trim();
    var n = parseFloat(v);
    if (!isFinite(n)) return fallback;
    return v.indexOf('ms') > -1 ? n : n * 1000;
  }

  var OUT_MS = msOf(ctx.panel, '--dur', 320); // 全站时长令牌：连线淡出
  // 牌的淡出与连线的起笔在样式里，得等棋盘建出来才读得到（见 newGame）
  var FADE_MS = 320;
  var LINE_MS = 240;

  /* --- 状态 -------------------------------------------------------------- */
  var grid = []; // (ROWS+2) × (COLS+2)：0 是空位，其余是 { sym, el }
  var board = null; // 棋盘容器（每次开局重建）
  var lines = null; // 连线层（挂在棋盘里，画在牌上面）
  var sel = null; // 当前选中的格子
  var pairs = 0; // 总对数
  var left = 0; // 剩余对数
  var hints = 0; // 用了几次提示
  var cell = 40; // 当前一格多大（px）
  var begun = false; // 摇过第一张牌没有 —— 没开始就不计时
  var finished = false;
  var built = false; // 棋盘建过没有（关掉再打开要接着上一局）

  /* --- 小工具 ------------------------------------------------------------ */
  function shuffleArr(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function iconOf(sym) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + SYMBOLS[sym].g + '</svg>';
  }

  function labelOf(sym, r, c) {
    return SYMBOLS[sym].name + '，第 ' + r + ' 行第 ' + c + ' 列';
  }

  /** 重新触发一次动画：先摘类、强制重排、再挂上 —— 否则连着两次同类事件不会重播 */
  function flash(el, cls, ms) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(function () {
      el.classList.remove(cls);
    }, ms);
  }

  /* --- 布局 --------------------------------------------------------------
     一格多大是算出来的，不写媒体查询：小屏按宽度定、矮屏按高度定、大屏封顶。
     这样面板与棋盘在任何视口下都严丝合缝，也不会出现「手机上横向溢出」。 */
  function place(el) {
    var r = +el.dataset.r;
    var c = +el.dataset.c;
    var size = cell - GAP;
    el.style.left = c * cell + GAP / 2 + 'px';
    el.style.top = r * cell + GAP / 2 + 'px';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
  }

  function layout() {
    if (!board) return;

    // 面板里除棋盘之外的那部分（头 + 脚 + 内边距）先量出来，剩下的才是棋盘能用的高度。
    // 量法：面板总高 − 舞台槽的高（槽里只装棋盘，自己没有内边距）。
    // ⚠ 可用**宽**要量舞台（ctx.stage），不能量槽 —— 槽的宽就是棋盘的宽，
    // 拿它当基准就成了「用正在算的数去算自己」，实测会把格子锁死在最小档。
    var chromeH = ctx.panel.offsetHeight - slot.offsetHeight;
    var availH = window.innerHeight - chromeH - 2 * VIEW_PAD;
    var availW = ctx.stage.clientWidth;

    var s = Math.floor(Math.min(availW / (COLS + 2), availH / (ROWS + 2), MAX_CELL));
    cell = Math.max(MIN_CELL, s);

    var w = cell * (COLS + 2);
    var h = cell * (ROWS + 2);
    board.style.width = w + 'px';
    board.style.height = h + 'px';
    lines.setAttribute('width', w);
    lines.setAttribute('height', h);

    var tiles = board.querySelectorAll('.llk__tile');
    for (var i = 0; i < tiles.length; i++) place(tiles[i]);
  }

  /* --- 造牌 -------------------------------------------------------------- */
  function newGame() {
    finished = false;
    begun = false;
    sel = null;
    hints = 0;
    ctx.clock.reset();
    elDone.hidden = true;

    pairs = (COLS * ROWS) / 2;
    var each = (pairs * 2) / SYMBOLS.length; // 每种图案几张
    var pool = [];
    for (var i = 0; i < SYMBOLS.length; i++) {
      for (var k = 0; k < each; k++) pool.push(i);
    }
    shuffleArr(pool);

    grid = [];
    for (var r = 0; r < ROWS + 2; r++) {
      grid[r] = [];
      for (var c = 0; c < COLS + 2; c++) grid[r][c] = 0;
    }

    if (board && board.parentNode) board.parentNode.removeChild(board);
    board = document.createElement('div');
    board.className = 'llk';
    board.setAttribute('role', 'group');
    board.setAttribute('aria-label', '连连看棋盘');

    lines = document.createElementNS(NS, 'svg');
    lines.setAttribute('class', 'llk__lines');
    lines.setAttribute('aria-hidden', 'true');
    board.appendChild(lines);

    var n = 0;
    for (var ri = 0; ri < ROWS; ri++) {
      for (var ci = 0; ci < COLS; ci++) {
        var rr = ri + 1;
        var cc = ci + 1;
        var sym = pool[n++];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'llk__tile';
        btn.dataset.r = rr;
        btn.dataset.c = cc;
        btn.setAttribute('aria-label', labelOf(sym, rr, cc));
        btn.innerHTML = iconOf(sym);
        btn.addEventListener('click', onTile);
        board.appendChild(btn);
        grid[rr][cc] = { sym: sym, el: btn };
      }
    }

    // 棋盘插在舞台槽最前，通关面板与提示泡在它之后 —— 层级上也压在它上面
    slot.insertBefore(board, slot.firstChild);

    // 时长要等样式生效、棋盘到手才读得到（样式在 linkup.css 的 .llk 上）
    FADE_MS = msOf(board, '--llk-fade', 320);
    LINE_MS = msOf(board, '--llk-line', 240);

    left = pairs;
    paintLeft();
    layout();
  }

  function paintLeft() {
    elLeft.textContent = String(left);
  }

  /* --- 连通判定 ----------------------------------------------------------
     坐标系是含外圈的棋盘坐标：0 与 ROWS+1 / COLS+1 那两行两列永远是空的。
     这个「外圈」很关键：没有它，贴着边缘的两张牌就绕不过去，
     中间堵死时本该能连的组合会被判成连不上。 */
  function inside(r, c) {
    return r >= 0 && r < ROWS + 2 && c >= 0 && c < COLS + 2;
  }

  function empty(r, c) {
    return inside(r, c) && grid[r][c] === 0;
  }

  /** 同一行上两端之间是否全是空的（端点自身不算） */
  function hClear(r, c1, c2) {
    var a = Math.min(c1, c2);
    var b = Math.max(c1, c2);
    for (var c = a + 1; c < b; c++) if (!empty(r, c)) return false;
    return true;
  }

  function vClear(c, r1, r2) {
    var a = Math.min(r1, r2);
    var b = Math.max(r1, r2);
    for (var r = a + 1; r < b; r++) if (!empty(r, c)) return false;
    return true;
  }

  /** 至多一个折点的连线。不通返回 null，通了返回折点序列（含两端） */
  function link(a, b) {
    if (a.r === b.r && hClear(a.r, a.c, b.c)) return [a, b];
    if (a.c === b.c && vClear(a.c, a.r, b.r)) return [a, b];

    var p = { r: a.r, c: b.c };
    if (empty(p.r, p.c) && hClear(a.r, a.c, b.c) && vClear(b.c, a.r, b.r)) return [a, p, b];

    p = { r: b.r, c: a.c };
    if (empty(p.r, p.c) && vClear(a.c, a.r, b.r) && hClear(b.r, a.c, b.c)) return [a, p, b];

    return null;
  }

  /**
   * 至多两个折点：先沿 a 的四个方向走到第一个空位 q（一路都是空格），
   * 再看 q 能不能用「至多一个折点」接到 b。能走到 q 就说明 a→q 这一段是直的，
   * 加上后半段最多一个折点，总数正好不超过两个。
   */
  function findPath(a, b) {
    var direct = link(a, b);
    if (direct) return direct;

    var dirs = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    for (var d = 0; d < dirs.length; d++) {
      for (var k = 1; k < Math.max(ROWS, COLS) + 2; k++) {
        var r = a.r + dirs[d][0] * k;
        var c = a.c + dirs[d][1] * k;
        if (!empty(r, c)) break;
        var sub = link({ r: r, c: c }, b);
        if (sub) return [a].concat(sub);
      }
    }
    return null;
  }

  function cellsList() {
    var out = [];
    for (var r = 1; r <= ROWS; r++) {
      for (var c = 1; c <= COLS; c++) if (grid[r][c]) out.push({ r: r, c: c });
    }
    return out;
  }

  /** 随便找一对能连的牌；找不到返回 null（= 死局） */
  function anyPair() {
    var cells = cellsList();
    for (var i = 0; i < cells.length; i++) {
      for (var j = i + 1; j < cells.length; j++) {
        var a = cells[i];
        var b = cells[j];
        if (grid[a.r][a.c].sym !== grid[b.r][b.c].sym) continue;
        if (findPath(a, b)) return [a, b];
      }
    }
    return null;
  }

  /* --- 选中与消除 -------------------------------------------------------- */
  function tileAt(p) {
    return grid[p.r][p.c];
  }

  function select(r, c) {
    var t = grid[r][c];
    if (!t) return;
    sel = { r: r, c: c };
    t.el.classList.add('is-sel');
  }

  function unselect() {
    if (!sel) return;
    var t = tileAt(sel);
    if (t) t.el.classList.remove('is-sel');
    sel = null;
  }

  function onTile(event) {
    var btn = event.currentTarget;
    var r = +btn.dataset.r;
    var c = +btn.dataset.c;
    var t = grid[r][c];
    if (!t || finished) return;

    if (!begun) {
      begun = true;
      ctx.clock.start();
    }

    // 点同一张 = 取消选择
    if (sel && sel.r === r && sel.c === c) {
      unselect();
      return;
    }

    if (!sel) {
      select(r, c);
      return;
    }

    var first = sel;
    var firstTile = tileAt(first);

    // 图案不同：把选择挪到新点的那张上（连连看里最自然的动作）
    if (!firstTile || firstTile.sym !== t.sym) {
      unselect();
      select(r, c);
      return;
    }

    var path = findPath(first, { r: r, c: c });
    if (!path) {
      // 同图案却连不上：两张各晃一下，选择挪到新的一张
      flash(firstTile.el, 'is-blocked', 560);
      flash(t.el, 'is-blocked', 560);
      unselect();
      select(r, c);
      return;
    }

    unselect();
    take(first, { r: r, c: c }, path);
  }

  function drawLine(path) {
    var points = [];
    for (var i = 0; i < path.length; i++) {
      points.push((path[i].c + 0.5) * cell + ',' + (path[i].r + 0.5) * cell);
    }

    var pl = document.createElementNS(NS, 'polyline');
    pl.setAttribute('points', points.join(' '));
    pl.setAttribute('class', 'llk__line');
    lines.appendChild(pl);

    // 起笔：先把整条长度盖住，下一帧再放开，dashoffset 才会真的走一段
    var len = 0;
    try {
      len = pl.getTotalLength();
    } catch (err) {
      len = 0;
    }
    if (len) {
      pl.style.strokeDasharray = len + ' ' + len;
      pl.style.strokeDashoffset = len;
      requestAnimationFrame(function () {
        pl.style.strokeDashoffset = 0;
      });
    }

    setTimeout(function () {
      pl.classList.add('is-out');
    }, LINE_MS + 400);
    setTimeout(function () {
      if (pl.parentNode) pl.parentNode.removeChild(pl);
    }, LINE_MS + 400 + OUT_MS + 60);
  }

  function take(a, b, path) {
    var ta = tileAt(a);
    var tb = tileAt(b);
    if (!ta || !tb) return;

    drawLine(path);

    // 格子当场腾出来（判定必须立刻看到空位），DOM 留一会儿把淡出走完
    grid[a.r][a.c] = 0;
    grid[b.r][b.c] = 0;

    [ta, tb].forEach(function (t) {
      t.el.classList.remove('is-sel', 'is-hint', 'is-blocked');
      t.el.classList.add('is-gone');
      setTimeout(function () {
        if (t.el.parentNode) t.el.parentNode.removeChild(t.el);
      }, FADE_MS + 40);
    });

    left--;
    paintLeft();

    if (left === 0) {
      win();
      return;
    }

    // 死局检查放在动画之后：牌还没走完就重排，看着像自己点错了
    setTimeout(function () {
      if (finished || !begun) return;
      if (!anyPair()) reshuffle();
    }, FADE_MS + 60);
  }

  function win() {
    finished = true;
    ctx.clock.pause();
    elDoneTime.textContent = ctx.clock.text();
    elDoneHints.textContent = String(hints);
    elDone.hidden = false;
  }

  /**
   * 死局重排：把剩下的图案洗一遍重新分配到原位上，洗到「有解」为止。
   * 换图案会让牌面认不出来，所以顺手翻一下（.is-flip），给人一个「它变了」的信号。
   */
  function reshuffle() {
    var cells = cellsList();
    if (!cells.length) return;

    var syms = [];
    for (var i = 0; i < cells.length; i++) syms.push(grid[cells[i].r][cells[i].c].sym);

    var ok = false;
    for (var attempt = 0; attempt < 40 && !ok; attempt++) {
      shuffleArr(syms);
      for (var k = 0; k < cells.length; k++) grid[cells[k].r][cells[k].c].sym = syms[k];
      ok = !!anyPair();
    }

    unselect();
    for (var m = 0; m < cells.length; m++) {
      (function (p) {
        var t = tileAt(p);
        if (!t) return;
        t.el.innerHTML = iconOf(t.sym);
        t.el.setAttribute('aria-label', labelOf(t.sym, p.r, p.c));
        flash(t.el, 'is-flip', 420);
      })(cells[m]);
    }
    ctx.toast();
  }

  function hint() {
    if (finished) return;
    var pair = anyPair();
    if (!pair) {
      reshuffle();
      pair = anyPair();
    }
    if (!pair) return;

    hints++;
    flash(tileAt(pair[0]).el, 'is-hint', 1900);
    flash(tileAt(pair[1]).el, 'is-hint', 1900);

    if (!begun) {
      begun = true;
      ctx.clock.start();
    }
  }

  /* --- 接上本玩法自己的按钮 ----------------------------------------------- */
  var hintBtn = ctx.foot.querySelector('[data-llk-hint]');
  if (hintBtn) hintBtn.addEventListener('click', hint);

  var restartBtn = ctx.foot.querySelector('[data-llk-restart]');
  if (restartBtn) restartBtn.addEventListener('click', newGame);

  var againBtn = elDone.querySelector('[data-llk-again]');
  if (againBtn) againBtn.addEventListener('click', newGame);

  /* --- 交给外壳的句柄 ----------------------------------------------------- */
  return {
    start: function () {
      if (!built) {
        built = true;
        newGame();
        return;
      }
      // 关掉再打开要接着上一局：重排一下尺寸（面板可能换过大小）并接着计时
      layout();
      if (!finished) ctx.clock.start();
    },
    pause: function () {
      ctx.clock.pause();
    },
    restart: newGame,
    resize: layout,
  };
};
