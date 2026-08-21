import sharp from 'sharp';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const candidates = [
  join(__dirname, '..', 'FRONT-END', 'logo.jpg'),
  join(__dirname, '..', '..', 'Gemini_Generated_Image_vqu4njvqu4njvqu4.jpg'),
  join(__dirname, '..', 'Gemini_Generated_Image_vqu4njvqu4njvqu4.jpg'),
  join(__dirname, '..', '..', '..', 'Gemini_Generated_Image_vqu4njvqu4njvqu4.jpg'),
  'c:\\Users\\Usuário\\OneDrive\\PROJETO-DA-COZINHA\\Gemini_Generated_Image_vqu4njvqu4njvqu4.jpg'
];

function findSource() {
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

async function run() {
  try {
    const src = findSource();
    if (!src) { console.error('Fonte não encontrada. Candidatos:', candidates.join('\n')); process.exit(1); }
    const destDir = join(__dirname, '..', 'FRONT-END', 'icons');
    fs.mkdirSync(destDir, { recursive: true });

    const tasks = [
      { out: 'icon-512.jpg', size: 512, format: 'jpeg' },
      { out: 'icon-192.jpg', size: 192, format: 'jpeg' },
      { out: 'favicon-32x32.png', size: 32, format: 'png' },
      { out: 'favicon-16x16.png', size: 16, format: 'png' },
      { out: 'apple-touch-icon.png', size: 180, format: 'png' }
    ];

    for (const t of tasks) {
      const p = join(destDir, t.out);
      const image = sharp(src).resize(t.size, t.size, { fit: 'cover' });
      if (t.format === 'png') await image.png({ quality: 90 }).toFile(p);
      else await image.jpeg({ quality: 90 }).toFile(p);
      console.log('Gerado', p);
    }

    console.log('Todos os ícones gerados em', destDir);
  } catch (e) {
    console.error('Erro:', e.message);
    process.exit(1);
  }
}

run();
