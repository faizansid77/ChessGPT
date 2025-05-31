// components/Controls.tsx

'use client';

import React from 'react';

interface ControlsProps {
  onNewGame: () => void;
  onUndo: () => void;
  onFlip: () => void;
  onEvaluate?: () => void; // Optional: Stockfish eval
}

const Controls: React.FC<ControlsProps> = ({ onNewGame, onUndo, onFlip, onEvaluate }) => {
  return (
    <div className="flex gap-4 flex-wrap items-center mt-4">
      <button
        onClick={onNewGame}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
      >
        New Game
      </button>
      <button
        onClick={onUndo}
        className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition"
      >
        Undo
      </button>
      <button
        onClick={onFlip}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
      >
        Flip Board
      </button>
      {onEvaluate && (
        <button
          onClick={onEvaluate}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition"
        >
          Evaluate
        </button>
      )}
    </div>
  );
};

export default Controls;