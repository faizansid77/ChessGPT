import { NextRequest, NextResponse } from "next/server";
import { getMaiaEngine, MaiaLevel } from "../../../../lib/maiaEngine";

export async function POST(request: NextRequest, { params }: { params: { elo: MaiaLevel } }) {
  const { fen } = await request.json();

  const engine = getMaiaEngine(params.elo);

  try {
    const bestmove = await engine.evaluate(fen);
    return NextResponse.json({ bestmove });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Engine error" }, { status: 500 });
  }
}
