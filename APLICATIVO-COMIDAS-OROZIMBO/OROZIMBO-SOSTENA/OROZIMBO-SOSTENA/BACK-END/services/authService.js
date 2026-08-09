import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { createUser, getUserByCpf, getUserByEmail } from '../models/userModel.js';

// Compatibilidade legacy: tokens por cargo usados pelo frontend antigo
const TOKENS_MESTRES = { 'Diretor': 'DIR-2026-MASTER', 'Cozinheira': 'COZ-2026-SCHOOL' };

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRATION });
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

export async function registerUser(userData) {
  const existingCpf = getUserByCpf(userData.cpf);
  if (existingCpf) throw new Error('CPF já cadastrado');

  const existingEmail = getUserByEmail(userData.email);
  if (existingEmail) throw new Error('E-mail já cadastrado');

  let senha_hash = '';
  if (userData.senha && typeof userData.senha === 'string' && userData.senha.length > 0) {
    senha_hash = await hashPassword(userData.senha);
  }
  const now = new Date().toISOString();

  return createUser({
    nome: userData.nome,
    sobrenome: userData.sobrenome,
    email: userData.email,
    cpf: userData.cpf,
    senha_hash,
    cargo: userData.cargo,
    created_at: now,
    updated_at: now,
  });
}

export async function loginUser({ cpf, senha }) {
  const user = getUserByCpf(cpf);
  if (!user) throw new Error('Usuário não encontrado');
  // Suporte para login legacy via token (frontend antigo envia { cpf, token })
  if (!senha && typeof cpf === 'string') {
    // senha ausente -> verificar token no controller (passado via 'senha' campo alternadamente)
    // Note: caller should pass { cpf, token } but for compat we'll check env token if provided as 'senha'
    throw new Error('Senha ausente: use loginWithToken se necessário');
  }

  const isValid = await comparePassword(senha, user.senha_hash);
  if (!isValid) throw new Error('Senha inválida');

  const token = signToken({ id: user.id, cargo: user.cargo, nome: user.nome, email: user.email });
  return { user, token };
}

export async function loginWithToken({ cpf, token }) {
  const user = getUserByCpf(cpf);
  if (!user) throw new Error('Usuário não encontrado');
  const expected = TOKENS_MESTRES[user.cargo];
  if (!expected || token !== expected) throw new Error('Token inválido!');
  // Retornamos o usuário; frontend antigo espera o objeto user
  return { user, token: null };
}
