// components/MoveList.tsx
'use client';

import React, { useEffect, useRef } from 'react';

// Define the structure of a move object, similar to chess.js verbose history
interface Move {
  san: string;
  color: 'w' | 'b';
  // Add other fields from chess.js verbose history if needed for display or logic
}

interface MoveListProps {
  moves: Move[];
  currentMoveIndex: number;
  onNavigate: (index: number) => void;
}

const MoveList: React.FC<MoveListProps> = ({ moves, currentMoveIndex, onNavigate }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const moveItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Adjust the size of the refs array when the moves array changes
  useEffect(() => {
    moveItemRefs.current = moveItemRefs.current.slice(0, moves.length);
  }, [moves]);

  // Scroll the current move into view
  useEffect(() => {
    if (currentMoveIndex >= 0 && currentMoveIndex < moves.length && moveItemRefs.current[currentMoveIndex]) {
      moveItemRefs.current[currentMoveIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentMoveIndex, moves]);

  return (
    <div className="w-full bg-white/5 p-4 md:p-6 rounded-lg shadow-xl max-h-72 flex flex-col">
      <h2 className="text-xl md:text-2xl font-semibold mb-4 border-b border-gray-700 pb-2 text-white flex-shrink-0">
        Move List
      </h2>
      <div ref={scrollContainerRef} className="overflow-y-auto flex-grow pr-1 space-y-1">
        {moves.length === 0 ? (
          <p className="text-gray-400 text-sm md:text-base italic p-2">No moves in PGN.</p>
        ) : (
          moves.map((move, index) => {
            const moveNumberDisplay = Math.floor(index / 2) + 1;
            const isWhiteMove = move.color === 'w';

            return (
              <button
                key={index}
                ref={el => { moveItemRefs.current[index] = el; }}
                onClick={() => onNavigate(index)}
                className={`block w-full text-left p-2 rounded transition-colors duration-150 text-sm md:text-base 
                            ${index === currentMoveIndex 
                              ? 'bg-purple-600 text-white font-semibold' 
                              : 'text-gray-300 hover:bg-gray-700/70 hover:text-white'
                            }`}
                title={`Go to move: ${moveNumberDisplay}. ${isWhiteMove ? '' : '...'}${move.san}`}
              >
                <span className="font-mono text-xs mr-2 text-gray-400 w-7 inline-block text-right">
                  {isWhiteMove ? `${moveNumberDisplay}.` : ''}
                </span>
                <span className={`${!isWhiteMove && index !== currentMoveIndex ? 'ml-[0.8rem]' : ''} ${!isWhiteMove && index === currentMoveIndex ? 'ml-[0.8rem]' : ''}`}>
                  {isWhiteMove ? '' : '...'}{move.san}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MoveList;