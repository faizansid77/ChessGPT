import json
import Levenshtein
import time
import argparse
import chess
import chess.pgn

PROCESSED_FEN_FILE = "data/processed_study_fens.json"

def convert_fen_to_dotted_pieces(full_fen_string):
    """Converts the piece placement part of a FEN string to use dots for empty squares."""
    if not full_fen_string:
        return ""
    piece_placement = full_fen_string.split(' ')[0]
    dotted_placement = ''
    for char in piece_placement:
        if char.isdigit():
            dotted_placement += '.' * int(char)
        else:
            dotted_placement += char
    return dotted_placement

def load_processed_fens(filepath=PROCESSED_FEN_FILE):
    """Loads the processed FEN data from the JSON file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"Successfully loaded {len(data)} FEN records from {filepath}")
        return data
    except FileNotFoundError:
        print(f"Error: Processed FEN file '{filepath}' not found.")
        return None
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{filepath}'.")
        return None

def find_closest_fens_naive(query_dotted_fen, all_fens_data, top_n=5):
    """
    Naively finds the top_n closest FENs from all_fens_data to the query_dotted_fen
    using Levenshtein distance.
    Returns a list of tuples: (distance, fen_record).
    """
    if not all_fens_data:
        return []

    distances = []
    for record in all_fens_data:
        dist = Levenshtein.distance(query_dotted_fen, record['dotted_fen'])
        distances.append((dist, record))
    
    # Sort by distance
    distances.sort(key=lambda x: x[0])
    
    return distances[:top_n]


def get_fens_from_pgn_file(pgn_filepath):
    """Parses a PGN file and returns a list of FENs for each ply of the first game."""
    fens = []
    try:
        with open(pgn_filepath, 'r', encoding='utf-8') as pgn_file:
            # Read the first game from the PGN file
            game = chess.pgn.read_game(pgn_file)
            if game:
                board = game.board()
                fens.append(board.fen()) # Initial position FEN
                for move in game.mainline_moves():
                    board.push(move)
                    fens.append(board.fen())
            else:
                print(f"No game found in PGN file: {pgn_filepath}")
                return None
    except FileNotFoundError:
        print(f"Error: PGN file '{pgn_filepath}' not found.")
        return None
    except Exception as e:
        print(f"Error reading or parsing PGN file {pgn_filepath}: {e}")
        return None
    return fens

def rank_studies_for_game(user_game_fens_list, all_fens_data, top_n_ply_matches=1):
    """
    Ranks studies/chapters based on their relevance to a user's game.
    user_game_fens_list: A list of FEN strings from the user's game.
    all_fens_data: The loaded processed FEN data from studies.
    top_n_ply_matches: How many top matches from the database to consider for each ply of the user's game.
    """
    if not all_fens_data or not user_game_fens_list:
        print("No FEN data provided for ranking studies.")
        return []

    # Key: (study_id, chapter_title), Value: {'distances': [], 'ply_indices_matched': set()}
    study_chapter_relevance = {}

    print(f"Analyzing {len(user_game_fens_list)} plies from the user's game...")
    for ply_idx, user_fen_full in enumerate(user_game_fens_list):
        user_dotted_fen = convert_fen_to_dotted_pieces(user_fen_full)
        if not user_dotted_fen:
            # print(f"Skipping empty dotted FEN for ply {ply_idx}: {user_fen_full}")
            continue

        # Find the closest FENs in the database for the current ply of the user's game
        closest_ply_matches = find_closest_fens_naive(user_dotted_fen, all_fens_data, top_n=top_n_ply_matches)

        for dist, record in closest_ply_matches:
            key = (record['study_id'], record['chapter'])
            if key not in study_chapter_relevance:
                study_chapter_relevance[key] = {'distances': [], 'ply_indices_matched': set()}
            
            study_chapter_relevance[key]['distances'].append(dist)
            study_chapter_relevance[key]['ply_indices_matched'].add(ply_idx)
    
    if not study_chapter_relevance:
        print("No relevant study chapters found after analyzing game plies.")
        return []

    # Calculate scores for ranking
    ranked_studies = []
    for key, data in study_chapter_relevance.items():
        if not data['distances']:
            continue
        
        study_id, chapter_title = key
        avg_distance = sum(data['distances']) / len(data['distances'])
        # How many unique plies of the user game this study/chapter had a top_n_ply_match for
        num_distinct_ply_matches = len(data['ply_indices_matched']) 
        
        ranked_studies.append({
            'study_id': study_id,
            'chapter': chapter_title,
            'average_distance': avg_distance,
            'distinct_ply_matches': num_distinct_ply_matches,
            'total_close_references': len(data['distances'])
        })

    # Sort: prioritize studies/chapters that match more plies of the user's game,
    # then by average Levenshtein distance (lower is better).
    ranked_studies.sort(key=lambda x: (-x['distinct_ply_matches'], x['average_distance']))
    
    return ranked_studies

def main():
    parser = argparse.ArgumentParser(description="Find closest FENs or rank studies for a game from processed Lichess study data.")
    parser.add_argument(
        "query_fen", 
        nargs='?', 
        default=None, # Default to None, will check if game_pgn is used
        help="The FEN string to query for single FEN lookup. Can be a full FEN or just piece placement. Not used if --game_pgn is specified."
    )
    parser.add_argument(
        "--top_n", 
        type=int, 
        default=5, 
        help="Number of closest FENs to retrieve for single FEN lookup, or number of top study/chapter matches for game analysis."
    )
    parser.add_argument(
        "--file",
        type=str,
        default=PROCESSED_FEN_FILE,
        help=f"Path to the processed FENs JSON file (default: {PROCESSED_FEN_FILE})"
    )
    parser.add_argument(
        "--game_pgn",
        type=str,
        default=None,
        help="Path to a PGN file representing the user's game. If provided, ranks studies based on this game."
    )
    parser.add_argument(
        "--top_n_ply_matches",
        type=int,
        default=1,
        help="For game analysis, how many top database FENs to consider for each ply of the user's game (default: 1)."
    )

    args = parser.parse_args()

    all_fens_data = load_processed_fens(args.file)
    if not all_fens_data:
        return

    if args.game_pgn:
        print(f"Starting game analysis for PGN: {args.game_pgn}")
        user_game_fens = get_fens_from_pgn_file(args.game_pgn)
        if not user_game_fens:
            print(f"Could not extract FENs from {args.game_pgn}. Exiting.")
            return
        
        start_time = time.time()
        ranked_study_chapters = rank_studies_for_game(user_game_fens, all_fens_data, top_n_ply_matches=args.top_n_ply_matches)
        end_time = time.time()

        print(f"\nGame analysis completed in {end_time - start_time:.4f} seconds.")
        if ranked_study_chapters:
            print(f"\nTop {min(args.top_n, len(ranked_study_chapters))} relevant study chapters:")
            for i, entry in enumerate(ranked_study_chapters[:args.top_n]):
                print(f"  {i+1}. Study ID: {entry['study_id']} - Chapter: {entry['chapter']}")
                print(f"     Avg Distance: {entry['average_distance']:.2f}")
                print(f"     Distinct Plies Matched: {entry['distinct_ply_matches']}/{len(user_game_fens)}")
                # print(f"     Total Close References: {entry['total_close_references']}") # More verbose
                print("     -----")
        else:
            print("No relevant study chapters found for the provided game.")

    elif args.query_fen:
        # Original single FEN lookup logic
        query_fen_to_process = args.query_fen
        if query_fen_to_process == 'None': # Workaround if nargs='?' passes 'None' string
            query_fen_to_process = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1" # Default if no FEN and no game_pgn
            print(f"No query FEN or game PGN provided. Using default FEN: {query_fen_to_process}")

        if ' ' in query_fen_to_process: 
            query_dotted_fen = convert_fen_to_dotted_pieces(query_fen_to_process)
            print(f"Original Query FEN: {query_fen_to_process}")
            print(f"Converted to Dotted Piece FEN for search: {query_dotted_fen}")
        else:
            query_dotted_fen = query_fen_to_process
            print(f"Query Dotted Piece FEN: {query_dotted_fen}")

        if not query_dotted_fen:
            print("Query FEN is empty after conversion. Exiting.")
            return

        print(f"\nSearching for top {args.top_n} closest FENs (naive approach)...")
        start_time = time.time()
        closest_fens = find_closest_fens_naive(query_dotted_fen, all_fens_data, top_n=args.top_n)
        end_time = time.time()

        print(f"\nSearch completed in {end_time - start_time:.4f} seconds.")

        if closest_fens:
            print(f"\nTop {len(closest_fens)} matches:")
            for i, (dist, record) in enumerate(closest_fens):
                print(f"  {i+1}. Distance: {dist}")
                print(f"     Study ID: {record['study_id']}")
                print(f"     Chapter: {record['chapter']}")
                print(f"     Ply: {record['ply']}")
                print(f"     Dotted FEN: {record['dotted_fen']}")
                print(f"     Original FEN: {record['original_fen']}")
                print("     -----")
        else:
            print("No matches found.")
    else:
        print("No query FEN provided and no game PGN specified. Use --help for options.")

if __name__ == "__main__":
    main()
