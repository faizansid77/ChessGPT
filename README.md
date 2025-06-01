# ChessGPT - AI Chess Tutor

ChessGPT is an AI-powered chess tutoring application designed to help players analyze their games, understand their mistakes, and learn from relevant study material. It combines Stockfish analysis with Lichess study retrieval and advice generation from an LLM.

## How it Works

### Backend

The backend is a Python Flask application that provides an API endpoint for game analysis. When a user submits a game (in PGN format) and specifies their color:

1.  **PGN Parsing**: The game's PGN is parsed to understand the sequence of moves.
2.  **Stockfish Analysis**: Each move played by the user is analyzed by the Stockfish chess engine. The engine calculates:
    *   The evaluation of the position before and after the user's move.
    *   The centipawn loss incurred by the move.
    *   A categorization of the move (e.g., fine, inaccuracy, mistake, blunder).
    *   For significant errors (mistakes/blunders), Stockfish suggests better alternative moves.
3.  **Lichess Study Retrieval**: The system searches a database of processed Lichess studies to find chapters relevant to the positions encountered in the user's game. The top matching studies are selected.
4.  **LLM Prompt Generation**: A detailed prompt is constructed in an XML-like format. This prompt includes:
    *   The Stockfish analysis for each of the user's moves.
    *   Information about the top relevant Lichess studies (ID, title, URL, and extracted chapter text/commentary).
    *   A requested response format for the LLM, guiding it to provide an overview and specific move recommendations.
5.  **LLM API Call**: The generated prompt is sent to the LLM API (specifically, the `claude-opus-4-20250514` model).
6.  **Response Processing**: The advice returned by the LLM is then sent back to the client.

### Conceptual Frontend

The frontend is an interactive web interface where users can:

1.  **Submit Games**: Paste or upload a PGN of a game they've played.
2.  **View Overview**: Receive an overall summary of their game, highlighting key moments and linking to the most relevant Lichess study identified by the backend.
3.  **Interactive Move Analysis**: For each mistake or blunder identified:
    *   The board position where the error occurred is displayed.
    *   The LLM's advice for that specific move is shown.
    *   The user is given an opportunity to try to find one of Stockfish's recommended better moves on the interactive board.
    *   Hints (provided by the LLM) can be revealed one by one if the user is stuck.
    *   After attempting to find the move or requesting to see the solution, Stockfish's top alternative moves are displayed on the board.

This interactive loop aims to make learning more engaging and effective.

## API Endpoint

### `/analyze`

*   **Method**: `POST`
*   **Description**: Analyzes a given PGN string and returns tutoring advice.
*   **Request Body** (JSON):
    ```json
    {
      "pgn": "<PGN_STRING>",
      "player_color": "<white_or_black>"
    }
    ```
*   **Success Response** (JSON):
    ```json
    {
      "advice": "<CLAUDE_GENERATED_ADVICE_XML_STRING>"
    }
    ```
*   **Error Response** (JSON):
    ```json
    {
      "error": "<ERROR_MESSAGE>"
    }
    ```

### Example: Scholar's Mate Analysis

**Request:**

```bash
curl -X POST -H "Content-Type: application/json" \
-d '{
"pgn": "[Event \"Sample Game\"]\n[Site \"-\"]\n[Date \"????.??.??\"]\n[Round \"-\"]\n[White \"Player1\"]\n[Black \"Player2\"]\n[Result \"1-0\"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0",
"player_color": "black"
}' \
http://127.0.0.1:5001/analyze
```

**Response:**

```json
{
  "advice": "<overview>
  This game shows the classic Scholar's Mate pattern, where White is attempting a quick checkmate with Qh5. After 1.e4 e5 2.Qh5 Nc6 3.Bc4, Black has fallen into a critical position where they must defend against the immediate checkmate threat on f7. The move 3...Nf6?? is a devastating blunder that allows White to deliver checkmate in one move with 4.Qxf7#.

  The most relevant study for you is \"Chess Opening Traps - Scholar's Mate\" (https://lichess.org/study/JBtn8H96). This study will help you understand this common beginner's trap and how to defend against it properly. Learning these patterns is essential for avoiding quick losses in your games.
</overview>

<move_recommendation>
  <move_number>3</move_number>
  <ply>6</ply>
  <advice>Your move 3...Nf6?? loses immediately to Scholar's Mate! White can now play 4.Qxf7# for checkmate. The f7 pawn is only defended by your king, and White's queen and bishop are both attacking it. When defending against Scholar's Mate, you must protect the f7 square while developing your pieces. The best defensive moves were 3...g6 (kicking the queen away), 3...Qe7 (defending f7 and preparing to develop), or 3...Qf6 (defending f7 and counterattacking).</advice>
  <hint>White is threatening Qxf7# checkmate - you must defend the f7 pawn immediately!</hint>
  <hint>Moving the knight to f6 blocks your own queen from defending f7, leaving it vulnerable to the queen and bishop battery.</hint>
  <top_moves>
    <move>g6</move>
    <move>Qe7</move>
    <move>Qf6</move>
  </top_moves>
</move_recommendation>"
}
```

## Setup and Running

1.  **Prerequisites**:
    *   Python 3.x
    *   Stockfish executable (place it in `backend/stockfish` and ensure it's executable).
2.  **Clone the repository** (if applicable).
3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
4.  **Set up Environment Variables**:
    *   Copy `.env.example` to `.env`.
    *   Add your `ANTHROPIC_API_KEY` to the `.env` file:
        ```
        ANTHROPIC_API_KEY='your_actual_api_key'
        ```
5.  **Run the backend server**:
    ```bash
    cd backend
    python app.py
    ```
    The server will run on `http://127.0.0.1:5001`.

## Project Structure

```
ChessGPT/
├── backend/
│   ├── app.py                # Flask application, API endpoints
│   ├── main_analyzer.py      # Core logic for analysis, prompt gen, Claude call
│   ├── fen_processor.py      # Processes Lichess studies into FENs
│   ├── fen_retriever.py      # Retrieves relevant studies for a game
│   ├── stockfish             # Stockfish executable
│   └── (other .py files...)
├── data/
│   ├── lichess_studies_2.json # Raw Lichess study data (example)
│   └── processed_study_fens.json # Processed FENs from studies (example)
├── .env                    # Local environment variables (Anthropic API Key) - DO NOT COMMIT
├── .env.example            # Example environment file
├── .gitignore
├── requirements.txt
└── README.md
```
