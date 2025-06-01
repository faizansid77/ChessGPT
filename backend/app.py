import os
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# Import the analysis functions from main_analyzer.py
# Ensure main_analyzer.py is in the same directory or accessible via PYTHONPATH
from main_analyzer import analyze_game_and_generate_prompt, get_claude_opus_advice

# Load environment variables from .env file in the project root
# This is crucial for accessing ANTHROPIC_API_KEY
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

app = Flask(__name__)

@app.route('/analyze', methods=['POST'])
def analyze_pgn():
    data = request.get_json()
    if not data or 'pgn' not in data or 'player_color' not in data:
        return jsonify({'error': 'Missing pgn or player_color in request body'}), 400

    pgn_string = data['pgn']
    player_color_str = data['player_color'].lower()

    if player_color_str not in ['white', 'black']:
        return jsonify({'error': 'Invalid player_color. Must be "white" or "black".'}), 400

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return jsonify({'error': 'ANTHROPIC_API_KEY not configured on the server.'}), 500

    try:
        print(f"Analyzing PGN for {player_color_str}...")
        llm_prompt = analyze_game_and_generate_prompt(pgn_string, player_color_str)
        
        if llm_prompt.startswith("Error:") or not llm_prompt:
             # analyze_game_and_generate_prompt might return error strings or empty if issues occur
            return jsonify({'error': f'Failed to generate LLM prompt: {llm_prompt}'}), 500

        print("Contacting Claude API for advice...")
        advice = get_claude_opus_advice(llm_prompt, api_key)

        # get_claude_opus_advice also returns error strings on failure
        if advice.startswith("Error:") or advice.startswith("Claude API"):
            return jsonify({'error': f'Failed to get advice from Claude: {advice}'}), 500

        return jsonify({'advice': advice})

    except Exception as e:
        # Catch any other unexpected errors during the process
        print(f"An unexpected error occurred in /analyze: {e}")
        import traceback
        traceback.print_exc() # Log the full traceback to server console
        return jsonify({'error': f'An unexpected server error occurred: {str(e)}'}), 500

if __name__ == '__main__':
    # Note: debug=True is convenient for development but should be False in production
    app.run(debug=True, port=5001) # Using port 5001 to avoid common conflicts
