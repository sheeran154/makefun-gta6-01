// main.ts — PORT SOLARA entrypoint: hands the game in.
// Copies game/ and screenshots/ from beside this file into the output
// directory and writes /output/dossier.json with buildDossier.
// Standard library only; runs on Node 22 with no install and no network.

import { cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const gameSrc = join(here, 'game');
const shotsSrc = join(here, 'screenshots');

mkdirSync(outDir, { recursive: true });

// Copy the playable game and the screenshots into the output directory.
cpSync(gameSrc, join(outDir, 'game'), { recursive: true });
if (existsSync(shotsSrc)) {
  cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });
}

// Build the dossier from exactly what was copied, with the bounty's caps.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`PORT SOLARA: dossier written (${dossier.length} bytes) to ${join(outDir, 'dossier.json')}`);
