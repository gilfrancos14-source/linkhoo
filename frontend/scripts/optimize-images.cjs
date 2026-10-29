const sharp = require('../../backend/node_modules/sharp');
const fs = require('fs');

const jobs = [
  ['public/images/hero-city.jpg', 'public/images/hero-city.webp', 1400, 70],
  ['public/images/cities/abidjan.jpg', 'public/images/cities/abidjan.webp', 1280, 66],
  ['public/images/cities/cotonou.jpg', 'public/images/cities/cotonou.webp', 1280, 66],
  ['public/images/cities/dakar.jpg', 'public/images/cities/dakar.webp', 1280, 66],
  ['public/images/cities/lome.jpg', 'public/images/cities/lome.webp', 1280, 66],
  ['public/images/listings/cocody.jpg', 'public/images/listings/cocody.webp', 640, 70],
  ['public/images/listings/grand-bassam.jpg', 'public/images/listings/grand-bassam.webp', 640, 70],
  ['public/images/listings/yamoussoukro.jpg', 'public/images/listings/yamoussoukro.webp', 640, 70],
  ['public/images/listings/san-pedro.jpg', 'public/images/listings/san-pedro.webp', 640, 70],
  ['public/images/listings/bingerville.jpg', 'public/images/listings/bingerville.webp', 640, 70],
  ['public/images/listings/assinie.jpg', 'public/images/listings/assinie.webp', 640, 70],
  ['public/images/pexels-fotoaibe-1571460.jpg', 'public/images/pexels-fotoaibe-1571460.webp', 560, 70],
  ['public/images/pexels-artbovich-6782567.jpg', 'public/images/pexels-artbovich-6782567.webp', 560, 70],
  ['public/images/pexels-artbovich-7214173.jpg', 'public/images/pexels-artbovich-7214173.webp', 560, 70],
  ['public/images/pexels-artbovich-7045712.jpg', 'public/images/pexels-artbovich-7045712.webp', 560, 70],
  ['public/images/pexels-artbovich-6283961.jpg', 'public/images/pexels-artbovich-6283961.webp', 560, 70],
  ['public/images/pexels-artbovich-6315808.jpg', 'public/images/pexels-artbovich-6315808.webp', 560, 70],
  ['public/images/pexels-artbovich-5998117.jpg', 'public/images/pexels-artbovich-5998117.webp', 560, 70],
  ['public/images/about-team.jpg', 'public/images/about-team.webp', 1100, 70],
  ['public/images/about-smiling-woman.jpg', 'public/images/about-smiling-woman.webp', 1000, 70],
  ['public/images/contact-support.jpg', 'public/images/contact-support.webp', 900, 70],
  // Visuels du seed servis par l'API (accueil : événements, tourisme, escapades).
  ['public/images/1.jpg', 'public/images/1.webp', 640, 62],
  ['public/images/ouidah.jpg', 'public/images/ouidah.webp', 800, 64],
  ['public/images/tori.jpg', 'public/images/tori.webp', 800, 64],
];

(async () => {
  for (const [src, dest, width, quality] of jobs) {
    if (!fs.existsSync(src)) { console.log('missing', src); continue; }
    const before = fs.existsSync(dest) ? fs.statSync(dest).size : fs.statSync(src).size;
    await sharp(src).rotate().resize({ width, withoutEnlargement: true }).webp({ quality, effort: 6 }).toFile(dest);
    const after = fs.statSync(dest).size;
    console.log(`${dest}: ${(before/1024).toFixed(0)}KB -> ${(after/1024).toFixed(0)}KB`);
  }
})();
