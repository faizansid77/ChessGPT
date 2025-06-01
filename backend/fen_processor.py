import json
import chess
import chess.pgn
import multiprocessing
from tqdm import tqdm
import io
import os

INPUT_JSON_FILE = "data/lichess_studies_2.json"
OUTPUT_PROCESSED_FILE = "data/processed_study_fens.json"

# Ensure python-chess and tqdm are installed: pip install python-chess tqdm

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

def process_single_study_data(study_item):
    """
    Processes a single study item (dictionary) to extract FENs for each ply.
    Returns a list of dictionaries, each representing a FEN record.
    """
    study_id = study_item.get('study_id', 'UNKNOWN_ID')
    pgn_string = study_item.get('pgn')
    study_title = study_item.get('title', 'Unknown Study') # For context in case of errors

    if not pgn_string:
        return []

    processed_fens_for_study = []
    try:
        pgn_file_handle = io.StringIO(pgn_string)
        chapter_num = 0
        while True:
            chapter_num += 1
            current_game_node = chess.pgn.read_game(pgn_file_handle)
            if current_game_node is None:
                break 

            chapter_title_from_headers = current_game_node.headers.get("Event", f"Chapter {chapter_num}")
            chapter_identifier = f"{study_title} - {chapter_title_from_headers}"
            
            board = current_game_node.board()
            
            initial_full_fen = board.fen()
            initial_dotted_fen = convert_fen_to_dotted_pieces(initial_full_fen)
            processed_fens_for_study.append({
                "dotted_fen": initial_dotted_fen,
                "study_id": study_id,
                "chapter": chapter_identifier,
                "ply": 0,
                "original_fen": initial_full_fen
            })

            for move in current_game_node.mainline_moves():
                board.push(move)
                full_fen = board.fen()
                dotted_fen_pieces = convert_fen_to_dotted_pieces(full_fen)
                processed_fens_for_study.append({
                    "dotted_fen": dotted_fen_pieces,
                    "study_id": study_id,
                    "chapter": chapter_identifier,
                    "ply": board.ply(),
                    "original_fen": full_fen
                })
    except Exception as e:
        error_context_chapter = chapter_identifier if 'chapter_identifier' in locals() else f"Chapter {chapter_num} (or earlier)"
        print(f"Error processing PGN for study {study_id} ('{study_title}'), chapter context: '{error_context_chapter}': {e}. Skipping this study's remaining content.")
        return [] 
    
    return processed_fens_for_study

def main():
    print(f"Loading studies from {INPUT_JSON_FILE}...")
    try:
        with open(INPUT_JSON_FILE, 'r', encoding='utf-8') as f:
            all_studies_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file {INPUT_JSON_FILE} not found.")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {INPUT_JSON_FILE}.")
        return

    if not all_studies_data:
        print("No studies found in the input file.")
        return

    print(f"Loaded {len(all_studies_data)} studies. Starting FEN processing with multiprocessing...")

    num_processes = os.cpu_count()
    print(f"Using {num_processes} processes.")

    all_processed_fens = []
    with multiprocessing.Pool(processes=num_processes) as pool:
        results_iterator = pool.imap_unordered(process_single_study_data, all_studies_data)
        
        for single_study_fens in tqdm(results_iterator, total=len(all_studies_data), desc="Processing studies"):
            if single_study_fens:
                all_processed_fens.extend(single_study_fens)

    print(f"\nFinished processing. Total FENs extracted: {len(all_processed_fens)}")

    if all_processed_fens:
        print(f"Saving processed FENs to {OUTPUT_PROCESSED_FILE}...")
        try:
            with open(OUTPUT_PROCESSED_FILE, 'w', encoding='utf-8') as f:
                json.dump(all_processed_fens, f, indent=2) # Pretty-print with indent
            print(f"Successfully saved {len(all_processed_fens)} FENs to {OUTPUT_PROCESSED_FILE}")
        except IOError as e:
            print(f"Error saving processed FENs: {e}")
    else:
        print("No FENs were extracted. Output file will not be created.")

if __name__ == "__main__":
    main()
