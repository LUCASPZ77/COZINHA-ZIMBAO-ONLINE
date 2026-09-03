import { createLog, getAllLogs, deleteLog } from '../models/consumoLogModel.js';
import { getAllStock, getStockById, getStockByItemLote, addOrUpdateStock, upsertStock, updateStock, deleteStock } from '../models/stockModel.js';
import { getUserByCpf, getUserByName, createUser, getAnyUser } from '../models/userModel.js';

export async function listStock() {
  return getAllStock();
}

export async function processBaixa({ itens, usuarioCpf, usuarioNome, prato, periodo }) {
  let user = usuarioCpf ? await getUserByCpf(usuarioCpf) : null;
  if (!user && usuarioNome) {
    user = await getUserByName(usuarioNome);
  }
  if (!user) throw new Error('Usuário não encontrado para baixa');

  const now = new Date();
  const data = now.toISOString().split('T')[0];
  const hora = now.toTimeString().slice(0,5);
  const timestamp = now.toISOString();

  for (const item of itens) {
    const estoqueAtual = await getStockById(item.id);
    if (!estoqueAtual) throw new Error(`Item não encontrado: ${item.id}`);
    const quantidade = Number(item.quantidade);
    if (quantidade <= 0) throw new Error('Quantidade deve ser maior que zero');
    if (quantidade > estoqueAtual.quantidade) throw new Error(`Estoque insuficiente para ${estoqueAtual.item}`);

    const packWeight = estoqueAtual.qtd_unidades > 0 ? estoqueAtual.quantidade / estoqueAtual.qtd_unidades : 0;
    const unidades = packWeight > 0 ? Math.floor(quantidade / packWeight) : 0;
    const novaQuantidade = Math.max(0, estoqueAtual.quantidade - quantidade);
    const novasUnidades = quantidade >= estoqueAtual.quantidade ? 0 : Math.max(0, estoqueAtual.qtd_unidades - unidades);

    await updateStock({ id: item.id, quantidade: novaQuantidade, qtd_unidades: novasUnidades, updated_at: timestamp });

    await createLog({
      item_id: item.id,
      usuario_id: user.id,
      quantidade,
      unidades,
      data,
      hora,
      tipo: 'SAIDA',
      lote: item.lote || estoqueAtual.lote,
      prato: prato || '',
      periodo: periodo || '',
      timestamp,
    });
  }
}

export async function addManual({ item, lote, quantidade, qtd_unidades, validade }) {
  const now = new Date();
  const data = now.toISOString().split('T')[0];
  const hora = now.toTimeString().slice(0,5);
  const timestamp = now.toISOString();

  const created_at = now.toISOString();
  const updated_at = created_at;

  await addOrUpdateStock({ item, quantidade: Number(quantidade), qtd_unidades: Number(qtd_unidades || 0), lote: lote || 'S/L', validade: validade || '-', created_at, updated_at });
  const estoque = await getStockByItemLote(item, lote || 'S/L');
  let usuario = await getAnyUser();
  if (!usuario) {
    // cria um usuário sistema mínimo para referenciar nos logs
    await createUser({ nome: 'Sistema', sobrenome: '', email: 'sistema@local', cpf: '00000000000', senha_hash: '', cargo: 'Sistema', created_at: now.toISOString(), updated_at: now.toISOString() });
    usuario = await getAnyUser();
  }

  const usuario_id = usuario ? usuario.id : null;
  await createLog({ item_id: estoque.id, usuario_id, quantidade: Number(quantidade), unidades: Number(qtd_unidades || 0), data, hora, tipo: 'ENTRADA', lote: lote || 'S/L', prato: null, periodo: null, timestamp });
  return estoque;
}

export async function importExcel({ dados }) {
  const now = new Date();
  const data = now.toISOString().split('T')[0];
  const hora = now.toTimeString().slice(0,5);
  const timestamp = now.toISOString();
  const created_at = timestamp;
  const updated_at = timestamp;

  for (const i of dados) {
    const nome = i.item || i['Nome do Produto'];
    const qtdKg = Number(String(i.quantidade || i['Quantidade Disponível em Kg'] || 0).replace(/[^\d,.]/g, '').replace(',', '.')) || 0;
    const qtdUn = Number(i.qtd_unidades || i['Quantidade de Unidades'] || 0) || 0;
    const lote = String(i.lote || i['Lote'] || 'S/L');
    await upsertStock({ item: nome, quantidade: qtdKg, qtd_unidades: qtdUn, lote, validade: i.validade || '-', created_at, updated_at });
    const estoque = await getStockByItemLote(nome, lote);
    let usuario = await getAnyUser();
    if (!usuario) {
      await createUser({ nome: 'Sistema', sobrenome: '', email: 'sistema@local', cpf: '00000000000', senha_hash: '', cargo: 'Sistema', created_at: now.toISOString(), updated_at: now.toISOString() });
      usuario = await getAnyUser();
    }
    const usuario_id = usuario ? usuario.id : null;
    await createLog({ item_id: estoque.id, usuario_id, quantidade: qtdKg, unidades: qtdUn, data, hora, tipo: 'ENTRADA', lote, prato: null, periodo: null, timestamp });
  }
}

export async function editStock({ id, quantidade, qtd_unidades, updated_at }) {
  const now = updated_at || new Date().toISOString();
  return updateStock({ id, quantidade: Number(quantidade), qtd_unidades: Number(qtd_unidades || 0), updated_at: now });
}

export async function listLogs() {
  return getAllLogs();
}

export async function removeLog(id) {
  return deleteLog(id);
}

export async function removeStockItem(id) {
  return deleteStock(id);
}
