import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

const publicDir = './public';

async function generateIcons() {
  // Read SVGs
  const logoSvg = readFileSync(join(publicDir, 'images/logo-icon.svg'));
  const faviconSvg = readFileSync(join(publicDir, 'favicon.svg'));

  // PWA icons from logo
  await sharp(logoSvg)
    .resize(192, 192)
    .png()
    .toFile(join(publicDir, 'icon-192x192.png'));

  await sharp(logoSvg)
    .resize(512, 512)
    .png()
    .toFile(join(publicDir, 'icon-512x512.png'));

  await sharp(logoSvg)
    .resize(180, 180)
    .png()
    .toFile(join(publicDir, 'apple-icon.png'));

  // Favicon from star
  const favicon32 = await sharp(faviconSvg)
    .resize(32, 32)
    .png()
    .toBuffer();

  await sharp(favicon32)
    .toFile(join(publicDir, 'favicon-32x32.png'));

  // OG Image
  const ogBackground = Buffer.from(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#10221a"/>
      <text x="600" y="480" font-family="Lexend, sans-serif" font-size="72" font-weight="700" fill="#7EDDB5" text-anchor="middle">KYNITE</text>
      <text x="600" y="540" font-family="Noto Sans, sans-serif" font-size="28" fill="#8baea0" text-anchor="middle">Routines without the friction</text>
    </svg>
  `);

  const logoBuffer = await sharp(logoSvg).resize(280, 280).png().toBuffer();

  await sharp(ogBackground)
    .composite([{ input: logoBuffer, top: 100, left: 460 }])
    .png()
    .toFile(join(publicDir, 'og-image.png'));

  console.log('Icons generated successfully!');
}

generateIcons().catch(console.error);
