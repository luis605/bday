(function () {
  const app = document.getElementById("app");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    data: null,
    sessionId: null,
    flow: [],
    cleanup: null,
  };

  function h(tag, props, ...kids) {
    const node = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value === false || value == null) continue;
        if (key === "class") node.className = value;
        else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value === true ? "" : value);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return node;
  }

  function fmt(text, extra) {
    const meta = state.data.meta;
    let out = String(text)
      .replaceAll("{name}", meta.herName)
      .replaceAll("{me}", meta.myName);
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        out = out.replaceAll(`{${key}}`, value);
      }
    }
    return out;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function newSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  async function api(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  function show(node, cleanup) {
    if (state.cleanup) state.cleanup();
    state.cleanup = cleanup || null;
    app.replaceChildren(node);
    window.scrollTo({ top: 0 });
  }

  function buildFlow() {
    const flow = [];
    for (const section of state.data.sections) {
      for (const question of section.questions) {
        flow.push({ section, question });
      }
    }
    return flow;
  }

  function progressBar(index) {
    return h(
      "div",
      { class: "progress", "aria-hidden": "true" },
      state.flow.map((_, i) => h("div", { class: "seg" + (i < index ? " done" : i === index ? " now" : "") })),
    );
  }

  function whatsappLink(label) {
    const meta = state.data.meta;
    const number = String(meta.whatsappNumber || "").replace(/\D/g, "");
    if (!number) return null;
    const href = `https://wa.me/${number}?text=${encodeURIComponent(fmt(meta.whatsappText))}`;
    return h(
      "a",
      { class: "brick soft link", href, target: "_blank", rel: "noopener noreferrer" },
      fmt(label || meta.whatsappLabel),
    );
  }

  function errorCard(retry) {
    const meta = state.data ? state.data.meta : null;
    const line = meta ? meta.errorLine : "Something went wrong.";
    const label = meta ? meta.retryErrorLabel : "Try again";
    show(
      h(
        "section",
        { class: "card" },
        h("p", { class: "lede" }, line),
        h("button", { class: "brick primary", type: "button", onclick: retry }, label),
      ),
    );
  }

  function introScreen() {
    const meta = state.data.meta;
    show(
      h(
        "section",
        { class: "card" },
        h("h1", null, fmt(meta.title)),
        h("p", { class: "lede" }, fmt(meta.tagline)),
        h("ol", { class: "intro-list" }, meta.intro.map((line) => h("li", null, fmt(line)))),
        h("p", { class: "notice" }, fmt(meta.saveNotice)),
        h(
          "button",
          {
            class: "brick primary",
            type: "button",
            onclick: () => {
              state.sessionId = newSessionId();
              questionScreen(0);
            },
          },
          meta.startLabel,
        ),
      ),
    );
  }

  function makeRunaway(button, yesButton, labels) {
    const ghost = h("div", { class: "ghost" });
    const labelNode = button.querySelector(".label");
    let loose = false;
    let count = 0;

    function viewport() {
      return {
        width: document.documentElement.clientWidth,
        height: window.innerHeight,
      };
    }

    function dodge(px, py) {
      if (!loose) {
        const rect = button.getBoundingClientRect();
        ghost.style.height = rect.height + "px";
        button.replaceWith(ghost);
        document.body.append(button);
        button.classList.add("loose");
        button.style.left = rect.left + "px";
        button.style.top = rect.top + "px";
        loose = true;
      }

      count += 1;
      if (labels.length) labelNode.textContent = fmt(labels[(count - 1) % labels.length]);

      const vp = viewport();
      const w = button.offsetWidth;
      const hh = button.offsetHeight;
      const yes = yesButton.getBoundingClientRect();
      let best = null;
      let bestDistance = -1;

      for (let i = 0; i < 40; i += 1) {
        const x = 8 + Math.random() * Math.max(0, vp.width - w - 16);
        const y = 8 + Math.random() * Math.max(0, vp.height - hh - 16);
        const clear =
          x > yes.right + 14 || x + w < yes.left - 14 || y > yes.bottom + 14 || y + hh < yes.top - 14;
        if (!clear) continue;
        const distance = Math.hypot(x + w / 2 - px, y + hh / 2 - py);
        if (distance > bestDistance) {
          bestDistance = distance;
          best = { x, y };
        }
      }

      if (!best) best = { x: 8, y: Math.max(8, vp.height - hh - 8) };
      button.style.left = best.x + "px";
      button.style.top = best.y + "px";
    }

    function center() {
      const r = button.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function onMove(event) {
      if (event.pointerType === "touch") return;
      const c = center();
      if (Math.hypot(event.clientX - c.x, event.clientY - c.y) < 110) {
        dodge(event.clientX, event.clientY);
      }
    }

    function onPointerDown(event) {
      event.preventDefault();
      dodge(event.clientX, event.clientY);
    }

    function onTouchStart(event) {
      event.preventDefault();
      const touch = event.touches[0];
      dodge(touch ? touch.clientX : center().x, touch ? touch.clientY : center().y);
    }

    function onClick(event) {
      event.preventDefault();
      event.stopPropagation();
      const c = center();
      dodge(c.x, c.y);
    }

    function onFocus() {
      const c = center();
      dodge(c.x, c.y);
    }

    function onResize() {
      if (!loose) return;
      const vp = viewport();
      const w = button.offsetWidth;
      const hh = button.offsetHeight;
      const left = Math.min(parseFloat(button.style.left) || 0, Math.max(8, vp.width - w - 8));
      const top = Math.min(parseFloat(button.style.top) || 0, Math.max(8, vp.height - hh - 8));
      button.style.left = left + "px";
      button.style.top = top + "px";
    }

    document.addEventListener("pointermove", onMove);
    window.addEventListener("resize", onResize);
    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") dodge(event.clientX, event.clientY);
    });
    button.addEventListener("pointerdown", onPointerDown);
    button.addEventListener("touchstart", onTouchStart, { passive: false });
    button.addEventListener("click", onClick);
    button.addEventListener("focus", onFocus);

    return function cleanup() {
      document.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      button.remove();
      ghost.remove();
    };
  }

  function questionScreen(index) {
    const { section, question } = state.flow[index];
    const meta = state.data.meta;
    const isLast = index === state.flow.length - 1;
    const runawayIndex = Number.isInteger(question.runaway) ? question.runaway : null;
    const declineIndex = Number.isInteger(question.decline) ? question.decline : null;
    let locked = false;
    let runawayCleanup = null;

    const buttons = [];
    const optionsBox = h("div", { class: "options" });
    const feedback = h("div", { class: "feedback" });

    function paintReveal(result) {
      const scored = question.scored !== false;
      buttons.forEach((btn, i) => {
        btn.disabled = true;
        btn.classList.remove("soft", "primary");
        const isYou = i === result.choice;
        const isTruth = scored && i === result.luisPick;
        const chips = [];
        if (isYou) chips.push(h("span", { class: "chip" }, "You"));
        if (isTruth && fmt(section.chipLabel)) chips.push(h("span", { class: "chip" }, fmt(section.chipLabel)));
        if (scored) {
          if (isYou && isTruth) btn.classList.add("match");
          else if (isYou) btn.classList.add("you");
          else if (isTruth) btn.classList.add("truth");
          else btn.classList.add("dim");
        } else if (!isYou) {
          btn.classList.add("dim");
        } else {
          btn.classList.add("you");
        }
        if (chips.length) btn.append(h("span", { class: "chips" }, chips));
      });
    }

    function reactionFor(result) {
      if (question.scored === false) {
        const list = question.reactions || [];
        return list[result.choice] ? fmt(list[result.choice]) : "";
      }
      return result.match ? pick(meta.matchReactions) : pick(meta.missReactions);
    }

    async function choose(choice) {
      if (locked) return;
      locked = true;
      buttons.forEach((btn) => {
        btn.disabled = true;
      });
      feedback.replaceChildren();

      let result;
      try {
        result = await api("/api/answer", {
          sessionId: state.sessionId,
          questionId: question.id,
          choice,
        });
      } catch {
        locked = false;
        buttons.forEach((btn) => {
          btn.disabled = false;
        });
        feedback.replaceChildren(
          h("p", { class: "error" }, meta.errorLine),
        );
        return;
      }

      if (runawayCleanup) {
        runawayCleanup();
        runawayCleanup = null;
      }

      paintReveal(result);

      const reaction = reactionFor(result);
      const parts = [];
      if (reaction) parts.push(h("p", { class: "reaction" }, reaction));
      if (question.share) {
        const link = whatsappLink();
        if (link && result.choice !== declineIndex) parts.push(link);
      }
      parts.push(
        h(
          "button",
          {
            class: "brick primary",
            type: "button",
            onclick: () => (isLast ? finishScreen() : questionScreen(index + 1)),
          },
          isLast ? meta.finishLabel : meta.nextLabel,
        ),
      );
      feedback.replaceChildren(...parts);
    }

    question.options.forEach((label, i) => {
      const button = h(
        "button",
        {
          class: "brick" + (declineIndex === i ? " soft" : ""),
          type: "button",
          onclick: () => choose(i),
        },
        h("span", { class: "label" }, fmt(label)),
      );
      buttons.push(button);
      optionsBox.append(button);
    });

    const card = h(
      "section",
      { class: "card" },
      progressBar(index),
      h("h2", null, fmt(section.title)),
      h("p", { class: "kicker" }, fmt(section.subtitle)),
      h("p", { class: "question" }, fmt(question.text)),
      optionsBox,
      feedback,
    );

    show(card, () => {
      if (runawayCleanup) runawayCleanup();
    });

    if (runawayIndex !== null) {
      const yesButton = buttons.find((_, i) => i !== runawayIndex);
      runawayCleanup = makeRunaway(buttons[runawayIndex], yesButton, question.dodgeLabels || []);
    }
  }

  function finishScreen() {
    const meta = state.data.meta;
    const fill = h("div", { class: "bar-fill" });
    const line = h("p", { class: "loading-line" }, fmt(meta.loadingLines[0]));
    const card = h(
      "section",
      { class: "card loading" },
      h("h2", null, fmt(meta.compatibilityLabel)),
      line,
      h("div", { class: "bar" }, fill),
    );

    let lineIndex = 0;
    const timer = setInterval(() => {
      lineIndex = (lineIndex + 1) % meta.loadingLines.length;
      line.textContent = fmt(meta.loadingLines[lineIndex]);
    }, 650);

    show(card, () => clearInterval(timer));

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fill.style.width = "100%";
      });
    });

    const minimum = new Promise((resolve) => setTimeout(resolve, reducedMotion ? 300 : 2600));
    Promise.all([api("/api/finish", { sessionId: state.sessionId }), minimum])
      .then(([result]) => resultScreen(result))
      .catch(() => errorCard(finishScreen));
  }

  function countUp(node, target) {
    if (reducedMotion) {
      node.textContent = target + "%";
      return;
    }
    const start = performance.now();
    const duration = 1700;
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      node.textContent = Math.round(eased * target) + "%";
      if (t < 1) requestAnimationFrame(frame);
      else node.textContent = target + "%";
    }
    requestAnimationFrame(frame);
  }

  function confetti() {
    if (reducedMotion) return;
    const canvas = document.getElementById("confetti");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ["#ff5fa8", "#ffd9ec", "#8c4dff", "#ffc83d", "#ffffff", "#22b07d"];
    const pieces = Array.from({ length: 150 }, (_, i) => ({
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.6,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vx: -1.5 + Math.random() * 3,
      vy: 2 + Math.random() * 3.5,
      rot: Math.random() * Math.PI * 2,
      vr: -0.2 + Math.random() * 0.4,
      color: colors[i % colors.length],
    }));
    let frames = 0;
    function tick() {
      ctx.clearRect(0, 0, width, height);
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      frames += 1;
      if (frames < 230) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, width, height);
    }
    tick();
  }

  function resultScreen(result) {
    const meta = state.data.meta;
    const percent = h("p", { class: "percent" }, "0%");

    const giftImage = h("img", {
      src: meta.giftImage,
      alt: fmt(meta.giftAlt),
    });
    giftImage.addEventListener("error", () => {
      if (!giftImage.dataset.fallback) {
        giftImage.dataset.fallback = "1";
        giftImage.src = "gift-placeholder.svg";
      }
    });

    const reveal = h(
      "div",
      { class: "gift-reveal" },
      h("h3", null, fmt(meta.giftTitle)),
      giftImage,
      h("p", { class: "gift-name" }, fmt(meta.giftName)),
      h("div", { class: "message" }, meta.birthdayMessage.map((line) => h("p", null, fmt(line)))),
      h(
        "button",
        { class: "brick soft", type: "button", onclick: () => introScreen() },
        meta.retryLabel,
      ),
    );

    const box = h(
      "div",
      { class: "gift-box" },
      h("div", { class: "gift-body" }),
      h("div", { class: "gift-ribbon-v" }),
      h("div", { class: "gift-lid" }),
      h("div", { class: "gift-bow" }),
    );

    const openButton = h(
      "button",
      {
        class: "brick primary",
        type: "button",
        onclick: () => {
          box.classList.add("open");
          openButton.classList.add("hidden");
          box.style.height = "0";
          box.style.margin = "0 auto";
          reveal.classList.add("show");
          confetti();
        },
      },
      meta.openGiftLabel,
    );

    const card = h(
      "section",
      { class: "card result" },
      h("span", { class: "pill" }, fmt(meta.compatibilityLabel)),
      percent,
      h(
        "p",
        { class: "matches" },
        fmt(meta.matchesLine, { matches: result.matches, total: result.total }),
      ),
      h("p", { class: "score-note" }, fmt(meta.scoreNote)),
      h("div", { class: "gift-stage" }, box, reveal),
      openButton,
    );

    show(card);
    countUp(percent, result.percent);
  }

  async function start() {
    try {
      const res = await fetch("questions.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(String(res.status));
      state.data = await res.json();
    } catch {
      errorCard(start);
      return;
    }
    state.flow = buildFlow();
    document.title = fmt(state.data.meta.title);
    console.log("%c" + fmt(state.data.meta.consoleMessage), "color:#ff5fa8;font-size:14px;font-weight:bold");
    introScreen();
  }

  start();
})();
