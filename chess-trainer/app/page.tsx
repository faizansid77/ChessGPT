// /app/page.tsx

'use client';

import ChessBoard from "../components/ChessBoard";
import EvaluationDisplay from "../components/EvaluationDisplay";
import Controls from "../components/Controls";
import MoveList from "../components/MoveList";
import useStockfish from "../hooks/useStockfish";
import { useState } from "react";
import { Chess } from "chess.js";

export default function Home() {
  const [game, setGame] = useState(() => new Chess());
  const [orientation, setOrientation] = useState<"white" | "black">("white");

  const { evaluate, evaluation } = useStockfish();

  const updateEvaluation = (nextGame: Chess) => {
    // Trigger Stockfish evaluation for the current FEN.
    evaluate(nextGame.fen());
  };

  const handleMove = (from: string, to: string) => {
    const next = new Chess(game.fen());
    try {
      const move = next.move({ from, to, promotion: "q" });
      if (!move) return; // chess.js returned null (shouldn’t happen with try) but guard anyway

      setGame(next);
      updateEvaluation(next);
    } catch {
      // illegal move – ignore. Chessground shouldn’t allow this but when
      // orientation is flipped players might attempt black’s first move
      // while it’s still white’s turn. We simply swallow the error so the
      // UI keeps working.
    }
  };

  const resetGame = () => {
    const fresh = new Chess();
    setGame(fresh);
    updateEvaluation(fresh);
  };

  const undoMove = () => {
    const next = new Chess(game.fen());
    next.undo();
    setGame(next);
    updateEvaluation(next);
  };

  return (
    <main className="flex flex-col items-center p-8 gap-6 w-full max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold tracking-tight">Chess Trainer</h1>

      <ChessBoard game={game} orientation={orientation} onMove={handleMove} />

      <EvaluationDisplay evaluation={evaluation} />

      <MoveList moves={game.history()} />

      <Controls
        onNewGame={resetGame}
        onUndo={undoMove}
        onFlip={() => setOrientation((prev) => (prev === "white" ? "black" : "white"))}
        onEvaluate={() => evaluate(game.fen())}
      />
    </main>
  );
}