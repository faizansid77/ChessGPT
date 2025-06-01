// /app/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [pgn, setPgn] = useState('');
  const router = useRouter();

  const handleLoadPgn = () => {
    if (pgn.trim() === '') {
      alert('Please paste PGN data.');
      return;
    }
    try {
      // Basic validation: check for common PGN tags
      // A more robust validation would involve a PGN parsing library here
      if (!pgn.includes('[Event ') && !pgn.includes('1.')) {
        alert('Invalid PGN data. Please check the format.');
        return;
      }
      localStorage.setItem('pgnData', pgn);
      router.push('/game');
    } catch (error) {
      console.error('Error processing PGN:', error);
      alert('Could not process PGN. Please check console for errors.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-gray-800 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
      {/* Main content box: solid background, refined shadow */}
      <div className="w-full max-w-3xl bg-slate-800 rounded-2xl shadow-xl p-8 md:p-12">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-center mb-6">
          Chess PGN Viewer
        </h1>
        <p className="text-slate-300 text-center mb-8 text-base md:text-lg leading-relaxed">
          Paste your complete PGN data below. The game will be loaded for board display and move navigation.
        </p>
        
        {/* Title for PGN Input Area */}
        <h2 className="text-xl font-semibold text-slate-200 mb-3 text-center sm:text-left">
          Enter PGN Data:
        </h2>
        
        {/* Textarea: increased height, solid background, refined border */}
        <textarea
          className="w-full h-[28rem] sm:h-[32rem] p-4 bg-slate-900 text-slate-100 border border-slate-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all duration-300 resize-none placeholder-slate-500 shadow-inner text-sm md:text-base leading-relaxed"
          placeholder={`[Event "FIDE World Championship Match 2023"]
[Site "Astana KAZ"]
[Date "2023.04.09"]
[Round "1"]
[White "Nepomniachtchi, Ian"]
[Black "Ding, Liren"]
[Result "1/2-1/2"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 14. Ng3 g6 15. a4 Bg7 16. Bd3 c6 17. Bg5 Qc7 18. Qd2 Rac8 19. Bh6 Bh8 20. Qg5 ... 1/2-1/2`}
          value={pgn}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPgn(e.target.value)}
        />
        <button
          onClick={handleLoadPgn}
          className="mt-8 w-full bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 hover:from-purple-700 hover:via-pink-700 hover:to-red-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-slate-900 transform hover:scale-[1.02] transition-all duration-200 ease-in-out text-lg"
        >
          Load Game
        </button>
      </div>
      <footer className="text-center text-xs text-gray-500 mt-12">
        &copy; {new Date().getFullYear()} PGN Viewer
      </footer>
    </div>
  );
}