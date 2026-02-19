import { makeBadge } from "badge-maker";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const outDir = path.join(repoRoot, "docs", "assets", "badges");

const base = {
  style: "for-the-badge",
  labelColor: "#0d1117",
};

/** @type {Array<{filename: string; label: string; message: string; color: string; labelColor?: string; style?: string}>} */
const badges = [
  { filename: "version-1.0.0.svg", label: "version", message: "1.0.0", color: "#00d4ff" },
  { filename: "python-3.11.svg", label: "python", message: "3.11", color: "#3776ab" },
  { filename: "nextjs-16.1.6.svg", label: "next.js", message: "16.1.6", color: "#000000" },
  { filename: "fastapi-0.115.6.svg", label: "fastapi", message: "0.115.6", color: "#009688" },
  { filename: "license-mit.svg", label: "license", message: "MIT", color: "#7c3aed" },

  { filename: "docker-compose.svg", label: "docker", message: "compose", color: "#2496ed" },
  { filename: "postgresql-16.svg", label: "postgresql", message: "16", color: "#4169e1" },
  { filename: "redis-7.svg", label: "redis", message: "7", color: "#dc382d" },
  { filename: "celery-5.svg", label: "celery", message: "5", color: "#37814a" },

  { filename: "typescript-5.x.svg", label: "typescript", message: "5.x", color: "#3178c6" },
  { filename: "tailwind-4.svg", label: "tailwind", message: "4", color: "#06b6d4" },
  { filename: "github-abhishekthatguy.svg", label: "GitHub", message: "abhishekthatguy", color: "#181717", style: "flat-square" },
];

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  await Promise.all(
    badges.map(async (b) => {
      const { filename, ...format } = b;
      const svg = makeBadge({ ...base, ...format });
      const outPath = path.join(outDir, filename);
      await fs.writeFile(outPath, svg, "utf8");
    }),
  );

  // eslint-disable-next-line no-console
  console.log(`Generated ${badges.length} badges in ${path.relative(repoRoot, outDir)}/`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

