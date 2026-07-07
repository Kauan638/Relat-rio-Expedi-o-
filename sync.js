// ========================================================
// ========================================================
// SINCRONIZAÇÃO AUTOMÁTICA — File System Access API
//
// Conecta a subpasta "Relatório de Expedição" (dentro da
// pasta mestre) uma única vez. A partir daí, detecta sozinho:
//   - o arquivo Base/Turno B (extensão .xlsx / .xls)
//   - o arquivo Faturamento  (extensão .txt)
// e reprocessa automaticamente sempre que qualquer um dos
// dois for salvo/atualizado no disco. Assim como no botão
// manual, os dois são independentes — se só um existir na
// pasta, sincroniza só ele.
//
// Reaproveita 100% da lógica já existente no projeto:
// processarArquivoBase(arquivo), processarArquivoFaturamento(arquivo)
// (extraídas do script.js original só pra não depender de
// alert()/DOM, sem duplicar nenhuma regra de negócio).
// ========================================================
// ========================================================

const SYNC_DB_NAME = "relatorio-expedicao-sync-db";
const SYNC_STORE_NAME = "handles";
const SYNC_HANDLE_KEY = "pastaExpedicao";
const SYNC_INTERVALO_MS = 5000; // checa a cada 5s

let syncDirHandle = null;
let syncArquivoBaseHandle = null;
let syncArquivoFaturamentoHandle = null;
let syncLastModifiedBase = 0;
let syncLastModifiedFaturamento = 0;
let syncIntervalId = null;

// ---------- IndexedDB: persistir o handle da pasta ----------

function syncAbrirDB(){

    return new Promise((resolve, reject)=>{

        const req = indexedDB.open(SYNC_DB_NAME, 1);

        req.onupgradeneeded = ()=>
        req.result.createObjectStore(SYNC_STORE_NAME);

        req.onsuccess = ()=> resolve(req.result);

        req.onerror = ()=> reject(req.error);

    });

}

async function syncSalvarHandle(handle){

    const db = await syncAbrirDB();

    return new Promise((resolve, reject)=>{

        const tx = db.transaction(SYNC_STORE_NAME, "readwrite");

        tx.objectStore(SYNC_STORE_NAME).put(handle, SYNC_HANDLE_KEY);

        tx.oncomplete = resolve;

        tx.onerror = ()=> reject(tx.error);

    });

}

async function syncCarregarHandle(){

    const db = await syncAbrirDB();

    return new Promise((resolve, reject)=>{

        const tx = db.transaction(SYNC_STORE_NAME, "readonly");

        const req = tx.objectStore(SYNC_STORE_NAME).get(SYNC_HANDLE_KEY);

        req.onsuccess = ()=> resolve(req.result || null);

        req.onerror = ()=> reject(req.error);

    });

}

async function syncLimparHandle(){

    const db = await syncAbrirDB();

    const tx = db.transaction(SYNC_STORE_NAME, "readwrite");

    tx.objectStore(SYNC_STORE_NAME).delete(SYNC_HANDLE_KEY);

}

async function syncGarantirPermissao(handle){

    const opcoes = { mode: "read" };

    if((await handle.queryPermission(opcoes)) === "granted") return true;

    if((await handle.requestPermission(opcoes)) === "granted") return true;

    return false;

}

// ---------- UI ----------

function syncSetStatus(tipo, textoExtra){

    const el = document.getElementById("syncStatus");

    if(!el) return;

    const mapa = {

        off: [
            "sync-off",
            '<span class="sync-dot"></span> Sincronização desligada'
        ],

        scan: [
            "sync-scan",
            '<span class="sync-dot"></span> Procurando arquivos na pasta...'
        ],

        on: [
            "sync-on",
            '<span class="sync-dot"></span> Conectado — monitorando' +
            (textoExtra ? ` (${textoExtra})` : "")
        ]

    };

    el.className = mapa[tipo][0];
    el.innerHTML = mapa[tipo][1];

    const btnConectar = document.getElementById("btnConectarPasta");
    const btnDesconectar = document.getElementById("btnDesconectarPasta");

    if(btnConectar) btnConectar.style.display = tipo === "off" ? "inline-block" : "none";
    if(btnDesconectar) btnDesconectar.style.display = tipo === "off" ? "none" : "inline-block";

}

function syncAtualizarUltimaChecagem(){

    const el = document.getElementById("syncUltimaChecagem");

    if(!el) return;

    el.style.display = "inline";

    el.textContent =
    "Última checagem: " +
    new Date().toLocaleTimeString("pt-BR");

}

// ---------- Varredura da subpasta ----------

const SYNC_EXT_BASE = [".xlsx",".xls"];
const SYNC_EXT_FATURAMENTO = [".txt"];

function syncTemExtensao(nome, lista){

    const n = nome.toLowerCase();

    return lista.some(ext=> n.endsWith(ext));

}

async function syncVarrerPasta(){

    syncSetStatus("scan");

    syncArquivoBaseHandle = null;
    syncArquivoFaturamentoHandle = null;

    for await (const [nome, handle] of syncDirHandle.entries()){

        if(handle.kind !== "file") continue;

        if(
            !syncArquivoBaseHandle &&
            syncTemExtensao(nome, SYNC_EXT_BASE)
        ){

            syncArquivoBaseHandle = handle;

        }else if(
            !syncArquivoFaturamentoHandle &&
            syncTemExtensao(nome, SYNC_EXT_FATURAMENTO)
        ){

            syncArquivoFaturamentoHandle = handle;

        }

    }

    if(!syncArquivoBaseHandle && !syncArquivoFaturamentoHandle){

        alert(
            "Não encontrei nenhum arquivo reconhecível nessa pasta.\n\n" +
            "Base/Turno B precisa ser .xlsx/.xls e Faturamento precisa ser .txt."
        );

        return false;

    }

    return true;

}

// ---------- Processamento automático (reaproveita as funções originais) ----------

async function syncProcessarBase(){

    mostrarLoading();

    try{

        const arquivo =
        await syncArquivoBaseHandle.getFile();

        await processarArquivoBase(arquivo);

        document.getElementById("nomeBase").innerText =
        "🔗 " + arquivo.name + " (auto)";

        console.log("Sync: Base/Turno B atualizada");

    }catch(erro){

        console.error(erro);

    }finally{

        ocultarLoading();

    }

}

async function syncProcessarFaturamento(){

    mostrarLoading();

    try{

        const arquivo =
        await syncArquivoFaturamentoHandle.getFile();

        await processarArquivoFaturamento(arquivo);

        document.getElementById("nomeFaturamento").innerText =
        "🔗 " + arquivo.name + " (auto)";

        console.log("Sync: Faturamento atualizado");

    }catch(erro){

        console.error(erro);

    }finally{

        ocultarLoading();

    }

}

// ---------- Loop de monitoramento ----------

function syncPararMonitoramento(){

    if(syncIntervalId){

        clearInterval(syncIntervalId);

        syncIntervalId = null;

    }

}

function syncIniciarMonitoramento(){

    syncPararMonitoramento();

    const nomesDetectados = [

        syncArquivoBaseHandle?.name,
        syncArquivoFaturamentoHandle?.name

    ].filter(Boolean).join(" + ");

    syncSetStatus("on", nomesDetectados);

    syncIntervalId = setInterval(
        syncChecarMudancas,
        SYNC_INTERVALO_MS
    );

}

async function syncChecarMudancas(){

    try{

        if(syncArquivoBaseHandle){

            const file = await syncArquivoBaseHandle.getFile();

            if(file.lastModified !== syncLastModifiedBase){

                syncLastModifiedBase = file.lastModified;

                await syncProcessarBase();

            }

        }

        if(syncArquivoFaturamentoHandle){

            const file = await syncArquivoFaturamentoHandle.getFile();

            if(file.lastModified !== syncLastModifiedFaturamento){

                syncLastModifiedFaturamento = file.lastModified;

                await syncProcessarFaturamento();

            }

        }

        syncAtualizarUltimaChecagem();

    }catch(erro){

        console.error(
            "Erro ao checar mudanças na pasta:",
            erro
        );

    }

}

// ---------- Ações de UI (botões) ----------

async function conectarPastaExpedicao(){

    try{

        syncDirHandle = await window.showDirectoryPicker();

        await syncSalvarHandle(syncDirHandle);

        const encontrou = await syncVarrerPasta();

        if(!encontrou){

            syncSetStatus("off");

            return;

        }

        // primeira carga imediata de cada arquivo encontrado
        if(syncArquivoBaseHandle){

            await syncProcessarBase();

            const file = await syncArquivoBaseHandle.getFile();
            syncLastModifiedBase = file.lastModified;

        }

        if(syncArquivoFaturamentoHandle){

            await syncProcessarFaturamento();

            const file = await syncArquivoFaturamentoHandle.getFile();
            syncLastModifiedFaturamento = file.lastModified;

        }

        syncIniciarMonitoramento();

    }catch(erro){

        if(erro.name !== "AbortError"){

            console.error(erro);

            alert("Erro ao conectar a pasta: " + erro.message);

        }

    }

}

async function desconectarPastaExpedicao(){

    syncPararMonitoramento();

    syncDirHandle = null;
    syncArquivoBaseHandle = null;
    syncArquivoFaturamentoHandle = null;
    syncLastModifiedBase = 0;
    syncLastModifiedFaturamento = 0;

    await syncLimparHandle();

    syncSetStatus("off");

    const elChecagem = document.getElementById("syncUltimaChecagem");

    if(elChecagem) elChecagem.style.display = "none";

}

// ---------- Reconexão automática ao abrir a página ----------

(async function syncTentarReconectar(){

    const handleSalvo = await syncCarregarHandle();

    if(!handleSalvo) return;

    const temPermissao = await syncGarantirPermissao(handleSalvo);

    if(!temPermissao){

        // não força popup de permissão sem interação do usuário;
        // ele clica em "Conectar Pasta" de novo se precisar
        return;

    }

    syncDirHandle = handleSalvo;

    const encontrou = await syncVarrerPasta();

    if(!encontrou) return;

    if(syncArquivoBaseHandle){

        await syncProcessarBase();

        const file = await syncArquivoBaseHandle.getFile();
        syncLastModifiedBase = file.lastModified;

    }

    if(syncArquivoFaturamentoHandle){

        await syncProcessarFaturamento();

        const file = await syncArquivoFaturamentoHandle.getFile();
        syncLastModifiedFaturamento = file.lastModified;

    }

    syncIniciarMonitoramento();

})();
