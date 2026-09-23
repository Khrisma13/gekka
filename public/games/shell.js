/* ==========================================================================
   月華社 · 彩蛋小游戏 · 外壳
   --------------------------------------------------------------------------
   职责只有四件事：**随机挑一个玩法 / 按需把它的资源拉进来 / 开关对话框 /
   把「公共的那几样」递给玩法**（舞台槽、页脚块、计时、提示泡）。

   玩法本身不在这里 —— 一个玩法一套文件（linkup.* / minesweeper.*）。
   这个文件也**不认识任何一个具体的玩法**：名册是从 HTML 的槽位里读出来的
   （舞台里 `<div class="egg__game" data-game="X" data-game-js=… data-game-css=…>`，
   页脚里一块 `.egg__game-foot[data-game="X"]`，页眉里一个 `.egg__title[data-game="X"]`）。
   于是「加第三个小游戏」= 在 EasterEgg.astro 里加一个槽 + 放两个文件，
   这个文件一行都不用改。

   为什么不在构建管线里（放 public/ 由 Astro 原样拷贝）：
   Astro 的 script 会被打包成 module，file:// 下被 CORS 拦（见 DESIGN §24 复制按钮那条），
   而离线预览与视觉验证走的正是 file://。详见 DESIGN §26 / §27。

   契约（写给写玩法的人）：
     window.GekkaGames[<槽位上的 data-game>] = function (ctx) { … return 句柄 }
     ctx = {
       slot   该玩法的舞台槽（把它自己的棋盘塞进来；提示泡与通关面板也在里面）
       stage  舞台本体（可用区域）：算「一格多大」量它的**宽**
       foot   该玩法的页脚块（计数与两个文字操作）
       panel  对话框本体（要按「面板里除棋盘之外占多高」算尺寸时用它）
       toast(text?)  亮一下本玩法的提示泡；给了 text 就连文案一起换
       clock  共用的计时器：start / pause / reset / text()
     }
     句柄 = { start, pause, restart, resize }（都可以缺省）
       start   面板已可见，量尺寸、接着上一局 —— 每次打开都会调
       pause   面板要收了（停表）
       restart 重新开始
       resize  视口或面板尺寸变了（只有当前可见的玩法会收到）
   ========================================================================== */

(function () {
  'use strict';

  var root = document.querySelector('[data-egg]');
  if (!root) return;

  var panel = root.querySelector('.egg__panel');

  /* --- 从样式里读时长。**按单位算**：自定义属性取回来的是「写出来的那个字符串」，
     构建时的压缩器会把 320ms 压成 .32s —— parseFloat('.32s') 是 0.32，
     当成毫秒用就差了一千倍（dev 下完全看不出来）。同 Intro.astro / linkup.js 的 msOf。 */
  function msOf(el, name, fallback) {
    var v = getComputedStyle(el).getPropertyValue(name).trim();
    var n = parseFloat(v);
    if (!isFinite(n)) return fallback;
    return v.indexOf('ms') > -1 ? n : n * 1000;
  }

  var OUT_MS = msOf(root, '--dur', 320); // 全站时长令牌：面板淡入淡出
  var SHRINK_MS = OUT_MS + 60; // 收起来要等淡出走完

  /* --- 名册（从 HTML 读，这里不列名单） ---------------------------------- */
  function ids() {
    var out = [];
    var list = root.querySelectorAll('[data-game][data-game-js]');
    for (var i = 0; i < list.length; i++) out.push(list[i].getAttribute('data-game'));
    return out;
  }

  function slotOf(id) {
    return root.querySelector('.egg__game[data-game="' + id + '"][data-game-js]');
  }

  function footOf(id) {
    return root.querySelector('.egg__game-foot[data-game="' + id + '"]');
  }

  function titleOf(id) {
    return root.querySelector('.egg__title[data-game="' + id + '"]');
  }

  /* --- 按需拉资源 ---------------------------------------------------------
     第一次触发才下载，而且只下载**被挑中的那一个**玩法（外壳样式与外壳脚本一次）。
     失败路径留了一条：把失败的 URL 从缓存里删掉，于是再连点三下就是一次重试 ——
     彩蛋不该因为一次网络抖动就永久失效。 */
  var loaded = {};

  function pull(url, kind) {
    if (!url) return Promise.resolve();
    if (loaded[url]) return loaded[url];

    loaded[url] = new Promise(function (resolve, reject) {
      var el = document.createElement(kind === 'css' ? 'link' : 'script');
      if (kind === 'css') {
        el.rel = 'stylesheet';
        el.href = url;
      } else {
        el.src = url;
      }
      el.addEventListener('load', function () {
        resolve();
      });
      el.addEventListener('error', function () {
        delete loaded[url];
        reject(new Error('拉不到 ' + url));
      });
      document.head.appendChild(el);
    });

    return loaded[url];
  }

  function ensure(id) {
    var slot = slotOf(id);
    return Promise.all([
      pull(root.getAttribute('data-shell-css'), 'css'),
      pull(slot.getAttribute('data-game-css'), 'css'),
      pull(slot.getAttribute('data-game-js'), 'js'),
    ]);
  }

  /* --- 递给玩法的几样公共件 ---------------------------------------------- */
  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function fmt(ms) {
    var s = Math.floor(ms / 1000);
    return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
  }

  /**
   * 计时器。**两个玩法共用这一个实现** —— 「用时」是个口径，不该每个玩法各写一份
   * （起表时机仍由玩法自己决定：连连看是第一下手、扫雷是第一次翻开）。
   * 数字写进本玩法页脚里那个 [data-game-time]。
   */
  function makeClock(foot) {
    var elapsed = 0; // 已累计的毫秒（不含面板关着的那几段）
    var from = 0; // 本段计时的起点，0 表示没在走
    var timerId = 0;

    function now() {
      return from ? elapsed + (Date.now() - from) : elapsed;
    }

    function paint() {
      var el = foot && foot.querySelector('[data-game-time]');
      if (el) el.textContent = fmt(now());
    }

    return {
      start: function () {
        if (from) return;
        from = Date.now();
        timerId = setInterval(paint, 500);
        paint();
      },
      /** 停表并把这半段计入累计。关面板、通关、重开都要走这里 */
      pause: function () {
        if (!from) return;
        elapsed += Date.now() - from;
        from = 0;
        clearInterval(timerId);
        timerId = 0;
        paint();
      },
      reset: function () {
        elapsed = 0;
        from = 0;
        clearInterval(timerId);
        timerId = 0;
        paint();
      },
      text: function () {
        return fmt(now());
      },
    };
  }

  function makeToast(slot) {
    var el = slot.querySelector('.egg__toast');
    var id = 0;
    return function (text) {
      if (!el) return;
      if (text) el.textContent = text;
      el.classList.add('is-on');
      clearTimeout(id);
      id = setTimeout(function () {
        el.classList.remove('is-on');
      }, 1600);
    };
  }

  /* --- 玩法实例 ----------------------------------------------------------- */
  var handles = {};

  function mount(id) {
    if (handles[id]) return handles[id];

    var factory = window.GekkaGames && window.GekkaGames[id];
    if (!factory) {
      // 脚本拉下来了却没登记这个玩法 —— 只可能是接错了名字。别默默什么都没发生。
      if (window.console) console.error('[彩蛋] 玩法没登记：' + id);
      return null;
    }

    var slot = slotOf(id);
    var foot = footOf(id);

    handles[id] = factory({
      slot: slot,
      stage: root.querySelector('[data-egg-stage]'),
      foot: foot,
      panel: panel,
      toast: makeToast(slot),
      clock: makeClock(foot),
    }) || {};

    return handles[id];
  }

  /** 只让当前玩法的槽 / 页脚块 / 标题露出来 —— 靠 hidden，而不是给每个玩法写一条 CSS */
  function activate(id) {
    var list = root.querySelectorAll('[data-game]');
    for (var i = 0; i < list.length; i++) {
      list[i].hidden = list[i].getAttribute('data-game') !== id;
    }
    root.setAttribute('data-active', id);

    // 对话框的名字跟着换：读屏进面板时听到的是当前那个玩法的标题
    var title = titleOf(id);
    if (title && title.id) panel.setAttribute('aria-labelledby', title.id);
  }

  /* --- 开关 --------------------------------------------------------------- */
  var active = null; // 当前玩法 id
  var handle = null; // 当前玩法句柄
  var isOpen = false;
  var lastFocus = null;
  var rafId = 0;
  var seq = 0; // 「该显示谁」的序号，见 open()

  function pick() {
    var list = ids();
    return list[Math.floor(Math.random() * list.length)];
  }

  /** 让某个玩法就位：先露出它的槽，再摘 hidden，最后才让它量尺寸 */
  function bring(id) {
    activate(id);
    var h = mount(id);
    active = id;
    handle = h;
    root.hidden = false;
    if (h && h.start) h.start();
  }

  /**
   * id 省略 = 随机挑一个（触发点走的就是这条）。
   * 打开与切换**共用同一条路**：都要先 ensure 再 bring。
   *
   * ⚠ 切换那条**不能跳过 ensure**。面板第一次打开时只拉了「被挑中的那一个」玩法的资源
   * （见 ensure），所以开着面板切到另一个玩法时，它的 js/css 还没下过 —— 直接 bring 会
   * mount 到一个还没登记的玩法上，舞台上只剩下一个空槽、页脚计数也不动，症状只有一条
   * console.error，看着像「这个游戏坏了」。
   *
   * 顺序也很讲究：**先把该玩法的槽露出来，再摘 hidden 并量尺寸，最后才上 is-open**。
   * 面板在这之前是 opacity:0，量得到但看不见 —— 顺序反了的话量到的是 display:none 下的 0，
   * 棋盘会按最小格铺出来。
   */
  function open(id) {
    var want = id && slotOf(id) ? id : pick();
    if (isOpen && active === want) return;

    // 每次「该显示谁」都发一个新号：资源回来得晚的不许盖掉回来得早的
    // （连着切两下时，先发的那次 ensure 可能后 resolve）。
    var mine = ++seq;
    if (handle && handle.pause) handle.pause();

    var first = !isOpen;
    if (first) {
      isOpen = true;
      lastFocus = document.activeElement;
    }

    ensure(want)
      .then(function () {
        if (mine !== seq || !isOpen) return; // 被后来的切换或关闭顶掉了
        bring(want);
        if (!first) return;
        requestAnimationFrame(function () {
          if (isOpen) root.classList.add('is-open');
        });
        lockScroll(true);
        if (panel.focus) panel.focus();
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', onResize);
      })
      .catch(function (err) {
        if (mine !== seq) return;
        isOpen = false;
        root.hidden = true;
        if (window.console) console.error('[彩蛋] ' + err.message);
      });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    if (handle && handle.pause) handle.pause();

    root.classList.remove('is-open');
    lockScroll(false);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);

    // 等淡出走完再真正收掉；这中间又打开了就不能收
    setTimeout(function () {
      if (!isOpen) root.hidden = true;
    }, SHRINK_MS);

    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function restart() {
    if (handle && handle.restart) handle.restart();
  }

  /* --- 键盘与滚动 --------------------------------------------------------- */
  function onResize() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      if (handle && handle.resize) handle.resize();
    });
  }

  /** 锁住背后那页的滚动，并把腾出来的滚动条宽度补回去（否则整页会横着跳一下） */
  function lockScroll(on) {
    var html = document.documentElement;
    if (on) {
      var sbw = window.innerWidth - html.clientWidth;
      html.style.overflow = 'hidden';
      if (sbw > 0) html.style.paddingRight = sbw + 'px';
    } else {
      html.style.overflow = '';
      html.style.paddingRight = '';
    }
  }

  function focusables() {
    var out = [];
    var list = panel.querySelectorAll('button');
    for (var i = 0; i < list.length; i++) {
      // offsetParent 为 null = 被 hidden 收着（非当前玩法的按钮、未触发的通关面板），不进循环
      if (list[i].offsetParent !== null) out.push(list[i]);
    }
    return out;
  }

  function onKey(event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;

    var list = focusables();
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    var focused = document.activeElement;

    if (event.shiftKey && (focused === first || !panel.contains(focused))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && focused === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* --- 接上页面里的按钮 --------------------------------------------------- */
  var closers = root.querySelectorAll('[data-egg-close]');
  for (var ci = 0; ci < closers.length; ci++) closers[ci].addEventListener('click', close);

  window.GekkaEaster = { open: open, close: close, restart: restart };
})();
