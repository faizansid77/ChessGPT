import { spawn, ChildProcessWithoutNullStreams } from "child_process";

export type MaiaLevel = "1100" | "1200" | "1300" | "1400" | "1500" | "1600" | "1700" | "1800" | "1900";

interface PendingRequest {
  fen: string;
  resolve: (bestmove: string) => void;
  reject: (err: Error) => void;
}

/**
 * Simple singleton wrapper that keeps one lc0 process per Maia model
 * alive and feeds it UCI commands.  We keep a queue so that only one
 * request is processed at a time (lc0 itself is single-threaded in this
 * configuration).  Throughput isn’t a problem because each request only
 * visits a single node.
 */
export class MaiaEngine {
  private process!: ReturnType<typeof spawn>;
  private queue: PendingRequest[] = [];
  private isBusy = false;

  constructor(private elo: MaiaLevel) {
    // Adjust the path to your weights folder if necessary.
    const weightsPath = `model_files/maia-${elo}.pb.gz`;

    this.process = spawn("lc0", ["--weights", weightsPath], {
      stdio: ["pipe", "pipe", "inherit"],
    });

    // Tell the engine to use zero search – Maia is a policy net.
    this.process.stdin!.write("go nodes 1\n");

    let buffer = "";
    this.process.stdout!.on("data", (chunk) => {
      buffer += chunk.toString();

      // We’re interested in lines that start with "bestmove".
      let idx;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line.startsWith("bestmove")) {
          const parts = line.split(" ");
          const move = parts[1];
          this.finishCurrentRequest(move);
        }
      }
    });
  }

  private finishCurrentRequest(bestmove: string) {
    const req = this.queue.shift();
    this.isBusy = false;
    if (req) req.resolve(bestmove);
    this.processNext();
  }

  private processNext() {
    if (this.isBusy) return;
    const nextReq = this.queue[0];
    if (!nextReq) return;

    this.isBusy = true;
    this.process.stdin!.write(`position fen ${nextReq.fen}\n`);
    this.process.stdin!.write("go nodes 1\n");
  }

  evaluate(fen: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, resolve, reject });
      this.processNext();
    });
  }
}

// Maintain a single instance per Elo so we don’t spawn multiple lc0
// processes.
const instances: Partial<Record<MaiaLevel, MaiaEngine>> = {};

export function getMaiaEngine(level: MaiaLevel) {
  if (!instances[level]) {
    instances[level] = new MaiaEngine(level);
  }
  return instances[level]!;
}
