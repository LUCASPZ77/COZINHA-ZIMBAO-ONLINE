import { listStock, processBaixa, listLogs, removeLog, removeStockItem, addManual, importExcel, editStock } from '../services/stockService.js';
import { createBaixaNotification } from './collaborationController.js';

export async function getStockController(req, res, next) {
  try {
    const estoque = await listStock();
    res.json(estoque);
  } catch (error) {
    next(error);
  }
}

export async function postBaixaController(req, res, next) {
  try {
    const { prato, periodo, itens } = req.body;
    await processBaixa({ itens, usuarioCpf: req.user.cpf, usuarioNome: req.user.nome, prato, periodo });
    try {
      await createBaixaNotification(req.user, prato, periodo, itens);
    } catch (notificationError) {
      console.error('Baixa concluída, mas não foi possível salvar a notificação:', notificationError);
    }
    res.json({ message: 'Baixa realizada com sucesso' });
  } catch (error) {
    next(error);
  }
}

export async function getLogsController(req, res, next) {
  try {
    const logs = await listLogs();
    res.json(logs);
  } catch (error) {
    next(error);
  }
}

export async function postManualController(req, res, next) {
  try {
    const estoque = await addManual(req.body);
    res.json({ message: 'Item adicionado manualmente', estoque });
  } catch (error) {
    next(error);
  }
}

export async function postImportController(req, res, next) {
  try {
    await importExcel(req.body);
    res.json({ message: 'Importado com sucesso' });
  } catch (error) {
    next(error);
  }
}
export async function putEditStockController(req, res, next) {
  try {
    const { quantidade, qtd_unidades } = req.body;
    await editStock({ id: req.params.id, quantidade, qtd_unidades });
    res.json({ message: 'Atualizado!' });
  } catch (error) {
    next(error);
  }
}

export async function deleteLogController(req, res, next) {
  try {
    await removeLog(req.params.id);
    res.json({ message: 'Registro apagado' });
  } catch (error) {
    next(error);
  }
}

export async function deleteStockController(req, res, next) {
  try {
    await removeStockItem(req.params.id);
    res.json({ message: 'Item removido' });
  } catch (error) {
    next(error);
  }
}
