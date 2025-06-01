import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pgn, player_color } = body;

    if (!pgn || !player_color) {
      return NextResponse.json({ error: 'Missing pgn or player_color in request body' }, { status: 400 });
    }

    // TODO: Replace this with actual LLM call to Claude or similar
    // This is a MOCK response for demonstration purposes.
    // Note: The ply value (e.g., 6 for move 4) should correspond to the state *before* White's 4th move.
    const mockAdviceXML = `
      <response_format>
      <overview>
        This game shows the classic Scholar's Mate trap in action. After 1.e4 e5 2.Nf3 Nc6 3.Bc4, Black played the natural-looking but fatal blunder 3...Nf6??, allowing 4.Qh5! which threatens both checkmate on f7 and the e5 pawn. This is one of the most common opening traps that catches beginners.

        The most relevant study for you is "Chess Opening Traps - Scholar's Mate" (https://lichess.org/study/JBtn8H96). This study specifically covers this exact trap pattern and will help you recognize and avoid it in future games. Understanding this fundamental tactical pattern is crucial for every chess player's development.
        </overview>

        <move_recommendation>
        <move_number>3</move_number>
        <ply>6</ply>
        <advice>After 3.Bc4, you played 3...Nf6?? which is a terrible blunder that loses immediately to Scholar's Mate. White can now play 4.Qh5! attacking both f7 (threatening checkmate with Qxf7#) and your e5 pawn. Since you cannot defend both threats, this position is already lost. The key lesson here is that f7 (and f2 for White) is the weakest square in the opening because it's only defended by the king. Always be alert when your opponent's pieces aim at this square!</advice>
        <hint>Instead of developing the knight to f6, you needed to first deal with White's aggressive bishop on c4 that's eyeing your f7 square. Playing 3...g6 prepares to fianchetto your bishop and controls the h5 square, preventing White's queen from delivering the Scholar's Mate.</hint>
        <hint>Another good option was 3...Qe7, which defends the e5 pawn and prepares to develop your pieces safely. This move also prevents White's Qh5 trick because after 4.Qh5, you can simply play 4...Nf6 and the queen must retreat.</hint>
        <top_moves>
        <move>g6</move>
        <move>Qe7</move>
        <move>Nh6</move>
        </top_moves>
        </move_recommendation>
      </response_format>
    `;

    // Simulate some delay as if calling an external API
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json({ advice: mockAdviceXML });

  } catch (error) {
    console.error('Error in /api/analyze:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
}