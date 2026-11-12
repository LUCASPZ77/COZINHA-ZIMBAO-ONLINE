import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import env from './config/env.js';

import authRoutes from './routes/authRoutes.js';
import stockRoutes from './routes/stockRoutes.js';
import collaborationRoutes from './routes/collaborationRoutes.js';
import { loginController } from './controllers/authController.js';

import { requestLogger } from './middlewares/requestLogger.js';
import { errorHandler } from './middlewares/errorHandler.js';

import { createUserTable } from './models/userModel.js';
import { createStockTable } from './models/stockModel.js';
import { createConsumoLogTable, deleteExpiredConsumptionLogs } from './models/consumoLogModel.js';
import { createCollaborationTables, deleteExpiredNotifications } from './models/collaborationModel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pastaFrontEnd = join(__dirname, '..', 'FRONT-END');

const app = express();
const DAILY_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

app.use(express.json());
app.use(cors());
app.use(requestLogger);

// Serve assets que estão fora da pasta FRONT-END (ex: imagem colocada na raiz do workspace)
app.use('/external-assets', express.static(join(__dirname, '..', '..', '..', '..')));

// Rota dedicada para servir o logo (garante headers corretos e caminho curto)
import fs from 'fs';

app.get('/logo.jpg', (req, res) => {
  // Preferir logo na pasta FRONT-END (caso o usuário tenha colocado o arquivo lá)
  const frontLogo = join(pastaFrontEnd, 'logo.jpg');
  if (fs.existsSync(frontLogo)) {
    return res.sendFile(frontLogo);
  }

  // Fallback: procurar logo na raiz do workspace (vários níveis acima)
  const fallback = join(__dirname, '..', '..', '..', '..', 'logo.jpg');
  if (fs.existsSync(fallback)) return res.sendFile(fallback);

  // último recurso: procurar pelo arquivo com outro nome conhecido
  const alt = join(__dirname, '..', '..', '..', '..', 'Gemini_Generated_Image_vqu4njvqu4njvqu4.jpg');
  if (fs.existsSync(alt)) return res.sendFile(alt);

  res.status(404).send('Logo not found');
});

// Cria tabelas se necessário (idempotente) — espera as promessas antes de iniciar
async function initDb() {
  try {
    await createUserTable();
    await createStockTable();
    await createConsumoLogTable();
    await createCollaborationTables();
    await cleanupExpiredRecords();
    const cleanupTimer = setInterval(cleanupExpiredRecords, DAILY_CLEANUP_INTERVAL_MS);
    cleanupTimer.unref();
    console.log('Banco e tabelas inicializados');
  } catch (e) {
    console.error('Erro ao inicializar tabelas:', e);
    throw e;
  }
}

async function cleanupExpiredRecords() {
  try {
    const [reportsDeleted, notificationsDeleted] = await Promise.all([
      deleteExpiredConsumptionLogs(),
      deleteExpiredNotifications(),
    ]);
    if (reportsDeleted || notificationsDeleted) {
      console.log(`Retenção de 30 dias: ${reportsDeleted} relatórios e ${notificationsDeleted} notificações removidos`);
    }
  } catch (error) {
    console.error('Falha ao limpar registros com mais de 30 dias:', error.message);
  }
}

// Rotas de API
app.use('/usuarios', authRoutes); // /usuarios/registrar
app.post('/login', loginController); // mantém /login para compatibilidade com frontend antigo
app.use('/', stockRoutes); // endpoints: /lista-estoque, /baixa, /relatorios, /estoque/:id, /logs/:id
app.use('/api', collaborationRoutes);

// Front-end estático
app.use(express.static(pastaFrontEnd));
app.get('/', (req, res) => res.sendFile(join(pastaFrontEnd, 'index.html')));

// Tratamento de erros (último middleware)
app.use(errorHandler);

const PORT = env.PORT || 3000;
initDb().then(() => {
  app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));
}).catch(err => {
  console.error('Falha ao inicializar aplicação:', err);
  process.exit(1);
});