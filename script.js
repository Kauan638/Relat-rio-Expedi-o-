/* =========================================================
   CONFIRMAÇÃO DE CARREGAMENTO — script.js
   Foto (comprimida no navegador) + dados da doca → Web Share API
   pro WhatsApp (contato/grupo escolhido na hora pelo usuário).
========================================================= */

let fotoBlob = null;
let fotoURL = null;
let toastTimeout = null;

/* ---------- INICIALIZAÇÃO ---------- */

document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('inputCamera')
        .addEventListener('change', e => handleFotoSelecionada(e.target.files[0]));

    document.getElementById('inputGaleria')
        .addEventListener('change', e => handleFotoSelecionada(e.target.files[0]));

    document.getElementById('modalConfirmar')
        .addEventListener('click', e => {
            if (e.target.id === 'modalConfirmar') fecharConfirmacao();
        });

    document.getElementById('modalLoja')
        .addEventListener('click', e => {
            if (e.target.id === 'modalLoja') fecharModalLoja();
        });

    document.getElementById('modalLojaInput')
        .addEventListener('keydown', e => {
            if (e.key === 'Enter') confirmarLoja();
        });

    document.getElementById('manualLojasChips')
        .addEventListener('click', e => {
            const btn = e.target.closest('button[data-loja]');
            if (btn) removerLoja(btn.dataset.loja);
        });

    document.getElementById('manualRegistrosLista')
        .addEventListener('click', e => {
            const btn = e.target.closest('button[data-data]');
            if (btn) excluirRegistroManual(btn.dataset.data);
        });

    document.getElementById('inputFaturamento')
        .addEventListener('change', e => handleArquivoFaturamento(e.target.files[0]));

    document.addEventListener('click', e => {
        const select = document.getElementById('faturamentoSetorSelect');
        if (select && !select.contains(e.target)) {
            document.getElementById('faturamentoSetorPainel').style.display = 'none';
        }
    });

    document.getElementById('faturamentoFiltrarData')
        .addEventListener('change', e => {
            document.getElementById('faturamentoDataBox').style.display = e.target.checked ? 'grid' : 'none';
        });

    document.getElementById('faturamentoFiltrarHorario')
        .addEventListener('change', e => {
            const mostrar = e.target.checked;
            document.getElementById('faturamentoHorarioBox').style.display = mostrar ? 'grid' : 'none';
            document.getElementById('faturamentoHorarioDica').style.display = mostrar ? 'block' : 'none';
        });

    const ultimoCliente = localStorage.getItem('carregamento_ultimoCliente');
    if (ultimoCliente) {
        document.getElementById('campoCliente').value = ultimoCliente;
    }

    document.getElementById('manualData').value = hojeISO();

    renderHistorico();
    renderLojasChips();
    renderRegistrosManuais();
    popularSelectRelatorio();
});

/* ---------- FOTO: CAPTURA + COMPRESSÃO ---------- */

async function handleFotoSelecionada(file) {

    if (!file) return;

    try {
        const blob = await comprimirImagem(file);

        if (fotoURL) URL.revokeObjectURL(fotoURL);

        fotoBlob = blob;
        fotoURL = URL.createObjectURL(blob);

        document.getElementById('fotoPreview').src = fotoURL;
        document.getElementById('fotoVazia').style.display = 'none';
        document.getElementById('fotoPreviewBox').style.display = 'block';

    } catch (err) {
        console.error('Erro ao processar foto:', err);
        mostrarToast('Não consegui processar essa foto. Tenta de novo.', 'erro');
    }
}

async function comprimirImagem(file) {

    const MAX_DIM = 1600;

    let source, width, height;

    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        source = bitmap;
        width = bitmap.width;
        height = bitmap.height;
    } catch {
        // fallback pra navegadores sem suporte a createImageBitmap com orientação
        const img = await new Promise((resolve, reject) => {
            const im = new Image();
            im.onload = () => resolve(im);
            im.onerror = reject;
            im.src = URL.createObjectURL(file);
        });
        source = img;
        width = img.naturalWidth;
        height = img.naturalHeight;
    }

    let w = width, h = height;
    if (w > MAX_DIM || h > MAX_DIM) {
        if (w >= h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
        else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(source, 0, 0, w, h);

    return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.85);
    });
}

function retirarFoto() {

    fotoBlob = null;

    if (fotoURL) {
        URL.revokeObjectURL(fotoURL);
        fotoURL = null;
    }

    document.getElementById('inputCamera').value = '';
    document.getElementById('inputGaleria').value = '';
    document.getElementById('fotoPreviewBox').style.display = 'none';
    document.getElementById('fotoVazia').style.display = 'block';
}

/* ---------- FORMULÁRIO ---------- */

function coletarDados() {
    return {
        doca:     document.getElementById('campoDoca').value.trim(),
        loja:     document.getElementById('campoLoja').value.trim(),
        paletes:  document.getElementById('campoPaletes').value.trim(),
        cliente:  document.getElementById('campoCliente').value.trim(),
        status:   document.getElementById('campoStatus').value,
        obs:      document.getElementById('campoObs').value.trim()
    };
}

function hojeISO() {
    const data = new Date();
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function eNumeroInteiroNaoNegativo(valor) {
    return /^\d+$/.test(valor);
}

function construirMensagem(d) {

    const emojiStatus = {
        'Faturada':        '✅',
        'Não Faturada':    '⚠️',
        'Em Conferência':  '🔎',
        'Pendente':        '⏳'
    }[d.status] || '📋';

    const linhas = [
        `Doca: *${d.doca}*`,
        `Loja: *${d.loja}*`,
        `Paletes: *${d.paletes}*`,
        `Tipo de veículo: *${d.cliente}*`,
        `Status: ${emojiStatus} *${d.status}*`
    ];
    if (d.obs) linhas.push(`Observação: ${d.obs}`);
    return linhas.join('\n');
}

function limparFormulario() {
    document.getElementById('campoDoca').value = '';
    document.getElementById('campoLoja').value = '';
    document.getElementById('campoPaletes').value = '';
    document.getElementById('campoObs').value = '';
    document.getElementById('campoStatus').value = 'Faturada';
    // campoCliente propositalmente NÃO é limpo — costuma repetir no mesmo turno
    retirarFoto();
}

/* ---------- CONFIRMAÇÃO (MODAL) ---------- */

let _dadosAtual = null;
let _textoAtual = '';

function abrirConfirmacao() {

    if (!fotoBlob) {
        mostrarToast('Tire ou escolha uma foto primeiro.', 'erro');
        return;
    }

    const dados = coletarDados();

    if (!dados.doca || !dados.loja || dados.paletes === '' || !dados.cliente) {
        mostrarToast('Preenche Doca, Loja, Paletes e Tipo de Veículo.', 'erro');
        return;
    }

    if (!eNumeroInteiroNaoNegativo(dados.doca) || !eNumeroInteiroNaoNegativo(dados.loja)) {
        mostrarToast('Doca e Loja devem conter somente números.', 'erro');
        return;
    }

    if (!eNumeroInteiroNaoNegativo(dados.paletes)) {
        mostrarToast('A quantidade de paletes deve ser um número inteiro igual ou maior que zero.', 'erro');
        return;
    }

    _dadosAtual = dados;
    _textoAtual = construirMensagem(dados);

    document.getElementById('modalFotoPreview').src = fotoURL;
    document.getElementById('modalTextoPreview').textContent = _textoAtual;
    document.getElementById('modalConfirmar').style.display = 'flex';
}

function fecharConfirmacao() {
    document.getElementById('modalConfirmar').style.display = 'none';
}

/* ---------- ENVIO / COMPARTILHAMENTO ---------- */

async function compartilharWhatsApp() {

    if (!_dadosAtual || !fotoBlob) return;

    const nomeArquivo = `carregamento-doca${_dadosAtual.doca}-loja${_dadosAtual.loja}.jpg`;
    const arquivo = new File([fotoBlob], nomeArquivo, { type: 'image/jpeg' });

    // caminho ideal: share sheet nativo com foto + texto, usuário escolhe o contato/grupo
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        try {
            await navigator.share({ files: [arquivo], text: _textoAtual, title: 'Confirmação de Carregamento' });
            finalizarEnvio();
        } catch (err) {
            if (err.name !== 'AbortError') mostrarToast('Não consegui abrir o compartilhamento.', 'erro');
        }
        return;
    }

    // navegador compartilha, mas sem suporte a arquivo (raro) — manda o texto e avisa
    if (navigator.share) {
        try {
            await navigator.share({ text: _textoAtual, title: 'Confirmação de Carregamento' });
            mostrarToast('Texto enviado — anexa a foto manualmente no WhatsApp.');
            finalizarEnvio();
        } catch (err) {
            if (err.name !== 'AbortError') mostrarToast('Não consegui compartilhar.', 'erro');
        }
        return;
    }

    // sem Web Share (ex: desktop) — baixa a foto e abre o WhatsApp só com o texto
    baixarFoto(nomeArquivo);
    abrirWhatsAppTexto();
    mostrarToast('Foto baixada — anexa ela na conversa do WhatsApp.');
    finalizarEnvio();
}

function compartilharSoTexto() {
    if (!_textoAtual) return;
    abrirWhatsAppTexto();
    finalizarEnvio();
}

function abrirWhatsAppTexto() {
    const url = 'https://wa.me/?text=' + encodeURIComponent(_textoAtual);
    window.open(url, '_blank');
}

function baixarFoto(nomeArquivo) {
    if (!fotoURL) return;
    const a = document.createElement('a');
    a.href = fotoURL;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function finalizarEnvio() {
    salvarNoHistorico(_dadosAtual);
    fecharConfirmacao();
    limparFormulario();
    mostrarToast('Registro enviado ✅');
    _dadosAtual = null;
    _textoAtual = '';
}

/* ---------- LANÇAMENTO MANUAL DO DIA ---------- */

let lojasFaturadas = [];

function abrirModalLoja() {
    document.getElementById('modalLojaInput').value = '';
    document.getElementById('modalLoja').style.display = 'flex';
    setTimeout(() => document.getElementById('modalLojaInput').focus(), 100);
}

function fecharModalLoja() {
    document.getElementById('modalLoja').style.display = 'none';
}

function confirmarLoja() {

    const valor = document.getElementById('modalLojaInput').value.trim();

    if (!eNumeroInteiroNaoNegativo(valor)) {
        mostrarToast('Digite um número de loja válido.', 'erro');
        return;
    }

    if (lojasFaturadas.includes(valor)) {
        mostrarToast('Essa loja já foi adicionada.', 'erro');
        fecharModalLoja();
        return;
    }

    lojasFaturadas.push(valor);
    renderLojasChips();
    fecharModalLoja();
}

function removerLoja(valor) {
    lojasFaturadas = lojasFaturadas.filter(l => l !== valor);
    renderLojasChips();
}

function renderLojasChips() {

    const contador = document.getElementById('manualLojasContador');
    const container = document.getElementById('manualLojasChips');

    contador.textContent = lojasFaturadas.length;

    if (lojasFaturadas.length === 0) {
        container.innerHTML = '<span class="manual-lojas-vazio">Nenhuma loja adicionada ainda.</span>';
        return;
    }

    container.innerHTML = lojasFaturadas.map(l =>
        `<span class="chip-loja">${escapeHTML(l)}<button type="button" data-loja="${escapeHTML(l)}">×</button></span>`
    ).join('');
}

function salvarRegistroManual() {

    const data = document.getElementById('manualData').value;

    if (!data) {
        mostrarToast('Selecione a data.', 'erro');
        return;
    }

    const valores = [
        document.getElementById('manualCaminhoes').value.trim(),
        document.getElementById('manualDocas').value.trim(),
        document.getElementById('manualVeiculosTurnoA').value.trim(),
        document.getElementById('manualForaEscala').value.trim()
    ];

    if (valores.some(valor => valor !== '' && !eNumeroInteiroNaoNegativo(valor))) {
        mostrarToast('Os campos numéricos devem ser inteiros iguais ou maiores que zero.', 'erro');
        return;
    }

    const registro = {
        data,
        caminhoes: Number(document.getElementById('manualCaminhoes').value) || 0,
        docas: Number(document.getElementById('manualDocas').value) || 0,
        veiculosA: Number(document.getElementById('manualVeiculosTurnoA').value) || 0,
        foraEscala: Number(document.getElementById('manualForaEscala').value) || 0,
        lojas: [...lojasFaturadas]
    };

    const registros = obterRegistrosManuais();
    const idx = registros.findIndex(r => r.data === data);

    if (idx >= 0) registros[idx] = registro;
    else registros.push(registro);

    registros.sort((a, b) => (a.data < b.data ? 1 : -1));

    localStorage.setItem('carregamento_registrosManuais', JSON.stringify(registros));

    mostrarToast('Registro do dia salvo ✅');
    renderRegistrosManuais();
    popularSelectRelatorio();
}

function limparFormularioManual() {
    document.getElementById('manualCaminhoes').value = '';
    document.getElementById('manualDocas').value = '';
    document.getElementById('manualVeiculosTurnoA').value = '';
    document.getElementById('manualForaEscala').value = '';
    lojasFaturadas = [];
    renderLojasChips();
}

function obterRegistrosManuais() {
    return JSON.parse(localStorage.getItem('carregamento_registrosManuais') || '[]');
}

function excluirRegistroManual(data) {
    if (!confirm(`Excluir o registro de ${formatarDataBR(data)}?`)) return;
    const registros = obterRegistrosManuais().filter(r => r.data !== data);
    localStorage.setItem('carregamento_registrosManuais', JSON.stringify(registros));
    renderRegistrosManuais();
    popularSelectRelatorio();
}

function formatarDataBR(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function renderRegistrosManuais() {

    const registros = obterRegistrosManuais();
    const vazio = document.getElementById('manualRegistrosVazio');
    const container = document.getElementById('manualRegistrosLista');

    if (registros.length === 0) {
        vazio.style.display = 'block';
        container.innerHTML = '';
        return;
    }

    vazio.style.display = 'none';

    container.innerHTML = registros.map(r => {
        const texto = `${formatarDataBR(r.data)} · 🚛 ${r.caminhoes} caminhões · 🚪 ${r.docas} docas · `
            + `✅ ${r.veiculosA} turno A · 📦 ${r.foraEscala} fora escala · 🏪 ${r.lojas.length} lojas`;
        return `<div class="historico-item">
            <div class="historico-item-texto">${escapeHTML(texto)}</div>
            <button type="button" class="btn-excluir-registro" data-data="${escapeHTML(r.data)}">✕</button>
        </div>`;
    }).join('');
}

/* ---------- RELATÓRIO EXECUTIVO (WHATSAPP) ---------- */

let _tipoRelatorio = 'dia';

function selecionarTipoRelatorio(tipo) {

    _tipoRelatorio = tipo;

    document.querySelectorAll('.tipo-btn').forEach(btn => {
        btn.classList.toggle('ativo', btn.dataset.tipo === tipo);
    });

    document.getElementById('relatorioDiaBox').style.display = tipo === 'dia' ? 'block' : 'none';
    document.getElementById('relatorioPeriodoBox').style.display = tipo === 'periodo' ? 'block' : 'none';
}

function popularSelectRelatorio() {

    const select = document.getElementById('relatorioDiaSelect');
    const registros = obterRegistrosManuais();

    if (registros.length === 0) {
        select.innerHTML = '<option value="">Nenhum registro salvo</option>';
        return;
    }

    select.innerHTML = registros.map(r =>
        `<option value="${escapeHTML(r.data)}">${escapeHTML(formatarDataBR(r.data))}</option>`
    ).join('');
}

function coletarDadosRelatorio() {

    const registros = obterRegistrosManuais();

    if (registros.length === 0) {
        mostrarToast('Nenhum registro diário salvo ainda.', 'erro');
        return null;
    }

    if (_tipoRelatorio === 'dia') {

        const data = document.getElementById('relatorioDiaSelect').value;
        const registro = registros.find(r => r.data === data);

        if (!registro) {
            mostrarToast('Selecione um dia salvo.', 'erro');
            return null;
        }

        return {
            periodo: formatarDataBR(registro.data),
            caminhoes: registro.caminhoes,
            docas: registro.docas,
            veiculosA: registro.veiculosA,
            foraEscala: registro.foraEscala,
            lojas: registro.lojas,
            detalhamento: [registro],
            rotulo: registro.data
        };
    }

    const de = document.getElementById('relatorioDe').value;
    const ate = document.getElementById('relatorioAte').value;

    if (!de || !ate) {
        mostrarToast('Preencha as datas De e Até.', 'erro');
        return null;
    }

    const filtrados = registros
        .filter(r => r.data >= de && r.data <= ate)
        .sort((a, b) => (a.data < b.data ? -1 : 1));

    if (filtrados.length === 0) {
        mostrarToast('Nenhum registro salvo nesse período.', 'erro');
        return null;
    }

    const lojasSet = new Set();
    let caminhoes = 0, docas = 0, veiculosA = 0, foraEscala = 0;

    filtrados.forEach(r => {
        caminhoes += r.caminhoes;
        docas += r.docas;
        veiculosA += r.veiculosA;
        foraEscala += r.foraEscala;
        r.lojas.forEach(l => lojasSet.add(l));
    });

    return {
        periodo: `${formatarDataBR(de)} a ${formatarDataBR(ate)}`,
        caminhoes, docas, veiculosA, foraEscala,
        lojas: [...lojasSet],
        detalhamento: filtrados,
        rotulo: `${de}_a_${ate}`
    };
}

function kpiColunaHTML(label, valor, cor) {
    return `<div>
        <div style="font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8B97A3;margin-bottom:6px;">
            ${escapeHTML(label)}
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:26px;font-weight:700;color:${cor};">
            ${valor}
        </div>
    </div>`;
}

function montarContainerRelatorio(d) {

    const div = document.createElement('div');
    div.id = 'relatorioParaImagem';
    div.style.position = 'fixed';
    div.style.left = '-9999px';
    div.style.top = '0';
    div.style.width = '680px';
    div.style.background = '#FFFFFF';
    div.style.fontFamily = "'Inter',sans-serif";
    div.style.color = '#14181C';
    div.style.borderRadius = '10px';
    div.style.overflow = 'hidden';

    const agora = new Date();
    const geradoEm = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}, `
        + `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

    const maxCaminhoes = Math.max(...d.detalhamento.map(r => r.caminhoes), 1);

    const linhasDetalhe = d.detalhamento.map((r, i) => {

        const pct = Math.round((r.caminhoes / maxCaminhoes) * 100);
        const borda = i > 0 ? 'border-top:1px solid #EDEFF2;' : '';
        const lojasTexto = r.lojas.length > 0 ? ` (${r.lojas.join(', ')})` : '';

        return `
        <div style="padding:18px 0;${borda}">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
                <div style="font-weight:700;font-size:16px;color:#14181C;">📅 ${escapeHTML(formatarDataBR(r.data))}</div>
                <div style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:18px;color:#4C8FD1;white-space:nowrap;">
                    ${r.caminhoes} caminhões
                </div>
            </div>
            <div style="font-size:12.5px;color:#6B7280;margin-bottom:10px;">
                🚪 ${r.docas} docas &nbsp;·&nbsp; 🏪 ${r.lojas.length} lojas faturadas${escapeHTML(lojasTexto)} &nbsp;·&nbsp;
                🔄 ${r.veiculosA} veíc. Turno A &nbsp;·&nbsp; ⚠️ ${r.foraEscala} fora da escala
            </div>
            <div style="height:6px;border-radius:3px;background:#EDEFF2;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:#4C8FD1;border-radius:3px;"></div>
            </div>
        </div>`;
    }).join('');

    const chipsLojas = [...d.lojas].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).map(loja => `
        <span style="display:inline-flex;align-items:center;padding:6px 12px;border-radius:20px;background:#EAF7EF;border:1px solid #B9E6C9;color:#1F4B36;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:13px;">
            ${escapeHTML(loja)}
        </span>`
    ).join('');

    div.innerHTML = `
        <div style="background:#14181C;padding:24px 28px 18px;">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="font-size:26px;">🚛</div>
                <div style="font-family:'Oswald',sans-serif;font-weight:700;font-size:21px;letter-spacing:.02em;text-transform:uppercase;color:#fff;">
                    Relatório Executivo — Expedição
                </div>
            </div>
            <div style="font-size:13px;color:#9AA5B1;margin-top:8px;">
                Período: ${escapeHTML(d.periodo)} · gerado em ${geradoEm}
            </div>
        </div>
        <div style="height:4px;background:#F2A93B;"></div>
        <div style="padding:26px 28px 8px;display:flex;justify-content:space-between;gap:12px;">
            ${kpiColunaHTML('Caminhões', d.caminhoes, '#4C8FD1')}
            ${kpiColunaHTML('Docas', d.docas, '#F2A93B')}
            ${kpiColunaHTML('Lojas Faturadas', d.lojas.length, '#3DCB82')}
            ${kpiColunaHTML('Veículos Turno A', d.veiculosA, '#6B7280')}
            ${kpiColunaHTML('Fora da Escala', d.foraEscala, '#E8564F')}
        </div>
        <div style="padding:20px 28px 8px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B7280;margin-bottom:10px;">
                Lojas Faturadas
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${chipsLojas || '<span style="font-size:13px;color:#9AA5B1;">Nenhuma loja registrada</span>'}
            </div>
        </div>
        <div style="padding:20px 28px 28px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B7280;margin-bottom:6px;">
                Detalhamento por Dia
            </div>
            ${linhasDetalhe}
        </div>
    `;

    document.body.appendChild(div);
    return div;
}

async function gerarRelatorioExecutivo() {

    const dados = coletarDadosRelatorio();
    if (!dados) return;

    if (typeof html2canvas === 'undefined') {
        mostrarToast('Biblioteca de imagem não carregou. Verifica sua conexão.', 'erro');
        return;
    }

    const container = montarContainerRelatorio(dados);

    try {

        const canvas = await html2canvas(container, { backgroundColor: null, scale: 2 });
        container.remove();

        canvas.toBlob(async blob => {

            if (!blob) {
                mostrarToast('Não consegui gerar a imagem.', 'erro');
                return;
            }

            const nomeArquivo = `relatorio-expedicao-${dados.rotulo}.png`;
            const arquivo = new File([blob], nomeArquivo, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
                try {
                    await navigator.share({ files: [arquivo], title: 'Relatório Executivo — Expedição' });
                    return;
                } catch (err) {
                    if (err.name === 'AbortError') return;
                }
            }

            baixarBlob(blob, nomeArquivo);
            mostrarToast('Imagem baixada — anexa ela no WhatsApp.');

        }, 'image/png');

    } catch (err) {
        console.error('Erro ao gerar relatório executivo:', err);
        container.remove();
        mostrarToast('Não consegui gerar a imagem.', 'erro');
    }
}

function baixarBlob(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- FATURAMENTO POR SETOR ---------- */

let _faturamentoArquivo = null;
let _dadosFaturamentoAtual = null;
let _registrosFaturamentoCache = null;
let _setoresDisponiveis = [];
let _setoresSelecionados = new Set();

async function handleArquivoFaturamento(file) {

    if (!file) return;

    _faturamentoArquivo = file;
    _registrosFaturamentoCache = null;

    document.getElementById('faturamentoNomeArquivo').textContent = file.name;
    document.getElementById('faturamentoArquivoBox').style.display = 'flex';
    document.getElementById('faturamentoVazio').style.display = 'none';

    document.getElementById('faturamentoResultadoCard').style.display = 'none';
    _dadosFaturamentoAtual = null;

    document.getElementById('faturamentoSetorToggleTexto').textContent = 'Lendo arquivo...';

    try {

        const texto = await lerArquivoComoTextoISO88591(file);
        const { registros, erro } = parseFaturamentoTXT(texto);

        if (erro === 'vazio') {
            mostrarToast('O arquivo está vazio ou não tem linhas de dado.', 'erro');
            document.getElementById('faturamentoSetorToggleTexto').textContent = 'Selecione o arquivo primeiro';
            return;
        }

        if (erro === 'colunas') {
            mostrarToast('Não encontrei as colunas esperadas (setor / data-hora / valor) no arquivo.', 'erro');
            document.getElementById('faturamentoSetorToggleTexto').textContent = 'Selecione o arquivo primeiro';
            return;
        }

        _registrosFaturamentoCache = registros;

        const setoresUnicos = [...new Set(registros.map(r => r.setor))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        popularFiltroSetores(setoresUnicos);

    } catch (err) {
        console.error('Erro ao ler arquivo de faturamento:', err);
        mostrarToast('Não consegui ler o arquivo.', 'erro');
        document.getElementById('faturamentoSetorToggleTexto').textContent = 'Selecione o arquivo primeiro';
    }
}

function retirarArquivoFaturamento() {

    _faturamentoArquivo = null;
    _registrosFaturamentoCache = null;
    _setoresDisponiveis = [];
    _setoresSelecionados = new Set();

    document.getElementById('inputFaturamento').value = '';
    document.getElementById('faturamentoArquivoBox').style.display = 'none';
    document.getElementById('faturamentoVazio').style.display = 'block';

    document.getElementById('faturamentoResultadoCard').style.display = 'none';
    _dadosFaturamentoAtual = null;

    document.getElementById('faturamentoSetorLista').innerHTML = '';
    document.getElementById('faturamentoSetorTodos').checked = true;
    document.getElementById('faturamentoSetorPainel').style.display = 'none';
    document.getElementById('faturamentoSetorToggleTexto').textContent = 'Selecione o arquivo primeiro';
}

function popularFiltroSetores(setores) {

    _setoresDisponiveis  = setores;
    _setoresSelecionados = new Set(setores);

    const lista = document.getElementById('faturamentoSetorLista');
    lista.innerHTML = setores.map(s => `
        <label class="multi-select-item">
            <input type="checkbox" checked data-setor="${escapeHTML(s)}" onchange="toggleSetorIndividual(this)">
            ${escapeHTML(s)}
        </label>
    `).join('');

    document.getElementById('faturamentoSetorTodos').checked = true;
    atualizarTextoToggleSetores();
}

function toggleTodosSetores(marcado) {

    _setoresSelecionados = marcado ? new Set(_setoresDisponiveis) : new Set();

    document.querySelectorAll('#faturamentoSetorLista input[type="checkbox"]')
        .forEach(cb => { cb.checked = marcado; });

    atualizarTextoToggleSetores();
}

function toggleSetorIndividual(checkbox) {

    const setor = checkbox.dataset.setor;

    if (checkbox.checked) _setoresSelecionados.add(setor);
    else _setoresSelecionados.delete(setor);

    document.getElementById('faturamentoSetorTodos').checked =
        _setoresDisponiveis.length > 0 && _setoresSelecionados.size === _setoresDisponiveis.length;

    atualizarTextoToggleSetores();
}

function atualizarTextoToggleSetores() {

    const el = document.getElementById('faturamentoSetorToggleTexto');
    const total = _setoresDisponiveis.length;
    const marcados = _setoresSelecionados.size;

    if (total === 0) el.textContent = 'Selecione o arquivo primeiro';
    else if (marcados === total) el.textContent = `Todos os setores (${total})`;
    else if (marcados === 0) el.textContent = 'Nenhum setor selecionado';
    else el.textContent = `${marcados} de ${total} setores`;
}

function toggleFaturamentoSetorDropdown() {

    if (_setoresDisponiveis.length === 0) return;

    const painel = document.getElementById('faturamentoSetorPainel');
    painel.style.display = painel.style.display === 'none' ? 'block' : 'none';
}

function lerArquivoComoTextoISO88591(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const bytes = new Uint8Array(reader.result);
                const decoder = new TextDecoder('iso-8859-1');
                const texto = decoder.decode(bytes).replace(/\u0000/g, '');
                resolve(texto);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function parseNumeroBR(str) {
    if (str === null || str === undefined || String(str).trim() === '') return 0;

    let valor = String(str)
        .trim()
        .replace(/^R\$\s*/i, '')
        .replace(/\s/g, '');

    const negativo = /^\(.*\)$/.test(valor);
    if (negativo) valor = valor.slice(1, -1);

    // Formato brasileiro: 1.234,56. Quando não há vírgula, mantém
    // o ponto decimal se ele existir (ex.: 1234.56).
    if (valor.includes(',')) {
        valor = valor.replace(/\./g, '').replace(',', '.');
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(valor)) {
        valor = valor.replace(/\./g, '');
    }

    const numero = Number(valor);
    return Number.isFinite(numero) ? (negativo ? -numero : numero) : 0;
}

function extrairHoraDeDataHora(str) {
    if (!str) return null;
    const partes = str.trim().split(' ');
    return partes.length > 1 ? partes[1].slice(0, 5) : null; // "HH:MM"
}

function extrairDataDeDataHora(str) {
    if (!str) return null;
    const partes = str.trim().split(' ');
    if (partes.length < 1) return null;
    const [dd, mm, yyyy] = partes[0].split('/');
    if (!dd || !mm || !yyyy) return null;
    return `${yyyy}-${mm}-${dd}`; // "yyyy-mm-dd", comparável com <input type="date">
}

function parseFaturamentoTXT(texto) {

    const linhas = texto.split(/\r\n|\n|\r/).filter(l => l.trim() !== '');

    if (linhas.length < 2) return { erro: 'vazio' };

    const cabecalho = linhas[0].split(';').map(h => h.trim().toUpperCase());
    const indice = nome => cabecalho.indexOf(nome);

    const iSetor       = indice('DESCLINHASEPAR');
    const iDataHora    = indice('DTAHORMOVIMENTO');
    const iQtdVolumes  = indice('QTD_VOLUMES');
    const iValor       = indice('VLRLIQVENDA');
    const iSeqProduto  = indice('SEQPRODUTO');

    if (iSetor === -1 || iDataHora === -1 || iValor === -1) {
        return { erro: 'colunas' };
    }

    const registros = [];

    for (let i = 1; i < linhas.length; i++) {

        const campos = linhas[i].split(';');
        if (campos.length <= Math.max(iSetor, iDataHora, iValor)) continue;

        const setor   = campos[iSetor].trim() || 'SEM SETOR';
        const hora    = extrairHoraDeDataHora(campos[iDataHora]);
        const data    = extrairDataDeDataHora(campos[iDataHora]);
        const valor   = parseNumeroBR(campos[iValor]);
        const qtd     = iQtdVolumes > -1 ? parseNumeroBR(campos[iQtdVolumes]) : 0;
        const produto = iSeqProduto > -1 ? campos[iSeqProduto].trim() : `${setor}|${i}`;

        registros.push({ setor, hora, data, valor, qtd, produto });
    }

    return { registros };
}

function horaDentroDoIntervalo(hora, de, ate) {
    if (!hora) return false;
    if (de <= ate) return hora >= de && hora <= ate;
    return hora >= de || hora <= ate; // vira a madrugada (ex: 22:00 até 07:00)
}

function agruparFaturamentoPorSetor(registros) {

    const mapa = new Map();

    registros.forEach(r => {
        if (!mapa.has(r.setor)) {
            mapa.set(r.setor, { nome: r.setor, valor: 0, qtd: 0, produtos: new Set() });
        }
        const s = mapa.get(r.setor);
        s.valor += r.valor;
        s.qtd   += r.qtd;
        s.produtos.add(r.produto);
    });

    return [...mapa.values()]
        .map(s => ({ nome: s.nome, valor: s.valor, qtd: s.qtd, itens: s.produtos.size }))
        .sort((a, b) => b.valor - a.valor);
}

async function processarFaturamento() {

    if (!_registrosFaturamentoCache) {
        mostrarToast('Escolhe o arquivo de faturamento primeiro.', 'erro');
        return;
    }

    if (_setoresSelecionados.size === 0) {
        mostrarToast('Marca pelo menos um setor no filtro.', 'erro');
        return;
    }

    try {

        let registrosFiltrados = _registrosFaturamentoCache;

        if (_setoresSelecionados.size < _setoresDisponiveis.length) {
            registrosFiltrados = registrosFiltrados.filter(r => _setoresSelecionados.has(r.setor));
        }

        const filtrarData     = document.getElementById('faturamentoFiltrarData').checked;
        const filtrarHorario  = document.getElementById('faturamentoFiltrarHorario').checked;

        let dataTexto = null;
        let horarioTexto = null;

        if (filtrarData) {

            const de  = document.getElementById('faturamentoDataDe').value;
            const ate = document.getElementById('faturamentoDataAte').value;

            if (!de || !ate) {
                mostrarToast('Preenche a data De e Até.', 'erro');
                return;
            }

            registrosFiltrados = registrosFiltrados.filter(r => r.data && r.data >= de && r.data <= ate);
            dataTexto = de === ate ? formatarDataBR(de) : `${formatarDataBR(de)} a ${formatarDataBR(ate)}`;

            if (registrosFiltrados.length === 0) {
                mostrarToast('Nenhum lançamento nesse período de data.', 'erro');
                return;
            }
        }

        if (filtrarHorario) {

            const de  = document.getElementById('faturamentoHoraDe').value;
            const ate = document.getElementById('faturamentoHoraAte').value;

            if (!de || !ate) {
                mostrarToast('Preenche o horário De e Até.', 'erro');
                return;
            }

            registrosFiltrados = registrosFiltrados.filter(r => horaDentroDoIntervalo(r.hora, de, ate));
            horarioTexto = `${de} às ${ate}`;

            if (registrosFiltrados.length === 0) {
                mostrarToast('Nenhum lançamento nesse intervalo de horário.', 'erro');
                return;
            }
        }

        if (registrosFiltrados.length === 0) {
            mostrarToast('Nenhum lançamento com esses filtros.', 'erro');
            return;
        }

        const setores           = agruparFaturamentoPorSetor(registrosFiltrados);
        const totalFaturado     = registrosFiltrados.reduce((s, r) => s + r.valor, 0);
        const volumesFaturados  = registrosFiltrados.reduce((s, r) => s + r.qtd, 0);
        const itensFaturados    = new Set(registrosFiltrados.map(r => r.produto)).size;

        const agora = new Date();
        const geradoEm = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}, `
            + `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

        const partesPeriodo = [];
        if (dataTexto) partesPeriodo.push(dataTexto);
        if (horarioTexto) partesPeriodo.push(`das ${horarioTexto}`);

        _dadosFaturamentoAtual = {
            periodo: partesPeriodo.length > 0 ? partesPeriodo.join(' · ') : 'Faturamento completo do arquivo',
            geradoEm,
            totalFaturado,
            volumesFaturados,
            itensFaturados,
            setores,
            rotulo: (partesPeriodo.join('_') || 'completo').replace(/[: ]/g, '-')
        };

        renderFaturamentoInline(_dadosFaturamentoAtual);
        mostrarToast('Relatório de faturamento gerado!');

    } catch (err) {
        console.error('Erro ao processar faturamento:', err);
        mostrarToast('Não consegui processar o arquivo.', 'erro');
    }
}

function formatarMoedaBR(v) {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarNumeroBR(v) {
    return v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function linhaSetorFaturamentoHTML(s, indice, maxValor) {

    const pct   = maxValor > 0 ? Math.max(3, Math.round((s.valor / maxValor) * 100)) : 0;
    const borda = indice > 0 ? 'border-top:1px solid #EDEFF2;' : '';

    return `
    <div style="padding:16px 0;${borda}">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;">
            <div style="font-weight:700;font-size:15px;color:#14181C;">${indice + 1}º · ${escapeHTML(s.nome)}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:16px;color:#3DCB82;white-space:nowrap;">
                R$ ${formatarMoedaBR(s.valor)}
            </div>
        </div>
        <div style="font-size:12px;color:#6B7280;margin:5px 0 10px;">
            ${formatarNumeroBR(s.itens)} itens · ${formatarNumeroBR(s.qtd)} vol.
        </div>
        <div style="height:6px;border-radius:3px;background:#EDEFF2;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:#3DCB82;border-radius:3px;"></div>
        </div>
    </div>`;
}

function montarConteudoFaturamentoHTML(d) {

    const maxValor      = Math.max(...d.setores.map(s => s.valor), 1);
    const top10         = d.setores.slice(0, 10);
    const linhasSetores = top10.map((s, i) => linhaSetorFaturamentoHTML(s, i, maxValor)).join('');

    return `
        <div style="background:#14181C;padding:24px 28px 18px;">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="font-size:26px;">💰</div>
                <div style="font-family:'Oswald',sans-serif;font-weight:700;font-size:19px;letter-spacing:.02em;text-transform:uppercase;color:#fff;">
                    Relatório Executivo — Faturamento
                </div>
            </div>
            <div style="font-size:13px;color:#9AA5B1;margin-top:8px;">
                ${escapeHTML(d.periodo)} · gerado em ${d.geradoEm}
            </div>
        </div>
        <div style="height:4px;background:#3DCB82;"></div>
        <div style="padding:26px 28px 8px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            ${kpiColunaHTML('Total Faturado', 'R$ ' + formatarMoedaBR(d.totalFaturado), '#3DCB82')}
            ${kpiColunaHTML('Volumes Faturados', formatarNumeroBR(d.volumesFaturados), '#4C8FD1')}
            ${kpiColunaHTML('Itens Faturados', formatarNumeroBR(d.itensFaturados), '#F2A93B')}
        </div>
        <div style="padding:20px 28px 28px;background:#FFFFFF;">
            <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B7280;margin-bottom:6px;">
                Top 10 Setores por Valor Faturado
            </div>
            ${linhasSetores}
        </div>
    `;
}

function renderFaturamentoInline(d) {
    const container = document.getElementById('faturamentoPreview');
    container.innerHTML = montarConteudoFaturamentoHTML(d);
    document.getElementById('faturamentoResultadoCard').style.display = 'block';
    document.getElementById('faturamentoResultadoCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function montarContainerFaturamentoParaImagem(d) {

    const div = document.createElement('div');
    div.id = 'faturamentoParaImagem';
    div.style.position = 'fixed';
    div.style.left = '-9999px';
    div.style.top = '0';
    div.style.width = '680px';
    div.style.background = '#FFFFFF';
    div.style.fontFamily = "'Inter',sans-serif";
    div.style.color = '#14181C';
    div.style.borderRadius = '10px';
    div.style.overflow = 'hidden';
    div.innerHTML = montarConteudoFaturamentoHTML(d);

    document.body.appendChild(div);
    return div;
}

async function gerarImagemFaturamento() {

    if (!_dadosFaturamentoAtual) return;

    if (typeof html2canvas === 'undefined') {
        mostrarToast('Biblioteca de imagem não carregou. Verifica sua conexão.', 'erro');
        return;
    }

    const container = montarContainerFaturamentoParaImagem(_dadosFaturamentoAtual);

    try {

        const canvas = await html2canvas(container, { backgroundColor: null, scale: 2 });
        container.remove();

        canvas.toBlob(async blob => {

            if (!blob) {
                mostrarToast('Não consegui gerar a imagem.', 'erro');
                return;
            }

            const nomeArquivo = `faturamento-${_dadosFaturamentoAtual.rotulo}.png`;
            const arquivo = new File([blob], nomeArquivo, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
                try {
                    await navigator.share({ files: [arquivo], title: 'Relatório Executivo — Faturamento' });
                    return;
                } catch (err) {
                    if (err.name === 'AbortError') return;
                }
            }

            baixarBlob(blob, nomeArquivo);
            mostrarToast('Imagem baixada — anexa ela no WhatsApp.');

        }, 'image/png');

    } catch (err) {
        console.error('Erro ao gerar imagem de faturamento:', err);
        container.remove();
        mostrarToast('Não consegui gerar a imagem.', 'erro');
    }
}

/* ---------- HISTÓRICO (LOCAL, POR DIA) ---------- */

function chaveHistoricoHoje() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `carregamento_${yyyy}-${mm}-${dd}`;
}

function salvarNoHistorico(dados) {

    const chave = chaveHistoricoHoje();
    const lista = JSON.parse(localStorage.getItem(chave) || '[]');

    lista.unshift({
        ...dados,
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });

    localStorage.setItem(chave, JSON.stringify(lista));
    localStorage.setItem('carregamento_ultimoCliente', dados.cliente);

    renderHistorico();
}

function renderHistorico() {

    const chave = chaveHistoricoHoje();
    const lista = JSON.parse(localStorage.getItem(chave) || '[]');

    const vazio = document.getElementById('historicoVazio');
    const container = document.getElementById('historicoLista');

    if (lista.length === 0) {
        vazio.style.display = 'block';
        container.innerHTML = '';
        return;
    }

    vazio.style.display = 'none';

    container.innerHTML = lista.map(item => {

        const classe = (item.status === 'Pendente' || item.status === 'Em Conferência') ? 'status-pendente'
            : (item.status === 'Não Faturada') ? 'status-nao-faturada' : '';

        const texto = `Doca ${item.doca} · Loja ${item.loja} · ${item.paletes} plts · ${item.cliente} · ${item.status}`;

        return `<div class="historico-item ${classe}">
            <div class="historico-item-texto">${escapeHTML(texto)}</div>
            <div class="historico-item-hora">${escapeHTML(item.hora)}</div>
        </div>`;

    }).join('');
}

function limparHistorico() {
    if (!confirm('Apagar todos os registros de hoje?')) return;
    localStorage.removeItem(chaveHistoricoHoje());
    renderHistorico();
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/* ---------- TOAST ---------- */

function mostrarToast(msg, tipo = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast mostrar' + (tipo === 'erro' ? ' erro' : '');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove('mostrar'), 3200);
}
