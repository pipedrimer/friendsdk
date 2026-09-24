import React, { useEffect, useRef, useState } from "react";
import type { CosmeticsState, FriendMood, MineRun } from "../types/game.js";
import { decodeSpriteBitmap } from "@rarefriends/friendsdk/sprites";
import { formatRf, RF_UNIT } from "../engine/economy.js";
import { getCosmeticItem, shade } from "../engine/cosmetics.js";
import {
  ChestIcon,
  PickaxeIcon,
  ShieldIcon,
  SmokeIcon,
  SparklesIcon,
} from "./Icons.js";

// Canonical Generations sprite bitmaps for idle, dig, celebrate, and danger
const CANONICAL_FRAMES: Record<string, bigint> = {
  idle: 0x660066007e00ff00ff007e0018001801ff81bd81bd80ff007e006600000n,
  digging: 0x600066007e00ff00ff007e0018001801ff81bd81bd80ff007e006600000n,
  treasure: 0x660066007e00ff007e0018001801ff81bd81bd80ff007e0066000000000n,
  bigTreasure: 0x660066007e00ff00ff007e0018001801ff81ff81ff80ff007e006600000n,
  danger: 0x180018007e007e007e003c0018001800ff00fd00fd007f003c003000000n,
  explosion: 0x180018007e007e003c0018001800ff00fd00fd007f003c0030000000000n,
  banking: 0x7e000000000124812481ff81ff83ffc3ffc07e005a007e007e004200000n,
};

interface FriendActorProps {
  friendId: bigint;
  state: MineRun;
  cosmetics: CosmeticsState;
  reducedMotion?: boolean;
}

export function FriendActor({ friendId, state, cosmetics, reducedMotion = false }: FriendActorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mood, setMood] = useState<FriendMood>("idle");
  const [bubbleText, setBubbleText] = useState<string>("Ready to delve deep!");

  // Equipped cosmetic items for the live sprite.
  const coatItem = cosmetics.equipped.coat ? getCosmeticItem(cosmetics.equipped.coat) : undefined;
  const helmetItem = cosmetics.equipped.helmet ? getCosmeticItem(cosmetics.equipped.helmet) : undefined;
  const pickaxeItem = cosmetics.equipped.pickaxe ? getCosmeticItem(cosmetics.equipped.pickaxe) : undefined;
  const auraItem = cosmetics.equipped.aura ? getCosmeticItem(cosmetics.equipped.aura) : undefined;

  // Compute friend mood & thought bubble based on game state
  useEffect(() => {
    if (state.phase === "revealing") {
      setMood("digging");
      setBubbleText("Striking the rock...");
      return;
    }

    if (state.phase === "complete") {
      if (state.bankedRf > 0n) {
        setMood("banking");
        setBubbleText(`Banked ${formatRf(state.bankedRf)} RF! What a haul!`);
      } else {
        setMood("explosion");
        setBubbleText("The mine swallowed the whole haul. Let's delve again!");
      }
      return;
    }

    if (state.lastResolution) {
      if (state.lastResolution.type === "rf") {
        const haul = state.lastResolution.haulRf;
        if (haul >= 8n * RF_UNIT) {
          setMood("bigTreasure");
          setBubbleText(`HUGE FIND! +${formatRf(haul)} RF!`);
        } else {
          setMood("treasure");
          setBubbleText(`Nice! +${formatRf(haul)} RF found!`);
        }
      } else if (state.lastResolution.type === "resource") {
        setMood("treasure");
        setBubbleText(`Extracted ${state.lastResolution.resource.name}!`);
      } else if (state.lastResolution.type === "mine") {
        if (state.lastResolution.wasShielded) {
          setMood("idle");
          setBubbleText("SHIELD DEFLECTED THE BLAST!");
        } else {
          setMood("explosion");
          setBubbleText("BOOM! Detonation wipes the haul!");
        }
      } else if (state.lastResolution.type === "special") {
        setMood("bigTreasure");
        setBubbleText(`Equipped ${state.lastResolution.specialType}!`);
      }
      return;
    }

    // Idle state check
    if (state.safeDigCount > 0) {
      if (state.safeDigCount >= 10) {
        setMood("danger");
        setBubbleText("Intense depths! Bank now or push further?");
      } else {
        setMood("idle");
        setBubbleText(`At risk: ${formatRf(state.atRiskRf)} RF. Dig or Bank?`);
      }
    } else {
      setMood("idle");
      setBubbleText("Ready to delve deep!");
    }
  }, [state.phase, state.lastResolution, state.safeDigCount, state.atRiskRf, state.bankedRf]);

  // Render pixel sprite on canvas using Rare Friends monochrome + signal palette
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Use mood-specific canonical bitmap frame
    const bitmap = CANONICAL_FRAMES[mood] ?? CANONICAL_FRAMES.idle;
    const decoded = decodeSpriteBitmap(bitmap);
    const pixelSize = canvas.width / 16;

    // Mood-based vivid sprite colors (no black or white)
    const moodColors: Record<string, { primary: string; accent: string }> = {
      idle:        { primary: "#00d4ff", accent: "#b47aff" },   // cyan body, violet head
      digging:     { primary: "#00d4ff", accent: "#00e68a" },   // cyan body, emerald head
      treasure:    { primary: "#00e68a", accent: "#ffb800" },   // emerald body, gold head
      bigTreasure: { primary: "#ccff00", accent: "#ffb800" },   // signal body, gold head
      danger:      { primary: "#ff5c6a", accent: "#ff3a4a" },   // coral body, danger head
      explosion:   { primary: "#ff5c6a", accent: "#b47aff" },   // coral body, violet head
      banking:     { primary: "#ffb800", accent: "#00e68a" },   // gold body, emerald head
    };

    // An equipped coat is a durable one-time skin: it re-dyes the whole sprite
    // regardless of mood (inherited from the verified Friend identity).
    const coat = coatItem?.palette ?? moodColors[mood] ?? moodColors.idle;
    const primaryColor = coat.primary;
    const accentColor = coat.accent;

    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const isFilled = decoded.rows[y]?.[x] === "#";
        if (isFilled) {
          ctx.fillStyle = y < 6 ? accentColor : primaryColor;
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      }
    }

    // Equipped helmet: a pixel cap drawn over the head region.
    if (helmetItem && helmetItem.color) {
      const base = helmetItem.color;
      const rim = shade(base, -0.22);
      ctx.fillStyle = rim;
      ctx.fillRect(1 * pixelSize, 4 * pixelSize, 14 * pixelSize, pixelSize);
      ctx.fillStyle = base;
      for (let y = 0; y <= 3; y++) {
        const inset = 5 - y;
        ctx.fillRect(inset * pixelSize, y * pixelSize, (16 - 2 * inset) * pixelSize, pixelSize);
      }
      ctx.fillStyle = shade(base, 0.35);
      ctx.fillRect(6 * pixelSize, 1 * pixelSize, pixelSize, pixelSize);
      ctx.fillRect(9 * pixelSize, 1 * pixelSize, pixelSize, pixelSize);
    }

    // Equipped pickaxe skin: a wedge-tip pick lifts from the top-right with a
    // diagonal wooden handle.
    if (pickaxeItem && pickaxeItem.color) {
      ctx.fillStyle = "#7a4a1f";
      [[12, 7], [13, 6], [14, 5], [15, 4]].forEach(([x, y]) => {
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      });
      ctx.fillStyle = pickaxeItem.color;
      ctx.fillRect(13 * pixelSize, 1 * pixelSize, 2 * pixelSize, pixelSize);
      ctx.fillRect(12 * pixelSize, 2 * pixelSize, 3 * pixelSize, pixelSize);
      ctx.fillRect(11 * pixelSize, 3 * pixelSize, 4 * pixelSize, pixelSize);
    }
  }, [friendId, mood, coatItem, helmetItem, pickaxeItem]);

  const animationClass = reducedMotion ? "" : `mood-${mood}`;

  return (
    <div className={`friend-actor-container ${animationClass}`} aria-live="polite">
      <div className="friend-speech-bubble" role="status">
        <span className="bubble-text">{bubbleText}</span>
      </div>

      <div className="friend-avatar-wrapper">
        {auraItem && auraItem.color && (
          <div
            className="friend-cosmetic-aura"
            style={{ boxShadow: `0 0 0 2px ${auraItem.color}, 0 0 18px 2px ${auraItem.color}` }}
            aria-hidden="true"
          />
        )}
        <canvas
          ref={canvasRef}
          width={96}
          height={96}
          className="friend-pixel-canvas"
          aria-label={`Rare Friends miner #${friendId.toString()}`}
        />
        {mood === "digging" && !pickaxeItem && <span className="friend-prop pickaxe" aria-hidden="true"><PickaxeIcon /></span>}
        {mood === "bigTreasure" && <span className="friend-prop sparkles" aria-hidden="true"><SparklesIcon /></span>}
        {mood === "explosion" && <span className="friend-prop smoke" aria-hidden="true"><SmokeIcon /></span>}
        {mood === "banking" && <span className="friend-prop treasure-chest" aria-hidden="true"><ChestIcon /></span>}
        {state.shieldCharges > 0 && <span className="friend-prop shield-aura" aria-hidden="true"><ShieldIcon /></span>}
      </div>

      <div className="friend-meta-tag">
        <span className="friend-id-badge">RARE FRIENDS #{friendId.toString()}</span>
        <span className="miner-status-dot" />
      </div>
    </div>
  );
}