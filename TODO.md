# Chess Tutor Backend - TODO List

## Phase 1: Knowledge Acquisition and Storage

1.  **Identify and Scrape Chess Knowledge Sources:**
    *   Research potential sources:
        *   Chess opening databases (e.g., ECO codes, popular lines).
        *   Middlegame strategy guides (e.g., pawn structures, piece activity, common tactical motifs).
        *   Endgame theory and databases (e.g., Lichess tablebase, Nalimov).
        *   Annotated master games.
        *   Chess principles and heuristics.
    *   Determine data formats (PGN, FEN, plain text, structured data).
    *   Develop/utilize scraping tools (Python libraries like `requests`, `BeautifulSoup`, or specialized chess libraries).
    *   Organize scraped data into a processable format (e.g., text files, JSON, CSV).
    *   *Consideration:* How to chunk large pieces of information for effective embedding.

2.  **Set Up and Learn Voyage AI:**
    *   Sign up for Voyage AI and obtain an API key.
    *   Set `VOYAGE_API_KEY` as an environment variable.
    *   Install the Voyage AI Python client: `pip install -U voyageai`.
    *   Familiarize yourself with the `voyageai.Client()` and its `embed()` method.
        *   Understand `input_type="document"` for your knowledge base and `input_type="query"` for user inputs.
        *   Choose an appropriate embedding model (e.g., `voyage-3.5` or `voyage-3-large`).
        *   Understand token limits and batching for embedding.

3.  **Process and Embed Chess Knowledge into Voyage AI:**
    *   Write Python scripts to:
        *   Load the scraped chess knowledge.
        *   Preprocess text (clean, structure, chunk if necessary).
        *   Use the Voyage AI client to generate embeddings for each piece of knowledge.
    *   **Store Embeddings and Corresponding Text:**
        *   *Initial:* Store embeddings and their original text locally (e.g., in NumPy arrays/lists and a corresponding list of texts, or simple files).
        *   *Scalable:* Evaluate and implement a vector database (e.g., FAISS, ChromaDB, Pinecone, Weaviate) if the knowledge base becomes large, for efficient similarity search. This will store the embeddings and allow quick lookups.

## Phase 2: Core Tutoring Logic

4.  **Develop Game Analysis and Memory Query Tool:**
    *   **Input:** A list of chess moves (e.g., SAN) for a game, or a FEN string for a specific position.
    *   **Stockfish Integration:**
        *   Integrate a Python Stockfish library (e.g., `python-chess` with Stockfish engine).
        *   For each move in a game (or for the given FEN):
            *   Get Stockfish's evaluation (centipawn score).
            *   Identify best move(s) suggested by Stockfish.
            *   Categorize player's moves (e.g., best, good, inaccuracy, mistake, blunder) based on evaluation drop compared to Stockfish's top move.
    *   **Voyage AI Memory Query:**
        *   For critical game positions (e.g., after blunders/mistakes, or key strategic moments identified by Stockfish/heuristics) or the input FEN:
            *   Formulate a query string based on the position (e.g., FEN, key pieces, pawn structure, tactical motifs present).
            *   Embed the query using Voyage AI (`input_type="query"`).
            *   Perform a similarity search against your stored chess knowledge embeddings.
            *   Retrieve the top N most relevant knowledge snippets.

5.  **LLM-Powered Advice Generation:**
    *   **Input:**
        *   Player's game moves and Stockfish analysis (especially blunders/mistakes).
        *   Retrieved knowledge snippets from Voyage AI relevant to the game/positions.
        *   Current game state (FEN if applicable).
    *   **LLM Interaction (Prompt Engineering):**
        *   Design prompts for your chosen LLM (e.g., GPT-4, Claude) to:
            *   Explain *why* a player's move was a blunder/mistake, referencing Stockfish's preferred lines and the retrieved chess principles/knowledge.
            *   Provide targeted advice on what the player could have considered.
            *   Offer insights into the player's overall game patterns observed (if analyzing a full game).
            *   Suggest general areas of chess study based on recurring errors or weaknesses.
    *   **Output:** Human-readable advice and explanations.

6.  **LLM-Powered Exercise Generation:**
    *   **Input:**
        *   Specific game positions where blunders/mistakes occurred (FEN).
        *   Stockfish's suggested alternative (better) move.
        *   Retrieved knowledge relevant to the mistake.
    *   **LLM Interaction (Prompt Engineering):**
        *   Design prompts for the LLM to:
            *   Take the game state (FEN) *before* the blunder.
            *   Explain the tactical or strategic opportunity missed.
            *   Present the position as an exercise: "It's White to move. What is the best continuation?"
            *   Optionally, ask the LLM to generate a FEN for the position *after* Stockfish's recommended move if needed for follow-up or to show the improved state. (Though `python-chess` can also generate FENs after a move).
            *   Provide hints based on the retrieved knowledge.
    *   **Output:** A FEN string for the exercise position and accompanying instructional text/hint.

## Phase 3: API and Integration

7.  **Develop Backend API Endpoints:**
    *   Design and implement API endpoints (e.g., using Flask or FastAPI) for the frontend to interact with.
        *   Example endpoint: `/analyze_game` (accepts PGN or list of moves).
        *   Example endpoint: `/get_advice_for_fen` (accepts FEN).
        *   Endpoints should return structured data (JSON) containing analysis, advice, and exercises.

8.  **Testing and Refinement:**
    *   Unit tests for individual components (Stockfish interaction, Voyage AI querying, LLM prompt formatting).
    *   Integration tests for the entire pipeline.
    *   Iteratively refine prompts and logic based on output quality.

## Future Considerations:

*   User profiles and progress tracking.
*   More sophisticated RAG techniques (e.g., reranking retrieved results).
*   Caching Stockfish analyses or Voyage AI queries for common positions.
*   Support for different chess variants or time controls if desired.
