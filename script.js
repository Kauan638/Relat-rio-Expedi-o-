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

    const ultimoCliente = localStorage.getItem('carregamento_ultimoCliente');
    if (ultimoCliente) {
        document.getElementById('campoCliente').value = ultimoCliente;
    }

    renderHistorico();
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

function construirMensagem(d) {
    const linhas = [
        `Doca ${d.doca}`,
        `Loja ${d.loja}`,
        `${d.paletes} plts`,
        d.cliente,
        d.status
    ];
    if (d.obs) linhas.push(d.obs);
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

    if (!dados.doca || !dados.loja || !dados.paletes || !dados.cliente) {
        mostrarToast('Preenche Doca, Loja, Paletes e Cliente.', 'erro');
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
