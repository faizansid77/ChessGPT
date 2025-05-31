// components/ChessBoard.tsx
// A lightweight wrapper around chessground that renders a chess board,
// highlights legal destinations for the selected piece and notifies the
// parent component once the user has played a move.
//
// The component is intentionally kept dependency–free (apart from
// chess.js / chessground) and does not hold any game state of its own –
// the current position (as FEN) plus the available legal moves are
// received through props so the single source-of-truth continues to live
// in the React state of the parent component.  This eliminates the risk
// of having the board and the underlying engine fall out-of-sync.

"use client";

import { useEffect, useRef } from "react";
import type { Chess } from "chess.js";

// chessground doesn't ship TypeScript declarations.  For the scope of
// this demo we fall back to `any`.  If the application grows consider
// adding a minimal d.ts file or installing @types/chessground once it
// becomes available.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChessgroundApi = any;

export interface ChessBoardProps {
  /**
   * An instance of chess.js that reflects the current game state.
   * We only read from it, never mutate it.
   */
  game: Chess;

  /**
   * Called after a legal user move has been played on the board.
   * The callback receives the origin and destination squares in algebraic
   * notation – e.g. "e2", "e4".
   */
  onMove: (from: string, to: string) => void;

  /** Board orientation. */
  orientation?: "white" | "black";
}

import "@lichess-org/chessground/assets/chessground.base.css";
import "@lichess-org/chessground/assets/chessground.brown.css";

export default function ChessBoard({
  game,
  onMove,
  orientation = "white",
}: ChessBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ChessgroundApi | null>(null);

  // Lazily create chessground exactly once.
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      // Dynamically import to avoid SSR issues.
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
      const { Chessground } = (await import("@lichess-org/chessground")) as {
        Chessground: (element: HTMLElement, config: Record<string, unknown>) => ChessgroundApi;
      };

      if (!isMounted || !boardRef.current) return;

      apiRef.current = Chessground(boardRef.current, {
        fen: game.fen(),
        orientation,
        draggable: { showGhost: true },
        movable: {
          free: false,
          color: game.turn() === "w" ? "white" : "black",
          dests: computeDests(game),
          events: {
            after: (orig: string, dest: string) => {
              onMove(orig, dest);
            },
          },
        },
      });
    };

    init();

    return () => {
      isMounted = false;
      apiRef.current?.destroy?.();
      apiRef.current = null;
    };
    // We run this only once – the board instance will be updated via the
    // second effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the board in sync with the current position / orientation.
  useEffect(() => {
    if (!apiRef.current) return;

    apiRef.current.set?.({
      fen: game.fen(),
      orientation,
      movable: {
        dests: computeDests(game),
        color: game.turn() === "w" ? "white" : "black",
      },
    });
  }, [game, orientation]);

  return (
    <div
      ref={boardRef}
      className="w-[400px] h-[400px] rounded-md shadow-lg transform-gpu [perspective:1000px] rotate-x-12"
    />
  );
}

function computeDests(game: Chess) {
  const dests = new Map<string, string[]>();

  // chess.js returns moves in verbose format when `verbose: true`.
  const turn = game.turn();
  game.board().forEach((row, rankIndex) => {
    row.forEach((piece, fileIndex) => {
      if (!piece || piece.color !== turn) return;
      const square = `${"abcdefgh"[fileIndex]}${8 - rankIndex}` as import("chess.js").Square;
      const moves = game.moves({ square, verbose: true }) as { to: string }[];
      if (moves.length) dests.set(square, moves.map((m) => m.to));
    });
  });

  return dests;
}
