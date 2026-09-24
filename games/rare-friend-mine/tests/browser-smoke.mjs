// Rare Friends: MINE -- automated browser smoke test.
// Uses the SDK's real sandboxed runtime with read-only mock wallet/RPC fixtures.
// Run from the FriendSDK root:  node games/rare-friend-mine/tests/browser-smoke.mjs
import assert from "node:assert/strict";
import { testGame } from "@rarefriends/friendsdk/testing";

let game;

await testGame("./games/rare-friend-mine", {
  width: 960,
  height: 800,
  screenshot: "./games/rare-friend-mine/tests/artifacts/smoke.png",
  check: async ({ game: frame, page }) => {
    game = frame;

    // 1. Game loads and the selected Rare Friends miner renders.
    await game.locator("canvas.friend-pixel-canvas").waitFor();
    await game.getByRole("heading", { name: /RARE FRIENDS/ }).waitFor();

    // 1b. How to Play guide opens and closes from the HUD.
    await game.getByRole("button", { name: "How to play", exact: true }).click();
    await game.getByText("HOW TO PLAY · RARE FRIENDS MINE").first().waitFor();
    await game.getByText("THE MULTIPLIER").first().waitFor();
    await page.screenshot({ path: "./games/rare-friend-mine/tests/artifacts/how_to_play.png" });
    await game.locator("#btn-close-how-to-play").click();
    await game.locator("#btn-close-how-to-play").waitFor({ state: "detached" });

    // 1c. Gear Locker: buy a durable cosmetic, equip/unequip, and track the NEW badge.
    await game.getByRole("button", { name: /Open gear locker/ }).first().click();
    await game.getByRole("dialog", { name: /GEAR LOCKER/ }).first().waitFor();
    const vaultText = async () =>
      (await game.locator(".gear-preview-blurb strong").textContent()).trim();
    const vaultMatch = (await vaultText()).match(/[\d.,]+\s*RF/);
    const vaultBefore = parseFloat(vaultMatch ? vaultMatch[0].replace(/,/g, "") : "0");
    assert.ok(vaultBefore >= 2, `Vault must afford the 2 RF Ember Pickaxe (got ${vaultBefore} RF)`);

    // Ember Pickaxe costs 2 simulated RF; buy auto-equips it.
    await game.getByRole("button", { name: /Buy Ember Pickaxe/ }).click();
    assert.match(
      await vaultText(),
      new RegExp(`${vaultBefore - 2}\\s*RF`),
      `Vault must drop by the 2 RF purchase price (was ${vaultBefore})`,
    );
    await game.getByRole("button", { name: "Unequip Ember Pickaxe" }).waitFor();
    await game.getByRole("button", { name: "Unequip Ember Pickaxe" }).click();
    await game.getByRole("button", { name: "Equip Ember Pickaxe" }).click();
    await game.getByRole("button", { name: "Unequip Ember Pickaxe" }).waitFor();
    await page.screenshot({ path: "./games/rare-friend-mine/tests/artifacts/gear_locker.png" });

    // Closing surfaces the unviewed NEW badge on the GEAR button; opening clears it.
    await game.locator("#btn-close-gear-locker").click();
    await game.getByRole("button", { name: "Open gear locker, 1 new" }).waitFor();
    await game.getByRole("button", { name: /Open gear locker/ }).first().click();
    await game.getByRole("dialog", { name: /GEAR LOCKER/ }).first().waitFor();
    await game.locator("#btn-close-gear-locker").click();
    await game.getByRole("button", { name: /Open gear locker/ }).first().waitFor();
    await game.getByRole("dialog", { name: /GEAR LOCKER/ }).waitFor({ state: "detached" });

    // 2. Pick the 15 mines preset, then capture pre-run screen.
    await game.getByRole("button", { name: /^15 mines/i }).click();
    await page.screenshot({ path: "./games/rare-friend-mine/tests/artifacts/prerun.png" });

    // Switch to 5 mines (minimum) and start delve
    await game.getByRole("button", { name: /^5 mines/i }).click();
    const startBtn = game.locator("#btn-start-mine");
    await startBtn.waitFor();
    await startBtn.click();

    // 3. Minefield appears.
    await game.getByRole("grid", { name: "5 by 5 Minefield" }).waitFor();

    const bankButton = () => game.locator("#btn-bank");
    const atRisk = async () => parseFloat(await game.locator("#hud-at-risk-rf").textContent() || "0");

    // 4. Dig tiles until the player holds a positive at-risk haul.
    // Any detonated mine wipes the haul, plays the crash animation (~1.1s), then
    // shows the settlement overlay; restart as needed. Safe digs raise at-risk RF.
    let digs = 0;
    let runsStarted = 0;
    const completeTitle = () => game.getByRole("heading", { name: /DELVE REPORT/ });
    const settleOverlay = async () => {
      for (let t = 0; t < 35; t++) {
        if (await completeTitle().isVisible().catch(() => false)) return true;
        await page.waitForTimeout(100);
      }
      return false;
    };

    for (let i = 0; i < 90; i++) {
      if (await completeTitle().isVisible().catch(() => false)) {
        if ((await atRisk()) === 0) runsStarted += 1;
        await game.locator("#btn-play-again").click();
        await game.locator("#btn-start-mine").waitFor();
        await game.locator("#btn-start-mine").click();
        await game.getByRole("grid", { name: "5 by 5 Minefield" }).waitFor();
        continue;
      }

      if ((await atRisk()) > 0) break;

      const tile = game
        .locator('button.mine-tile:not([disabled]):not([aria-pressed="true"]):not(.is-revealing)')
        .first();
      if ((await tile.count()) === 0) {
        if (await settleOverlay()) continue;
        if ((await game.locator('button.mine-tile:not([disabled])').count()) > 0) continue;
        break;
      }

      await tile.click();
      digs += 1;

      // Wait until this dig resolves: a safe tile raises at-risk RF, a mine
      // detonation plays the crash then shows the settlement overlay.
      for (let t = 0; t < 35; t++) {
        if ((await atRisk()) > 0 || (await completeTitle().isVisible().catch(() => false))) break;
        await page.waitForTimeout(100);
      }
    }

    assert.ok(digs >= 1, `Expected at least one dig to resolve (did ${digs})`);
    assert.ok((await atRisk()) > 0, "Digging safe tiles must increase the RF at risk");

    // 5. Mute toggle works from the HUD.
    await game.getByRole("button", { name: "Mute audio", exact: true }).click();
    await game.getByRole("button", { name: "Unmute audio", exact: true }).waitFor();
    await game.getByRole("button", { name: "Unmute audio", exact: true }).click();

    // Capture in-game active delve with bank button ready
    await page.screenshot({ path: "./games/rare-friend-mine/tests/artifacts/active_delve.png" });

    // 6. Banking completes the run and settles immediately.
    await bankButton().click();
    await game.getByRole("heading", { name: /DELVE REPORT · SUCCESS/ }).waitFor();
    const bankedText = await game.locator("#final-banked-rf").textContent();
    assert.match(bankedText, /^\+[\d.]+ RF$/, `Expected a positive simulated bank result, got "${bankedText}"`);
    assert.equal(await atRisk(), 0, "At-risk RF must be emptied after banking");

    // Capture victory report modal
    await page.screenshot({ path: "./games/rare-friend-mine/tests/artifacts/victory_modal.png" });

    // 7. Restarting returns to the ready screen (difficulty picker) before the next run.
    await game.locator("#btn-play-again").click();
    await game.locator("#btn-start-mine").waitFor();

    // Toggle dark mode and capture dark mode prerun
    await game.locator("#btn-toggle-theme").click();
    await page.screenshot({ path: "./games/rare-friend-mine/tests/artifacts/dark_mode.png" });

    // Switch back to light mode
    await game.locator("#btn-toggle-theme").click();

    await game.locator("#btn-start-mine").click();
    assert.match(await game.locator("#hud-at-risk-rf").textContent(), /^0(\s*RF)?$/, "Expected 0 at-risk RF");

    console.log(`PASS Rare Friends: MINE browser smoke (digs=${digs}, banked=${bankedText}, runsStarted=${runsStarted}).`);
  },
});