const API_URL = 'http://localhost:3000';
let usuarioLogado = null;
let estoqueLocal = []; 
let itensParaBaixa = []; 

const SOM_NOTIFICACAO = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// ==========================================
// 1. INICIALIZAÇÃO E INTERFACE
// ==========================================

// NOVO: Verifica se o usuário já estava logado ao abrir a página (Resolve erro do F5)
window.addEventListener('load', () => {
    const salvo = localStorage.getItem('usuarioLogado');
    if (salvo) {
        usuarioLogado = JSON.parse(salvo);
        configurarInterfacePorUsuario(usuarioLogado);
    }
    atualizarDataVisor();
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
    if (sidebar) sidebar.classList.toggle('open');
}

function ajustarBrilho(valor) {
    document.body.style.filter = `brightness(${valor}%)`;
}

function logout() {
    if (confirm("Deseja realmente sair do sistema?")) {
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

    if (data.cargo === 'Cozinheira') {
        document.getElementById('cozinha-view').classList.remove('hidden');
        document.getElementById('user-display').innerText = data.nome;
        carregarSelectCozinha();
    } else {
        document.getElementById('diretor-view').classList.remove('hidden');
        document.getElementById('admin-display').innerText = data.nome;
        carregarListasFluxo();
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prato, periodo, itens: itensParaBaixa, usuarioNome: usuarioLogado.nome })
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

    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const planilha = workbook.Sheets[workbook.SheetNames[0]];
        const dados = XLSX.utils.sheet_to_json(planilha);

        try {
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
        } catch (err) { alert("Erro ao importar Excel."); }
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