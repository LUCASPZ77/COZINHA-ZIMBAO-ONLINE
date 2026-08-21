import db from '../models/database.js';

function cleanup() {
  try {
    console.log('Iniciando limpeza de dados de teste...');
    // Remove logs relacionados ao item 'Arroz Teste'
    const estoque = db.prepare("SELECT id FROM estoque WHERE item = ?").all('Arroz Teste');
    for (const row of estoque) {
      db.prepare('DELETE FROM consumo_log WHERE item_id = ?').run(row.id);
      db.prepare('DELETE FROM estoque WHERE id = ?').run(row.id);
      console.log('Removido estoque e logs para id', row.id);
    }
    // Remove usuário de teste pelo CPF
    const res = db.prepare('DELETE FROM usuarios WHERE cpf = ?').run('12345678901');
    if (res.changes > 0) console.log('Usuário de teste removido (cpf 12345678901)');
    else console.log('Nenhum usuário de teste encontrado');
    console.log('Limpeza concluída');
  } catch (e) {
    console.error('Erro durante limpeza:', e.message);
    process.exit(1);
  }
}

cleanup();
