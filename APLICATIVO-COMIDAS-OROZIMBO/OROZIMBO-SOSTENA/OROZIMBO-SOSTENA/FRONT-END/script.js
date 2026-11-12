const API_URL = ['localhost', '127.0.0.1'].includes(location.hostname) ? location.origin : 'https://cozinha-zimbao-online.onrender.com';
let usuarioLogado = null;
let estoqueLocal = []; 
let itensParaBaixa = []; 
let realtimeSource = null;
let realtimeReconnectTimer = null;
let notificacoes = [];
let mensagens = [];
let contatosChat = [];
let contatoSelecionadoId = null;
let respostaSelecionada = null;
let mensagemParaCompartilharId = null;
let naoLidasPorContato = new Map();
let hasMoreMessages = false;
let loadingOlderMessages = false;
let toastTimer = null;

const SOM_NOTIFICACAO = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// ==========================================
// 1. INICIALIZAÇÃO E INTERFACE
// ==========================================

// --- Loading overlay controls ---
let activeRequests = 0;
let loadingTimer = null;
let hideLoadingTimer = null;

function showLoading(message = 'Carregando...') {
    const el = document.getElementById('loading');
    if (!el) return;
    const msg = document.getElementById('loading-msg');
    if (msg) msg.innerText = message;
    el.classList.remove('hidden');
    el.style.display = 'flex';
}

function hideLoading() {
    const el = document.getElementById('loading');
    if (!el) return;
    el.classList.add('hidden');
}

function mensagemDaRequisicao(url, method) {
    if (url.includes('/login')) return 'Entrando no Sistema...';
    if (url.includes('/usuarios/registrar')) return 'Cadastrando usuário...';
    if (url.includes('/lista-estoque')) return 'Carregando estoque...';
    if (url.includes('/relatorios')) return 'Carregando histórico...';
    if (url.includes('/baixa')) return 'Registrando saída...';
    if (url.includes('/estoque/importar')) return 'Importando planilha...';
    if (url.includes('/estoque/manual')) return 'Salvando entrada no estoque...';
    if (url.includes('/estoque/') && method === 'PUT') return 'Atualizando estoque...';
    if (url.includes('/estoque/') && method === 'DELETE') return 'Removendo lote...';
    if (url.includes('/logs/') && method === 'DELETE') return 'Excluindo registro...';
    return 'Processando...';
}

(function installFetchWrapper(){
    if (!window.fetch) return;
    const original = window.fetch.bind(window);
    window.fetch = async function(...args){
        const request = args[0];
        const options = args[1] || {};
        const url = typeof request === 'string' ? request : request.url;
        const method = (options.method || request.method || 'GET').toUpperCase();
        activeRequests++;
        clearTimeout(hideLoadingTimer);
        if (activeRequests === 1) {
            loadingTimer = setTimeout(() => showLoading(mensagemDaRequisicao(url, method)), 250);
        } else if (!document.getElementById('loading')?.classList.contains('hidden')) {
            showLoading(mensagemDaRequisicao(url, method));
        }
        try {
            return await original(...args);
        } finally {
            activeRequests--;
            if (activeRequests === 0) {
                clearTimeout(loadingTimer);
                hideLoadingTimer = setTimeout(hideLoading, 250);
            }
        }
    };
})();


// NOVO: Verifica se o usuário já estava logado ao abrir a página (Resolve erro do F5)
window.addEventListener('load', () => {
    const salvo = localStorage.getItem('usuarioLogado');
    if (salvo) {
        usuarioLogado = JSON.parse(salvo);
        if (usuarioLogado.accessToken) configurarInterfacePorUsuario(usuarioLogado);
        else {
            localStorage.removeItem('usuarioLogado');
            usuarioLogado = null;
            alert('Sua sessão precisa ser renovada para ativar notificações e mensagens. Entre novamente.');
        }
    }
    atualizarDataVisor();

    // token eye toggle
    const toggle = document.getElementById('toggle-token');
    if (toggle) {
        toggle.addEventListener('click', () => {
            const input = document.getElementById('login-token');
            if (!input) return;
            if (input.type === 'password') { input.type = 'text'; toggle.innerText = '🙈'; toggle.setAttribute('aria-label', 'Ocultar token'); }
            else { input.type = 'password'; toggle.innerText = '👁️'; toggle.setAttribute('aria-label', 'Mostrar token'); }
        });
    }

    document.addEventListener('click', (event) => {
        const sidebar = document.getElementById('sidebar');
        const menuToggle = document.getElementById('menu-toggle');
        if (!sidebar || !sidebar.classList.contains('open')) return;
        if (!sidebar.contains(event.target) && !menuToggle?.contains(event.target)) fecharMenu();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') fecharMenu();
    });
});

function atualizarDataVisor() {
    const agora = new Date();
    const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dataFormatada = agora.toLocaleDateString('pt-BR', opcoes);
    const elementoData = document.getElementById('data-atual');
    if (elementoData) elementoData.innerText = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
}
setInterval(atualizarDataVisor, 60000);

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('open');
    document.getElementById('menu-toggle')?.setAttribute('aria-expanded', String(sidebar.classList.contains('open')));
}

function fecharMenu() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('open');
    document.getElementById('menu-toggle')?.setAttribute('aria-expanded', 'false');
}

function ajustarBrilho(valor) {
    document.body.style.filter = `brightness(${valor}%)`;
}

function logout() {
    if (confirm("Deseja realmente sair do sistema?")) {
    realtimeSource?.close();
    clearTimeout(realtimeReconnectTimer);
        localStorage.removeItem('usuarioLogado'); // Limpa o login salvo
        usuarioLogado = null;
        location.reload();
    }
}

function mascararCPF(input) {
    let valor = input.value.replace(/\D/g, '');
    if (valor.length > 11) valor = valor.slice(0, 11);
    if (valor.length > 9) valor = valor.slice(0, 9) + '-' + valor.slice(9);
    if (valor.length > 6) valor = valor.slice(0, 6) + '.' + valor.slice(6);
    if (valor.length > 3) valor = valor.slice(0, 3) + '.' + valor.slice(3);
    input.value = valor;
}

// ==========================================
// 2. CONTROLE DE ACESSO
// ==========================================

// NOVO: Função centralizada para montar a tela (Evita repetição de código no login e no F5)
function configurarInterfacePorUsuario(data) {
    document.getElementById('profile-name').innerText = `${data.nome} ${data.sobrenome}`;
    document.getElementById('profile-role').innerText = data.cargo;
    document.getElementById('menu-toggle').classList.remove('hidden');
    document.getElementById('login-view').classList.add('hidden');
    conectarEventosEmTempoReal();
    carregarContatos();

    if (data.cargo === 'Cozinheira') {
        document.getElementById('cozinha-view').classList.remove('hidden');
        document.getElementById('user-display').innerText = data.nome;
        carregarSelectCozinha();
    } else {
        document.getElementById('diretor-view').classList.remove('hidden');
        document.getElementById('admin-display').innerText = data.nome;
        carregarListasFluxo();
        carregarNotificacoes();
    }
}

function mudarAba(tipo) {
    const btnLogin = document.getElementById('tab-login');
    const btnReg = document.getElementById('tab-cadastro');
    const formLogin = document.getElementById('form-login');
    const formReg = document.getElementById('form-cadastro');

    if (tipo === 'login') {
        formLogin.classList.remove('hidden');
        formReg.classList.add('hidden');
        btnLogin.style.borderBottom = "2px solid #2563eb"; btnLogin.style.color = "#2563eb";
        btnReg.style.borderBottom = "none"; btnReg.style.color = "#64748b";
    } else {
        formLogin.classList.add('hidden');
        formReg.classList.remove('hidden');
        btnReg.style.borderBottom = "2px solid #2563eb"; btnReg.style.color = "#2563eb";
        btnLogin.style.borderBottom = "none"; btnLogin.style.color = "#64748b";
    }
}

async function executarCadastro() {
    const cargo = document.getElementById('reg-cargo').value;
    const nome = document.getElementById('reg-nome').value;
    const sobrenome = document.getElementById('reg-sobrenome').value;
    const email = document.getElementById('reg-email').value;
    const cpf = document.getElementById('reg-cpf').value;
    const termos = document.getElementById('reg-termos').checked;

    if (!termos || !nome || !email || !cpf) { alert("Preencha os dados e aceite os termos."); return; }

    try {
        const response = await fetch(`${API_URL}/usuarios/registrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cargo, nome, sobrenome, email, cpf })
        });
        if (response.ok) { alert("✅ Cadastro realizado!"); mudarAba('login'); }
        else { const erro = await response.json(); alert("Erro: " + erro.error); }
    } catch (error) { alert("Erro de conexão."); }
}

async function executarLogin() {
    const cpf = document.getElementById('login-cpf').value;
    const token = document.getElementById('login-token').value;
    if (!cpf || !token) { alert("Preencha CPF e Token."); return; }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf, token })
        });
        const data = await response.json();
        if (response.ok) {
            usuarioLogado = data;
            // Salva para persistir no F5
            localStorage.setItem('usuarioLogado', JSON.stringify(data));
            configurarInterfacePorUsuario(data);
        } else { alert("Erro: " + data.error); }
    } catch (error) { alert("Erro ao logar."); }
}

// ==========================================
// 3. FUNÇÕES DA COZINHA
// ==========================================

async function carregarSelectCozinha() {
    try {
        const res = await fetch(`${API_URL}/lista-estoque`);
        estoqueLocal = await res.json();
        const select = document.getElementById('alimento');
        if (select) {
            const busca = document.getElementById('busca-cozinha')?.value?.toLowerCase() || '';
            const filtrado = estoqueLocal.filter(i => i.item.toLowerCase().includes(busca));
            select.innerHTML = filtrado.map(item => 
                `<option value="${item.id}" data-item="${item.item}" data-lote="${item.lote}">${item.item} (Lote: ${item.lote})</option>`
            ).join('');
            if (select.options.length > 0) select.selectedIndex = 0;
            mostrarInfoExtra();
        }
    } catch (e) { console.error("Erro estoque cozinha"); }
}

function filtrarSelectCozinha() {
    const busca = document.getElementById('busca-cozinha').value.toLowerCase();
    const select = document.getElementById('alimento');
    if (!estoqueLocal || estoqueLocal.length === 0) return carregarSelectCozinha();
    const filtrado = estoqueLocal.filter(i => i.item.toLowerCase().includes(busca));
    select.innerHTML = filtrado.map(item => 
        `<option value="${item.id}" data-item="${item.item}" data-lote="${item.lote}">${item.item} (Lote: ${item.lote})</option>`
    ).join('');
    if (select.options.length > 0) select.selectedIndex = 0;
    mostrarInfoExtra();
}

function mostrarInfoExtra() {
    const select = document.getElementById('alimento');
    const selectedOption = select.options[select.selectedIndex];
    const nome = selectedOption?.dataset?.item;
    const lote = selectedOption?.dataset?.lote;
    const itemId = select.value;
    const item = estoqueLocal.find(i => i.id == itemId);
    const display = document.getElementById('display-atual');
    if (item && display) {
        display.innerText = `${Number(item.quantidade).toFixed(3)} kg (${formatarKgEmGramas(item.quantidade)}) | ${item.qtd_unidades || 0} un`;
    } else if (display) {
        display.innerText = '-';
    }
}

function formatarKgEmGramas(qtdKg) {
    const gramas = Math.round(Number(qtdKg) * 1000);
    return `${gramas.toLocaleString('pt-BR')} g`;
}

function calcularPesoAutomatico() {
    const select = document.getElementById('alimento');
    const itemId = select.value;
    const item = estoqueLocal.find(i => i.id == itemId);
    const unSaida = Number(document.getElementById('qtd-unidades-saida').value);
    const inputPeso = document.getElementById('qtd');

    if (item && unSaida > 0 && item.qtd_unidades > 0) {
        const pesoUnitario = item.quantidade / item.qtd_unidades;
        inputPeso.value = (unSaida * pesoUnitario).toFixed(3);
    }
}

function adicionarItemNaLista() {
    const select = document.getElementById('alimento');
    const selectedOption = select.options[select.selectedIndex];
    const itemId = select.value;
    const itemNome = selectedOption?.dataset?.item;
    const lote = selectedOption?.dataset?.lote || 'S/L';
    const qtdInput = Number(document.getElementById('qtd').value);
    const unSaida = Number(document.getElementById('qtd-unidades-saida').value) || 0;

    // NOVO: Validação contra estoque negativo
    const itemNoEstoque = estoqueLocal.find(i => i.id == itemId);

    if (!qtdInput || qtdInput <= 0) { alert("Quantidade inválida."); return; }

    if (itemNoEstoque && qtdInput > itemNoEstoque.quantidade) {
        alert(`❌ Erro: Estoque insuficiente!\nO item ${itemNome} possui apenas ${itemNoEstoque.quantidade.toFixed(3)}kg disponíveis.`);
        return;
    }

    itensParaBaixa.push({ 
        id: itemId,
        itemNome, 
        lote, 
        quantidade: qtdInput, 
        unidadesSaida: unSaida 
    });

    const listaUl = document.getElementById('lista-temporaria-itens');
    const li = document.createElement('li');
    li.style = "display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #eee; background: #fff; margin-bottom: 4px; border-radius: 5px;";
    li.innerHTML = `<span><b>${itemNome}</b> (Lote: ${lote}) - ${qtdInput}kg (${formatarKgEmGramas(qtdInput)})</span> 
                    <button onclick="removerDaListaTemporaria(this, '${itemId}')" style="background:#ef4444; color:white; border:none; padding:2px 8px; border-radius:4px; cursor:pointer;">X</button>`;
    listaUl.appendChild(li);
    
    document.getElementById('qtd').value = '';
    document.getElementById('qtd-unidades-saida').value = '';
}

function removerDaListaTemporaria(btn, id) {
    itensParaBaixa = itensParaBaixa.filter(i => i.id !== id);
    btn.parentElement.remove();
}

async function enviarBaixaCompleta() {
    const prato = document.getElementById('prato-dia').value;
    const periodo = document.getElementById('periodo-refeicao').value;
    if (!prato || itensParaBaixa.length === 0) { alert("Preencha o prato e adicione itens."); return; }

    try {
        const response = await fetch(`${API_URL}/baixa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${usuarioLogado.accessToken}` },
            body: JSON.stringify({ prato, periodo, itens: itensParaBaixa })
        });
        if (response.ok) {
            SOM_NOTIFICACAO.play();
            alert("✅ Baixa realizada!");
            itensParaBaixa = [];
            document.getElementById('lista-temporaria-itens').innerHTML = '';
            carregarSelectCozinha();
        } else {
            const resErro = await response.json();
            alert("Erro: " + resErro.error);
        }
    } catch (e) { alert("Erro de conexão."); }
}

// ==========================================
// 4. FUNÇÕES DO DIRETOR
// ==========================================

function abrirAbaDiretor(event, abaId) {
    const conteudos = document.querySelectorAll('#diretor-view .tab-content');
    conteudos.forEach(c => c.classList.add('hidden'));

    const botoes = document.querySelectorAll('#diretor-view .tabs-container .tab-btn');
    botoes.forEach(b => b.classList.remove('active'));

    const elementoAlvo = document.getElementById(abaId);
    if (elementoAlvo) {
        elementoAlvo.classList.remove('hidden');
        if (event) event.currentTarget.classList.add('active');
    }

    if (abaId === 'aba-historico') { carregarListasFluxo(); }
    else if (abaId === 'aba-pratos') { verGastoDoDia(); }
    else if (abaId === 'aba-conferencia') { carregarTabelaConferencia(); }
    else if (abaId === 'aba-estoque') { carregarSelectExclusao(); }
    else if (abaId === 'aba-notificacoes') { carregarNotificacoes(); }
    else if (abaId === 'aba-mensagens') { carregarContatos(); }
}

async function adicionarNovoEstoque() {
    const item = document.getElementById('add-nome').value;
    const lote = document.getElementById('add-lote').value;
    const qtd_unidades = document.getElementById('add-unidades').value;
    const quantidade = document.getElementById('add-qtd').value;
    const validade = document.getElementById('add-validade').value;

    if (!item || !quantidade) { alert("Preencha o nome e o peso!"); return; }

    try {
        const res = await fetch(`${API_URL}/estoque/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item, lote, quantidade, qtd_unidades, validade })
        });
        if (res.ok) { 
            alert("✅ Adicionado com sucesso!");
            document.getElementById('add-nome').value = '';
            document.getElementById('add-lote').value = '';
            document.getElementById('add-unidades').value = '';
            document.getElementById('add-qtd').value = '';
            carregarTabelaConferencia();
        }
    } catch (e) { alert("Erro ao salvar."); }
}

async function processarExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading('Lendo planilha...');
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const planilha = workbook.Sheets[workbook.SheetNames[0]];
            const dados = XLSX.utils.sheet_to_json(planilha);
            const res = await fetch(`${API_URL}/estoque/importar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dados })
            });
            if (res.ok) {
                alert("✅ Importação concluída!");
                carregarTabelaConferencia();
            } else {
                alert("Erro ao processar dados no servidor.");
            }
        } catch (err) { alert("Erro ao processar a planilha."); }
        finally { hideLoading(); }
    };
    reader.onerror = () => {
        hideLoading();
        alert("Não foi possível ler a planilha.");
    };
    reader.readAsArrayBuffer(file);
}

async function carregarListasFluxo() {
    try {
        const res = await fetch(`${API_URL}/relatorios`);
        const logs = await res.json();
        const divEntradas = document.getElementById('lista-fluxo-entradas');
        const divSaidas = document.getElementById('lista-fluxo-saidas');
        if (!divEntradas || !divSaidas) return;
        divEntradas.innerHTML = ''; divSaidas.innerHTML = '';

        logs.forEach(log => {
            const html = `<div class="item-historico">
                <small style="color: #64748b">${new Date(log.data_hora || Date.now()).toLocaleString('pt-BR')}</small><br>
                <strong>${log.item}</strong><br>
                <span class="${log.tipo === 'ENTRADA' ? 'tag-entrada' : 'tag-saida'}">
                    ${log.tipo === 'ENTRADA' ? '↓ +' : '↑ -'} ${Number(log.quantidade).toFixed(2)}kg
                </span>
            </div>`;
            if (log.tipo === 'ENTRADA') divEntradas.innerHTML += html;
            else divSaidas.innerHTML += html;
        });
    } catch (e) { console.error("Erro ao carregar fluxos"); }
}

async function carregarTabelaConferencia() {
    const busca = document.getElementById('busca-estoque').value.toLowerCase();
    try {
        const res = await fetch(`${API_URL}/lista-estoque`);
        const estoque = await res.json();
        const corpo = document.getElementById('corpo-tabela-estoque');
        if (!corpo) return;

        const filtrado = estoque.filter(i => i.item.toLowerCase().includes(busca));

        corpo.innerHTML = filtrado.map(i => `<tr>
            <td style="padding:12px"><b>${i.item}</b></td>
            <td>${i.lote}</td>
            <td>${i.qtd_unidades}</td>
            <td>${Number(i.quantidade).toFixed(3)}kg</td>
            <td>${i.validade || '-'}</td>
            <td style="text-align:center">
                <button class="btn-edit" onclick="editarEstoqueManual(${i.id}, ${i.quantidade}, ${i.qtd_unidades})"><i class="fas fa-edit"></i></button>
                <button onclick="removerItemPorId(${i.id})" style="background:#ef4444; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
    } catch (e) { }
}

async function editarEstoqueManual(id, qtdAtual, unAtual) {
    const novaQtdRaw = prompt("Novo peso total em Kg:", qtdAtual);
    const novaUnRaw = prompt("Nova quantidade de unidades:", unAtual);
    if (novaQtdRaw === null || novaUnRaw === null) return;
    const novaQtd = Number(String(novaQtdRaw).replace(',', '.'));
    const novaUn = parseInt(String(novaUnRaw).replace(',', '.'), 10);
    if (Number.isNaN(novaQtd) || Number.isNaN(novaUn)) { alert('Valores inválidos. Use apenas números.'); return; }
    try {
        const res = await fetch(`${API_URL}/estoque/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantidade: novaQtd, qtd_unidades: novaUn })
        });
        if (res.ok) { carregarTabelaConferencia(); carregarSelectExclusao(); }
        else { const err = await res.json(); alert('Erro: ' + (err.error || 'Não foi possível editar.')); }
    } catch (e) { alert('Erro de conexão ao editar.'); }
}

async function verGastoDoDia() {
    try {
        const res = await fetch(`${API_URL}/relatorios`);
        const logs = await res.json();
        const container = document.getElementById('lista-dia');
        if (!container) return;

        const saidas = logs.filter(l => l.tipo === 'SAIDA');
        const grupos = {};

        saidas.forEach(l => {
            const chave = `${l.timestamp || l.data_hora}|${l.prato || ''}|${l.periodo || ''}|${l.usuario || ''}`;
            if (!grupos[chave]) {
                grupos[chave] = {
                    timestamp: l.timestamp || l.data_hora,
                    prato: l.prato,
                    periodo: l.periodo,
                    usuario: l.usuario,
                    itens: []
                };
            }
            grupos[chave].itens.push({ item: l.item, quantidade: l.quantidade, unidades: l.unidades, lote: l.lote, id: l.id });
        });

        const gruposOrdenados = Object.values(grupos).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        container.innerHTML = gruposOrdenados.map(grupo => {
            const dataHora = grupo.timestamp ? new Date(grupo.timestamp).toLocaleString('pt-BR') : 'Data Indisp.';
            const itensHtml = grupo.itens.map(i => `<li>${i.item} - ${Number(i.quantidade).toFixed(3)}kg${i.unidades ? ` | ${i.unidades} un` : ''}${i.lote ? ` | Lote: ${i.lote}` : ''}</li>`).join('');
            return `<div class="historico-card">
                <div class="historico-card-header">
                    <div>
                        <small style="color:#2563eb; display:block; margin-bottom:6px;">📅 ${dataHora}</small>
                        <strong>${grupo.prato || 'Registro de Saída'}</strong>
                        <div class="historico-card-details">${grupo.periodo || 'Período não informado'} • Responsável: ${grupo.usuario || 'N/A'}</div>
                    </div>
                    <button onclick="apagarLogGrupo('${grupo.timestamp || ''}', '${grupo.prato || ''}', '${grupo.periodo || ''}', '${grupo.usuario || ''}')" style="color:#ef4444; background:none; border:none; cursor:pointer; padding: 6px 10px;">Remover</button>
                </div>
                <ul>
                    ${itensHtml}
                </ul>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); }
}

async function apagarLogGrupo(timestamp, prato, periodo, usuario) {
    if (!confirm('Deseja apagar esse registro de histórico?')) return;
    try {
        const res = await fetch(`${API_URL}/relatorios`);
        const logs = await res.json();
        const saidas = logs.filter(l => l.tipo === 'SAIDA');
        const logsParaRemover = saidas.filter(l => `${l.timestamp || l.data_hora}|${l.prato || ''}|${l.periodo || ''}|${l.usuario || ''}` === `${timestamp}|${prato}|${periodo}|${usuario}`);
        for (const log of logsParaRemover) {
            await fetch(`${API_URL}/logs/${log.id}`, { method: 'DELETE' });
        }
        verGastoDoDia();
    } catch (e) { console.error(e); }
}

async function limparFluxoEntrada() {
    if (!confirm('Deseja limpar TODAS as entradas de comida?')) return;
    try {
        const res = await fetch(`${API_URL}/relatorios`);
        const logs = await res.json();
        const entradas = logs.filter(l => l.tipo === 'ENTRADA');
        for (const log of entradas) {
            await fetch(`${API_URL}/logs/${log.id}`, { method: 'DELETE' });
        }
        carregarListasFluxo();
    } catch (e) { console.error('Erro ao limpar entradas', e); alert('Erro ao limpar entradas'); }
}

async function limparFluxoSaida() {
    if (!confirm('Deseja limpar TODAS as saídas de comida?')) return;
    try {
        const res = await fetch(`${API_URL}/relatorios`);
        const logs = await res.json();
        const saidas = logs.filter(l => l.tipo === 'SAIDA');
        for (const log of saidas) {
            await fetch(`${API_URL}/logs/${log.id}`, { method: 'DELETE' });
        }
        carregarListasFluxo();
        verGastoDoDia();
    } catch (e) { console.error('Erro ao limpar saídas', e); alert('Erro ao limpar saídas'); }
}

async function limparTodoOHistorico() {
    if (!confirm('Deseja limpar TODOS os registros de histórico (entradas, saídas e consumo)?')) return;
    try {
        const res = await fetch(`${API_URL}/relatorios`);
        const logs = await res.json();
        for (const log of logs) {
            await fetch(`${API_URL}/logs/${log.id}`, { method: 'DELETE' });
        }
        carregarListasFluxo();
        verGastoDoDia();
    } catch (e) { console.error('Erro ao limpar histórico', e); alert('Erro ao limpar histórico'); }
}

async function apagarLog(id) {
    if (!confirm("Deseja apagar este registro do histórico?")) return;
    try {
        const res = await fetch(`${API_URL}/logs/${id}`, { method: 'DELETE' });
        if (res.ok) verGastoDoDia();
    } catch (e) { alert("Erro ao deletar log."); }
}


async function carregarSelectExclusao() {
    try {
        const res = await fetch(`${API_URL}/lista-estoque`);
        const itens = await res.json();
        const select = document.getElementById('delete-alimento-select');
        if (select) {
            select.innerHTML = '<option value="">Selecione um lote...</option>' + 
                itens.map(i => `<option value="${i.id}">${i.item} (Lote: ${i.lote})</option>`).join('');
        }
    } catch (e) { }
}

async function removerItemEstoque() {
    const id = document.getElementById('delete-alimento-select').value;
    if (!id) { alert("Selecione um item!"); return; }
    await removerItemPorId(id);
}

async function removerItemPorId(id) {
    if (!confirm("Deseja excluir permanentemente este lote?")) return;
    try {
        const res = await fetch(`${API_URL}/estoque/${id}`, { method: 'DELETE' });
        if (res.ok) { 
            carregarTabelaConferencia(); 
            carregarSelectExclusao(); 
        }
    } catch (e) { }
}

function trocarFotoPerfil(event) {
    const reader = new FileReader();
    reader.onload = function() {
        const output = document.getElementById('avatar-img');
        output.innerHTML = `<img src="${reader.result}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    }
    reader.readAsDataURL(event.target.files[0]);
}

function cabecalhosAutenticados(extra = {}) {
    return { ...extra, Authorization: `Bearer ${usuarioLogado?.accessToken || ''}` };
}

function formatarDataHora(valor) {
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? 'Horário indisponível' : data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function atualizarStatusTempoReal(texto, conectado) {
    document.querySelectorAll('[data-realtime-status]').forEach(elemento => {
        elemento.textContent = texto;
        elemento.classList.toggle('is-online', conectado);
    });
}

async function carregarNotificacoes() {
    if (usuarioLogado?.cargo !== 'Diretor') return;
    try {
        const response = await fetch(`${API_URL}/api/notifications`, { headers: cabecalhosAutenticados() });
        if (!response.ok) throw new Error('Não foi possível carregar as notificações.');
        const carregadas = await response.json();
        const idsCarregados = new Set(carregadas.map(item => String(item.id)));
        const recebidasAoVivo = notificacoes.filter(item => !idsCarregados.has(String(item.id)));
        notificacoes = [...recebidasAoVivo, ...carregadas].slice(0, 100);
        renderizarNotificacoes();
    } catch (error) {
        const lista = document.getElementById('lista-notificacoes');
        if (lista) lista.textContent = error.message;
    }
}

function renderizarNotificacoes() {
    const lista = document.getElementById('lista-notificacoes');
    const badge = document.getElementById('notification-count');
    const naoLidas = notificacoes.filter(item => !item.read_at).length;
    if (badge) {
        badge.textContent = naoLidas > 9 ? '9+' : String(naoLidas);
        badge.classList.toggle('hidden', naoLidas === 0);
    }
    if (!lista) return;
    lista.replaceChildren();
    if (notificacoes.length === 0) {
        lista.textContent = 'Nenhuma notificação por enquanto.';
        return;
    }
    notificacoes.forEach(item => {
        const row = document.createElement('article');
        row.className = `notification-item${item.read_at ? '' : ' is-unread'}`;
        const icon = document.createElement('span');
        icon.className = 'notification-item-icon';
        icon.innerHTML = '<i class="fas fa-utensils" aria-hidden="true"></i>';
        const content = document.createElement('div');
        content.className = 'notification-item-content';
        const message = document.createElement('strong');
        message.textContent = item.message;
        const details = document.createElement('small');
        details.textContent = `${item.actor_name} · ${formatarDataHora(item.created_at)}`;
        content.append(message, details);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'notification-delete-button';
        remove.setAttribute('aria-label', `Apagar notificação de ${item.actor_name}`);
        remove.title = 'Apagar notificação';
        remove.innerHTML = '<i class="fas fa-trash" aria-hidden="true"></i>';
        remove.addEventListener('click', () => apagarNotificacao(item.id));
        row.append(icon, content, remove);
        lista.appendChild(row);
    });
}

async function apagarNotificacao(id) {
    try {
        const response = await fetch(`${API_URL}/api/notifications/${id}`, {
            method: 'DELETE',
            headers: cabecalhosAutenticados()
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível apagar a notificação.');
        notificacoes = notificacoes.filter(item => String(item.id) !== String(id));
        renderizarNotificacoes();
    } catch (error) { alert(error.message); }
}

async function marcarNotificacoesComoLidas() {
    try {
        const response = await fetch(`${API_URL}/api/notifications/read-all`, {
            method: 'POST',
            headers: cabecalhosAutenticados()
        });
        if (!response.ok) throw new Error('Não foi possível atualizar as notificações.');
        const agora = new Date().toISOString();
        notificacoes = notificacoes.map(item => ({ ...item, read_at: item.read_at || agora }));
        renderizarNotificacoes();
    } catch (error) { alert(error.message); }
}

function nomeCompletoChat(contact) {
    return [contact?.nome, contact?.sobrenome].filter(Boolean).join(' ') || 'Usuário';
}

function avatarChat(contact) {
    return nomeCompletoChat(contact).split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

async function carregarContatos() {
    if (!usuarioLogado?.accessToken) return;
    try {
        const response = await fetch(`${API_URL}/api/contacts`, { headers: cabecalhosAutenticados() });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os contatos.');
        contatosChat = result;
        renderizarContatos();
        if (!contatosChat.some(contact => Number(contact.id) === Number(contatoSelecionadoId))) {
            contatoSelecionadoId = contatosChat[0]?.id || null;
            mensagens = [];
            respostaSelecionada = null;
            hasMoreMessages = false;
        }
        renderizarChat();
        if (contatoSelecionadoId) await carregarMensagens();
    } catch (error) {
        document.querySelectorAll('.chat-contacts').forEach(list => {
            list.replaceChildren();
            const message = document.createElement('p');
            message.className = 'chat-empty-contacts';
            message.textContent = error.message;
            list.appendChild(message);
        });
    }
}

function renderizarContatos() {
    const ordered = [...contatosChat].sort((a, b) => Number(b.online) - Number(a.online) || nomeCompletoChat(a).localeCompare(nomeCompletoChat(b), 'pt-BR'));
    const activeView = usuarioLogado?.cargo === 'Diretor' ? 'diretor' : 'cozinha';
    [activeView].forEach(view => {
        const list = document.getElementById(`lista-contatos-${view}`);
        if (!list) return;
        const search = document.getElementById(`busca-contatos-${view}`)?.value.trim().toLocaleLowerCase('pt-BR') || '';
        const filtered = ordered.filter(contact => `${nomeCompletoChat(contact)} ${contact.cargo}`.toLocaleLowerCase('pt-BR').includes(search));
        list.replaceChildren();
        if (filtered.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'chat-empty-contacts';
            empty.textContent = contatosChat.length ? 'Nenhum contato corresponde à busca.' : 'Nenhum outro usuário cadastrado.';
            list.appendChild(empty);
            return;
        }
        filtered.forEach(contact => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `chat-contact${contact.online ? ' is-online' : ''}${Number(contact.id) === Number(contatoSelecionadoId) ? ' is-selected' : ''}`;
            button.setAttribute('role', 'listitem');
            button.setAttribute('aria-label', `${nomeCompletoChat(contact)}, ${contact.cargo}, ${contact.online ? 'online' : 'offline'}`);
            button.addEventListener('click', () => selecionarContato(contact.id));

            const avatar = document.createElement('span');
            avatar.className = 'chat-contact-avatar';
            avatar.textContent = avatarChat(contact);
            const copy = document.createElement('span');
            copy.className = 'chat-contact-copy';
            const name = document.createElement('strong');
            name.textContent = nomeCompletoChat(contact);
            const detail = document.createElement('small');
            const unread = naoLidasPorContato.get(Number(contact.id)) || 0;
            detail.textContent = `${contact.cargo}${unread ? ` · ${unread} nova${unread > 1 ? 's' : ''}` : ''}`;
            const dot = document.createElement('span');
            dot.className = 'chat-presence-dot';
            dot.title = contact.online ? 'Online' : 'Offline';
            copy.append(name, detail);
            button.append(avatar, copy, dot);
            list.appendChild(button);
        });
    });
    atualizarDestinoCompartilhamento();
}

async function selecionarContato(contactId) {
    contatoSelecionadoId = Number(contactId);
    mensagens = [];
    respostaSelecionada = null;
    hasMoreMessages = false;
    loadingOlderMessages = false;
    naoLidasPorContato.delete(contatoSelecionadoId);
    renderizarContatos();
    renderizarChat();
    await carregarMensagens();
}

function contatoSelecionado() {
    return contatosChat.find(contact => Number(contact.id) === Number(contatoSelecionadoId));
}

function criarEstadoChat(title, detail) {
    const empty = document.createElement('div');
    empty.className = 'chat-empty-state';
    const icon = document.createElement('i');
    icon.className = 'fas fa-comments';
    icon.setAttribute('aria-hidden', 'true');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const copy = document.createElement('span');
    copy.textContent = detail;
    empty.append(icon, heading, copy);
    return empty;
}

function criarAcaoMensagem(label, iconName, action, messageId, dangerous = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chat-action-button${dangerous ? ' is-danger' : ''}`;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<i class="fas ${iconName}" aria-hidden="true"></i>`;
    button.addEventListener('click', () => action(messageId));
    return button;
}

function criarElementoMensagem(message) {
    const isMine = message.is_mine ?? Number(message.sender_user_id) === Number(usuarioLogado?.id);
    const row = document.createElement('article');
    row.className = `chat-message${isMine ? ' is-mine' : ''}`;
    const bubble = document.createElement('div');
    bubble.className = 'chat-message-bubble';

    if (!isMine) {
        const sender = document.createElement('div');
        sender.className = 'chat-message-sender';
        sender.textContent = message.sender_name;
        bubble.appendChild(sender);
    }
    if (message.forwarded_from_id) {
        const forwarded = document.createElement('div');
        forwarded.className = 'chat-message-forwarded';
        forwarded.textContent = `Encaminhada${message.forwarded_sender_name ? ` de ${message.forwarded_sender_name}` : ''}`;
        bubble.appendChild(forwarded);
    }
    if (message.reply_to_message_id) {
        const quote = document.createElement('blockquote');
        quote.className = 'chat-reply-quote';
        const quoteSender = document.createElement('strong');
        quoteSender.textContent = message.reply_sender_name || 'Mensagem anterior';
        const quoteBody = document.createElement('span');
        quoteBody.textContent = message.reply_deleted_for_all_at ? 'Mensagem apagada' : (message.reply_body || 'Conteúdo indisponível');
        quote.append(quoteSender, quoteBody);
        bubble.appendChild(quote);
    }
    const body = document.createElement('p');
    body.textContent = message.deleted_for_all_at ? 'Esta mensagem foi apagada.' : message.body;
    if (message.deleted_for_all_at) body.classList.add('chat-deleted-copy');
    bubble.appendChild(body);
    row.appendChild(bubble);

    if (!message.deleted_for_all_at) {
        const actions = document.createElement('div');
        actions.className = 'chat-message-actions';
        actions.appendChild(criarAcaoMensagem('Responder', 'fa-reply', responderMensagem, message.id));
        actions.appendChild(criarAcaoMensagem('Compartilhar', 'fa-share', prepararCompartilhamento, message.id));
        actions.appendChild(criarAcaoMensagem('Apagar para mim', 'fa-trash', apagarParaMim, message.id, true));
        if (isMine) actions.appendChild(criarAcaoMensagem('Apagar para todos', 'fa-trash-alt', apagarParaTodos, message.id, true));
        row.appendChild(actions);
    }

    const meta = document.createElement('time');
    meta.className = 'chat-message-meta';
    meta.dateTime = message.created_at;
    meta.textContent = formatarDataHora(message.created_at);
    row.appendChild(meta);
    return row;
}

function renderizarChat({ scrollToBottom = true, previousScroll = null } = {}) {
    const contact = contatoSelecionado();
    const activeView = usuarioLogado?.cargo === 'Diretor' ? 'diretor' : 'cozinha';
    [activeView].forEach(view => {
        const header = document.getElementById(`cabecalho-chat-${view}`);
        const thread = document.getElementById(`lista-mensagens-${view}`);
        const textarea = document.getElementById(`mensagem-${view}`);
        const replyPreview = document.getElementById(`resposta-chat-${view}`);
        const sendButton = document.querySelector(`#form-mensagem-${view} .chat-send-button`);
        if (!header || !thread || !textarea || !replyPreview) return;

        header.replaceChildren();
        if (contact) {
            const avatar = document.createElement('span');
            avatar.className = 'chat-contact-avatar';
            avatar.textContent = avatarChat(contact);
            const copy = document.createElement('span');
            const name = document.createElement('strong');
            name.textContent = nomeCompletoChat(contact);
            const role = document.createElement('small');
            role.textContent = `${contact.cargo} · ${contact.online ? 'Online' : 'Offline'}`;
            copy.append(name, role);
            header.append(avatar, copy);
        } else {
            const title = document.createElement('strong');
            title.textContent = 'Selecione um contato';
            header.appendChild(title);
        }

        thread.replaceChildren();
        if (!contact) thread.appendChild(criarEstadoChat('Suas conversas', 'Escolha um contato para começar uma conversa individual.'));
        else if (mensagens.length === 0) thread.appendChild(criarEstadoChat('Início da conversa', 'Envie uma mensagem para iniciar este diálogo.'));
        else {
            if (hasMoreMessages) {
                const olderButton = document.createElement('button');
                olderButton.type = 'button';
                olderButton.className = 'chat-load-older';
                olderButton.textContent = loadingOlderMessages ? 'Carregando...' : 'Carregar mensagens anteriores';
                olderButton.disabled = loadingOlderMessages;
                olderButton.addEventListener('click', () => carregarMensagens({ older: true }));
                thread.appendChild(olderButton);
            }
            mensagens.forEach(message => thread.appendChild(criarElementoMensagem(message)));
        }

        textarea.disabled = !contact;
        textarea.placeholder = contact ? `Mensagem para ${contact.nome}...` : 'Selecione um contato para enviar mensagens';
        if (sendButton) sendButton.disabled = !contact;
        replyPreview.replaceChildren();
        replyPreview.classList.toggle('hidden', !respostaSelecionada || !contact);
        if (respostaSelecionada && contact) {
            const copy = document.createElement('span');
            const label = document.createElement('strong');
            label.textContent = `Respondendo a ${respostaSelecionada.sender_name}: `;
            copy.append(label, document.createTextNode(respostaSelecionada.body));
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'icon-button';
            cancel.setAttribute('aria-label', 'Cancelar resposta');
            cancel.innerHTML = '&times;';
            cancel.addEventListener('click', cancelarResposta);
            replyPreview.append(copy, cancel);
        }
        requestAnimationFrame(() => {
            if (previousScroll) thread.scrollTop = previousScroll.top + thread.scrollHeight - previousScroll.height;
            else if (scrollToBottom) thread.scrollTop = thread.scrollHeight;
        });
    });
}

async function carregarMensagens({ older = false } = {}) {
    const contactId = Number(contatoSelecionadoId);
    if (!usuarioLogado?.accessToken || !Number.isSafeInteger(contactId) || contactId < 1) return;
    const view = usuarioLogado.cargo === 'Diretor' ? 'diretor' : 'cozinha';
    const thread = document.getElementById(`lista-mensagens-${view}`);
    const previousScroll = older && thread ? { top: thread.scrollTop, height: thread.scrollHeight } : null;
    if (older) loadingOlderMessages = true;
    renderizarChat({ scrollToBottom: !older, previousScroll });
    try {
        const before = older ? mensagens[0]?.id : null;
        const query = new URLSearchParams({ contactId: String(contactId) });
        if (before) query.set('before', String(before));
        const response = await fetch(`${API_URL}/api/messages?${query}`, { headers: cabecalhosAutenticados() });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar esta conversa.');
        if (contactId !== Number(contatoSelecionadoId)) return;
        const page = Array.isArray(payload) ? payload : (payload.messages || []);
        hasMoreMessages = Array.isArray(payload) ? false : Boolean(payload.hasMore);
        const merged = new Map([...(older ? page : []), ...mensagens, ...(older ? [] : page)].map(message => [String(message.id), message]));
        mensagens = [...merged.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        loadingOlderMessages = false;
        renderizarChat({ scrollToBottom: !older, previousScroll });
    } catch (error) {
        loadingOlderMessages = false;
        if (thread) { thread.replaceChildren(); thread.appendChild(criarEstadoChat('Conversa indisponível', error.message)); }
    }
}

function adicionarMensagemLocal(message) {
    if (!mensagens.some(existing => String(existing.id) === String(message.id))) {
        mensagens.push(message);
        mensagens.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        mensagens = mensagens.slice(-300);
    }
}

function responderMensagem(messageId) {
    respostaSelecionada = mensagens.find(message => String(message.id) === String(messageId)) || null;
    renderizarChat();
    document.getElementById(`mensagem-${usuarioLogado?.cargo === 'Diretor' ? 'diretor' : 'cozinha'}`)?.focus();
}

function cancelarResposta() {
    respostaSelecionada = null;
    renderizarChat();
}

async function enviarMensagem(event, view) {
    event.preventDefault();
    const input = document.getElementById(`mensagem-${view}`);
    const body = input.value.trim();
    const recipientUserId = Number(contatoSelecionadoId);
    if (!body || !recipientUserId) return;
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
        const response = await fetch(`${API_URL}/api/messages`, {
            method: 'POST',
            headers: cabecalhosAutenticados({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ body, recipientUserId, replyToMessageId: respostaSelecionada?.id || null })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível enviar a mensagem.');
        adicionarMensagemLocal({ ...result, is_mine: true });
        input.value = '';
        respostaSelecionada = null;
        renderizarChat();
    } catch (error) { alert(error.message); }
    finally { button.disabled = false; }
}

async function apagarMensagem(messageId, scope) {
    const prompt = scope === 'everyone' ? 'Apagar esta mensagem para todos os participantes?' : 'Apagar esta mensagem apenas da sua conversa?';
    if (!confirm(prompt)) return;
    try {
        const response = await fetch(`${API_URL}/api/messages/${messageId}?scope=${scope}`, {
            method: 'DELETE',
            headers: cabecalhosAutenticados()
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível apagar a mensagem.');
        mensagens = mensagens.filter(message => String(message.id) !== String(messageId));
        renderizarChat();
    } catch (error) { alert(error.message); }
}

function apagarParaMim(messageId) { apagarMensagem(messageId, 'me'); }
function apagarParaTodos(messageId) { apagarMensagem(messageId, 'everyone'); }

function atualizarDestinoCompartilhamento() {
    const select = document.getElementById('destino-compartilhamento');
    if (!select) return;
    const previousValue = select.value;
    select.replaceChildren();
    contatosChat.filter(contact => Number(contact.id) !== Number(contatoSelecionadoId)).forEach(contact => {
        const option = document.createElement('option');
        option.value = contact.id;
        option.textContent = `${nomeCompletoChat(contact)} · ${contact.cargo}${contact.online ? ' · online' : ''}`;
        select.appendChild(option);
    });
    if ([...select.options].some(option => option.value === previousValue)) select.value = previousValue;
}

function prepararCompartilhamento(messageId) {
    if (contatosChat.filter(contact => Number(contact.id) !== Number(contatoSelecionadoId)).length === 0) {
        alert('Não há outro contato disponível para encaminhar esta mensagem.');
        return;
    }
    mensagemParaCompartilharId = messageId;
    atualizarDestinoCompartilhamento();
    document.getElementById('compartilhar-mensagem-dialog')?.showModal();
}

async function compartilharMensagem() {
    const recipientUserId = Number(document.getElementById('destino-compartilhamento')?.value);
    if (!mensagemParaCompartilharId || !recipientUserId) return;
    try {
        const response = await fetch(`${API_URL}/api/messages/${mensagemParaCompartilharId}/forward`, {
            method: 'POST',
            headers: cabecalhosAutenticados({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ recipientUserId })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível encaminhar a mensagem.');
        document.getElementById('compartilhar-mensagem-dialog').close();
        mensagemParaCompartilharId = null;
        alert('Mensagem encaminhada.');
    } catch (error) { alert(error.message); }
}

function mostrarNotificacaoAoVivo(notification) {
    const toast = document.getElementById('live-toast');
    if (!toast || usuarioLogado?.cargo !== 'Diretor') return;
    document.getElementById('live-toast-title').textContent = notification.actor_name || 'Equipe da cozinha';
    document.getElementById('live-toast-detail').textContent = `${notification.message} · ${formatarDataHora(notification.created_at)}`;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(dispensarNotificacaoAoVivo, 8000);
}

function dispensarNotificacaoAoVivo() {
    document.getElementById('live-toast')?.classList.add('hidden');
    clearTimeout(toastTimer);
}

async function conectarEventosEmTempoReal() {
    if (!usuarioLogado?.accessToken) return;
    realtimeSource?.close();
    clearTimeout(realtimeReconnectTimer);
    atualizarStatusTempoReal('Conectando...', false);
    try {
        const ticketResponse = await fetch(`${API_URL}/api/events/ticket`, { headers: cabecalhosAutenticados() });
        if (!ticketResponse.ok) throw new Error('Não foi possível iniciar a conexão em tempo real.');
        const { ticket } = await ticketResponse.json();
        if (!usuarioLogado?.accessToken) return;
        const source = new EventSource(`${API_URL}/api/events?ticket=${encodeURIComponent(ticket)}`);
        realtimeSource = source;
        source.onopen = () => atualizarStatusTempoReal('Em tempo real', true);
        source.addEventListener('notification', event => {
            const notification = JSON.parse(event.data);
            if (usuarioLogado?.cargo !== 'Diretor') return;
            if (!notificacoes.some(item => item.id === notification.id)) notificacoes.unshift(notification);
            renderizarNotificacoes();
            mostrarNotificacaoAoVivo(notification);
        });
        source.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            const currentUserId = Number(usuarioLogado?.id);
            const senderId = Number(message.sender_user_id);
            const recipientId = Number(message.recipient_user_id);
            const contactId = senderId === currentUserId ? recipientId : senderId;
            if (contactId === Number(contatoSelecionadoId)) {
                adicionarMensagemLocal(message);
                naoLidasPorContato.delete(contactId);
                renderizarChat();
            } else if (senderId !== currentUserId) {
                naoLidasPorContato.set(contactId, (naoLidasPorContato.get(contactId) || 0) + 1);
                renderizarContatos();
            }
        });
        source.addEventListener('presence', event => {
            const presence = JSON.parse(event.data);
            const onlineIds = new Set((presence.users || []).map(user => Number(user.id)));
            contatosChat = contatosChat.map(contact => ({ ...contact, online: onlineIds.has(Number(contact.id)) }));
            renderizarContatos();
            renderizarChat();
        });
        source.addEventListener('message_deleted', event => {
            const deletion = JSON.parse(event.data);
            mensagens = mensagens.filter(message => String(message.id) !== String(deletion.id));
            renderizarChat();
        });
        source.onerror = () => {
            source.close();
            if (realtimeSource !== source) return;
            realtimeSource = null;
            atualizarStatusTempoReal('Reconectando...', false);
            realtimeReconnectTimer = setTimeout(conectarEventosEmTempoReal, 2500);
        };
    } catch {
        atualizarStatusTempoReal('Reconectando...', false);
        realtimeReconnectTimer = setTimeout(conectarEventosEmTempoReal, 4000);
    }
}