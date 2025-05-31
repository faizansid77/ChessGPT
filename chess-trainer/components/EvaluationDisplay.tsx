// /components/EvaluationDisplay.tsx

import React from 'react';

interface EvaluationDisplayProps {
  evaluation: string | null;
}

const EvaluationDisplay: React.FC<EvaluationDisplayProps> = ({ evaluation }) => {
  return (
    <div className="mt-4 text-lg font-mono text-center">
      {evaluation ? (
        <span>Stockfish Eval: {evaluation}</span>
      ) : (
        <span>Waiting for evaluation...</span>
      )}
    </div>
  );
};

export default EvaluationDisplay;