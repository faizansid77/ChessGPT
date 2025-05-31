/* eslint-disable no-restricted-globals */

// Web-Worker wrapper around the Stockfish WASM build served from a CDN.
// The outer application talks to *this* worker by posting UCI commands
// ("position fen …", "go depth 15", …).  We in turn spin up the real
// engine (which is itself a worker once instantiated) and pipe all
// traffic back and forth.

// Dynamically load the Stockfish engine code.  Using a CDN keeps the
// repository small and allows the engine to be updated independently.
// You may replace the URL with a self-hosted copy if you need offline
// capability.
self.importScripts(
  "https://cdn.jsdelivr.net/npm/stockfish@16.1.0/stockfish.js"
);

// The global `Stockfish` function is created by the script above.
// It returns a *dedicated* worker that speaks the UCI protocol.
// @ts-ignore – injected at runtime.
const engine = typeof Stockfish === "function" ? Stockfish() : null;

if (!engine) {
  // Fall back to a dummy evaluator so the UI doesn’t crash if the
  // download failed.
  self.onmessage = () => {
    // nop
  };
} else {
  // Relay messages between host ⇄ engine.
  self.onmessage = (ev) => {
    engine.postMessage(ev.data);
  };

  engine.onmessage = (ev) => {
    self.postMessage(ev.data);
  };
}
