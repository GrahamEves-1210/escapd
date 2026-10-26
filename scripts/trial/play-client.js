// Browser UI for the developer trial preview (play.html). Classic script,
// inlined after engine.js, whose functions are globals here. Every string that
// came from the model is inserted with textContent, never as HTML.
"use strict";
(function () {
  const KEY = "escapd-trial-preview";
  function decode(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  const data = decode(document.getElementById("trial-data").textContent.trim());
  const photos = JSON.parse(document.getElementById("trial-photos").textContent);
  const def = data.public;
  const secret = data.secret;
  const meta = data.meta || {};

  const QUIET_COPY = {
    needs_item: "Something is missing.",
    locked: "This does not open yet.",
    spent: "Nothing else here.",
    plain: "Nothing stands out.",
  };

  let session = createSession(def);
  let selected = [];
  let scene = 0;
  let fresh = new Set();
  let outlines = true;
  let labels = false;
  let startedAt = Date.now();
  let completing = false;
  let toastTimer = 0;
  const log = [];

  const $ = (id) => document.getElementById(id);
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === false || v == null) continue;
      if (k === "class") el.className = v;
      else if (k === "style") Object.assign(el.style, v);
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const hotspotById = (id) => (def.hotspots || []).find((x) => x.id === id);
  const itemById = (id) => (def.items || []).find((x) => x.id === id);
  const puzzleById = (id) => (def.puzzles || []).find((x) => x.id === id);
  const hotspotName = (hs) => (hs && (hs.name || hs.object_label || hs.id)) || "Something";
  const itemName = (id) => (itemById(id) && itemById(id).name) || id;
  const viewLabel = (index) => `view ${index + 1}`;
  const state = () => session.state;
  const requiresMet = (p) => (p.requires || []).every((r) => state().solved.includes(r));

  function availableCodePuzzle(hotspotId) {
    if (!state().revealed_hotspots.includes(hotspotId)) return null;
    return (def.puzzles || []).find((p) => p.kind === "code" && p.hotspot_id === hotspotId &&
      !state().solved.includes(p.id) && requiresMet(p)) || null;
  }

  function quietReason(hotspotId) {
    const here = (def.puzzles || []).filter((p) => p.hotspot_id === hotspotId && p.kind !== "combine");
    if (!here.length) return "plain";
    const unsolved = here.filter((p) => !state().solved.includes(p.id));
    if (!unsolved.length) return "spent";
    return unsolved.some((p) => p.kind === "use_item") ? "needs_item" : "locked";
  }

  function scenesOf(hotspotIds) {
    return [...new Set((hotspotIds || []).map((id) => hotspotById(id)).filter(Boolean).map((hs) => hs.photo_index))];
  }

  function record(action, result) {
    const what = action.type === "inspect" ? `inspect ${action.hotspot_id}`
      : action.type === "solve" ? `code ${action.puzzle_id} "${action.answer}"`
      : action.type === "use_item" ? `use ${action.item_id} on ${action.hotspot_id}`
      : `combine ${action.item_ids.join(" + ")}`;
    log.unshift(`${what} → ${result.outcome}${result.puzzle_id ? ` (${result.puzzle_id})` : ""}`);
    renderLog();
  }

  function send(action) {
    const { session: next, result } = submitAction(session, def, secret, action);
    session = next;
    record(action, result);
    if (result.outcome === "solved") {
      const elsewhere = scenesOf(result.revealed_hotspots).filter((s) => s !== scene);
      for (const s of elsewhere) fresh.add(s);
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  function render() {
    renderScene();
    renderTabs();
    renderTray();
    $("hints-used").textContent = session.hints_used ? `${session.hints_used} hint${session.hints_used === 1 ? "" : "s"}` : "";
  }

  function renderScene() {
    const photo = photos[scene];
    const plate = $("plate");
    plate.replaceChildren();
    plate.style.aspectRatio = `${photo.width} / ${photo.height}`;
    plate.style.width = `min(100%, calc(var(--plate-h) * ${photo.width / photo.height}))`;
    plate.append(h("img", { src: photo.src, alt: `View ${scene + 1}`, draggable: "false" }));
    for (const hs of def.hotspots || []) {
      if (hs.photo_index !== scene || !state().revealed_hotspots.includes(hs.id)) continue;
      const s = hs.shape || {};
      const solvedHere = (def.puzzles || []).some((p) => p.hotspot_id === hs.id) &&
        (def.puzzles || []).filter((p) => p.hotspot_id === hs.id && p.kind !== "combine").every((p) => state().solved.includes(p.id));
      plate.append(h("button", {
        class: `hotspot${outlines ? " outlined" : ""}${solvedHere ? " spent" : ""}${selected.length === 1 ? " target" : ""}`,
        style: { left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%` },
        "aria-label": hotspotName(hs),
        onclick: () => onHotspot(hs),
      }, labels ? h("span", { class: "tag" }, hotspotName(hs)) : null));
    }
  }

  function renderTabs() {
    const tabs = $("tabs");
    tabs.replaceChildren(...photos.map((photo, i) => h("button", {
      class: `tab${i === scene ? " active" : ""}`,
      "aria-label": `View ${i + 1} of ${photos.length}`,
      "aria-pressed": i === scene ? "true" : "false",
      onclick: () => goTo(i),
    }, h("img", { src: photo.src, alt: "" }), h("span", { class: "num" }, String(i + 1)), fresh.has(i) ? h("span", { class: "dot" }) : null)));
  }

  function renderTray() {
    const items = state().inventory;
    const tray = $("tray");
    const mode = $("mode");
    tray.replaceChildren(...(items.length ? items.map((id) => h("button", {
      class: `item${selected.includes(id) ? " selected" : ""}`,
      "aria-pressed": selected.includes(id) ? "true" : "false",
      onclick: () => toggleItem(id),
    }, itemName(id))) : [h("p", { class: "empty" }, "Items you find appear here.")]));

    mode.replaceChildren();
    if (selected.length === 1) {
      const item = itemById(selected[0]);
      mode.append(h("div", { class: "banner" },
        h("div", {}, h("strong", {}, `Use ${itemName(selected[0])} on…`), h("span", {}, " tap a spot in the room")),
        h("button", { class: "ghost", onclick: () => { selected = []; render(); } }, "Cancel")));
      if (item && item.description) mode.append(h("p", { class: "slip" }, item.description));
    } else if (selected.length === 2) {
      mode.append(h("div", { class: "banner" },
        h("div", {}, h("strong", {}, `${itemName(selected[0])} + ${itemName(selected[1])}`)),
        h("div", { class: "row" },
          h("button", { class: "ghost", onclick: () => { selected = []; render(); } }, "Cancel"),
          h("button", { class: "primary", onclick: combine }, "Combine"))));
    }
  }

  function renderLog() {
    $("log").replaceChildren(...log.slice(0, 40).map((line) => h("li", {}, line)));
  }

  function toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function openSheet(...children) {
    const sheet = $("sheet");
    sheet.replaceChildren(h("div", { class: "card", role: "dialog", "aria-modal": "true" }, ...children));
    sheet.classList.add("open");
    const focusable = sheet.querySelector("input, button");
    if (focusable && focusable.focus) setTimeout(() => focusable.focus(), 30);
  }
  function closeSheet() {
    $("sheet").classList.remove("open");
    $("sheet").replaceChildren();
  }

  function itemCards(ids) {
    return ids.map((id) => {
      const item = itemById(id);
      return h("div", { class: "found" }, h("span", { class: "stamp" }, "ADDED"), h("strong", {}, itemName(id)),
        item && item.description ? h("p", { class: "slip" }, item.description) : null);
    });
  }

  function resultSheet(title, result, extra) {
    if (result.completed) return complete(result);
    const revealedScenes = scenesOf(result.revealed_hotspots);
    const note = !revealedScenes.length ? null
      : revealedScenes.includes(scene) ? "Something new is visible here."
      : `Something changed in ${revealedScenes.map(viewLabel).join(", ")}.`;
    openSheet(
      h("p", { class: "stamp accent" }, "SOLVED"),
      h("h2", {}, title),
      h("p", { class: "narrative" }, result.message || ""),
      ...itemCards(result.gained_items || []),
      note ? h("p", { class: "note" }, note) : null,
      extra || null,
      h("button", { class: "primary wide", onclick: closeSheet }, "Continue"));
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  function goTo(index) {
    scene = index;
    fresh.delete(index);
    render();
  }

  function toggleItem(id) {
    if (selected.includes(id)) selected = selected.filter((x) => x !== id);
    else selected = selected.length >= 2 ? [selected[1], id] : [...selected, id];
    render();
  }

  function onHotspot(hs) {
    if (completing) return;
    if (selected.length === 1) return useItem(selected[0], hs);
    if (selected.length === 2) return toast("Combine the two items, or cancel.");
    const code = availableCodePuzzle(hs.id);
    if (code) return codeSheet(code, hs);
    inspect(hs);
  }

  function inspect(hs) {
    const result = send({ type: "inspect", hotspot_id: hs.id });
    if (result.outcome === "solved") resultSheet(hotspotName(hs), result);
    else if (result.outcome === "nothing") {
      openSheet(
        h("h2", {}, hotspotName(hs)),
        hs.description ? h("p", { class: "narrative" }, hs.description) : null,
        h("p", { class: "quiet" }, QUIET_COPY[quietReason(hs.id)]),
        h("button", { class: "primary wide", onclick: closeSheet }, "Continue"));
    } else toast(result.message || "That isn't possible yet.");
    render();
  }

  function useItem(itemId, hs) {
    const result = send({ type: "use_item", item_id: itemId, hotspot_id: hs.id });
    if (result.outcome === "solved") {
      selected = [];
      resultSheet(hotspotName(hs), result);
    } else if (result.outcome === "nothing") {
      toast("That doesn't work here.");   // stay in Use mode
    } else {
      selected = [];
      toast(result.message || "You can't do that.");
    }
    render();
  }

  function combine() {
    if (selected.length !== 2) return;
    const result = send({ type: "combine", item_ids: [selected[0], selected[1]] });
    selected = [];
    if (result.outcome === "solved") {
      const p = puzzleById(result.puzzle_id);
      resultSheet((p && p.title) || "Combined", result);
    } else if (result.outcome === "nothing") toast("These don't fit together.");
    else toast(result.message || "You can't combine those.");
    render();
  }

  function codeSheet(puzzle, hs) {
    const format = puzzle.answer_format || {};
    const input = h("input", {
      class: "code", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
      inputmode: format.kind === "digits" ? "numeric" : "text",
      maxlength: format.length || 32, placeholder: format.length ? "•".repeat(format.length) : "",
      "aria-label": puzzle.prompt || "Code",
    });
    const status = h("p", { class: "status", "aria-live": "polite" });
    const pad = h("div", { class: "padwrap" }, input);
    const submit = () => {
      const result = send({ type: "solve", puzzle_id: puzzle.id, answer: input.value });
      if (result.outcome === "wrong") {
        status.textContent = result.retry_after
          ? `${result.message} The lock rests until ${new Date(result.retry_after).toLocaleTimeString()}.`
          : result.message || "Nothing happens.";
        input.value = "";
        pad.classList.remove("shake");
        void pad.offsetWidth;
        pad.classList.add("shake");
        if (input.focus) input.focus();
      } else if (result.outcome === "solved") {
        resultSheet(puzzle.title || hotspotName(hs), result);
      } else {
        status.textContent = result.reason === "cooldown"
          ? `${result.message} (until ${new Date(result.retry_after).toLocaleTimeString()})`
          : result.message || "That doesn't work right now.";
      }
      render();
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    openSheet(
      h("p", { class: "stamp accent" }, hotspotName(hs).toUpperCase()),
      h("h2", {}, puzzle.title || "Enter the code"),
      puzzle.prompt ? h("p", { class: "narrative" }, puzzle.prompt) : null,
      pad, status,
      h("div", { class: "row" },
        h("button", { class: "ghost", onclick: closeSheet }, "Close"),
        h("button", { class: "primary", onclick: submit }, "Try code")));
  }

  function hintSheet() {
    const body = h("div", { class: "hints" });
    const footer = h("div", { class: "row" });
    const draw = (last) => {
      const shown = shownRungs(session);
      body.replaceChildren(...shown.map((text, i) => h("div", { class: "rung" }, h("span", { class: "stamp" }, `HINT ${i + 1}`), h("p", {}, text))));
      if (last && last.status !== "ok") body.append(h("p", { class: "quiet" }, last.message));
      footer.replaceChildren(h("button", { class: "ghost", onclick: closeSheet }, "Close"));
      const total = last && last.total_rungs;
      const done = last && (last.status === "no_hints" || (last.status === "rung_unavailable" && last.next_rung == null) ||
        (last.status === "ok" && last.rung >= last.total_rungs));
      if (!done) {
        footer.append(h("button", {
          class: "primary",
          onclick: () => {
            const { session: next, result } = useHint(session, def, secret, shownRungs(session).length + 1);
            session = next;
            draw(result);
            render();
          },
        }, shown.length === 0 ? "Reveal a hint" : `Reveal hint ${shown.length + 1}${total ? ` of ${total}` : ""}`));
      } else if (last && last.status === "ok") {
        body.append(h("p", { class: "quiet" }, "That is every hint for this step."));
      }
    };
    openSheet(h("p", { class: "stamp accent" }, "HINTS"), h("h2", {}, "A nudge"), body, footer);
    draw(null);
  }

  function walkthroughSheet() {
    if (!confirm("Show the full solution? This spoils the room.")) return;
    const run = walkthrough(def, secret);
    const describe = (step) => {
      const a = step.action;
      if (a.type === "inspect") {
        const hs = hotspotById(a.hotspot_id);
        return `Search ${hotspotName(hs)} (${viewLabel(hs ? hs.photo_index : 0)})`;
      }
      if (a.type === "solve") {
        const hs = hotspotById((puzzleById(a.puzzle_id) || {}).hotspot_id);
        return `Enter ${a.answer} at ${hotspotName(hs)} (${viewLabel(hs ? hs.photo_index : 0)})`;
      }
      if (a.type === "use_item") {
        const hs = hotspotById(a.hotspot_id);
        return `Use ${itemName(a.item_id)} on ${hotspotName(hs)} (${viewLabel(hs ? hs.photo_index : 0)})`;
      }
      return `Combine ${itemName(a.item_ids[0])} and ${itemName(a.item_ids[1])}`;
    };
    openSheet(
      h("p", { class: "stamp accent" }, "SOLUTION"),
      h("h2", {}, run.completed ? `${run.steps.length} steps` : "This room cannot be finished"),
      h("ol", { class: "steps" }, ...run.steps.map((s) => h("li", {}, h("strong", {}, describe(s)), h("p", {}, s.message || "")))),
      run.optional.length ? h("p", { class: "note" }, `Not needed to escape: ${run.optional.map((id) => (puzzleById(id) || {}).title || id).join(", ")}.`) : null,
      h("button", { class: "primary wide", onclick: closeSheet }, "Close"));
  }

  function infoSheet() {
    const rows = [
      ["Template", meta.template], ["Generated", meta.generatedAt], ["Mode", meta.stub ? "stub (no model calls)" : "Gemini"],
      ["Models", meta.model], ["Cost", meta.costUsd != null ? `$${Number(meta.costUsd).toFixed(4)}` : null],
      ["Time", meta.durationMs != null ? `${(meta.durationMs / 1000).toFixed(1)} s` : null],
      ["Hotspots", (def.hotspots || []).length], ["Puzzles", (def.puzzles || []).length],
      ["Actions", session.action_count], ["Wrong codes", session.wrong_answer_count], ["Hints", session.hints_used],
    ].filter((r) => r[1] != null && r[1] !== "");
    openSheet(
      h("p", { class: "stamp accent" }, "DEV PREVIEW"),
      h("h2", {}, def.title || "Generated room"),
      h("dl", { class: "info" }, ...rows.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, String(v))])),
      h("p", { class: "note" }, "This preview runs a local copy of the game engine. The phone app sends every move to the server."),
      h("button", { class: "primary wide", onclick: closeSheet }, "Close"));
  }

  function complete(result) {
    completing = true;
    closeSheet();
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    const exit = $("exit");
    exit.replaceChildren(h("div", { class: "exitcard" },
      h("p", { class: "stamp accent" }, "CASE CLOSED"),
      h("h1", {}, def.title || "Escaped"),
      h("p", { class: "narrative" }, result.message || ""),
      result.exit_message ? h("p", { class: "narrative strong" }, result.exit_message) : null,
      h("p", { class: "note" }, `${Math.floor(seconds / 60)}m ${seconds % 60}s · ${session.action_count} moves · ${session.wrong_answer_count} wrong codes · ${session.hints_used} hints`),
      h("button", { class: "primary wide", onclick: restart }, "Play again")));
    exit.classList.add("open");
  }

  function restart() {
    session = createSession(def, session);   // like the server, a new session keeps the cooldown
    selected = [];
    fresh = new Set();
    scene = 0;
    completing = false;
    startedAt = Date.now();
    log.length = 0;
    renderLog();
    $("exit").classList.remove("open");
    closeSheet();
    render();
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------
  $("title").textContent = def.title || "Generated room";
  $("intro-title").textContent = def.title || "Generated room";
  $("intro-text").textContent = def.intro || "";
  $("intro-meta").textContent = [meta.stub ? "STUB RUN" : "DEV PREVIEW", meta.template, meta.costUsd != null ? `$${Number(meta.costUsd).toFixed(3)}` : null]
    .filter(Boolean).join("  ·  ");
  $("begin").addEventListener("click", () => {
    $("intro").classList.remove("open");
    startedAt = Date.now();
  });
  $("hint").addEventListener("click", hintSheet);
  $("menu").addEventListener("click", () => openSheet(
    h("p", { class: "stamp accent" }, "OPTIONS"),
    h("div", { class: "menu" },
      h("button", { class: "ghost", onclick: () => { outlines = !outlines; closeSheet(); render(); } }, outlines ? "Hide hotspot outlines" : "Show hotspot outlines"),
      h("button", { class: "ghost", onclick: () => { labels = !labels; closeSheet(); render(); } }, labels ? "Hide hotspot labels" : "Show hotspot labels"),
      h("button", { class: "ghost", onclick: walkthroughSheet }, "Reveal solution walkthrough"),
      h("button", { class: "ghost", onclick: infoSheet }, "Generation details"),
      h("button", { class: "ghost", onclick: () => { if (confirm("Restart this room?")) restart(); } }, "Restart"),
      h("button", { class: "primary", onclick: closeSheet }, "Close"))));
  $("sheet").addEventListener("click", (e) => { if (e.target === $("sheet") && !completing) closeSheet(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
  render();
})();
