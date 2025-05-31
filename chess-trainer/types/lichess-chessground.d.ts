declare module "@lichess-org/chessground" {
  // We only need the exported `Chessground` factory function and can keep
  // the signature deliberately loose for now to avoid maintaining a full
  // type definition.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Chessground: any;
}
