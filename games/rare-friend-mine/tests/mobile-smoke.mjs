// Rare Friends: MINE -- automated mobile browser smoke test.
// Verifies the responsive trusted-host frame plus the compact child layout on
// portrait and short-landscape phone viewports, using the SDK's real sandboxed
// runtime with read-only mock wallet/RPC fixtures.
// Run from the FriendSDK root:  node games/rare-friend-mine/tests/mobile-smoke.mjs
import assert from "node:assert/strict";
import { testGame } from "@rarefriends/friendsdk/testing";

async function delveAndBank({ game, page, label, minTile }) {
  // Start with the minimum mine count so a single safe dig raises at-risk RF.
  await game.getByRole("button", { name: /^5 mines/i }).click();
  const startBtn = game.locator("#btn-start-mine");
  await startBtn.waitFor();
  await startBtn.click();
  await game.getByRole("grid", { name: "5 by 5 Minefield" }).waitFor();

  // Center the trusted frame in the viewport so the host toolbar (wallet) never
  // overlaps the board while tapping mines on short screens.
  await page.locator(".rf-game-frame").first().scrollIntoViewIfNeeded();

  // The board must not overflow and every tile must be a reachable touch target.
  await assertNoOverflow(game, label);
  await assertTileSize(game, label, minTile);
  const gridBox = await game.getByRole("grid", { name: "5 by 5 Minefield" }).boundingBox();
  assert.ok(gridBox, `${label}: grid is visible`);
  await page.screenshot({ path: `./games/rare-friend-mine/tests/artifacts/mobile_${label}_board.png` });

  // Advance dig-by-dig until a safe tile banks RF, then secure it.
  const completeTitle = () => game.getByRole("heading", { name: /DELVE REPORT/ });
  let digs = 0;
  for (let i = 0; i < 20; i++) {
    if (await completeTitle().isVisible().catch(() => false)) {
      await game.locator("#btn-play-again").click();
      await game.locator("#btn-start-mine").waitFor();
      await game.locator("#btn-start-mine").click();
      await game.getByRole("grid", { name: "5 by 5 Minefield" }).waitFor();
      continue;
    }
    const atRisk = async () => parseFloat(await game.locator("#hud-at-risk-rf").textContent() || "0");
    if ((await atRisk()) > 0) break;

    const tile = game.locator('button.mine-tile:not([disabled])').first();
    if ((await tile.count()) === 0) break;
    await tile.click();
    digs += 1;
    for (let t = 0; t < 35; t++) {
      if ((await atRisk()) > 0 || (await completeTitle().isVisible().catch(() => false))) break;
      await page.waitForTimeout(100);
    }
  }
  assert.ok(digs >= 1, `${label}: expected at least one dig to resolve (did ${digs})`);

  // The Bank control must be reachable inside the frame on this viewport.
  const bank = game.locator("#btn-bank");
  await bank.waitFor();
  const bankBox = await bank.boundingBox();
  assert.ok(bankBox, `${label}: bank button is visible`);
  await bank.click();
  await game.getByRole("heading", { name: /DELVE REPORT · SUCCESS/ }).waitFor();
  const banked = await game.locator("#final-banked-rf").textContent();
  assert.match(banked, /^\+[\d.]+ RF$/, `${label}: expected a positive simulated bank, got "${banked}"`);
  await page.screenshot({ path: `./games/rare-friend-mine/tests/artifacts/mobile_${label}_done.png` });
  return { digs, banked };
}

async function assertNoOverflow(game, label) {
  const delta = await game.locator(":root").evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert.ok(delta <= 1, `${label}: game must not overflow horizontally (delta=${delta}px)`);
}

async function assertFrameGeometry(page, label, { minHeight = 0, maxHeight = Infinity, maxWidth = Infinity } = {}) {
  const box = await page.locator(".rf-game-frame").boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, `${label}: trusted game frame is visible`);
  if (minHeight) assert.ok(box.height >= minHeight, `${label}: frame height ${Math.round(box.height)}px below minimum ${minHeight}`);
  if (maxHeight !== Infinity) assert.ok(box.height <= maxHeight, `${label}: frame height ${Math.round(box.height)}px above ${maxHeight}`);
  if (maxWidth !== Infinity) assert.ok(box.width <= maxWidth, `${label}: frame width ${Math.round(box.width)}px above ${maxWidth}`);
}

async function assertTileSize(game, label, min) {
  const box = await game.locator("button.mine-tile:not([disabled])").first().boundingBox();
  assert.ok(box, `${label}: a tappable tile must exist`);
  assert.ok(box.width >= min && box.height >= min, `${label}: tiles must be ${min}px+ for touch (got ${Math.round(box.width)}x${Math.round(box.height)})`);
}

let totals = [];
let results = { portrait: null, landscape: null };

await testGame("./games/rare-friend-mine", {
  width: 390,
  height: 740,
  screenshot: "./games/rare-friend-mine/tests/artifacts/mobile_portrait.png",
  check: async ({ game, page, friendId }) => {
    await game.locator("canvas.friend-pixel-canvas").waitFor();
    await game.getByRole("heading", { name: /RARE FRIENDS/ }).waitFor();
    // Frame must switch to the tall 1/1.75 portrait layout on a phone.
    await assertFrameGeometry(page, "portrait", { minHeight: 600, maxHeight: 740, maxWidth: 395 });

    // Gear Locker opens inside the tall portrait frame without horizontal overflow.
    await game.getByRole("button", { name: /Open gear locker/ }).first().click();
    await game.getByRole("dialog", { name: /GEAR LOCKER/ }).first().waitFor();
    await page.screenshot({ path: "./games/rare-friend-mine/tests/artifacts/mobile_portrait_gear.png" });
    await assertNoOverflow(game, "portrait-gear");
    await game.locator("#btn-close-gear-locker").click();
    await game.getByRole("dialog", { name: /GEAR LOCKER/ }).waitFor({ state: "detached" });

    // 5 by 5 on a ~390px board gives ~66px tiles.
    results.portrait = await delveAndBank({ game, page, label: "portrait", minTile: 44 });
    totals.push(results.portrait.banked);
    console.log(`PASS mobile portrait (digs=${results.portrait.digs}, banked=${results.portrait.banked}).`);
  },
});

await testGame("./games/rare-friend-mine", {
  width: 667,
  height: 375,
  screenshot: "./games/rare-friend-mine/tests/artifacts/mobile_landscape.png",
  check: async ({ game, page }) => {
    await game.locator("canvas.friend-pixel-canvas").waitFor();
    await game.getByRole("heading", { name: /RARE FRIENDS/ }).waitFor();
    // Frame must switch to the height-capped 4/3 landscape layout on a short phone.
    await assertFrameGeometry(page, "landscape", { minHeight: 220, maxHeight: 380, maxWidth: 670 });
    results.landscape = await delveAndBank({ game, page, label: "landscape", minTile: 36 });
    totals.push(results.landscape.banked);
    console.log(`PASS mobile landscape (digs=${results.landscape.digs}, banked=${results.landscape.banked}).`);
  },
});

console.log(`PASS Rare Friends: MINE mobile smoke (${totals.length} viewports).`);