import { registerUser, loginUser, loginWithToken, signToken } from '../services/authService.js';

export async function registerController(req, res, next) {
  try {
    const user = await registerUser(req.body);
    res.status(201).json({ message: 'Usuário cadastrado', userId: user.lastInsertRowid });
  } catch (error) {
    next(error);
  }
}

export async function loginController(req, res, next) {
  try {
    const { cpf, senha, token } = req.body;
    if (token && !senha) {
      const result = await loginWithToken({ cpf, token });
      const user = result.user;
      const accessToken = signToken({ id: user.id, nome: user.nome, sobrenome: user.sobrenome, cargo: user.cargo, email: user.email, cpf: user.cpf });
      return res.json({ id: user.id, nome: user.nome, sobrenome: user.sobrenome, cargo: user.cargo, email: user.email, cpf: user.cpf, accessToken });
    }
    const { user, token: jwtToken } = await loginUser(req.body);
    res.json({ user: { id: user.id, nome: user.nome, sobrenome: user.sobrenome, cargo: user.cargo, email: user.email, cpf: user.cpf }, token: jwtToken });
  } catch (error) {
    next(error);
  }
}
