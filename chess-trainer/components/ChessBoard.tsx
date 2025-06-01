// components/ChessBoard.tsx
// A lightweight wrapper around chessground that renders a chess board
// based on a FEN string. This component is display-only.

"use client";

import { useEffect, useRef } from "react";

// chessground doesn't ship TypeScript declarations. For the scope of
// this demo we fall back to `any`. If the application grows consider
// adding a minimal d.ts file or installing @types/chessground once it
// becomes available.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChessgroundApi = any;

export interface ChessBoardProps {
  /** FEN string representing the board position. */
  fen: string;

  /** Board orientation. */
  orientation?: "white" | "black";
}

// Note: chessground CSS (base, brown, cburnett) is imported globally in app/globals.css

export default function ChessBoard({
  fen,
  orientation = "white",
}: ChessBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ChessgroundApi | null>(null);

  // Initialize Chessground instance once.
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
        fen: fen,
        orientation: orientation,
        viewOnly: true, // Make the board non-interactive
        coordinates: true, // Show board coordinates
        style: 'cburnett', // Use the cburnett piece set
        // The 'brown' class on the board div will apply the brown theme for the board itself
        // Other chessground config options can be added here as needed
      });
    };

    init();

    return () => {
      isMounted = false;
      apiRef.current?.destroy?.();
      apiRef.current = null;
    };
    // We run this only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the board in sync with FEN and orientation changes.
  useEffect(() => {
    if (!apiRef.current) return;

    apiRef.current.set?.({
      fen: fen,
      orientation: orientation,
      // viewOnly mode should persist, but can be re-asserted if needed
    });
  }, [fen, orientation]);

  return (
    <div className="relative flex items-center justify-center w-full min-w-[220px] max-w-[400px] aspect-square mx-auto">
      {/* Optional: Keep or remove styling as preferred */}
      <div className="absolute inset-0 z-0 rounded-2xl pointer-events-none bg-gradient-to-br from-indigo-200/40 via-blue-100/30 to-pink-100/10 blur-xl" />
      <div
        ref={boardRef}
        className="brown relative z-10 w-full h-full rounded-2xl shadow-2xl hover:shadow-indigo-300 transition-shadow duration-300"
      />
    </div>
  );
}
