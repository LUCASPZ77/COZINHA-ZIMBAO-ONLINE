import { Router } from 'express';
import { getStockController, postBaixaController, getLogsController, deleteLogController, deleteStockController, postManualController, postImportController, putEditStockController } from '../controllers/stockController.js';
import { authenticateSession, requireRole } from '../middlewares/authenticateSession.js';

const router = Router();
router.get('/lista-estoque', getStockController);
router.post('/baixa', authenticateSession, requireRole('Cozinheira'), postBaixaController);
router.get('/relatorios', getLogsController);
router.post('/estoque/manual', postManualController);
router.post('/estoque/importar', postImportController);
router.delete('/logs/:id', deleteLogController);
router.delete('/estoque/:id', deleteStockController);
router.put('/estoque/:id', putEditStockController);

export default router;
