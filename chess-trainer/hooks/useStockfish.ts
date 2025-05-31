// /hooks/useStockfish.ts

import { useEffect, useRef, useState } from "react";

/**
 * Simple React hook that spawns a Web-Worker running Stockfish (WASM build)
 * and exposes two things:
 *   – evaluation: string | null  → the latest score ("0.34", "#3", …)
 *   – evaluate(fen)             → trigger a new engine search
 */
export default function useStockfish() {
  const [evaluation, setEvaluation] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Create the worker via an *import-meta* URL so that Next/Turbopack can
    // statically analyse the path during the build.
    // The worker script is located at `workers/stockfish.worker.js`.
    const workerUrl = new URL("../workers/stockfish.worker.js", import.meta.url);
    workerRef.current = new Worker(workerUrl, { type: "module" });

    // Translate raw UCI output → user-friendly numeric score or mate info.
    workerRef.current.onmessage = (e: MessageEvent<string>) => {
      const line = e.data;

      if (line.startsWith("info")) {
        const match = line.match(/score (cp|mate) (-?\d+)/);
        if (match) {
          const [, kind, raw] = match;
          const display = kind === "cp" ? (parseInt(raw, 10) / 100).toFixed(2) : `#${raw}`;
          setEvaluation(display);
        }
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const evaluate = (fen: string) => {
    if (!workerRef.current) return;
    workerRef.current.postMessage(`position fen ${fen}`);
    workerRef.current.postMessage("go depth 15");
  };

  return { evaluation, evaluate };
}