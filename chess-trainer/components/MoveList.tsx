// components/MoveList.tsx

'use client';

import React, { useEffect, useRef } from 'react';

interface MoveListProps {
  moves: string[];
}

const MoveList: React.FC<MoveListProps> = ({ moves }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when moves change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves]);

  const groupedMoves = [];
  for (let i = 0; i < moves.length; i += 2) {
    groupedMoves.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1] || '',
    });
  }

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-bold mb-2">Move List</h2>
      <div ref={scrollRef} className="overflow-y-auto max-h-64">
        {groupedMoves.length === 0 ? (
          <p className="text-gray-500 text-sm">No moves yet...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">#</th>
                <th className="text-left">White</th>
                <th className="text-left">Black</th>
              </tr>
            </thead>
            <tbody>
              {groupedMoves.map(({ moveNumber, white, black }, index) => (
                <tr
                  key={moveNumber}
                  className={index === groupedMoves.length - 1 ? 'bg-yellow-100' : ''}
                >
                  <td className="pr-2">{moveNumber}</td>
                  <td className="pr-2">{white}</td>
                  <td>{black}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MoveList;