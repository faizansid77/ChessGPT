// /app/game/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Chess } from 'chess.js'; // To parse PGN and manage game state
import { useRouter } from 'next/navigation';
import { BackwardIcon, ChevronLeftIcon, ChevronRightIcon, ForwardIcon } from '@heroicons/react/24/solid';

// We'll create/refactor these components later
import ChessBoard from '../../components/ChessBoard'; 
import MoveList from '../../components/MoveList';
// import GameControls from '@/components/GameControls';

// Types for the new chat interaction feature
interface ChatOverview {
  text: string;
  studyUrl?: string; // Optional: To be extracted or handled later
  studyReason?: string; // Optional: To be extracted or handled later
}

interface MoveRecommendation {
  moveNumber: number;
  ply: number; // 1-indexed ply of the board state *after* this many half-moves from start (or from initial FEN)
  advice: string;
  hints: string[];
  topMoves: string[];
}

export default function GamePage() {
  const [pgn, setPgn] = useState<string | null>(null);
  const [game, setGame] = useState<Chess | null>(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1); // -1 for board setup, 0 for first move
  const router = useRouter();

  // State for new chat interaction feature
  const [userInputForChat, setUserInputForChat] = useState<string>('');
  const [chatOverview, setChatOverview] = useState<ChatOverview | null>(null);
  const [currentRecommendation, setCurrentRecommendation] = useState<MoveRecommendation | null>(null);
  const [revealedHintCount, setRevealedHintCount] = useState<number>(0);
  const [isAwaitingUserMove, setIsAwaitingUserMove] = useState<boolean>(false); // True when user needs to make a move on board
  const [fenForRecommendation, setFenForRecommendation] = useState<string | null>(null); // FEN of the position for user's move
  const [userMessage, setUserMessage] = useState<string | null>(null); // Feedback messages for the user in chat UI
  // chess.js Promotion type, if not already available globally
  type Promotion = 'q' | 'r' | 'b' | 'n';

  useEffect(() => {
    const storedPgn = localStorage.getItem('pgnData');
    if (!storedPgn) {
      alert('No PGN data found. Redirecting to home.');
      router.push('/');
      return;
    }
    setPgn(storedPgn);

    try {
      const chessInstance = new Chess();
      // Use sloppy: true to be more lenient with PGN format
      // Cast options to `any` to bypass strict type checking for `sloppy` if not in current .d.ts
      chessInstance.loadPgn(storedPgn, { sloppy: true } as any);

      // Check if PGN loading resulted in a usable game state
      // (e.g., by checking if headers or history are populated)
      const headers = chessInstance.header();
      const history = chessInstance.history();

      if (Object.keys(headers).length === 0 && history.length === 0) {
        // If both headers and history are empty, it's likely the PGN was invalid or empty
        // even if loadPgn didn't throw an error.
        throw new Error('Invalid or empty PGN data after loading.');
      }

      setGame(chessInstance);
      setCurrentMoveIndex(-1); // Start at the beginning (board setup)
    } catch (error) {
      console.error('Error loading PGN:', error);
      alert(`Failed to load PGN: ${(error as Error).message}. Redirecting to home.`);
      localStorage.removeItem('pgnData'); // Clear invalid PGN
      router.push('/');
    }
  }, [router]);

  const gameHistory = game?.history({ verbose: true }) || [];

  const navigateToMove = (index: number) => {
    if (!game) return;
    // Validate index: must be -1 (for initial setup) or within gameHistory bounds
    if (index >= -1 && index < gameHistory.length) {
      setCurrentMoveIndex(index);
    } else if (gameHistory.length === 0 && index === -1) {
      // Handles case where PGN might be valid but have no moves (e.g., just a setup FEN)
      setCurrentMoveIndex(index);
    } else {
      console.warn(`navigateToMove: Attempted to navigate to invalid index ${index} for gameHistory of length ${gameHistory.length}.`);
    }
  };

  // Note: The conditional return for loading state is moved further down, after all hooks.

  const currentFen = () => {
    if (!game) { // Main game instance from useEffect not loaded yet
      return new Chess().fen(); // Default initial FEN
    }

    // Create a new Chess instance to derive the FEN.
    // This instance will start from the PGN's defined starting position (either a FEN or standard initial).
    const fenDerivationGame = new Chess();
    const pgnHeaders = game.header(); // Use headers from the main 'game' instance loaded in useEffect

    if (pgnHeaders.FEN) {
      // If the PGN specifies a starting FEN, load that into our derivation game.
      fenDerivationGame.load(pgnHeaders.FEN);
    }
    // If no FEN in pgnHeaders, fenDerivationGame remains at the standard initial chess position (default for new Chess()).

    if (currentMoveIndex < 0) {
      // This is the state *before* the first move in gameHistory (i.e., index 0).
      // It's either the FEN from the PGN header or the standard initial position.
      return fenDerivationGame.fen();
    }

    // If currentMoveIndex >= 0, apply moves from gameHistory to fenDerivationGame.
    // gameHistory contains moves that occur *after* any initial FEN setup from the PGN header.
    for (let i = 0; i <= currentMoveIndex; i++) {
      if (gameHistory[i] && gameHistory[i].san) {
        // Apply moves. The 'move' function does not take a 'sloppy' option.
        const moveResult = fenDerivationGame.move(gameHistory[i].san);
        if (moveResult === null) {
          console.error(
            `Error applying move "${gameHistory[i].san}" (at history index ${i}, target move ${currentMoveIndex + 1}) to FEN "${fenDerivationGame.fen()}" while generating current FEN. Original PGN: ${pgn}`
          );
          // Fallback: return FEN of the last known good state (before the failed move)
          // To do this accurately, we'd reconstruct up to i-1.
          // For simplicity, returning the FEN *before* this problematic move attempt.
          const errorStateGame = new Chess();
          if (pgnHeaders.FEN) errorStateGame.load(pgnHeaders.FEN);
          for (let j = 0; j < i; j++) { // Apply moves up to i-1
            if (gameHistory[j] && gameHistory[j].san) errorStateGame.move(gameHistory[j].san);
          }
          return errorStateGame.fen();
        }
      } else if (gameHistory[i]) {
        console.warn(`Move at gameHistory index ${i} is missing .san property.`);
      } else {
        // This case should ideally not be reached if currentMoveIndex is validated against gameHistory.length
        console.warn(`Move at gameHistory index ${i} is undefined. CurrentMoveIndex: ${currentMoveIndex}, HistoryLength: ${gameHistory.length}`);
        break; // Stop if history is shorter than expected or currentMoveIndex is out of sync
      }
    }
    return fenDerivationGame.fen();
  };

  // Helper function to parse the XML-like chat input
  const parseChatInput = (xmlInput: string): { overview: ChatOverview | null; recommendation: MoveRecommendation | null } => {
    let overview: ChatOverview | null = null;
    let recommendation: MoveRecommendation | null = null;

    try {
      const overviewMatch = xmlInput.match(/<overview>([\s\S]*?)<\/overview>/);
      if (overviewMatch && overviewMatch[1]) {
        overview = { text: overviewMatch[1].trim() };
      }

      const recommendationMatch = xmlInput.match(/<move_recommendation>([\s\S]*?)<\/move_recommendation>/);
      if (recommendationMatch && recommendationMatch[1]) {
        const recContent = recommendationMatch[1];
        const moveNumberMatch = recContent.match(/<move_number>(\d+)<\/move_number>/);
        const plyMatch = recContent.match(/<ply>(\d+)<\/ply>/);
        const adviceMatch = recContent.match(/<advice>([\s\S]*?)<\/advice>/);
        
        const hints: string[] = [];
        const hintRegex = /<hint>([\s\S]*?)<\/hint>/g;
        let hintMatch;
        while ((hintMatch = hintRegex.exec(recContent)) !== null) {
          hints.push(hintMatch[1].trim());
        }

        const topMoves: string[] = [];
        const topMovesBlockMatch = recContent.match(/<top_moves>([\s\S]*?)<\/top_moves>/);
        if (topMovesBlockMatch && topMovesBlockMatch[1]) {
          const topMovesRegex = /<move>([a-zA-Z0-9+#=!?\-]+)<\/move>/g; // Allow '-' for castling like O-O
          let topMoveMatch;
          while ((topMoveMatch = topMovesRegex.exec(topMovesBlockMatch[1])) !== null) {
            topMoves.push(topMoveMatch[1].trim());
          }
        }
        
        if (moveNumberMatch && plyMatch && adviceMatch) {
          recommendation = {
            moveNumber: parseInt(moveNumberMatch[1], 10),
            ply: parseInt(plyMatch[1], 10), // Assuming 1-indexed ply from input
            advice: adviceMatch[1].trim(),
            hints,
            topMoves,
          };
        }
      }
    } catch (e) {
      console.error("Error parsing chat input:", e);
      setUserMessage("Error parsing the recommendation format.");
    }
    return { overview, recommendation };
  };

  // Handle submission of the chat input containing the recommendation
  const handleChatSubmit = () => {
    if (!userInputForChat.trim()) return;

    const { overview: parsedOverview, recommendation: parsedRecommendation } = parseChatInput(userInputForChat);

    if (parsedRecommendation) {
      setChatOverview(parsedOverview);
      setCurrentRecommendation(parsedRecommendation);
      setRevealedHintCount(0);
      setIsAwaitingUserMove(false);
      setUserMessage(null); // Clear previous messages

      // The 'ply' in XML is 1-indexed, representing the state *after* K half-moves.
      // navigateToMove expects a 0-indexed ply. So, for ply K, we pass K-1.
      // This sets the board to the state *after* the (K-1)th 0-indexed ply.
      // This is the position where the user is expected to make the *next* move.
      console.log(`[GamePage] Parsed ply: ${parsedRecommendation.ply}, navigating to index: ${parsedRecommendation.ply - 1}`);
      navigateToMove(parsedRecommendation.ply - 1);
      
    } else {
      console.error("Failed to parse chat input or recommendation missing.");
      if (!userMessage) setUserMessage("Could not understand the recommendation format. Please check the input.");
    }
    // Keep userInputForChat for now, or clear if preferred: setUserInputForChat('');
  };

  // Effect to store the FEN for the current recommendation position
  useEffect(() => {
    if (currentRecommendation && game && currentMoveIndex >= -1) {
      // This FEN is the state of the board where the user is about to make a move.
      setFenForRecommendation(currentFen());
    }
  }, [currentMoveIndex, currentRecommendation, game, pgn]); // Added pgn to ensure currentFen() is stable after game load

  // Placeholder for handling user's move from ChessBoard (Phase 2)
  const handleUserMadeMoveOnBoard = (userMove: { from: string, to: string, promotion?: string }) => {
    if (!isAwaitingUserMove || !currentRecommendation || !fenForRecommendation || !game) {
      console.warn("handleUserMadeMoveOnBoard called unexpectedly or with missing state.");
      return;
    }

    const boardStateForValidation = new Chess(fenForRecommendation);
    const moveAttempt = {
      from: userMove.from,
      to: userMove.to,
      promotion: userMove.promotion as Promotion | undefined, // Cast to chess.js Promotion type
    };

    const moveResult = boardStateForValidation.move(moveAttempt);

    if (moveResult === null) {
      setUserMessage(`Invalid move (${userMove.from}-${userMove.to}). Please try again from this position.`);
      // Board remains at fenForRecommendation, user can try again.
      // isAwaitingUserMove remains true to allow another attempt.
      return; 
    }

    const sanMove = moveResult.san;
    if (currentRecommendation.topMoves.includes(sanMove)) {
      setUserMessage(`Congratulations! "${sanMove}" is a great move!`);
      setIsAwaitingUserMove(false);

      // Apply the successful move to the main game instance
      const mainGameMoveResult = game.move(sanMove); 
      if (mainGameMoveResult) {
        // Update currentMoveIndex to reflect the new state of the game
        // This relies on gameHistory being up-to-date *before* this point, or recalculating based on game.history()
        // A robust way is to find the ply that matches the new game.fen()
        // For simplicity now, if game.history() is used by MoveList, it will update.
        // We need to ensure currentMoveIndex correctly points to this new move.
        setCurrentMoveIndex(currentMoveIndex + 1); // This advances the game to the user's move
        
        // Optionally, clear current recommendation as it's fulfilled
        // setCurrentRecommendation(null);
        // setChatOverview(null);
      } else {
        // This should ideally not happen if move was valid on fenForRecommendation
        console.error("Error applying validated move to main game instance.");
        setUserMessage("An error occurred applying your move. The board is reset.");
        // Reset board to the recommendation FEN by not changing currentMoveIndex from recommendation point
        // Or, more explicitly, navigate back if currentMoveIndex was already changed optimistically
        navigateToMove(currentRecommendation.ply -1); // Re-sync to recommendation point
      }
    } else {
      setUserMessage(`"${sanMove}" is a legal move, but not among the top recommendations (${currentRecommendation.topMoves.join(', ')}). Try to find a stronger one! Board reset.`);
      // Board remains at fenForRecommendation, user can try again.
      // isAwaitingUserMove remains true to allow another attempt (or set to false then true to re-trigger board interactivity if needed)
      // No change to main game state, so board implicitly resets to fenForRecommendation on next render if ChessBoard relies on main fen prop.
      // To be absolutely sure, we could re-set the FEN prop of ChessBoard if it were managed separately, 
      // but since it uses currentFen() which depends on currentMoveIndex, and currentMoveIndex is NOT advanced here,
      // the board should show fenForRecommendation.
    }
    // If not a top move, isAwaitingUserMove can remain true. If it was a top move, it's set to false.
    // If we want only one attempt per "Make Your Move" click for non-top moves:
    // if (!currentRecommendation.topMoves.includes(sanMove)) { setIsAwaitingUserMove(false); }
  };

  // Conditional return for loading state - must be after all hook calls.
  if (!pgn || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-gray-800 flex items-center justify-center">
        <p className="text-2xl text-white">Loading PGN...</p>
      </div>
    );
  }

  return (
    // Main page container: Flexbox for two-column layout on small screens and up
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-gray-800 text-white p-4 sm:p-8 flex flex-col sm:flex-row gap-6 sm:gap-8">
      
      {/* Left Half: Chat Box Placeholder - Takes 2/5 width on sm screens and up */}
      <div className="w-full sm:w-2/5 md:w-1/3 sm:sticky sm:top-8 bg-slate-800/50 backdrop-blur-md p-6 rounded-xl shadow-xl border border-slate-700/50 flex flex-col max-h-screen sm:max-h-[calc(100vh-4rem)] mb-6 sm:mb-0">
        <h2 className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 mb-4">Chat with AI</h2>
        <div className="flex-grow bg-slate-900/70 rounded-lg p-4 mb-4 overflow-y-auto space-y-3">
          {/* Initial placeholder message - can be removed or conditional */} 
          {!chatOverview && !currentRecommendation && <p className="text-slate-400 text-sm">Chat area for AI recommendations.</p>}

          {/* Display Parsed Overview */}
          {chatOverview && (
            <div className="p-3 bg-slate-800/60 rounded-lg ring-1 ring-slate-700">
              <h3 className="text-md font-semibold text-sky-400 mb-1">Game Overview</h3>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{chatOverview.text}</p>
              {/* TODO: Extract and display studyUrl/studyReason if available */}
            </div>
          )}

          {/* Display Current Recommendation and Hints */}
          {currentRecommendation && !isAwaitingUserMove && (
            <div className="p-3 bg-slate-800/60 rounded-lg ring-1 ring-slate-700">
              <h3 className="text-md font-semibold text-amber-400 mb-1">Recommendation: Move {currentRecommendation.moveNumber} (White)</h3>
              <p className="text-xs text-slate-300 mb-2 italic whitespace-pre-wrap">{currentRecommendation.advice}</p>
              {currentRecommendation.hints.slice(0, revealedHintCount).map((hint, idx) => (
                <p key={idx} className="text-xs text-teal-300 ml-2 py-0.5">- {hint}</p>
              ))}
              {revealedHintCount < currentRecommendation.hints.length && (
                <button 
                  onClick={() => setRevealedHintCount(c => c + 1)}
                  className="mt-1 text-xs bg-teal-700 hover:bg-teal-600 px-2 py-1 rounded shadow">
                  Show Hint ({revealedHintCount + 1}/{currentRecommendation.hints.length})
                </button>
              )}
              <button 
                onClick={() => {
                  setIsAwaitingUserMove(true);
                  setUserMessage("Your turn! Make a move for White on the board.");
                }}
                className="mt-2 w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-1.5 px-3 rounded-lg text-sm shadow">
                Make Your Move
              </button>
            </div>
          )}
          
          {/* User Feedback Messages */}
          {userMessage && (
            <div className={`p-2 text-xs rounded-md shadow ${userMessage.includes("Congrats") || userMessage.includes("Correct") ? 'bg-green-800/70 text-green-200 ring-1 ring-green-600' : userMessage.includes("Error") || userMessage.includes("Could not") ? 'bg-red-800/70 text-red-200 ring-1 ring-red-600' : 'bg-blue-800/70 text-blue-200 ring-1 ring-blue-600'}`}>
              {userMessage}
            </div>
          )}

          {/* Indicator when waiting for user move on board */}
          {isAwaitingUserMove && (
            <div className="p-2 text-xs rounded-md bg-yellow-700/80 text-yellow-100 ring-1 ring-yellow-500 shadow">
              Waiting for you to make a move on the board for White...
            </div>
          )}
        </div>

        {/* Chat Input Area for AI Recommendation */}
        <textarea 
          value={userInputForChat}
          onChange={(e) => setUserInputForChat(e.target.value)}
          className="w-full p-3 bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors resize-none placeholder-slate-400 text-sm" 
          rows={8} 
          placeholder="Paste AI recommendation XML here..."></textarea>
        <button 
          onClick={handleChatSubmit}
          className="mt-3 w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all">
          Process Recommendation
        </button>
      </div>

      {/* Right Half: Existing Game Content - Takes 3/5 width on sm screens and up */}
      <div className="w-full sm:w-3/5 md:w-2/3 flex flex-col">
        <header className="mb-6 md:mb-10">
          <div className="flex justify-between items-center mb-6">
            <button 
              onClick={() => router.push('/')} 
              className="bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 hover:from-purple-700 hover:via-pink-600 hover:to-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 ease-in-out text-sm flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Load New PGN
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
              PGN Game Review
            </h1>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg shadow-lg text-sm">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
              <div><strong className="text-gray-300">Event:</strong> <span className="text-purple-300">{game.header().Event || 'N/A'}</span></div>
              <div><strong className="text-gray-300">Site:</strong> <span className="text-purple-300">{game.header().Site || 'N/A'}</span></div>
              <div><strong className="text-gray-300">Date:</strong> <span className="text-purple-300">{game.header().Date || 'N/A'}</span></div>
              <div><strong className="text-gray-300">White:</strong> <span className="text-gray-100 font-semibold">{game.header().White || 'N/A'}</span></div>
              <div><strong className="text-gray-300">Black:</strong> <span className="text-gray-100 font-semibold">{game.header().Black || 'N/A'}</span></div>
              <div><strong className="text-gray-300">Result:</strong> <span className="text-yellow-300 font-semibold">{game.header().Result || 'N/A'}</span></div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Chessboard container - ChessBoard.tsx itself has a rounded-xl shadow-2xl wrapper */}
          {/* We apply the frosted glass to its parent here for consistency if ChessBoard's own wrapper is changed/removed */}
          <div className="md:col-span-2 bg-slate-700/30 backdrop-blur-lg p-4 md:p-6 rounded-xl shadow-2xl border border-slate-600/50 flex items-center justify-center">
            <ChessBoard 
              key={isAwaitingUserMove ? 'interactive-board' : 'view-only-board'} // Force re-mount on mode change
              fen={isAwaitingUserMove && fenForRecommendation ? fenForRecommendation : currentFen()} 
              orientation="white" // Assuming white's perspective for now, can be dynamic
              allowUserMoves={isAwaitingUserMove}
              playerColor="white" // Hardcoded to white for now, as user makes move for white
              onUserMadeMove={handleUserMadeMoveOnBoard}
            />
          </div>

          {/* MoveList container */}
          <div className="bg-slate-700/30 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-600/50 flex flex-col md:max-h-[calc(var(--vh,1vh)_*_75_-_120px)]">
            <MoveList moves={gameHistory} currentMoveIndex={currentMoveIndex} onNavigate={navigateToMove} />
          </div>
        </div>

        <div className="mt-6 md:mt-8 bg-slate-700/30 backdrop-blur-lg p-4 md:p-6 rounded-xl shadow-2xl border border-slate-600/50 flex items-center justify-center space-x-2 md:space-x-3">
          {[{
            label: 'Start',
            action: () => navigateToMove(-1),
            disabled: currentMoveIndex < 0,
            IconComponent: BackwardIcon
          }, {
            label: 'Previous',
            action: () => navigateToMove(currentMoveIndex - 1),
            disabled: currentMoveIndex < 0,
            IconComponent: ChevronLeftIcon
          }, {
            label: 'Next',
            action: () => navigateToMove(currentMoveIndex + 1),
            disabled: currentMoveIndex >= gameHistory.length - 1,
            IconComponent: ChevronRightIcon
          }, {
            label: 'End',
            action: () => navigateToMove(gameHistory.length - 1),
            disabled: currentMoveIndex >= gameHistory.length - 1,
            IconComponent: ForwardIcon
          }].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              disabled={btn.disabled}
              title={btn.label}
              className="flex items-center justify-center text-white font-semibold py-2 px-3 md:px-4 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 ease-in-out bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 hover:from-purple-700 hover:via-pink-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 disabled:hover:scale-100"
            >
              <btn.IconComponent className="h-5 w-5 md:h-6 md:w-6 mr-1 md:mr-2" />
              <span className="hidden sm:inline text-sm md:text-base">{btn.label}</span>
            </button>
          ))}
        </div>

        <footer className="text-center text-xs text-gray-500 mt-12">
          &copy; {new Date().getFullYear()} PGN Viewer
        </footer>
      </div>
    </div>
  );
}
