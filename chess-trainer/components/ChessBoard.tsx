// components/ChessBoard.tsx
// A lightweight wrapper around chessground that renders a chess board
// based on a FEN string. This component is display-only.

"use client";

import { useEffect, useRef } from "react";
import { Chess } from 'chess.js'; // Import Chess for move generation


// chessground doesn't ship TypeScript declarations. For the scope of
// this demo we fall back to `any`. If the application grows consider
// adding a minimal d.ts file or installing @types/chessground once it
// becomes available.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChessgroundApi = any;

// Interface for the 'meta' object in chessground move events
interface ChessgroundMoveMeta {
  premove?: boolean;
  ctrlKey?: boolean;
  promotion?: 'q' | 'r' | 'n' | 'b'; // Queen, Rook, Knight, Bishop
}

export interface ChessBoardProps {
  /** FEN string representing the board position. */
  fen: string;

  /** Board orientation. */
  orientation?: "white" | "black";

  /** Whether user moves are allowed. Defaults to false. */
  allowUserMoves?: boolean;

  /** The color of the player who can make a move if allowUserMoves is true. */
  playerColor?: 'white' | 'black';

  /** Callback when a user makes a move on the board. */
  onUserMadeMove?: (move: { from: string; to: string; promotion?: string }) => void;
}

// Note: chessground CSS (base, brown, cburnett) is imported globally in app/globals.css

export default function ChessBoard({
  fen,
  orientation = "white",
  allowUserMoves = false,
  playerColor,
  onUserMadeMove,
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

  // Keep the board in sync with FEN, orientation, and interactivity changes.
  useEffect(() => {
    if (!apiRef.current) return;
    console.log('[ChessBoard] useEffect triggered. Props:', { fen, orientation, allowUserMoves, playerColor, onUserMadeMoveProvided: !!onUserMadeMove });

    try {
      const chessInstance = new Chess(fen); // Load current FEN to check turn and get moves
      const turnInFen = chessInstance.turn() === 'w' ? 'white' : 'black';
      console.log(`[ChessBoard] FEN: ${fen}, Derived turnInFen: ${turnInFen}, allowUserMoves: ${allowUserMoves}, playerColor: ${playerColor}`);

      const conditionMet = allowUserMoves && playerColor && playerColor === turnInFen && onUserMadeMove;
      console.log('[ChessBoard] Condition for enabling moves met:', conditionMet);

      if (conditionMet) {
        const legalMoves = chessInstance.moves({ verbose: true });
        // chessground expects dests as a plain object: { [square: string]: string[] }
        const dests: { [square: string]: string[] } = {}; 
        legalMoves.forEach(move => {
          if (!dests[move.from]) {
            dests[move.from] = [];
          }
          dests[move.from].push(move.to);
        });
        console.log('[ChessBoard] Enabling moves with dests:', dests); // Log the dests object

        const interactiveConfig = {
          fen: fen,
          orientation: orientation,
          turnColor: playerColor, // Highlight whose turn it is
          viewOnly: false,
          selectable: { 
            enabled: true 
          },
          movable: {
            free: false,
            color: playerColor, // Only this color can move pieces
            dests: dests,
            showDests: true, // Show legal move indicators
            events: {
              after: (orig: string, dest: string, meta: ChessgroundMoveMeta) => {
                onUserMadeMove({ from: orig, to: dest, promotion: meta.promotion });
              }
            },
            rookCastle: true, // Enable castling by dragging the king
          }
        };
        apiRef.current.set(interactiveConfig);
      } else {
        // Not allowing user moves, or it's not the specified player's turn, or no callback
        const nonInteractiveConfig = {
          fen: fen,
          orientation: orientation,
          turnColor: turnInFen, // Reflect actual turn from FEN for visual cue
          viewOnly: true, // Make the board non-interactive for piece movement
          movable: {
            free: false, // Pieces are not freely draggable
            color: undefined, // No specific color can move (overridden by viewOnly)
            dests: {}, // Ensure dests is always a plain object
            showDests: false,
            events: {} // Clear any previous move event handlers
          }
        };
        apiRef.current.set(nonInteractiveConfig);
      }
    } catch (error) {
      console.error("Error processing FEN or setting board state in ChessBoard:", error, "FEN:", fen);
      // Fallback to a safe, view-only state if FEN is invalid
      apiRef.current.set({
        fen: new Chess().fen(), // Default starting FEN
        orientation: orientation,
        viewOnly: true,
        movable: { free: false, events: {} }
      });
    }
  }, [fen, orientation, allowUserMoves, playerColor, onUserMadeMove]);

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
