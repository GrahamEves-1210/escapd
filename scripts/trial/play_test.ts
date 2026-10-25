// Drives play.html's UI (play-client.js) through The Study in a DOM shim:
// taps, item selection, combine, use, the code pad, hints, the exit screen,
// restart, the walkthrough and labels. Catches runtime errors in the page
// script that the engine tests cannot see.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { parseHTML } from "npm:linkedom@0.18.5";
import { loadSeed } from "../../supabase/functions/_shared/test_fixtures.ts";
import { renderPlay } from "./play-html.ts";

// A 1x1 JPEG is enough: the page only needs a src and a size per view.
const PIXEL = Uint8Array.from(atob(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
), (c) => c.charCodeAt(0));

// deno-lint-ignore no-explicit-any
type El = any;

Deno.test({
  name: "play.html plays The Study end to end",
  sanitizeOps: false,       // the page's toast and focus timers outlive the test
  sanitizeResources: false,
  async fn() {
    const { publicDefinition, solution } = await loadSeed();
    const photos = [0, 1, 2].map(() => ({ bytes: PIXEL, width: 1200, height: 1600 }));
    const html = await renderPlay(publicDefinition, solution, photos, { template: "seed", stub: true });

    // linkedom's types describe a browser window; this DOM is a shim.
    const { window, document } = parseHTML(html) as unknown as { window: El; document: El };
    // deno-lint-ignore no-explicit-any
    const g = globalThis as any;
    const saved = { document: g.document, window: g.window, confirm: g.confirm, Node: g.Node };
    Object.assign(g, { document, window, confirm: () => true, Node: window.Node });
    try {
      const scripts = [...document.querySelectorAll("script")].filter((s: El) => !s.getAttribute("type")).map((s: El) => s.textContent);
      (0, eval)(`${scripts[0]}\n${scripts[1]}`);

      const $ = (sel: string): El => document.querySelector(sel);
      const click = (el: El) => {
        assert(el, "element to click is missing");
        el.dispatchEvent(new window.Event("click", { bubbles: true }));
      };
      const button = (text: string): El => [...document.querySelectorAll("button")].find((b: El) => b.textContent.trim() === text);
      const hotspot = (name: string): El => $(`#plate .hotspot[aria-label="${name}"]`);
      const item = (name: string): El => [...document.querySelectorAll("#tray .item")].find((b: El) => b.textContent === name);
      const sheet = () => $("#sheet");
      const sheetText = () => sheet().textContent;
      const isOpen = (el: El) => el.classList.contains("open");
      const tapAndContinue = (name: string, expect: string) => {
        click(hotspot(name));
        assert(isOpen(sheet()), `no sheet after tapping ${name}`);
        assertStringIncludes(sheetText(), expect);
        click(button("Continue"));
        assert(!isOpen(sheet()));
      };

      assertEquals($("#title").textContent, "The Study");
      assert(isOpen($("#intro")));
      assertStringIncludes($("#intro-text").textContent, "door clicked shut");
      click($("#begin"));
      assert(!isOpen($("#intro")));

      // View 1: inspect solves show the message and the item card.
      click(hotspot("Desk drawer"));
      assertStringIncludes(sheetText(), "SOLVED");
      assertStringIncludes(sheetText(), "Under some papers you find a brass key.");
      assertStringIncludes(sheetText(), "Small and a little tarnished.");
      click(button("Continue"));
      tapAndContinue("Bookshelf", "A torn note falls out of a book.");

      // View 2: the safe is hidden; the cabinet says something is missing.
      click($('#tabs .tab[aria-label="View 2 of 3"]'));
      assert(!hotspot("Wall safe"));
      tapAndContinue("Locked cabinet", "Something is missing.");
      tapAndContinue("Rug", "Another torn note was hidden under the rug.");

      // Combine mode.
      click(item("Torn note (left)"));
      click(item("Torn note (right)"));
      click(button("Combine"));
      assertStringIncludes(sheetText(), "The halves fit together: 0427.");
      assertStringIncludes(sheetText(), "Taped note");
      click(button("Continue"));

      // Use mode reveals the safe here.
      click(item("Brass key"));
      assertStringIncludes($("#mode").textContent, "Use Brass key on");
      click(hotspot("Locked cabinet"));
      assertStringIncludes(sheetText(), "The cabinet opens, revealing a wall safe.");
      assertStringIncludes(sheetText(), "Something new is visible here.");
      click(button("Continue"));
      assert(hotspot("Wall safe"), "the safe should be visible after the cabinet opens");

      // Hints: the ladder points at the safe and charges one rung.
      click($("#hint"));
      click(button("Reveal a hint"));
      assertStringIncludes(sheetText(), "HINT 1");
      assertStringIncludes(sheetText(), "A four-digit keypad wants four digits.");
      assertEquals($("#hints-used").textContent, "1 hint");
      click(button("Close"));

      // The code pad: wrong keeps it open, right solves.
      click(hotspot("Wall safe"));
      const input = $("#sheet input.code");
      assert(input, "code pad did not open");
      input.value = "1234";
      click(button("Try code"));
      assertStringIncludes(sheetText(), "Nothing happens.");
      assert($("#sheet input.code"), "the pad should stay open after a wrong code");
      $("#sheet input.code").value = "04 27";
      click(button("Try code"));
      assertStringIncludes(sheetText(), "The safe pops open. Inside is the door key.");
      click(button("Continue"));

      // View 3: the door ends the case.
      click($('#tabs .tab[aria-label="View 3 of 3"]'));
      click(hotspot("Door"));
      assert(isOpen($("#exit")), "exit screen did not open");
      assertStringIncludes($("#exit").textContent, "CASE CLOSED");
      assertStringIncludes($("#exit").textContent, "The door swings open. You escaped!");
      assertStringIncludes($("#exit").textContent, "1 hints");

      // Restart clears everything.
      click(button("Play again"));
      assert(!isOpen($("#exit")));
      assertStringIncludes($("#tray").textContent, "Items you find appear here.");

      // Walkthrough and labels from the options menu.
      click($("#menu"));
      click(button("Reveal solution walkthrough"));
      assertStringIncludes(sheetText(), "7 steps");
      assertStringIncludes(sheetText(), "Enter 0427 at Wall safe (view 2)");
      click(button("Close"));
      click($("#menu"));
      click(button("Show hotspot labels"));
      assertEquals($("#plate .hotspot .tag")?.textContent, "Desk drawer");
    } finally {
      Object.assign(g, saved);
    }
  },
});
