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
          This is a mock overview for ${player_color} after analyzing the PGN.
          The game shows interesting tactical opportunities around move 10.
          Consider reviewing studies on King safety, like the Lichess study on 'Basic Checkmates' (URL: https://lichess.org/study/series/basic-checkmates).
        </overview>
        <move_recommendation>
          <move_number>3</move_number> 
          <ply>5</ply> 
          <advice>Consider developing your light-squared bishop to c4 or b5 to control central squares and prepare for castling. This is a mock advice.</advice>
          <hint>Think about piece activity and king safety.</hint>
          <hint>Which square offers your bishop good scope?</hint>
          <top_moves>
            <move>Bc4</move>
            <move>Bb5</move>
            <move>Nf3</move>
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