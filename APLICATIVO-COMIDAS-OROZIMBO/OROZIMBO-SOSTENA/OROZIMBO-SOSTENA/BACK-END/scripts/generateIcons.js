import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function generate() {
  try {
    const workspaceRoot = join(__dirname, '..', '..'); // BACK-END/.. -> OROZIMBO-SOSTENA\OROZIMBO-SOSTENA
    const candidates = [
      join(workspaceRoot, '..', '..', 'Gemini_Generated_Image_vqu4njvqu4njvqu4.jpg'),
      join(workspaceRoot, '..', 'Gemini_Generated_Image_vqu4njvqu4njvqu4.jpg'),
      join(workspaceRoot, 'Gemini_Generated_Image_vqu4njvqu4njvqu4.jpg'),
      'c:\\Users\\Usuário\\OneDrive\\PROJETO-DA-COZINHA\\Gemini_Generated_Image_vqu4njvqu4njvqu4.jpg'
    ];

    let source = null;
    for (const c of candidates) {
      if (fs.existsSync(c)) { source = c; break; }
    }
    if (!source) {
      console.error('Arquivo fonte não encontrado. Procure por:', candidates.join('\n'));
      process.exit(1);
    }

    const destDir = join(workspaceRoot, 'FRONT-END', 'icons');
    fs.mkdirSync(destDir, { recursive: true });

    const targets = [
      { name: 'icon-512.jpg' },
      { name: 'icon-192.jpg' },
      { name: 'apple-touch-icon.png' },
      { name: 'favicon-32x32.png' },
      { name: 'favicon-16x16.png' }
    ];

    targets.forEach(t => {
      const dest = join(destDir, t.name);
      fs.copyFileSync(source, dest);
      console.log('Criado', dest);
    });

    console.log('Ícones gerados em:', destDir);
  } catch (e) {
    console.error('Erro ao gerar ícones:', e.message);
    process.exit(1);
  }
}

generate();
