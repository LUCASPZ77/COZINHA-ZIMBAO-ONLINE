import { listStock, processBaixa, listLogs, removeLog, removeStockItem } from '../services/stockService.js';

import { addManual, importExcel, editStock } from '../services/stockService.js';

export function getStockController(req, res, next) {
  try {
    const estoque = listStock();
    res.json(estoque);
  } catch (error) {
    next(error);
  }
}

export async function postBaixaController(req, res, next) {
  try {
    const { prato, periodo, itens, usuarioCpf, usuarioNome } = req.body;
    await processBaixa({ itens, usuarioCpf, usuarioNome, prato, periodo });
    res.json({ message: 'Baixa realizada com sucesso' });
  } catch (error) {
    next(error);
  }
}

export function getLogsController(req, res, next) {
  try {
    const logs = listLogs();
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

export function putEditStockController(req, res, next) {
  try {
    const { quantidade, qtd_unidades } = req.body;
    editStock({ id: req.params.id, quantidade, qtd_unidades });
    res.json({ message: 'Atualizado!' });
  } catch (error) {
    next(error);
  }
}

export function deleteLogController(req, res, next) {
  try {
    removeLog(req.params.id);
    res.json({ message: 'Registro apagado' });
  } catch (error) {
    next(error);
  }
}

export function deleteStockController(req, res, next) {
  try {
    removeStockItem(req.params.id);
    res.json({ message: 'Item removido' });
  } catch (error) {
    next(error);
  }
}
