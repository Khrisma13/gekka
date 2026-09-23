/* ==========================================================================
   月華社 · 彩蛋小游戏 · 扫雷
   --------------------------------------------------------------------------
   由同目录的 shell.js 在**挑中这个玩法时**才拉进来
   （触发是页脚徽记连点三下，见 components/EasterEgg.astro）。
   外壳（遮罩、对话框、页脚、通关面板、计时、提示泡）归 shell.js，
   面板骨架归那个组件，本文件只管**规则与棋盘**；样式在同目录的 minesweeper.css。

   · 玩法（经典扫雷）：翻开格子，数字是它八邻里的雷数；踩到雷就输，
     把非雷的 71 格全部翻开就赢。
   · **首点必安全**：雷是「第一次翻开之后」才布的，而且避开那一格与它的八邻里 ——
     这样第一下一定展开一片，不会开局就炸（现代扫雷的通行做法）。
   · 外圈不算：这里是 9×9 的方阵，邻域按边界截断，与外圈那套逻辑无关（那是连连看的）。
   · **雷位留在 DOM 上**（每格的 data-mine）—— 与连连看把图案留在 DOM 上同一个用意：
     判定要用的信息不藏在闭包里，探针因此能纯黑盒地把整局走完（含赢的那条路），
     而这个彩蛋里「打开开发者工具作弊」从来不是要防的事。
   · 时长只有一个真源：计时用外壳递过来的 clock（与连连看共用一套口径）。

   为什么这个文件不在 src/ 里：Astro 的 script 会被打包成 module，file:// 下被 CORS 拦
   （见 DESIGN §24 复制按钮那条），而离线预览与视觉验证走的正是 file://。
   ========================================================================== */

window.GekkaGames = window.GekkaGames || {};

window.GekkaGames.minesweeper = function (ctx) {
  'use strict';

  /* --- 规则参数 ---------------------------------------------------------- */
  var COLS = 9;
  var ROWS = 9;
  var MINES = 10;
  var GAP = 2; // 格子之间留的缝（px）
  var MIN_CELL = 22; // 一格的边长下限 / 上限：小屏点得中，大屏不至于铺成一张巨毯
  var MAX_CELL = 46;
  var VIEW_PAD = 24; // 棋盘之外至少留这么多，别顶着面板边框
  var TOTAL = COLS * ROWS; // 81
  var SAFE = TOTAL - MINES; // 71 —— 翻开这么多就赢

  /* 24×24 线稿（与连连看同一套画法：描边取 currentColor，不引图标库、不用 emoji） */
  var FLAG_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M7 21V3.6"/><path d="M7 4.6h10.4l-3 3.4 3 3.4H7"/><path d="M4.4 21h5.2"/></svg>';
  var MINE_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="5.4"/>' +
    '<path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6' +
    'M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9"/></svg>';

  /* --- 自己那几个节点 ----------------------------------------------------- */
  var slot = ctx.slot;
  var elLeft = ctx.foot.querySelector('[data-ms-left]');
  var flagBtn = ctx.foot.querySelector('[data-ms-flag]');
  var winPanel = slot.querySelector('[data-ms-done="win"]');
  var losePanel = slot.querySelector('[data-ms-done="lose"]');

  /* --- 静态邻域：每格的八邻里（按边界截断），建一次就够 --------------------- */
  var around = [];
  (function () {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var list = [];
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            var rr = r + dr;
            var cc = c + dc;
            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
            list.push(rr * COLS + cc);
          }
        }
        around[r * COLS + c] = list;
      }
    }
  })();

  /* --- 状态 -------------------------------------------------------------- */
  var board = null;
  var cells = [];
  var mines = []; // 0 / 1
  var open = [];
  var flags = [];
  var placed = false; // 雷布下来没有（= 第一次翻开过没有）
  var begun = false; // 起表没有 —— 没开始就不计时
  var finished = false;
  var flagMode = false; // 「插旗」模式：单击就是插旗，触屏与键盘都靠它
  var flagCount = 0;
  var openCount = 0;
  var cell = 36;
  var built = false;

  /* --- 小工具 ------------------------------------------------------------ */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function mineCount(i) {
    var n = 0;
    var nb = around[i];
    for (var k = 0; k < nb.length; k++) if (mines[nb[k]]) n++;
    return n;
  }

  /**
   * 画一格。**每一次状态变化都走这里**，包括 aria-label ——
   * 格子上的信息全在视觉里（底色、数字、图标），读屏只能靠这句话。
   */
  function paint(i) {
    var el = cells[i];
    if (!el) return;
    el.className = 'ms__cell';

    var r = Math.floor(i / COLS) + 1;
    var c = (i % COLS) + 1;
    var said;

    if (open[i]) {
      el.classList.add('is-open');
      if (mines[i]) {
        el.classList.add('is-mine');
        el.innerHTML = MINE_ICON;
        said = '雷';
      } else {
        var n = mineCount(i);
        if (n) {
          el.dataset.n = n;
          el.textContent = String(n);
          said = String(n);
        } else {
          delete el.dataset.n;
          el.textContent = '';
          said = '周围没有雷';
        }
      }
    } else if (flags[i]) {
      el.classList.add('is-flag');
      el.innerHTML = FLAG_ICON;
      said = '已插旗';
    } else {
      delete el.dataset.n;
      el.textContent = '';
      said = '未翻开';
    }

    el.setAttribute('aria-label', '第 ' + r + ' 行第 ' + c + ' 列，' + said);
  }

  function paintLeft() {
    elLeft.textContent = String(MINES - flagCount);
  }

  /* --- 布局 --------------------------------------------------------------
     一格多大是算出来的，不写媒体查询：小屏按宽度定、矮屏按高度定、大屏封顶。
     格子排布交给 CSS grid（行列与缝由脚本写进行内样式），比绝对定位省一整套坐标换算。 */
  function layout() {
    if (!board) return;

    // 面板里除棋盘之外的那部分（头 + 脚 + 内边距）先量出来，剩下的才是棋盘能用的高度。
    // ⚠ 可用**宽**要量舞台（ctx.stage），不能量槽 —— 槽的宽就是棋盘的宽，
    // 拿它当基准就成了「用正在算的数去算自己」，实测会把格子锁死在最小档。
    var chromeH = ctx.panel.offsetHeight - slot.offsetHeight;
    var availH = window.innerHeight - chromeH - 2 * VIEW_PAD;
    var availW = ctx.stage.clientWidth;

    var s = Math.floor(
      Math.min(
        (availW - (COLS - 1) * GAP) / COLS,
        (availH - (ROWS - 1) * GAP) / ROWS,
        MAX_CELL,
      ),
    );
    cell = Math.max(MIN_CELL, s);

    board.style.gridTemplateColumns = 'repeat(' + COLS + ', ' + cell + 'px)';
    board.style.gap = GAP + 'px';
    board.style.setProperty('--ms-cell-size', cell + 'px');
  }

  /* --- 布雷与翻开 ---------------------------------------------------------
     雷在**第一次翻开之后**才布，且避开那一格与它的八邻里 —— 首点必安全，
     而且一定展开一片（那一片的中央是 0，会连锁翻开）。 */
  function placeMines(safe) {
    var banned = {};
    banned[safe] = 1;
    var nb = around[safe];
    for (var k = 0; k < nb.length; k++) banned[nb[k]] = 1;

    var pool = [];
    for (var i = 0; i < TOTAL; i++) if (!banned[i]) pool.push(i);
    shuffle(pool);
    for (var m = 0; m < MINES; m++) mines[pool[m]] = 1;

    // 雷位顺手写一份到 DOM 上（data-mine）—— 探针据此纯黑盒地把整局验完，
    // 包括「赢」的那条路（否则只能靠猜或者给游戏开一个测试专用接口）。
    // 这个彩蛋不防「打开开发者工具作弊」，所以这不是代价。
    for (var q = 0; q < TOTAL; q++) {
      if (mines[q]) cells[q].dataset.mine = '1';
      else delete cells[q].dataset.mine;
    }
  }

  /** 从一格开始翻开（0 会连锁摊开）。踩到雷返回 true */
  function dig(start) {
    var stack = [start];
    while (stack.length) {
      var i = stack.pop();
      if (open[i] || flags[i]) continue;
      open[i] = 1;
      openCount++;
      paint(i);

      if (mines[i]) return true;

      if (mineCount(i) === 0) {
        var nb = around[i];
        for (var k = 0; k < nb.length; k++) {
          if (!open[nb[k]] && !flags[nb[k]]) stack.push(nb[k]);
        }
      }
    }
    return false;
  }

  function begin() {
    if (begun) return;
    begun = true;
    ctx.clock.start();
  }

  function onCell(event) {
    var i = +event.currentTarget.dataset.i;
    if (finished || open[i]) return;

    // 插旗模式下单击就是插旗（触屏与键盘的唯一入口）
    if (flagMode) {
      flag(i);
      return;
    }
    if (flags[i]) return; // 插着旗的格子点不开 —— 先取消旗，这是个安全动作

    if (!placed) {
      placed = true;
      placeMines(i);
      begin();
    }

    if (dig(i)) {
      boom(i);
      return;
    }
    if (openCount === SAFE) win();
  }

  /** 插旗 / 取消旗。它是**安全动作**：任何时候都不该把局面弄炸 */
  function flag(i) {
    if (finished || open[i]) return;
    flags[i] = flags[i] ? 0 : 1;
    flagCount += flags[i] ? 1 : -1;
    paint(i);
    paintLeft();
  }

  function boom(i) {
    finished = true;
    ctx.clock.pause();
    board.classList.add('is-lost');

    // 把雷全翻出来，并把插错的旗划掉 —— 输了也要让人看清「错在哪」
    var seen = 0;
    for (var k = 0; k < TOTAL; k++) {
      if (mines[k] && !flags[k]) {
        open[k] = 1;
        paint(k);
      } else if (!mines[k] && flags[k]) {
        paint(k);
        cells[k].classList.add('is-wrong');
      }
      if (open[k] && !mines[k]) seen++;
    }
    cells[i].classList.add('is-boom');

    losePanel.querySelector('[data-ms-done-time]').textContent = ctx.clock.text();
    losePanel.querySelector('[data-ms-done-open]').textContent = String(seen);
    losePanel.hidden = false;
  }

  function win() {
    finished = true;
    ctx.clock.pause();
    winPanel.querySelector('[data-ms-done-time]').textContent = ctx.clock.text();
    winPanel.querySelector('[data-ms-done-flags]').textContent = String(flagCount);
    winPanel.hidden = false;
  }

  /* --- 插旗模式 ----------------------------------------------------------- */
  function toggleFlagMode() {
    if (finished) return;
    flagMode = !flagMode;
    board.classList.toggle('is-flagmode', flagMode);
    if (flagBtn) flagBtn.setAttribute('aria-pressed', flagMode ? 'true' : 'false');
    ctx.toast(flagMode ? '插旗模式已开启' : '插旗模式已关闭');
  }

  /* --- 开局 -------------------------------------------------------------- */
  function newGame() {
    finished = false;
    placed = false;
    begun = false;
    flagMode = false;
    flagCount = 0;
    openCount = 0;
    mines = [];
    open = [];
    flags = [];
    for (var i = 0; i < TOTAL; i++) {
      mines[i] = 0;
      open[i] = 0;
      flags[i] = 0;
    }

    ctx.clock.reset();
    winPanel.hidden = true;
    losePanel.hidden = true;
    if (flagBtn) flagBtn.setAttribute('aria-pressed', 'false');

    if (board && board.parentNode) board.parentNode.removeChild(board);
    board = document.createElement('div');
    board.className = 'ms';
    board.setAttribute('role', 'group');
    board.setAttribute('aria-label', '扫雷棋盘');

    cells = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var idx = r * COLS + c;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ms__cell';
        btn.dataset.i = idx;
        btn.addEventListener('click', onCell);
        board.appendChild(btn);
        cells[idx] = btn;
        paint(idx);
      }
    }

    // 右键插旗（桌面上的顺手操作；插旗模式是给触屏与键盘的）
    board.addEventListener('contextmenu', function (event) {
      var el = event.target && event.target.closest ? event.target.closest('.ms__cell') : null;
      if (!el || !board.contains(el)) return;
      event.preventDefault();
      flag(+el.dataset.i);
    });

    // 棋盘插在舞台槽最前，通关面板与提示泡在它之后 —— 层级上也压在它上面
    slot.insertBefore(board, slot.firstChild);

    // 雷位留在 DOM 上：探针据此纯黑盒地验完整局（见文件头的说明）
    paintLeft();
    layout();
  }

  /* --- 接上本玩法自己的按钮 ----------------------------------------------- */
  if (flagBtn) flagBtn.addEventListener('click', toggleFlagMode);

  var restartBtn = ctx.foot.querySelector('[data-ms-restart]');
  if (restartBtn) restartBtn.addEventListener('click', newGame);

  var againBtns = slot.querySelectorAll('[data-ms-again]');
  for (var a = 0; a < againBtns.length; a++) againBtns[a].addEventListener('click', newGame);

  /* --- 交给外壳的句柄 ----------------------------------------------------- */
  return {
    start: function () {
      if (!built) {
        built = true;
        newGame();
        return;
      }
      // 关掉再打开要接着上一局：重排尺寸；**只有已经起过表才接着走**
      // （扫雷的表是第一次翻开才起的，不能一打开面板就计时）
      layout();
      if (begun && !finished) ctx.clock.start();
    },
    pause: function () {
      ctx.clock.pause();
    },
    restart: newGame,
    resize: layout,
  };
};
