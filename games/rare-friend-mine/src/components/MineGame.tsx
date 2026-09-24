import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import type { GameSnapshot } from "@rarefriends/friendsdk/game";
import type { CosmeticSlot } from "../types/game.js";
import { createInitialState, mineReducer } from "../engine/mineEngine.js";
import { MineSoundKit } from "../audio/soundKit.js";
import { GameHud } from "./GameHud.js";
import { FriendActor } from "./FriendActor.js";
import { MineGrid } from "./MineGrid.js";
import { ActionBar } from "./ActionBar.js";
import { ResultOverlay } from "./ResultOverlay.js";
import { ErrorPanel, LoadingScreen } from "./ErrorPanel.js";
import { MineCountSelector } from "./MineCountSelector.js";
import { StakeSelector } from "./StakeSelector.js";
import { HowToPlay } from "./HowToPlay.js";
import { CosmeticsLocker } from "./CosmeticsLocker.js";
import { formatRf } from "../engine/economy.js";
import { formatMultiplier, getDangerTier, RULES } from "../engine/rules.js";
import { CloseIcon, QuestionIcon, SparklesIcon, WarningIcon } from "./Icons.js";

export function MineGame({ friendId, client, paused }: GameComponentProps) {
  const [state, dispatch] = useReducer(mineReducer, friendId, createInitialState);
  const [loading, setLoading] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showGear, setShowGear] = useState(false);

  const [theme, setTheme] = useState<"light" | "invert">("light");

  const soundKitRef = useRef<MineSoundKit | null>(null);
  const epochRef = useRef(0);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "invert" : "light"));
  };

  // Initialize sound kit & motion preference
  useEffect(() => {
    soundKitRef.current = new MineSoundKit(false);
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);

    const onMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", onMotionChange);

    return () => {
      soundKitRef.current?.dispose();
      mql.removeEventListener("change", onMotionChange);
    };
  }, []);

  // Initialize client read
  useEffect(() => {
    const version = ++epochRef.current;
    let mounted = true;

    async function initSession() {
      try {
        setLoading(true);
        setClientError(null);
        const snapshot: GameSnapshot = await client.read();
        if (!mounted || version !== epochRef.current) return;

        // Initialize engine with friendId
        dispatch({ type: "INIT_READY", friendId });
        setLoading(false);
      } catch (err) {
        if (!mounted || version !== epochRef.current) return;
        // In local mock or preview without wallet, fallback gracefully to preview ready
        dispatch({ type: "INIT_READY", friendId });
        setLoading(false);
      }
    }

    void initSession();

    return () => {
      mounted = false;
      epochRef.current++;
    };
  }, [client, friendId]);

  // Handle tile reveal animation delay
  useEffect(() => {
    if (state.phase !== "revealing" || paused) return;

    soundKitRef.current?.play("dig");
    const delay = reducedMotion ? 100 : RULES.animationDurationMs;

    const timer = window.setTimeout(() => {
      dispatch({ type: "FINISH_REVEAL" });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [state.phase, paused, reducedMotion]);

  // Handle mine detonation crash animation: keep the run on-screen while the field detonates.
  useEffect(() => {
    if (state.phase !== "crashing" || paused) return;

    soundKitRef.current?.play("mineExplosion");
    const delay = reducedMotion
      ? RULES.mineCrashReducedMotionMs
      : RULES.mineCrashMs;

    const timer = window.setTimeout(() => {
      dispatch({ type: "FINISH_CRASH" });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [state.phase, paused, reducedMotion]);

  // Audio trigger on tile resolution
  useEffect(() => {
    if (!state.lastResolution) return;

    const sound = soundKitRef.current;
    if (!sound) return;

    if (state.lastResolution.type === "rf") {
      if (state.safeDigCount >= 4) {
        sound.play("rareFound");
      } else {
        sound.play("rfFound");
      }
    } else if (state.lastResolution.type === "resource") {
      sound.play("rareFound");
    } else if (state.lastResolution.type === "mine") {
      if (state.lastResolution.wasShielded) {
        sound.play("shieldDeflect");
      } else {
        sound.play("mineExplosion");
      }
    } else if (state.lastResolution.type === "special") {
      sound.play("boostActivate");
    }
  }, [state.lastResolution, state.safeDigCount]);

  // Chime when trophy gear drops in
  useEffect(() => {
    if (state.cosmetics.newItems.length > 0) {
      soundKitRef.current?.play("rareFound");
    }
  }, [state.cosmetics.newItems.length]);

  // Keyboard shortcut listener
  useEffect(() => {
    if (paused || state.phase !== "playing") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        soundKitRef.current?.unlock();
        if (state.atRiskRf > 0n) {
          handleBank();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paused, state.phase, state.atRiskRf]);

  // User Actions
  const handleStartRun = () => {
    soundKitRef.current?.unlock();
    soundKitRef.current?.play("click");
    dispatch({ type: "START_RUN" });
  };

  const handleTileClick = (tileId: number) => {
    soundKitRef.current?.unlock();

    if (state.phase === "playing") {
      dispatch({ type: "SELECT_TILE", tileId });
    }
  };

  const handleBank = () => {
    soundKitRef.current?.play("bankSuccess");
    dispatch({ type: "BANK" });
  };

  const handleReturnToReady = () => {
    soundKitRef.current?.play("click");
    dispatch({ type: "RETURN_TO_READY" });
  };

  const handleSetMineCount = (count: number) => {
    soundKitRef.current?.unlock();
    soundKitRef.current?.play("click");
    dispatch({ type: "SET_MINE_COUNT", count });
  };

  const handleSetStake = (stakeRf: bigint) => {
    soundKitRef.current?.unlock();
    soundKitRef.current?.play("click");
    dispatch({ type: "SET_STAKE", stakeRf });
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundKitRef.current?.setMuted(next);
    if (!next) soundKitRef.current?.unlock();
  };

  const handleToggleReducedMotion = () => {
    setReducedMotion((prev) => !prev);
  };

  const handleOpenGear = () => {
    soundKitRef.current?.unlock();
    soundKitRef.current?.play("click");
    setShowGear(true);
  };

  const handleCloseGear = useCallback(() => {
    soundKitRef.current?.play("click");
    setShowGear(false);
  }, []);

  const handlePurchaseCosmetic = (itemId: string) => {
    soundKitRef.current?.unlock();
    soundKitRef.current?.play("rareFound");
    dispatch({ type: "PURCHASE_COSMETIC", itemId });
  };

  const handleEquipCosmetic = (itemId: string) => {
    soundKitRef.current?.play("click");
    dispatch({ type: "EQUIP_COSMETIC", itemId });
  };

  const handleUnequipCosmetic = (slot: CosmeticSlot) => {
    soundKitRef.current?.play("click");
    dispatch({ type: "UNEQUIP_COSMETIC", slot });
  };

  const handleAckCosmetics = useCallback(() => {
    dispatch({ type: "ACK_COSMETICS" });
  }, []);

  if (loading) {
    return <LoadingScreen message="CONNECTING RARE FRIENDS MINE..." />;
  }

  if (clientError) {
    return <ErrorPanel message={clientError} onRetry={() => window.location.reload()} />;
  }

  const isInputDisabled =
    paused || state.phase === "revealing" || state.phase === "crashing";
  const currentTier = getDangerTier(state.mineCount);

  return (
    <main
      className={`rare-friend-mine-app ${reducedMotion ? "reduced-motion" : ""}`}
      data-theme={theme}
      aria-label="Rare Friends: MINE Game Board"
    >
      {/* Top HUD */}
      <GameHud
        state={state}
        muted={muted}
        reducedMotion={reducedMotion}
        theme={theme}
        newCosmetics={state.cosmetics.newItems.length}
        onToggleMute={handleToggleMute}
        onToggleReducedMotion={handleToggleReducedMotion}
        onToggleTheme={handleToggleTheme}
        onToggleHelp={() => setShowHelp((v) => !v)}
        onToggleCosmetics={handleOpenGear}
      />

      {/* Error or Notice Alert */}
      {state.errorMessage && (
        <div className="game-alert-banner" role="alert">
          <span>{state.errorMessage}</span>
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_ERROR", message: "" })}
            aria-label="Close error"
          >
            <CloseIcon className="rf-icon" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Ready / Start Pre-Run Screen */}
      {state.phase === "ready" ? (
        <section className="pre-run-screen" aria-label="Start Mine Delve">
          <div className="title-glow-card">
            <h1 className="game-title">
              <span className="title-rare">RARE FRIENDS</span>
              <span className="title-mine">MINE</span>
            </h1>
            <p className="game-tagline">Progressive Risk & Reward Mining on Robinhood Chain</p>
          </div>

          <div className="miner-feature-showcase">
            <FriendActor friendId={friendId} state={state} cosmetics={state.cosmetics} reducedMotion={reducedMotion} />
          </div>

          {/* Mine + Stake Configuration */}
          <div className="pre-run-config-grid">
            <MineCountSelector
              mineCount={state.mineCount}
              onChange={handleSetMineCount}
              onStart={handleStartRun}
            />

            <StakeSelector
              stakeRf={state.stakeRf}
              availableRf={state.availableRf}
              onChange={handleSetStake}
            />
          </div>

          {/* Run Summary */}
          <div className="run-summary-strip" aria-label="Run summary">
            <span>{state.mineCount} MINES · {currentTier.name.toUpperCase()}</span>
            <span>STAKE {formatRf(state.stakeRf)} RF</span>
            <span>STARTS AT {formatMultiplier(state.nextMultiplierBps)}x</span>
          </div>

          {/* Main Start Delve CTA */}
          <button
            type="button"
            className="start-delve-btn"
            onClick={handleStartRun}
            id="btn-start-mine"
            aria-label={`Start delve with ${state.mineCount} mines, risking ${formatRf(state.stakeRf)} RF`}
          >
            <span className="btn-label-primary">START DELVE</span>
            <span className="btn-label-sub">
              {state.mineCount} mines · {currentTier.name} · -{formatRf(state.stakeRf)} RF · {formatMultiplier(state.nextMultiplierBps)}x start
            </span>
          </button>

          <p className="sim-disclaimer-note">
            <WarningIcon className="rf-icon" aria-hidden="true" />{" "}
            <strong>SIMULATED RF ECONOMY</strong> — No real tokens are spent or burned in this Vibeathon preview.
          </p>

          <div className="pre-run-cta-row">
            <button
              type="button"
              className={`how-to-play-delve-btn ${state.cosmetics.newItems.length > 0 ? "has-new" : ""}`}
              onClick={handleOpenGear}
              id="btn-gear-locker-pre"
              aria-haspopup="dialog"
              aria-label="Open gear locker"
            >
              <SparklesIcon className="rf-icon" aria-hidden="true" /> GEAR LOCKER
              {state.cosmetics.newItems.length > 0 && (
                <span className="gear-new-badge" aria-hidden="true">{state.cosmetics.newItems.length}</span>
              )}
            </button>

            <button
              type="button"
              className="how-to-play-delve-btn"
              onClick={() => setShowHelp(true)}
              id="btn-how-to-play"
              aria-haspopup="dialog"
            >
              <QuestionIcon className="rf-icon" aria-hidden="true" /> HOW TO PLAY
            </button>
          </div>
        </section>
      ) : (
        /* Active Mining Delve View */
        <section className="active-mine-stage">
          <div className="mine-delve-layout">
            <aside className="friend-sidebar">
              <FriendActor friendId={friendId} state={state} cosmetics={state.cosmetics} reducedMotion={reducedMotion} />
            </aside>

            <div className={`minefield-center${state.phase === "crashing" ? " crash-active" : ""}`}>
              <MineGrid
                board={state.board}
                disabled={isInputDisabled}
                selectedTileIndex={state.selectedTileIndex}
                crashing={state.phase === "crashing"}
                crashTileId={state.lastResolution?.type === "mine" ? state.lastResolution.tileId : null}
                onSelect={handleTileClick}
              />
            </div>
          </div>

          {/* Action Bar: Bank the haul */}
          <ActionBar
            state={state}
            disabled={isInputDisabled}
            onBank={handleBank}
          />
        </section>
      )}

      {/* Settlement and Modals */}
      <ResultOverlay
        state={state}
        onPlayAgain={handleReturnToReady}
      />

      {/* How to Play guide */}
      <HowToPlay open={showHelp} onClose={() => setShowHelp(false)} />

      {/* Gear Locker (durable cosmetics, simulated RF) */}
      <CosmeticsLocker
        open={showGear}
        friendId={friendId}
        state={state}
        onPurchase={handlePurchaseCosmetic}
        onEquip={handleEquipCosmetic}
        onUnequip={handleUnequipCosmetic}
        onAck={handleAckCosmetics}
        onClose={handleCloseGear}
      />
    </main>
  );
}
