(function () {
  if (window.__CODEX_FX__) return;
  window.__CODEX_FX__ = true;

  var AUDIO_URL = "https://codex-theta-two.vercel.app/welcome-codex-v3.mp3";

  function initStars() {
    if (document.getElementById("codex-starfield")) return;

    var canvas = document.createElement("canvas");
    canvas.id = "codex-starfield";
    // Fixed overlay only — NEVER in document flow (avoids header gap)
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

    // Append at END so even a brief layout flash can't push the header down
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

  function showTapHint(onTap) {
    if (document.getElementById("codex-audio-unlock")) return;
    var btn = document.createElement("button");
    btn.id = "codex-audio-unlock";
    btn.type = "button";
    btn.textContent = "🔊 اضغط للترحيب";
    btn.setAttribute(
      "style",
      [
        "position:fixed",
        "left:16px",
        "bottom:16px",
        "z-index:99999",
        "border:1px solid rgba(255,255,255,.25)",
        "background:rgba(10,10,15,.92)",
        "color:#fff",
        "padding:10px 14px",
        "border-radius:12px",
        "font:600 13px/1.2 sans-serif",
        "cursor:pointer",
        "backdrop-filter:blur(10px)",
        "box-shadow:0 8px 30px rgba(0,0,0,.45)",
      ].join(";"),
    );
    btn.addEventListener("click", function () {
      onTap();
      btn.remove();
    });
    document.body.appendChild(btn);
    setTimeout(function () {
      if (btn.parentNode) btn.remove();
    }, 12000);
  }

  function playWelcome() {
    try {
      if (sessionStorage.getItem("codex_welcome_played") === "1") return;
      var audio = new Audio(AUDIO_URL);
      audio.preload = "auto";
      audio.volume = 1;
      var played = false;

      function go() {
        if (played) return;
        var p = audio.play();
        if (p && typeof p.then === "function") {
          p.then(function () {
            played = true;
            sessionStorage.setItem("codex_welcome_played", "1");
            var hint = document.getElementById("codex-audio-unlock");
            if (hint) hint.remove();
          }).catch(function () {
            showTapHint(go);
          });
        } else {
          played = true;
          sessionStorage.setItem("codex_welcome_played", "1");
        }
      }

      setTimeout(go, 500);
      ["pointerdown", "click", "touchstart", "keydown"].forEach(function (evt) {
        window.addEventListener(evt, go, { once: true, capture: true });
      });
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initStars();
      playWelcome();
    });
  } else {
    initStars();
    playWelcome();
  }
})();
