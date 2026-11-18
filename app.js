document.documentElement.classList.add("js");

/*
 * Все ссылки на связь — здесь. Поменять адрес можно в одном месте:
 * плитки в разметке подхватят его сами, невалидный адрес просто скроется.
 */
const LINKS = {
  telegram: "https://t.me/porngiant",
  github: "https://github.com/painhahub"
};

const isValidUrl = (value) => typeof value === "string" && /^https?:\/\//i.test(value.trim());

document.querySelectorAll("[data-link]").forEach((element) => {
  const url = LINKS[element.dataset.link];

  if (!isValidUrl(url)) {
    element.remove();
    return;
  }

  element.href = url.trim();
});

const year = document.getElementById("year");

if (year) {
  year.textContent = String(new Date().getFullYear());
}

/*
 * «Что делаю» — список раскрывающихся плиток, а не карусель.
 * Открыта одна за раз: при выборе нового направления предыдущее
 * плавно закрывается, поэтому переход читается как перелистывание,
 * а не как накопление открытых блоков.
 */
const services = document.getElementById("services");

if (services) {
  const items = Array.from(services.querySelectorAll(".service"));

  const setOpen = (item, open) => {
    item.classList.toggle("is-open", open);

    const head = item.querySelector(".service__head");

    if (head) {
      head.setAttribute("aria-expanded", String(open));
    }
  };

  items.forEach((item) => {
    const head = item.querySelector(".service__head");

    if (!head) return;

    head.addEventListener("click", () => {
      const willOpen = !item.classList.contains("is-open");

      items.forEach((other) => {
        if (other !== item) setOpen(other, false);
      });

      setOpen(item, willOpen);
    });
  });
}

/* ---------- Звёздное небо ---------- */

const skyCanvas = document.getElementById("sky");
const skyBase = document.getElementById("sky-base");

if (skyCanvas && skyBase) {
  /*
   * Два слоя вместо одного: статичное небо рисуется один раз в свой
   * canvas, а в кадре остаются только мерцающие звёзды. Раньше каждый
   * кадр копировал полноэкранную картинку — это и было основным тормозом.
   */
  const ctx = skyCanvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const backdrop = skyBase;
  const backdropCtx = skyBase.getContext("2d");

  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];
  let meteors = [];
  let asteroids = [];
  let rafId = 0;
  let lastTime = 0;
  let resizeTimer = 0;

  const rand = (min, max) => min + Math.random() * (max - min);

  /* Нормальное распределение: вокруг полосы получается естественное облако. */
  const gauss = () => {
    let u = 0;
    let v = 0;

    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();

    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  /*
   * Статичный слой: градиент неба, полоса Млечного Пути и виньетка.
   * Перерисовывается только при изменении размера окна, поэтому
   * в кадре остаётся только мерцание звёзд.
   */
  const buildBackdrop = () => {
    backdrop.width = Math.max(1, Math.floor(width * dpr));
    backdrop.height = Math.max(1, Math.floor(height * dpr));
    backdropCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sky = backdropCtx.createLinearGradient(0, 0, width * 0.3, height);
    sky.addColorStop(0, "#0B0B10");
    sky.addColorStop(0.5, "#08080B");
    sky.addColorStop(1, "#050506");
    backdropCtx.fillStyle = sky;
    backdropCtx.fillRect(0, 0, width, height);

    // Полоса идёт через экран с лёгким наклоном, как на снимке.
    const angle = -0.2;
    const dirX = Math.sin(angle);
    const dirY = -Math.cos(angle);
    const perpX = Math.cos(angle);
    const perpY = Math.sin(angle);
    const centerX = width * 0.52;
    const centerY = height * 0.46;
    const reach = Math.max(width, height) * 0.9;
    const spread = Math.min(width, height) * 0.17;

    const place = (along, offset) => ({
      x: centerX + dirX * along + perpX * offset,
      y: centerY + dirY * along + perpY * offset
    });

    // Свечение держим компактным: крупные размытые пятна давали «мыло».
    const clouds = Math.round(26 + width / 140);

    for (let i = 0; i < clouds; i += 1) {
      const point = place(gauss() * reach * 0.6, gauss() * spread * 0.45);
      const radius = rand(spread * 0.1, spread * 0.36);
      const alpha = rand(0.006, 0.02);

      const glow = backdropCtx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, radius
      );
      glow.addColorStop(0, `rgba(232, 232, 242, ${alpha})`);
      glow.addColorStop(0.55, `rgba(232, 232, 242, ${alpha * 0.45})`);
      glow.addColorStop(1, "rgba(232, 232, 242, 0)");

      backdropCtx.fillStyle = glow;
      backdropCtx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
    }

    // Зерно: плотная россыпь мелких точек — именно она делает полосу резкой.
    const grains = Math.round((width * height) / 620);

    for (let i = 0; i < grains; i += 1) {
      const point = place(gauss() * reach * 0.62, gauss() * spread * (0.45 + Math.random() * 0.75));
      const alpha = rand(0.03, 0.2);

      backdropCtx.fillStyle = `rgba(240, 240, 248, ${alpha})`;
      backdropCtx.beginPath();
      backdropCtx.arc(point.x, point.y, rand(0.3, 0.8), 0, Math.PI * 2);
      backdropCtx.fill();
    }

    // Тёмные прожилки пыли поверх свечения.
    const dust = Math.round(20 + width / 130);

    for (let i = 0; i < dust; i += 1) {
      const point = place(gauss() * reach * 0.5, gauss() * spread * 0.45);
      const radius = rand(spread * 0.08, spread * 0.3);

      const vein = backdropCtx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, radius
      );
      vein.addColorStop(0, "rgba(0, 0, 0, 0.34)");
      vein.addColorStop(1, "rgba(0, 0, 0, 0)");

      backdropCtx.fillStyle = vein;
      backdropCtx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
    }

    // Виньетка: края темнее, центр держит внимание на визитке.
    const vignette = backdropCtx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.25,
      width / 2, height / 2, Math.max(width, height) * 0.78
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.62)");

    backdropCtx.fillStyle = vignette;
    backdropCtx.fillRect(0, 0, width, height);
  };

  const buildStars = () => {
    const count = Math.round((width * height) / 3600);

    stars = Array.from({ length: count }, () => {
      const bright = Math.random() < 0.07;

      return {
        x: Math.random() * width,
        y: Math.random() * height,
        radius: bright ? rand(0.9, 1.7) : rand(0.3, 0.95),
        base: bright ? rand(0.5, 0.95) : rand(0.14, 0.5),
        phase: Math.random() * Math.PI * 2,
        speed: rand(0.9, 3.2),
        phase2: Math.random() * Math.PI * 2,
        speed2: rand(2.4, 6.5),
        flare: bright ? rand(0.1, 0.26) : rand(0.04, 0.12)
      };
    });
  };

  /*
   * Астероиды: медленные тусклые камни из нескольких граней. Идут по
   * прямой и заворачивают за край, поэтому поток не иссякает и не
   * требует пересоздания объектов в кадре.
   */
  const makeAsteroid = () => {
    const direction = Math.random() * Math.PI * 2;
    const speed = rand(5, 16);

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      dx: Math.cos(direction) * speed,
      dy: Math.sin(direction) * speed,
      size: rand(0.9, 2.2),
      alpha: rand(0.1, 0.26),
      spin: rand(-0.5, 0.5),
      angle: Math.random() * Math.PI * 2,
      chunks: Array.from({ length: 4 }, () => ({
        dx: rand(-1.7, 1.7),
        dy: rand(-1.7, 1.7),
        s: rand(0.5, 1.1)
      }))
    };
  };

  const buildAsteroids = () => {
    const count = Math.round(Math.min(6, Math.max(3, (width * height) / 420000)));

    asteroids = Array.from({ length: count }, () => makeAsteroid());
  };

  const drawAsteroids = (delta) => {
    const dt = Math.min(50, delta) / 1000;

    asteroids.forEach((rock) => {
      rock.angle += rock.spin * dt;
      rock.x += rock.dx * dt;
      rock.y += rock.dy * dt;

      // Заворот за краем: камень возвращается с противоположной стороны.
      if (rock.x < -40) rock.x = width + 40;
      if (rock.x > width + 40) rock.x = -40;
      if (rock.y < -40) rock.y = height + 40;
      if (rock.y > height + 40) rock.y = -40;

      const cos = Math.cos(rock.angle);
      const sin = Math.sin(rock.angle);

      ctx.globalAlpha = rock.alpha;

      rock.chunks.forEach((chunk) => {
        const x = rock.x + chunk.dx * cos - chunk.dy * sin;
        const y = rock.y + chunk.dx * sin + chunk.dy * cos;
        const size = chunk.s * rock.size;

        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      });

      // Ядро камня светлее граней — силуэт читается, но не бросается в глаза.
      const core = rock.size * 1.2;
      ctx.globalAlpha = Math.min(1, rock.alpha * 1.6);
      ctx.fillRect(rock.x - core / 2, rock.y - core / 2, core, core);
    });

    ctx.globalAlpha = 1;
  };

  const spawnMeteor = () => {
    // Большая часть летит слева направо, примерно треть — встречным курсом.
    const mirrored = Math.random() < 0.3;
    const angle = mirrored ? rand(1.75, 2.2) : rand(0.95, 1.4);
    const speed = rand(0.75, 1.5) * Math.max(width, height);

    meteors.push({
      x: rand(width * 0.05, width * 0.95),
      y: rand(-height * 0.15, height * 0.25),
      dx: Math.cos(angle),
      dy: Math.sin(angle),
      speed,
      length: rand(0.08, 0.2) * Math.max(width, height),
      width: rand(1, 2),
      core: rand(1.6, 2.6),
      age: 0,
      life: rand(0.8, 1.6)
    });
  };

  const drawMeteors = () => {
    meteors.forEach((meteor) => {
      const fade = Math.sin(Math.min(1, meteor.age / meteor.life) * Math.PI);
      const tailX = meteor.x - meteor.dx * meteor.length;
      const tailY = meteor.y - meteor.dy * meteor.length;

      const trail = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
      trail.addColorStop(0, `rgba(255, 255, 255, ${0.95 * fade})`);
      trail.addColorStop(0.22, `rgba(255, 255, 255, ${0.42 * fade})`);
      trail.addColorStop(0.6, `rgba(255, 255, 255, ${0.1 * fade})`);
      trail.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.strokeStyle = trail;
      ctx.lineWidth = meteor.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(meteor.x, meteor.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      // Ядро и ореол: без них след читается как простая царапина.
      const halo = meteor.core * 3;
      ctx.globalAlpha = fade * 0.22;
      ctx.fillRect(meteor.x - halo / 2, meteor.y - halo / 2, halo, halo);

      ctx.globalAlpha = fade;
      ctx.fillRect(
        meteor.x - meteor.core / 2,
        meteor.y - meteor.core / 2,
        meteor.core,
        meteor.core
      );

      ctx.globalAlpha = 1;
    });
  };

  const drawScene = (seconds, delta) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#FFFFFF";

    /*
     * Только звёзды: небо уже лежит в отдельном слое. fillRect дешевле
     * дуг со сглаживанием, а строка цвета больше не пересобирается
     * на каждую звезду — кадр стал заметно легче.
     */
    /*
     * Двойное мерцание: медленная волна плюс быстрая дрожь. Одна
     * гармоника выглядела механически, две дают живое поле.
     */
    stars.forEach((star) => {
      const slow = Math.sin(seconds * star.speed + star.phase);
      const fast = Math.sin(seconds * star.speed2 + star.phase2);
      const twinkle = 0.62 + 0.3 * slow + star.flare * fast;
      const alpha = Math.max(0.05, Math.min(1, star.base * twinkle));
      // Крупные звёзды «дышат» и размером — поле перестаёт быть статичным.
      const size = star.radius * (0.9 + 0.22 * (fast * 0.5 + 0.5));

      if (star.radius > 1.05) {
        const halo = size * 3.2;
        ctx.globalAlpha = alpha * 0.1;
        ctx.fillRect(star.x - halo, star.y - halo, halo * 2, halo * 2);
      }

      ctx.globalAlpha = alpha;
      ctx.fillRect(star.x - size, star.y - size, size * 2, size * 2);
    });

    ctx.globalAlpha = 1;

    drawAsteroids(delta);
    drawMeteors();
    ctx.globalCompositeOperation = "source-over";

    if (delta <= 0) return;

    /*
     * Кометы идут чаще и по несколько сразу, чтобы небо не пустовало.
     * При 30 кадрах 0.012 — примерно одна за три секунды.
     */
    if (meteors.length < 3 && Math.random() < (meteors.length ? 0.012 : 0.03)) {
      spawnMeteor();
    }

    meteors.forEach((meteor) => {
      meteor.age += delta / 1000;

      const step = (meteor.speed * delta) / 1000;
      meteor.x += meteor.dx * step;
      meteor.y += meteor.dy * step;
    });

    meteors = meteors.filter((meteor) => meteor.age < meteor.life);
  };

  /*
   * 30 кадров вместо 60: мерцание звёзд от этого не страдает,
   * а работы вдвое меньше.
   */
  const FRAME = 1000 / 30;

  const loop = (time) => {
    rafId = window.requestAnimationFrame(loop);

    if (lastTime && time - lastTime < FRAME) return;

    const delta = lastTime ? Math.min(80, time - lastTime) : 16;
    lastTime = time;

    drawScene(time / 1000, delta);
  };

  const stop = () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  const start = () => {
    stop();
    lastTime = 0;

    if (reduceMotion.matches) {
      // При отключённой анимации небо остаётся, но замирает.
      drawScene(0, 0);
      return;
    }

    rafId = window.requestAnimationFrame(loop);
  };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;

    skyCanvas.width = Math.max(1, Math.floor(width * dpr));
    skyCanvas.height = Math.max(1, Math.floor(height * dpr));

    buildBackdrop();
    buildStars();
    buildAsteroids();

    if (reduceMotion.matches) drawScene(0, 0);
  };

  resize();
  start();

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 160);
  });

  reduceMotion.addEventListener("change", start);

  // Скрытая вкладка не жжёт батарею.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
      return;
    }

    start();
  });
}

/* ---------- Боковые зоны: навигация, часы, консоль ---------- */

const railLinks = Array.from(document.querySelectorAll(".rail__link"));

if (railLinks.length && "IntersectionObserver" in window) {
  const targets = railLinks
    .map((link) => {
      const id = link.getAttribute("href");
      const section = id && id.startsWith("#") ? document.querySelector(id) : null;

      return section ? { link, section } : null;
    })
    .filter(Boolean);

  if (targets.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const current = targets.find((item) => item.section === entry.target);

          if (!current) return;

          targets.forEach((item) => {
            item.link.classList.toggle("is-active", item === current);
          });
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );

    targets.forEach((item) => observer.observe(item.section));
  }
}

/*
 * Часы в углу: локальное время посетителя.
 * Обновляем раз в полминуты — чаще нет смысла, показываются минуты.
 */
const astroDate = document.getElementById("astro-date");
const astroTime = document.getElementById("astro-time");

if (astroDate && astroTime) {
  const pad = (value) => String(value).padStart(2, "0");

  const renderClock = () => {
    const now = new Date();

    astroDate.textContent = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
    astroTime.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  renderClock();
  window.setInterval(renderClock, 30000);
}

/*
 * Консоль в правой колонке: короткий цикл команд.
 * Строки набираются посимвольно, чтобы блок выглядел живым,
 * а не статичной картинкой.
 */
const term = document.getElementById("term");

if (term) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const termScript = [
    "$ python bot.py",
    "  бот запущен",
    "$ python parser.py --excel",
    "  собрано 128 позиций",
    "$ python report.py",
    "  отчёт готов"
  ];

  let line = 0;
  let char = 0;
  let buffer = "";
  let timer = 0;

  const showAll = () => {
    term.textContent = termScript.join("\n");
  };

  const tick = () => {
    if (line >= termScript.length) {
      timer = window.setTimeout(() => {
        buffer = "";
        line = 0;
        char = 0;
        term.textContent = "";
        tick();
      }, 2800);
      return;
    }

    const text = termScript[line];

    if (char < text.length) {
      buffer += text[char];
      char += 1;
      term.textContent = buffer;
      timer = window.setTimeout(tick, 42);
      return;
    }

    buffer += "\n";
    term.textContent = buffer;
    line += 1;
    char = 0;
    timer = window.setTimeout(tick, 320);
  };

  /*
   * Без анимации показываем сразу весь вывод: смысл блока не в печати,
   * а в том, какие проекты здесь бывают.
   */
  const restart = () => {
    window.clearTimeout(timer);

    buffer = "";
    line = 0;
    char = 0;
    term.textContent = "";

    if (reduceMotion.matches) {
      showAll();
      return;
    }

    tick();
  };

  restart();
  reduceMotion.addEventListener("change", restart);
}

/* ---------- Созвездие: звёзды складываются в имя ---------- */

const constellation = document.getElementById("constellation");

if (constellation && constellation.getContext) {
  const skyCtx = constellation.getContext("2d");
  const shape = document.createElement("canvas");
  const shapeCtx = shape.getContext("2d");
  const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const title = document.querySelector(".hero__title");
  const TITLE_TEXT = title ? title.textContent.trim() : "painhahaha";

  /* Небольшой сдвиг вправо: глифы рисуются чуть левее своего бокса. */
  const TITLE_SHIFT_X = 3;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let points = [];
  let progress = 0;
  let goal = 0;
  let rafId = 0;
  let lastTime = 0;
  let resizeTimer = 0;
  let titleRect = null;

  const random = (min, max) => min + Math.random() * (max - min);
  const easeOut = (value) => 1 - (1 - value) ** 3;

  /*
   * Прямоугольник именно текста, а не блока: Range даёт точные границы
   * букв, поэтому точки ложатся ровно в контур заголовка.
   * Значение кэшируется и сбрасывается при прокрутке и ресайзе.
   */
  const getTitleRect = () => {
    if (!title) return null;

    if (!titleRect) {
      const range = document.createRange();
      range.selectNodeContents(title);

      const rect = range.getBoundingClientRect();

      if (rect.width < 2 || rect.height < 2) {
        return null;
      }

      titleRect = rect;
    }

    return titleRect;
  };

  /*
   * Точки снимаются с настоящего заголовка: буфер рисуется по размеру
   * текста, а координаты нормализуются. Поэтому созвездие всегда
   * попадает ровно в буквы, каким бы ни был экран.
   */
  const buildPoints = () => {
    const rect = getTitleRect();

    if (!rect) {
      points = [];
      return;
    }

    /*
     * Контур рисуется теми же шрифтом, кеглем и трекингом, что у самого
     * заголовка, иначе звёздные буквы не совпадают с ним по размеру.
     */
    const titleStyles = title
      ? window.getComputedStyle(title)
      : { fontSize: "", fontWeight: "", fontFamily: "", letterSpacing: "" };

    const fontSize = parseFloat(titleStyles.fontSize) || rect.height * 0.8;
    const fontWeight = titleStyles.fontWeight || "600";
    const fontFamily = titleStyles.fontFamily || "system-ui, sans-serif";

    // Запас по краям: текст рисуется целиком, даже если он шире своего бокса.
    const bufferWidth = Math.max(160, Math.ceil(rect.width * 1.4));
    const bufferHeight = Math.max(60, Math.ceil(rect.height * 1.9));
    const scale = 2;

    shape.width = bufferWidth * scale;
    shape.height = bufferHeight * scale;

    shapeCtx.setTransform(scale, 0, 0, scale, 0, 0);
    shapeCtx.clearRect(0, 0, bufferWidth, bufferHeight);

    shapeCtx.fillStyle = "#FFFFFF";
    shapeCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    shapeCtx.textAlign = "center";
    shapeCtx.textBaseline = "middle";

    // Трекинг из CSS: без него буквы в буфере шире настоящих.
    if ("letterSpacing" in shapeCtx && titleStyles.letterSpacing) {
      shapeCtx.letterSpacing = titleStyles.letterSpacing;
    }

    shapeCtx.fillText(TITLE_TEXT, bufferWidth / 2, bufferHeight / 2);

    const pixels = shapeCtx.getImageData(0, 0, shape.width, shape.height).data;
    const step = 3;
    const found = [];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let y = 0; y < shape.height; y += step) {
      for (let x = 0; x < shape.width; x += step) {
        if (pixels[(y * shape.width + x) * 4 + 3] > 128) {
          found.push({ x, y });

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!found.length || maxX === minX || maxY === minY) {
      points = [];
      return;
    }

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const stride = Math.max(1, Math.ceil(found.length / 1600));

    points = found
      .filter((_, index) => index % stride === 0)
      .map((point) => ({
        ux: (point.x - minX) / spanX,
        uy: (point.y - minY) / spanY,
        startX: random(0, width),
        startY: random(0, height),
        size: random(1, 2.4),
        alpha: random(0.55, 1),
        delay: random(0, 0.28)
      }));
  };

  const render = (delta) => {
    if (progress !== goal) {
      const direction = goal > progress ? 1 : -1;
      /*
       * Сборка медленнее распада: звёзды успевают прочитаться как имя,
       * а не сливаются в рывок. При «уменьшении движения» переход сразу.
       */
      const duration = prefersReduce.matches ? 1 : direction > 0 ? 820 : 700;

      progress += (direction * delta) / duration;
      progress = Math.max(0, Math.min(1, progress));

      if (Math.abs(goal - progress) < 0.01) {
        progress = goal;
      }
    }

    /*
     * Собралось — включаем настоящий шрифт. Пока идёт полёт,
     * имя остаётся звёздным, чтобы не было двух версий сразу.
     */
    if (title) {
      title.classList.toggle("is-formed", progress >= 0.85);
    }

    skyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    skyCtx.clearRect(0, 0, width, height);

    /*
     * Цвет задаётся каждый кадр: без него fillRect красит чёрным,
     * и точки просто растворяются в тёмном фоне.
     */
    skyCtx.fillStyle = "#FFFFFF";
    skyCtx.globalCompositeOperation = "lighter";

    const rect = getTitleRect();

    if (!rect || !points.length) {
      // Мерить нечего — показываем обычный текст, чтобы имя не пропало.
      if (title) {
        title.classList.add("is-formed");
      }

      return;
    }

    /*
     * К финалу сборки звёзды уходят, а на их месте проявляется
     * настоящий шрифт: две версии имени не должны спорить.
     */
    const settle = Math.max(0, Math.min(1, (progress - 0.7) / 0.3));

    points.forEach((point) => {
      // Волна: точки вступают не одновременно, а с небольшой задержкой.
      const local = Math.max(0, Math.min(1, (progress - point.delay) / (1 - point.delay)));
      const eased = easeOut(local);

      const targetX = rect.left + point.ux * rect.width + TITLE_SHIFT_X;
      const targetY = rect.top + point.uy * rect.height;

      const x = point.startX + (targetX - point.startX) * eased;
      const y = point.startY + (targetY - point.startY) * eased;

      const alpha = point.alpha * Math.min(1, eased * 1.5) * (1 - settle);

      /*
       * Одна точка — одна звезда, без личного ореола: подсветка всего
       * слоя идёт через CSS-фильтр, иначе буквы сливаются в пятно.
       * В покое слой пуст: звёзды проявляются уже в движении.
       */
      skyCtx.globalAlpha = alpha;
      skyCtx.fillRect(x, y, point.size, point.size);
    });

    skyCtx.globalAlpha = 1;
    skyCtx.globalCompositeOperation = "source-over";
  };

  /*
   * Кадры крутятся только пока идёт движение. Когда имя собрано,
   * картинка остаётся на месте, и лишняя работа прекращается.
   */
  const loop = (time) => {
    const delta = lastTime ? Math.min(64, time - lastTime) : 16;
    lastTime = time;

    render(delta);

    rafId = progress === goal ? 0 : window.requestAnimationFrame(loop);
  };

  const kick = () => {
    if (rafId) return;

    lastTime = 0;
    rafId = window.requestAnimationFrame(loop);
  };

  /* Переключает состояние: звёзды собраны в буквы или распущены. */
  const setStarred = (active) => {
    goal = active ? 1 : 0;

    if (title) {
      title.classList.toggle("is-starred", active && points.length > 0);
    }

    kick();
  };

  const setup = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;

    constellation.width = Math.floor(width * dpr);
    constellation.height = Math.floor(height * dpr);

    buildPoints();
    render(0);
  };

  setup();
  kick();

  /*
   * Собираем сразу, без задержки: белого текста на экране не бывает,
   * звёзды проявляются и слетаются в буквы с первого кадра.
   */
  setStarred(true);

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      titleRect = null;
      setup();
    }, 180);
  });

  let scrollTick = 0;

  window.addEventListener(
    "scroll",
    () => {
      titleRect = null;

      /*
       * Когда имя уже собрано, кадры не идут — после скролла его
       * нужно перерисовать один раз на новом месте.
       */
      if (progress === goal) {
        window.cancelAnimationFrame(scrollTick);
        scrollTick = window.requestAnimationFrame(() => render(0));
      }
    },
    { passive: true }
  );

  document.addEventListener("visibilitychange", () => {
    if (prefersReduce.matches) return;

    if (document.hidden) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
      return;
    }

    kick();
  });
}

/* ---------- Звёзды, закручивающиеся вокруг QR ---------- */

const swirlCanvas = document.getElementById("side-swirl");

if (swirlCanvas && swirlCanvas.getContext) {
  const swirlCtx = swirlCanvas.getContext("2d");
  const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  /*
   * Ядро сингулярности живёт в отдельном буфере: градиенты считаются
   * один раз при изменении размера, а не в каждом кадре.
   */
  const core = document.createElement("canvas");
  const coreCtx = core.getContext("2d");

  let width = 0;
  let height = 0;
  let dpr = 1;
  let radius = 0;
  let particles = [];
  let rafId = 0;
  let lastTime = 0;
  let resizeTimer = 0;
  let assembly = 0;
  let assemblyGoal = 0;

  // Картинка кода: по её прямоугольнику строится звёздный узор.
  const qrImg = swirlCanvas.parentElement
    ? swirlCanvas.parentElement.querySelector(".side__qr-img")
    : null;

  const TAU = Math.PI * 2;
  const ARMS = 3;
  const rand = (min, max) => min + Math.random() * (max - min);

  /*
   * Рукава: угол складывается из угла ветви и спирального загиба по
   * радиусу, поэтому точки ложатся в плавные ветви, а не в пыль.
   * sqrt даёт сгущение к центру — там и должно быть ярче всего.
   */
  const makeParticle = (anywhere) => {
    const arm = Math.floor(Math.random() * ARMS);
    const r = anywhere ? Math.sqrt(rand(0.04, 1)) : rand(0.94, 1);

    return {
      baseAngle: (arm / ARMS) * TAU + r * 2.6 + rand(-0.2, 0.2),
      phase: rand(0, TAU),
      radius: r,
      speed: rand(0.9, 1.1),
      fall: rand(0.011, 0.02),
      size: rand(0.8, 2.1),
      alpha: rand(0.25, 0.8)
    };
  };

  /*
   * Узор для сборки: узнаваемый QR на сетке 21×21 — три маркера по
   * углам, их рамки и разреженные модули данных. «Шум» считается по
   * формуле, а не случайно, поэтому картинка не меняется при ресайзе.
   */
  const buildQrTargets = () => {
    const canvasBox = swirlCanvas.getBoundingClientRect();
    const qrBox = qrImg ? qrImg.getBoundingClientRect() : null;

    /*
     * Узор привязан к фактическому прямоугольнику картинки, а не к
     * центру канваса: подпись под кодом смещает картинку вверх, и
     * старая привязка оставляла хвост из точек мимо QR.
     */
    const hasBox = qrBox && qrBox.width > 2 && canvasBox.width > 2;
    const size = hasBox
      ? Math.min(qrBox.width, qrBox.height)
      : Math.min(width, height) * 0.4;
    const originX = hasBox ? qrBox.left - canvasBox.left : width / 2 - size / 2;
    const originY = hasBox ? qrBox.top - canvasBox.top : height / 2 - size / 2;
    const cells = 21;
    const cell = size / cells;
    const targets = [];

    const push = (gx, gy) => {
      targets.push({
        x: originX + (gx + 0.5) * cell,
        y: originY + (gy + 0.5) * cell
      });
    };

    const finder = (ox, oy) => {
      for (let y = 0; y < 7; y += 1) {
        for (let x = 0; x < 7; x += 1) {
          const edge = x === 0 || x === 6 || y === 0 || y === 6;
          const coreCell = x >= 2 && x <= 4 && y >= 2 && y <= 4;

          if (edge || coreCell) push(ox + x, oy + y);
        }
      }
    };

    finder(0, 0);
    finder(14, 0);
    finder(0, 14);

    for (let y = 0; y < cells; y += 1) {
      for (let x = 0; x < cells; x += 1) {
        const inFinder =
          (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);

        if (inFinder) continue;
        if ((x * 7 + y * 13) % 5 < 2) push(x, y);
      }
    }

    return targets;
  };

  const build = () => {
    const count = Math.round(Math.min(220, Math.max(120, radius * 1.1)));
    const targets = buildQrTargets();

    particles = Array.from({ length: count }, (_, index) => {
      const particle = makeParticle(true);

      particle.target = targets[index % targets.length];
      particle.delay = rand(0, 0.5);

      return particle;
    });
  };

  /*
   * От ядра оставлено только затемнение под кодом: светящиеся кольца
   * читались как отдельная графика и спорили с роем. Градиент уходит
   * в ноль без видимой границы, поэтому никакого круга не видно.
   */
  const buildCore = () => {
    core.width = Math.max(1, Math.round(width * dpr));
    core.height = Math.max(1, Math.round(height * dpr));

    coreCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    coreCtx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const r = radius;

    const hole = coreCtx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.62);
    hole.addColorStop(0, "rgba(0, 0, 0, 0.9)");
    hole.addColorStop(0.5, "rgba(0, 0, 0, 0.62)");
    hole.addColorStop(0.78, "rgba(0, 0, 0, 0.22)");
    hole.addColorStop(1, "rgba(0, 0, 0, 0)");
    coreCtx.fillStyle = hole;
    coreCtx.fillRect(0, 0, width, height);
  };

  const render = (delta) => {
    swirlCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    swirlCtx.clearRect(0, 0, width, height);

    // Ядро — один drawImage из буфера вместо трёх градиентов в кадре.
    swirlCtx.drawImage(core, 0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const dt = Math.min(50, delta) / 1000;

    /*
     * Сборка в QR: 0 — рой падает в воронку, 1 — звёзды стоят узором.
     * Идём по времени, а не по доле за кадр, поэтому скорость перехода
     * не зависит от частоты кадров.
     */
    if (assembly !== assemblyGoal) {
      const direction = assemblyGoal > assembly ? 1 : -1;
      const duration = direction > 0 ? 1.15 : 0.9;

      assembly = Math.max(0, Math.min(1, assembly + (direction * dt) / duration));
    }

    swirlCtx.fillStyle = "#FFFFFF";
    swirlCtx.globalCompositeOperation = "lighter";

    particles.forEach((particle) => {
      if (dt > 0) {
        /*
         * Дифференциальное вращение: внутренние орбиты обгоняют внешние.
         * Рукава закручиваются сами, без рывков и пересборки.
         */
        particle.phase += dt * particle.speed * (0.14 + 0.3 / (particle.radius + 0.26));
        particle.radius -= dt * particle.fall;

        if (particle.radius < 0.19) {
          /*
           * Цель в узоре и задержка принадлежат самой частице, а не
           * орбите: при рождении их надо перенести, иначе точка
           * потеряет своё место в QR.
           */
          const target = particle.target;
          const delay = particle.delay;

          Object.assign(particle, makeParticle(false));

          particle.target = target;
          particle.delay = delay;
        }
      }

      /*
       * Гасим у обоих краёв: у горизонта событий и на внешней границе.
       * Поэтому рождение и гибель частицы не видны — читается только
       * плавный вток звёзд в воронку.
       */
      const fadeIn = Math.min(1, Math.max(0, (particle.radius - 0.19) / 0.24));
      const fadeOut = Math.min(1, Math.max(0, (1 - particle.radius) / 0.14));

      const angle = particle.baseAngle + particle.phase;
      const rr = particle.radius * radius;

      const spiralX = cx + Math.cos(angle) * rr;
      const spiralY = cy + Math.sin(angle) * rr;

      /*
       * Плавное слияние двух состояний: пока идёт сборка, точка летит
       * от своей орбиты к месту в узоре. Задержка у каждой своя, поэтому
       * звёзды приходят волной, а не прыгают все разом.
       */
      const local = assembly <= 0
        ? 0
        : Math.min(1, Math.max(0, (assembly - particle.delay) / (1 - particle.delay)));
      const eased = local * local * (3 - 2 * local);

      const targetX = particle.target ? particle.target.x : spiralX;
      const targetY = particle.target ? particle.target.y : spiralY;

      const x = spiralX + (targetX - spiralX) * eased;
      const y = spiralY + (targetY - spiralY) * eased;
      const size = particle.size * (0.72 + fadeIn * 0.45 + eased * 0.35);

      /*
       * В узоре точка горит ровно: гашение у центра нужно только рою,
       * иначе дальние частицы придут в буквы еле видимыми.
       */
      const spiralAlpha = particle.alpha * fadeIn * fadeOut;
      const figureAlpha = Math.min(1, particle.alpha * 1.3);

      swirlCtx.globalAlpha = spiralAlpha + (figureAlpha - spiralAlpha) * eased;
      swirlCtx.fillRect(x, y, size, size);
    });

    swirlCtx.globalAlpha = 1;
    swirlCtx.globalCompositeOperation = "source-over";
  };

  const loop = (time) => {
    const delta = lastTime ? Math.min(50, time - lastTime) : 16;
    lastTime = time;

    render(delta);
    rafId = window.requestAnimationFrame(loop);
  };

  const stop = () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  const start = () => {
    stop();

    if (!width || !height) return;

    if (prefersReduce.matches) {
      render(0);
      return;
    }

    lastTime = 0;
    rafId = window.requestAnimationFrame(loop);
  };

  /*
   * Наведение запускает сборку: рой перестаёт падать в воронку и
   * складывается в узор кода. Уход возвращает звёзды на орбиты.
   */
  const holder = swirlCanvas.parentElement;

  if (holder) {
    holder.addEventListener("pointerenter", () => {
      assemblyGoal = 1;

      if (prefersReduce.matches) {
        assembly = 1;
        render(0);
      }
    });

    holder.addEventListener("pointerleave", () => {
      assemblyGoal = 0;

      if (prefersReduce.matches) {
        assembly = 0;
        render(0);
      }
    });
  }

  const resize = () => {
    const box = swirlCanvas.getBoundingClientRect();

    if (!box.width || !box.height) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = box.width;
    height = box.height;
    radius = Math.min(width, height) / 2;

    swirlCanvas.width = Math.max(1, Math.round(width * dpr));
    swirlCanvas.height = Math.max(1, Math.round(height * dpr));

    buildCore();
    build();
    render(0);

    if (!rafId) start();
  };

  resize();

  /*
   * На телефоне курсора нет, наведение не сработает — там код
   * собирается сам, сразу после загрузки страницы.
   */
  if (window.matchMedia("(hover: none)").matches) {
    assemblyGoal = 1;

    if (prefersReduce.matches) {
      assembly = 1;
      render(0);
    }
  }

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 200);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
      return;
    }

    start();
  });
}
