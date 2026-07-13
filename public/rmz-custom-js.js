(function () {
  if (window.__CODEX_FX__) return;
  window.__CODEX_FX__ = true;

  // أخفِ تلميح السحب فوراً قبل تحميل المنتجات
  try {
    var early = document.createElement("style");
    early.id = "codex-swipe-hide";
    early.textContent =
      "p.swipe-hint{display:none!important;}p.swipe-hint.codex-swipe-visible{display:block!important;}";
    (document.head || document.documentElement).appendChild(early);
  } catch (e) {}

  function initStars() {
    if (document.getElementById("codex-starfield")) return;

    var canvas = document.createElement("canvas");
    canvas.id = "codex-starfield";
    function forceFixed() {
      canvas.style.setProperty("position", "fixed", "important");
      canvas.style.setProperty("top", "0", "important");
      canvas.style.setProperty("left", "0", "important");
      canvas.style.setProperty("right", "0", "important");
      canvas.style.setProperty("bottom", "0", "important");
      canvas.style.setProperty("width", "100vw", "important");
      canvas.style.setProperty("height", "100vh", "important");
      canvas.style.setProperty("margin", "0", "important");
      canvas.style.setProperty("padding", "0", "important");
      canvas.style.setProperty("border", "0", "important");
      canvas.style.setProperty("z-index", "-1", "important");
      canvas.style.setProperty("pointer-events", "none", "important");
      canvas.style.setProperty("display", "block", "important");
      canvas.style.setProperty("background", "transparent", "important");
    }
    forceFixed();
    document.body.appendChild(canvas);
    forceFixed();

    var ctx = canvas.getContext("2d");
    var stars = [];
    var mouse = { x: 0.5, y: 0.5 };
    var target = { x: 0.5, y: 0.5 };
    var COUNT = 280;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    function makeStars() {
      stars = [];
      for (var i = 0; i < COUNT; i++) {
        stars.push({
          x: Math.random(),
          y: Math.random(),
          z: Math.random() * 0.85 + 0.15,
          r: Math.random() * 2.2 + 0.6,
          a: Math.random() * 0.45 + 0.55,
          tw: Math.random() * Math.PI * 2,
        });
      }
    }
    function draw() {
      mouse.x += (target.x - mouse.x) * 0.08;
      mouse.y += (target.y - mouse.y) * 0.08;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var ox = (mouse.x - 0.5) * 70;
      var oy = (mouse.y - 0.5) * 70;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.tw += 0.025 + s.z * 0.025;
        var twinkle = 0.65 + Math.sin(s.tw) * 0.35;
        var px = s.x * canvas.width + ox * s.z;
        var py = s.y * canvas.height + oy * s.z;
        var radius = Math.max(0.8, s.r * (0.55 + s.z * 0.7));
        ctx.beginPath();
        ctx.fillStyle = "rgba(255,255,255," + Math.min(1, s.a * twinkle) + ")";
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    window.addEventListener(
      "mousemove",
      function (e) {
        target.x = e.clientX / window.innerWidth;
        target.y = e.clientY / window.innerHeight;
      },
      { passive: true },
    );
    window.addEventListener(
      "touchmove",
      function (e) {
        if (!e.touches || !e.touches[0]) return;
        target.x = e.touches[0].clientX / window.innerWidth;
        target.y = e.touches[0].clientY / window.innerHeight;
      },
      { passive: true },
    );
    window.addEventListener("resize", resize);
    resize();
    makeStars();
    draw();
  }

  function findScroller(section) {
    var scope =
      section.querySelector(".products-content") ||
      section.querySelector(".products-lazy-container") ||
      section;
    var nodes = scope.querySelectorAll("*");
    var best = null;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var style = window.getComputedStyle(el);
      var ox = style.overflowX;
      if (ox !== "auto" && ox !== "scroll") continue;
      if (!best || el.scrollWidth > best.scrollWidth) best = el;
    }
    if (best) return best;

    var flex = scope.querySelector(".flex");
    return flex || scope;
  }

  function updateSwipeHints() {
    codexDedupeSections();
    var hints = document.querySelectorAll("p.swipe-hint");
    for (var i = 0; i < hints.length; i++) {
      var hint = hints[i];
      // مخفي افتراضياً — يظهر فقط إذا السلايدر أوسع من الشاشة
      hint.style.setProperty("display", "none", "important");
      hint.classList.remove("codex-swipe-visible");

      var section = hint.closest("section");
      if (!section) continue;

      var scroller = findScroller(section);
      var needsScroll = false;

      if (scroller) {
        needsScroll = scroller.scrollWidth > scroller.clientWidth + 4;
      }

      // احتياط: صف المنتجات أعرض من الحاوية
      if (!needsScroll) {
        var content =
          section.querySelector(".products-content") ||
          section.querySelector(".products-lazy-container");
        var row =
          (content && content.querySelector(".flex")) ||
          (content && content.firstElementChild);
        if (content && row) {
          needsScroll = row.scrollWidth > content.clientWidth + 4;
        }
      }

      // احتياط أخير بعدد الكروت مقابل عرض الشاشة
      if (!needsScroll) {
        var cards = section.querySelectorAll(
          ".product-item, a[href*='/product/']",
        );
        var unique = {};
        var count = 0;
        for (var c = 0; c < cards.length; c++) {
          var key =
            cards[c].getAttribute("href") ||
            cards[c].innerText ||
            String(c);
          if (!unique[key]) {
            unique[key] = true;
            count += 1;
          }
        }
        var cardW = 280;
        var gap = 16;
        var pad = 48;
        var fit = Math.max(
          1,
          Math.floor((window.innerWidth - pad + gap) / (cardW + gap)),
        );
        needsScroll = count > fit;
      }

      if (needsScroll) {
        hint.style.setProperty("display", "block", "important");
        hint.classList.add("codex-swipe-visible");
      }
    }
  }

  function initSwipeHints() {
    updateSwipeHints();
    window.addEventListener("resize", updateSwipeHints);
    // products load lazily — recheck a few times
    var tries = 0;
    var timer = setInterval(function () {
      updateSwipeHints();
      tries += 1;
      if (tries >= 20) clearInterval(timer);
    }, 500);
    document.addEventListener("DOMContentLoaded", updateSwipeHints);
    // observe lazy containers filling in
    try {
      var mo = new MutationObserver(function () {
        updateSwipeHints();
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  function codexDedupeSections() {
    // توحيد اسم قسم الدسكورد
    var heads = document.querySelectorAll("h2, a, span, button");
    for (var i = 0; i < heads.length; i++) {
      var el = heads[i];
      if (!el.childElementCount && (el.textContent || "").trim() === "بوتات دسكورد") {
        el.textContent = "قسم الدسكورد";
      }
    }

    var seen = {};
    var sections = document.querySelectorAll("section.py-12");
    for (var s = 0; s < sections.length; s++) {
      var sec = sections[s];
      var h2 = sec.querySelector("h2");
      var title = (h2 && h2.innerText || "").trim();
      if (title === "بوتات دسكورد") {
        title = "قسم الدسكورد";
        if (h2) h2.textContent = title;
      }
      if (!title) continue;
      if (seen[title]) {
        sec.style.setProperty("display", "none", "important");
      } else {
        seen[title] = true;
        sec.style.removeProperty("display");
      }
    }
    // أخفِ كل تلميحات السحب دائماً (العرض شبكة)
    var hints = document.querySelectorAll("p.swipe-hint");
    for (var h = 0; h < hints.length; h++) {
      hints[h].style.setProperty("display", "none", "important");
    }
  }

  function boot() {
    codexDedupeSections();
    setTimeout(codexDedupeSections, 800);
    setTimeout(codexDedupeSections, 2000);
    // أزل زر الترحيب لو كان باقي من نسخة قديمة
    var oldBtn = document.getElementById("codex-audio-unlock");
    if (oldBtn) oldBtn.remove();
    initStars();
    initSwipeHints();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
