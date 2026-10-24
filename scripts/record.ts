// Turns the Playwright clip(s) listed in demo/clips.json into demo/medilink-cfaa-demo.mp4
// (H.264, 1920×1080, padded) and prints the duration. Run by `pnpm demo:record`.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";

const ffmpeg = ffmpegPath as unknown as string;
const { clips } = JSON.parse(readFileSync("demo/clips.json", "utf8")) as { clips: string[] };
if (!clips.length || !clips.every(existsSync)) throw new Error("no clips found — run `playwright test` first");

const list = "demo/clips.txt";
writeFileSync(list, clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join("\n"));
const out = "demo/medilink-cfaa-demo.mp4";

execFileSync(ffmpeg, [
  "-y", "-f", "concat", "-safe", "0", "-i", list,
  "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30",
  "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out,
], { stdio: ["ignore", "ignore", "inherit"] });

// Duration: parse ffmpeg's own banner for the finished file (ffmpeg-static ships no ffprobe).
let info = "";
try {
  execFileSync(ffmpeg, ["-i", out], { stdio: ["ignore", "ignore", "pipe"] });
} catch (e) {
  info = String((e as { stderr?: Buffer }).stderr ?? "");
}
const dur = info.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
const seconds = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : NaN;
console.log(`wrote ${out} — duration ${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s (${clips.length} clip(s))`);
