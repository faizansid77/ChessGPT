"use client";

import { useCallback, useState } from "react";

export default function useMaia(level: string = "1500") {
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const requestMove = useCallback(async (fen: string) => {
    try {
      setSuggestion(null);
      const res = await fetch(`/api/maia/${level}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen }),
      });

      if (!res.ok) throw new Error("Request failed");
      const { bestmove } = await res.json();
      setSuggestion(bestmove);
    } catch (err) {
      console.error(err);
    }
  }, [level]);

  return { suggestion, requestMove };
}
