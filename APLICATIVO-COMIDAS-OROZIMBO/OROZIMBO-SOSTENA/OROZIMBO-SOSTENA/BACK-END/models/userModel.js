import db from './database.js';

export const createUserTable = () => db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  sobrenome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  cpf TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  cargo TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

export const getUserByCpf = (cpf) => db.prepare('SELECT * FROM usuarios WHERE cpf = ?').get(cpf);
export const getUserByName = (nome) => db.prepare('SELECT * FROM usuarios WHERE nome = ? LIMIT 1').get(nome);
export const getUserByEmail = (email) => db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
export const createUser = ({ nome, sobrenome, email, cpf, senha_hash, cargo, created_at, updated_at }) =>
  db.prepare(`INSERT INTO usuarios (nome, sobrenome, email, cpf, senha_hash, cargo, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(nome, sobrenome, email, cpf, senha_hash, cargo, created_at, updated_at);
export const getAnyUser = () => db.prepare('SELECT * FROM usuarios LIMIT 1').get();
