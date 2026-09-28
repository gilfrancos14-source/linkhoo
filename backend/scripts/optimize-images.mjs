// Compresse les images statiques du frontend en place (JPEG q80, largeur max
// 1200px, 1920px pour le fond du Hero). Les originaux sont sauvegardés une fois
// dans frontend/.image-originals/ (hors de public/ pour ne pas être déployés,
// ignoré par git).
//
// Usage : npm run optimize:images   (depuis backend/)
import { readdir, mkdir, copyFile, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.resolve(__dirname, '../../frontend/public/images');
// Hors de public/ : Vite copie tout ce qui est dans public/ vers dist/.
const originalsDir = path.resolve(__dirname, '../../frontend/.image-originals');

// Fond du Hero : affiché en plein écran, on garde plus de largeur.
const WIDE = new Set(['4.jpg']);
const MAX_WIDTH = 1200;
const MAX_WIDTH_WIDE = 1920;
const QUALITY = 80;
// En dessous de cette taille, l'image est déjà optimisée : on n'y retouche pas.
const SKIP_UNDER_BYTES = 250 * 1024;

const formatBytes = (n) => `${(n / 1024 / 1024).toFixed(2)} Mo`;

async function main() {
  const entries = await readdir(imagesDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && /\.(jpe?g|png)$/i.test(e.name));
  if (files.length === 0) {
    console.log('Aucune image trouvée dans', imagesDir);
    return;
  }

  await mkdir(originalsDir, { recursive: true });

  let totalBefore = 0;
  let totalAfter = 0;
  let optimized = 0;

  for (const file of files) {
    const filePath = path.join(imagesDir, file.name);
    const before = (await stat(filePath)).size;
    totalBefore += before;

    // Sauvegarde de l'original seulement s'il s'agit d'une nouvelle image
    // (pas de sauvegarde, ou fichier plus gros que la sauvegarde = image
    // fraîchement ajoutée). Une image déjà optimisée ne doit JAMAIS être
    // ré-encodée : chaque passe JPEG dégraderait la qualité.
    const originalPath = path.join(originalsDir, file.name);
    const backupSize = await stat(originalPath)
      .then((s) => s.size)
      .catch(() => null);
    const isNewOriginal = backupSize === null || before > backupSize;

    if (isNewOriginal) {
      await copyFile(filePath, originalPath);
    } else {
      totalAfter += before;
      console.log(`  = ${file.name} déjà optimisée (${formatBytes(before)}), ignorée`);
      continue;
    }

    if (before <= SKIP_UNDER_BYTES) {
      totalAfter += before;
      console.log(`  = ${file.name} déjà petite (${formatBytes(before)}), ignorée`);
      continue;
    }

    const input = await readFile(filePath);
    const targetWidth = WIDE.has(file.name) ? MAX_WIDTH_WIDE : MAX_WIDTH;
    // Le format de sortie DOIT suivre l'extension : écrire des octets JPEG
    // dans un .png produirait un fichier corrompu (mauvais Content-Type).
    const isPng = /\.png$/i.test(file.name);

    const pipeline = sharp(input)
      .rotate() // respecte l'orientation EXIF
      .resize({ width: targetWidth, withoutEnlargement: true });
    const output = isPng
      ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
      : await pipeline.jpeg({ quality: QUALITY, mozjpeg: true, progressive: true }).toBuffer();

    if (output.length >= before) {
      totalAfter += before;
      console.log(`  = ${file.name} déjà optimisée (${formatBytes(before)})`);
      continue;
    }

    await writeFile(filePath, output);
    totalAfter += output.length;
    optimized += 1;
    console.log(
      `  ✓ ${file.name}: ${formatBytes(before)} → ${formatBytes(output.length)} ` +
        `(-${Math.round((1 - output.length / before) * 100)}%)`
    );
  }

  console.log(
    `\n${optimized}/${files.length} images optimisées. ` +
      `Total: ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)} ` +
      `(-${Math.round((1 - totalAfter / totalBefore) * 100)}%)`
  );
  console.log(`Originaux sauvegardés dans ${path.relative(process.cwd(), originalsDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
