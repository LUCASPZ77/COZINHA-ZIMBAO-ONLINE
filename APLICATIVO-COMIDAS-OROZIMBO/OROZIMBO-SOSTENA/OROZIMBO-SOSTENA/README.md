# Aplicativo de Comidas Orozimbo

Aplicação web para gestão de estoque escolar e controle de baixa de alimentos na cozinha.

## Funcionalidades

### 1. Login e autenticação
- Login com CPF e token de segurança
- Suporte a usuários Diretor e Cozinheira
- Compatibilidade com o fluxo antigo do frontend

### 2. Cadastro de usuários
- Registro de novos usuários
- Armazenamento de nome, sobrenome, email, CPF, cargo e senha

### 3. Gestão de estoque
- Visualização do estoque disponível
- Cadastro manual de itens
- Importação de dados de estoque
- Edição de itens do estoque
- Remoção de itens do estoque

### 4. Baixa de alimentos
- Registro de consumo de itens do estoque
- Seleção de prato, período e itens para baixa
- Atualização automática do saldo de estoque
- Registro de log de saída

### 5. Relatórios e histórico
- Visualização de relatórios de movimentações
- Histórico de entradas e saídas
- Exclusão de registros de log

### 6. Interface web
- Tela de login
- Tela de cadastro
- Tela de controle de estoque
- Tela para baixa de alimentos
- Tela de relatórios

## Estrutura do projeto

- BACK-END: servidor Node.js com Express
- FRONT-END: interface web em HTML, CSS e JavaScript

## Tecnologias

- Node.js
- Express
- SQLite via better-sqlite3
- JWT para autenticação
- CORS
- bcryptjs

## Como executar

1. Entre na pasta BACK-END
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor:
   ```bash
   npm start
   ```
4. Acesse o app no navegador em:
   ```text
   http://localhost:3000
   ```

## Observações

- O backend foi estruturado para manter compatibilidade com o frontend antigo.
- O sistema usa SQLite para persistir dados de usuários, estoque e logs.
