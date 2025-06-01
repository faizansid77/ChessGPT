import chess
import chess.pgn
import chess.engine
import json
import os
import io # Required for StringIO
import html # For XML character escaping
from dotenv import load_dotenv
import anthropic
import xml.etree.ElementTree as ET

# Assuming fen_retriever.py is in the same directory (backend/)
import fen_retriever 

# Path to the Stockfish executable within the backend directory
STOCKFISH_PATH = os.path.join(os.path.dirname(__file__), "stockfish")

# Define thresholds for move categories (example values, can be tuned)
# Centipawn loss thresholds
INACCURACY_THRESHOLD = 50  # 0.5 pawns
MISTAKE_THRESHOLD = 100    # 1.0 pawns
BLUNDER_THRESHOLD = 200    # 2.0 pawns

# Lichess study base URL
LICHESS_STUDY_URL = "https://lichess.org/study/"

# Helper function to generate the LLM prompt XML
def _generate_llm_prompt_xml(analyzed_moves, top_studies):
    prompt_parts = []

    prompt_parts.append("<prompt>")
    prompt_parts.append("  <llm_role>You are a chess tutor. Analyze the provided game using Stockfish analysis and relevant Lichess studies.</llm_role>")
    
    prompt_parts.append("  <stockfish_analysis>")
    for move_data in analyzed_moves:
        prompt_parts.append(f"    <move>")
        prompt_parts.append(f"      <move_number>{move_data['move_number']}</move_number>")
        prompt_parts.append(f"      <player_move_san>{html.escape(move_data['player_move_san'])}</player_move_san>")
        prompt_parts.append(f"      <eval_before_white_pov>{move_data['eval_before_white_pov']}</eval_before_white_pov>")
        prompt_parts.append(f"      <eval_after_white_pov>{move_data['eval_after_white_pov']}</eval_after_white_pov>")
        prompt_parts.append(f"      <centipawn_loss>{move_data['cp_loss']}</centipawn_loss>")
        prompt_parts.append(f"      <category>{move_data['category']}</category>")
        if move_data['category'] in ['mistake', 'blunder'] and move_data['top_alternative_moves']:
            prompt_parts.append(f"      <top_alternative_moves>")
            for alt_move in move_data['top_alternative_moves']:
                prompt_parts.append(f"        <move>{html.escape(alt_move)}</move>")
            prompt_parts.append(f"      </top_alternative_moves>")
        prompt_parts.append(f"    </move>")
    prompt_parts.append("  </stockfish_analysis>")

    prompt_parts.append("  <lichess_studies>")
    if top_studies:
        for study in top_studies:
            prompt_parts.append(f"    <study>")
            prompt_parts.append(f"      <study_id>{study['study_id']}</study_id>")
            prompt_parts.append(f"      <chapter_title>{html.escape(study['chapter'])}</chapter_title>")
            prompt_parts.append(f"      <url>{study['url']}</url>")
            prompt_parts.append(f"      <relevance_stats>")
            prompt_parts.append(f"        <average_distance>{study['average_distance']:.2f}</average_distance>")
            prompt_parts.append(f"        <distinct_ply_matches>{study['distinct_ply_matches']}</distinct_ply_matches>")
            prompt_parts.append(f"      </relevance_stats>")
            prompt_parts.append(f"      <chapter_content>{html.escape(study.get('chapter_text_content', ''))}</chapter_content>")
            prompt_parts.append(f"    </study>")
    prompt_parts.append("  </lichess_studies>")

    prompt_parts.append("  <response_format>")
    prompt_parts.append("    <overview> Overall overview of what happened in the game, as well as the top Lichess study and its URL, and why it's relevant for them to read. </overview>")
    for move_data in analyzed_moves:
        if move_data['category'] in ['mistake', 'blunder']:
            prompt_parts.append(f"    <move_recommendation>")
            prompt_parts.append(f"      <move_number>{move_data['move_number']}</move_number>")
            prompt_parts.append(f"      <ply>{move_data['ply_for_prompt']}</ply>")
            prompt_parts.append(f"      <advice> <!-- LLM generated advice --> </advice>")
            prompt_parts.append(f"      <hint> <!-- Hint 1 --> </hint>")
            prompt_parts.append(f"      <hint> <!-- Hint 2 --> </hint>")
            if move_data['top_alternative_moves']:
                prompt_parts.append(f"      <top_moves>") 
                for alt_move in move_data['top_alternative_moves']:
                    prompt_parts.append(f"        <move>{html.escape(alt_move)}</move>")
                prompt_parts.append(f"      </top_moves>")
            prompt_parts.append(f"    </move_recommendation>")
    prompt_parts.append("  </response_format>")
    prompt_parts.append("</prompt>")
    
    return "\n".join(prompt_parts)

def analyze_game_and_generate_prompt(pgn_string: str, player_color_str: str):
    """
    Analyzes a chess game from a PGN string, identifies key moments,
    retrieves relevant studies, and generates a prompt for an LLM.

    Args:
        pgn_string: The PGN of the game as a string.
        player_color_str: The color the player was playing ("white" or "black").

    Returns:
        A string formatted as an LLM prompt.
    """
    # Validate player_color_str and convert to chess.WHITE or chess.BLACK
    if player_color_str.lower() == "white":
        player_color = chess.WHITE
    elif player_color_str.lower() == "black":
        player_color = chess.BLACK
    else:
        raise ValueError("Invalid player_color_str. Must be 'white' or 'black'.")

    # --- Phase 1: PGN Processing and Stockfish Analysis ---
    pgn_io = io.StringIO(pgn_string)
    game = chess.pgn.read_game(pgn_io)
    if game is None:
        raise ValueError("Invalid PGN string or no game found.")

    board = game.board()
    analyzed_moves = []
    all_game_fens_for_study_retrieval = [board.fen()] # Start with initial position FEN

    engine = None
    try:
        engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
        # Set a default limit for analysis, e.g., 0.1 seconds per move or a certain depth
        # Using a time limit for expediency as discussed.
        # More complex scenarios might vary this or use depth.
        analysis_limit = chess.engine.Limit(time=0.1) 

        # Get initial evaluation of the starting position
        # This helps establish a baseline if the first move is analyzed for player_color
        # For simplicity, we'll calculate eval_before inside the loop for the position just before the player's move.

        for i, node in enumerate(game.mainline()): # node is a GameNode, node.move is the move leading to this node's board state
            move = node.move
            # The board state *before* this move was `board`
            # The board state *after* this move is `node.board()`
            
            current_player_turn = board.turn # True for White, False for Black

            if current_player_turn == player_color:
                move_number = board.fullmove_number if player_color == chess.WHITE else board.fullmove_number
                ply_number = board.ply() # Ply number *before* the current move is made on `board`
                # For prompt, if user wants 1-indexed game ply, it's board.ply() + 1 before board.push(move)
                # Or, if it's after the move, it would be node.board().ply()

                # Get evaluation *before* the player's move
                info_before = engine.analyse(board, analysis_limit)
                eval_before_cp = info_before.get("score").pov(chess.WHITE).score(mate_score=10000) # Mate score large to avoid issues with None

                # Make the move on a temporary board to get eval_after, or use node.board()
                board_after_move = board.copy()
                board_after_move.push(move)
                info_after = engine.analyse(board_after_move, analysis_limit)
                eval_after_cp = info_after.get("score").pov(chess.WHITE).score(mate_score=10000)

                # Centipawn loss calculation (from player's perspective)
                # If player is White, loss is eval_before - eval_after
                # If player is Black, loss is eval_after - eval_before (since eval_before and eval_after are from White's POV)
                # Or, if we adjusted eval_after_cp and eval_before_cp for Black's perspective (by negating), then loss is always eval_before_cp - eval_after_cp
                # Let's stick to White's POV for evals and adjust loss calculation
                if player_color == chess.WHITE:
                    cp_loss = eval_before_cp - eval_after_cp 
                else: # Player is Black
                    cp_loss = -(eval_before_cp - eval_after_cp) # Loss for black is gain for white

                move_category = "fine"
                if cp_loss >= BLUNDER_THRESHOLD:
                    move_category = "blunder"
                elif cp_loss >= MISTAKE_THRESHOLD:
                    move_category = "mistake"
                elif cp_loss >= INACCURACY_THRESHOLD:
                    move_category = "inaccuracy"
                
                top_moves_for_prompt = []
                if move_category in ["mistake", "blunder"]:
                    # Get Stockfish's top N alternative moves from the position *before* the player's move
                    # The 'info_before' object contains the best move (pv[0]) and possibly others if multipv is set.
                    # For simplicity, let's assume info_before.get("pv")[0] is the best move. We might need to ask for multipv.
                    # Let's re-analyze with multipv for this specific case to get a few top moves.
                    multipv_info = engine.analyse(board, analysis_limit, multipv=3)
                    for i in range(min(3, len(multipv_info))):
                        best_move_variation = multipv_info[i].get("pv")
                        if best_move_variation:
                            top_moves_for_prompt.append(board.san(best_move_variation[0]))
                
                analyzed_moves.append({
                    "move_number": move_number,
                    "player_move_san": board.san(move),
                    "board_fen_before": board.fen(),
                    "eval_before_white_pov": info_before.get("score").white().score(mate_score=10000),
                    "eval_after_white_pov": info_after.get("score").white().score(mate_score=10000),
                    "cp_loss": cp_loss,
                    "category": move_category,
                    "stockfish_best_move_san": board.san(info_before.get("pv")[0]) if info_before.get("pv") else "N/A",
                    "top_alternative_moves": top_moves_for_prompt, # For mistakes/blunders
                    "ply_for_prompt": board.ply() + 1 # Example: 1-indexed game ply *before* move
                })

            # Crucial: advance the main board state for the next iteration
            board.push(move)
            all_game_fens_for_study_retrieval.append(board.fen())

    except Exception as e:
        # Ensure engine is closed even if an error occurs elsewhere
        if engine:
            engine.quit()
        raise e # Re-raise the exception after cleanup
    finally:
        if engine:
            engine.quit()

    # For debugging or to see results so far:
    print("\n--- Analyzed Moves ---")
    for am in analyzed_moves:
        print(json.dumps(am, indent=2))
    print("----------------------")

    # --- Phase 2: Study Retrieval ---
    top_studies_for_prompt = []
    # Load the database of processed FENs from studies
    all_study_fens_data = fen_retriever.load_processed_fens()
    chapter_texts_map = fen_retriever.load_chapter_texts() # Load chapter texts

    if chapter_texts_map is None: # Handle missing chapter text file
        print("Warning: Chapter texts map could not be loaded. Proceeding without chapter content.")
        chapter_texts_map = {}

    if not all_study_fens_data:
        print("Warning: Could not load study FEN data. Skipping study retrieval.")
    elif not all_game_fens_for_study_retrieval:
        print("Warning: No FENs extracted from the game. Skipping study retrieval.")
    else:
        print(f"\nRanking studies based on {len(all_game_fens_for_study_retrieval)} game FENs...")
        # Get ranked studies/chapters based on the user's game FENs
        # The rank_studies_for_game function expects a list of FEN strings from the user's game.
        ranked_studies = fen_retriever.rank_studies_for_game(
            user_game_fens_list=all_game_fens_for_study_retrieval, 
            all_fens_data=all_study_fens_data,
            chapter_texts_map=chapter_texts_map, # Pass the loaded chapter texts
            top_n_ply_matches=1 # Default value, consider making it configurable
        )

        if ranked_studies:
            print(f"Found {len(ranked_studies)} relevant study chapters.")
            # Take top 3 for the prompt
            for i, study_info in enumerate(ranked_studies[:3]):
                top_studies_for_prompt.append({
                    "study_id": study_info['study_id'],
                    "chapter": study_info['chapter'],
                    "url": study_info['lichess_url'], # Use the URL from fen_retriever
                    "average_distance": study_info['average_distance'],
                    "distinct_ply_matches": study_info['distinct_ply_matches'],
                    "chapter_text_content": study_info.get('chapter_text_content', '') # Ensure text is passed
                })
        else:
            print("No relevant study chapters found for this game.")

    # For debugging or to see results so far:
    print("\n--- Top Studies for Prompt ---")
    for ts in top_studies_for_prompt:
        print(json.dumps(ts, indent=2))
    print("----------------------------")

    # --- Phase 3: Prompt Generation ---
    # Generate the LLM prompt
    llm_prompt = _generate_llm_prompt_xml(analyzed_moves, top_studies_for_prompt)
    # The function will now return the prompt and defer API call to the main execution block or an API endpoint
    return llm_prompt

def get_claude_opus_advice(xml_prompt_string: str, api_key: str):
    """Sends the XML prompt to Claude 4 Opus and returns the advice."""
    if not api_key:
        return "Error: ANTHROPIC_API_KEY not set. Cannot contact Claude API."

    try:
        # Parse the XML to extract the system prompt (llm_role)
        # and the user message (the rest of the prompt)
        # This is a simplified approach; robust XML parsing might be needed for complex structures
        # For now, we assume llm_role is the first direct child of <prompt>
        # and the rest of the <prompt> content is the user message.
        
        tree = ET.fromstring(xml_prompt_string)
        system_prompt_element = tree.find('llm_role')
        system_prompt = system_prompt_element.text.strip() if system_prompt_element is not None and system_prompt_element.text else "You are a helpful chess tutor."
        
        # Remove llm_role to create the user message part
        if system_prompt_element is not None:
            tree.remove(system_prompt_element)
        
        # The user message is the remaining XML structure
        user_message_xml_parts = []
        for element in tree:
            user_message_xml_parts.append(ET.tostring(element, encoding='unicode'))
        user_message_content = "\n".join(user_message_xml_parts)

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-opus-4-20250514",
            max_tokens=4000, # Adjust as needed
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": user_message_content
                }
            ]
        )
        # Assuming the response structure gives text content directly
        # Based on Anthropic's typical API, the content is in response.content[0].text
        if response.content and len(response.content) > 0 and hasattr(response.content[0], 'text'):
            return response.content[0].text
        else:
            return "Error: Unexpected response structure from Claude API."

    except ET.ParseError as e:
        return f"Error parsing XML prompt: {e}"
    except anthropic.APIConnectionError as e:
        return f"Claude API connection error: {e.__cause__}"
    except anthropic.RateLimitError as e:
        return f"Claude API rate limit exceeded: {e.response.text}"
    except anthropic.APIStatusError as e:
        return f"Claude API status error (status {e.status_code}): {e.response}"
    except Exception as e:
        return f"An unexpected error occurred while contacting Claude API: {e}"

if __name__ == '__main__':
    # Load environment variables from .env file if it exists
    # This is useful for local development to store API keys
    # Make sure .env is in your .gitignore!
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env')) # Looks for .env in the project root

    # Test with Scholar's Mate PGN, player is Black
    sample_pgn = """
[Event "Sample Game"]
[Site "-"]
[Date "????.??.??"]
[Round "-"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0
"""
    player_color = "black"
    
    # Ensure Stockfish is executable and accessible
    if not os.path.exists(STOCKFISH_PATH) or not os.access(STOCKFISH_PATH, os.X_OK):
        print(f"Error: Stockfish executable not found or not executable at {STOCKFISH_PATH}")
        print("Please ensure Stockfish is correctly placed and has execute permissions.")
    else:
        print(f"Attempting to analyze PGN for {player_color}...")
        try:
            # IMPORTANT: Set your ANTHROPIC_API_KEY environment variable before running!
            # For example, in your terminal: export ANTHROPIC_API_KEY='your_key_here'
            api_key = os.getenv("ANTHROPIC_API_KEY")

            if not api_key:
                print("Error: ANTHROPIC_API_KEY environment variable not set.")
                print("Please set it and try again. Example: export ANTHROPIC_API_KEY='your_key_here'")
            else:
                print(f"Attempting to analyze PGN for {player_color} and get Claude advice...")
                final_llm_prompt = analyze_game_and_generate_prompt(sample_pgn, player_color)
                print("\n--- Generated LLM Prompt ---")
                print(final_llm_prompt)
                print("----------------------------")

                print("\n--- Contacting Claude 3 Opus for advice... ---")
                advice = get_claude_opus_advice(final_llm_prompt, api_key)
                print("\n--- Advice from Claude 3 Opus ---")
                print(advice)
                print("-----------------------------------")

            print("\n--- main_analyzer.py finished ---") 
        except ValueError as e:
            print(f"Error: {e}")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            import traceback
            traceback.print_exc()
