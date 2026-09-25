import "dotenv/config";

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Turns a folder of photographs into WebP, same pixels, a fraction of the
 * weight.
 *
 *   node scripts/to-webp.mjs <folder> [--quality 90] [--max 2480]
 *
 * Nothing is overwritten: the .webp lands beside the original, so a bad batch
 * is deleted rather than recovered. Run it over the folder you are about to
 * upload to R2, then upload the .webp files.
 *
 * sharp is already here — Next installs it for its own image optimisation —
 * so this needs nothing added to the project.
 *
 * On the studio's own covers (1748 x 2480, the A5 template at 300dpi) quality
 * 90 came out 74-82% smaller at 38-49dB PSNR, which is past the point where a
 * difference is visible on a screen. Lower it if you want smaller files and
 * can live with that; there is no setting that makes a re-encode literally
 * identical, so "without degrading" means "not visibly", not "bit for bit".
 */

const SOURCE_TYPES = /\.(jpe?g|png|tiff?)$/i;

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

async function main() {
  const args = process.argv.slice(2);
  const folder = args.find((one) => !one.startsWith("--"));

  if (!folder) {
    console.error("Give it a folder: node scripts/to-webp.mjs ./images");
    process.exit(1);
  }

  const quality = Number(readFlag(args, "--quality") ?? 90);

  /*
    Resizing is off unless asked for. A portfolio card is 300px wide and these
    are 1748px, so `--max 1200` would save far more than the re-encode does —
    but it is a real loss of detail on the piece being sold, so it is never
    the default.
  */
  const max = readFlag(args, "--max") ? Number(readFlag(args, "--max")) : null;

  const out = path.join(folder, "webp");
  await mkdir(out, { recursive: true });

  const names = (await readdir(folder)).filter((name) => SOURCE_TYPES.test(name));

  if (names.length === 0) {
    console.log(`Nothing to convert in ${folder}`);
    return;
  }

  let before = 0;
  let after = 0;

  for (const name of names) {
    const source = path.join(folder, name);
    const original = await readFile(source);

    let pipeline = sharp(original);
    if (max) pipeline = pipeline.resize({ width: max, height: max, fit: "inside", withoutEnlargement: true });

    const webp = await pipeline.webp({ quality, effort: 6 }).toBuffer();
    const target = path.join(out, name.replace(SOURCE_TYPES, ".webp"));
    await writeFile(target, webp);

    before += original.length;
    after += webp.length;

    console.log(
      `${name}  ${mb(original.length)} -> ${mb(webp.length)}  ` +
        `(${(100 - (webp.length / original.length) * 100).toFixed(0)}% smaller)`,
    );
  }

  console.log(
    `\n${names.length} files: ${mb(before)} -> ${mb(after)}, ` +
      `${(100 - (after / before) * 100).toFixed(0)}% smaller overall`,
  );
  console.log(`written to ${out}`);
}

function readFlag(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

await main();
