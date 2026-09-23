"use client";

import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import "@rarefriends/friendsdk/runtime.css";
import "./style.css";
import { MineGame } from "./src/components/MineGame.js";

export default function App({ friendId, client, paused }: GameComponentProps) {
  return (
    <MineGame
      friendId={friendId}
      client={client}
      paused={paused}
    />
  );
}
