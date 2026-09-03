import pool from './database.js';

export const createUserTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
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
};

export const getUserByCpf = async (cpf) => {
  const res = await pool.query('SELECT * FROM usuarios WHERE cpf = $1 LIMIT 1', [cpf]);
  return res.rows[0];
};

export const getUserByName = async (nome) => {
  const res = await pool.query('SELECT * FROM usuarios WHERE nome = $1 LIMIT 1', [nome]);
  return res.rows[0];
};

export const getUserByEmail = async (email) => {
  const res = await pool.query('SELECT * FROM usuarios WHERE email = $1 LIMIT 1', [email]);
  return res.rows[0];
};

export const createUser = async ({ nome, sobrenome, email, cpf, senha_hash, cargo, created_at, updated_at }) => {
  const res = await pool.query(
    `INSERT INTO usuarios (nome, sobrenome, email, cpf, senha_hash, cargo, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [nome, sobrenome, email, cpf, senha_hash, cargo, created_at, updated_at]
  );
  return res.rows[0];
};

export const getAnyUser = async () => {
  const res = await pool.query('SELECT * FROM usuarios LIMIT 1');
  return res.rows[0];
};
