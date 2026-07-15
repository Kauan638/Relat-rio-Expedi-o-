// =====================================
// VARIÁVEIS GLOBAIS
// =====================================

let dadosBase = [];
let dadosFaturamento = [];
let grafico = null;
let lojasFaturadasHoje = [];

// =====================================
// NOME DO ARQUIVO SELECIONADO
// =====================================

document
.getElementById("arquivoBase")
.addEventListener("change", function(){

    const arquivo = this.files[0];

    document
    .getElementById("nomeBase")
    .innerText =
    arquivo
    ? arquivo.name
    : "Nenhum arquivo selecionado";

});

document
.getElementById("arquivoFaturamento")
.addEventListener("change", function(){

    const arquivo = this.files[0];

    document
    .getElementById("nomeFaturamento")
    .innerText =
    arquivo
    ? arquivo.name
    : "Nenhum arquivo selecionado";

});

// =====================================
// LOADING
// =====================================

function mostrarLoading(){

    document
    .getElementById("loading")
    .style.display = "flex";

}

function ocultarLoading(){

    document
    .getElementById("loading")
    .style.display = "none";

}

// =====================================
// PROCESSAMENTO PRINCIPAL
// =====================================

async function processar(){

    const arquivo =
    document
    .getElementById("arquivoBase")
    .files[0];

    const arquivoFat =
    document
    .getElementById("arquivoFaturamento")
    .files[0];

    if(!arquivo && !arquivoFat){

        alert(
            "Selecione ao menos um arquivo (Base ou Faturamento)."
        );

        return;

    }

    mostrarLoading();

    try{

        if(arquivo){

            await processarArquivoBase(arquivo);

        }

        if(arquivoFat){

            await processarArquivoFaturamento(arquivoFat);

        }

    }

    catch(erro){

        console.error(erro);

        alert(
            "Erro ao processar os arquivos. Confira os formatos esperados."
        );

    }

    finally{

        ocultarLoading();

    }

}

// =====================================
// PROCESSAMENTO PURO (sem DOM/alert) —
// recebe o File já resolvido. Usado pelo
// botão manual (via processar acima) e
// pela sincronização automática (sync.js).
// =====================================

async function processarArquivoBase(arquivo){

    dadosBase =
    await lerExcel(
        arquivo,
        "Base"
    );

    dadosBase =
    dadosBase.map(linha=>{

        const dataRaw =
        linha["DATA"] ||
        linha["Data"];

        let data = null;

        if(
            dataRaw instanceof Date
        ){

            data = dataRaw;

        }
        else if(
            typeof dataRaw === "number"
        ){

            data =
            XLSX.SSF.parse_date_code(
                dataRaw
            );

            data =
            data
            ? new Date(
                data.y,
                data.m - 1,
                data.d
            )
            : null;

        }
        else if(dataRaw){

            const partes =
            String(dataRaw)
            .split(/[\/\-]/);

            if(partes.length === 3){

                data =
                new Date(
                    partes[2].length === 4
                    ? `${partes[2]}-${partes[1]}-${partes[0]}`
                    : dataRaw
                );

            }

        }

        return{

            data,

            caminhoes:
            Number(
                linha["Caminhões carregados"]
            ) || 0,

            docas:
            Number(
                linha["Docas produzidas"]
            ) || 0,

            lojas:
            Number(
                linha["Lojas Faturadas"]
            ) || 0,

            veiculosTurnoA:
            Number(
                linha["Veículos completados do Turno A"]
            ) || 0,

            foraEscala:
            Number(
                linha["Cargas produzidas fora da escala"]
            ) || 0

        };

    })
    .filter(
        item => item.data
    )
    .sort(
        (a,b) => a.data - b.data
    );

    atualizarKPIs();

    renderizarGrafico();

    renderizarTabela();

    console.log(
        "Base processada:",
        dadosBase
    );

}

async function processarArquivoFaturamento(arquivoFat){

    dadosFaturamento =
    await lerFaturamentoTXT(
        arquivoFat
    );

    atualizarFaturamento();

    console.log(
        "Faturamento processado:",
        dadosFaturamento.length,
        "linhas"
    );

}

// =====================================
// LEITURA EXCEL (por nome de aba)
// =====================================

function lerExcel(arquivo, nomeAba){

    return new Promise((resolve,reject)=>{

        const leitor =
        new FileReader();

        leitor.onload = e=>{

            try{

                const dados =
                new Uint8Array(
                    e.target.result
                );

                const workbook =
                XLSX.read(
                    dados,
                    {
                        type:"array",
                        cellDates:true
                    }
                );

                const aba =
                workbook.SheetNames.includes(nomeAba)
                ? nomeAba
                : workbook.SheetNames[0];

                const json =
                XLSX.utils.sheet_to_json(
                    workbook.Sheets[aba],
                    {
                        defval:""
                    }
                );

                resolve(json);

            }catch(erro){

                reject(erro);

            }

        };

        leitor.onerror = reject;

        leitor.readAsArrayBuffer(
            arquivo
        );

    });

}

// =====================================
// LEITURA FATURAMENTO (TXT)
// =====================================
// Arquivo vem de exportação do sistema (TOTVS/Consinco),
// separado por ";". Pode vir com ou sem bloco de bytes
// nulos no início (lixo de exportação) — removemos antes
// de interpretar. Lê pelo nome real das colunas quando
// o arquivo tem cabeçalho (confirmado no arquivo de
// referência); se não tiver, cai para as posições fixas
// já validadas como equivalentes:
//
//   Setor          -> DESCLINHASEPAR   (posição 1)
//   SKU            -> SEQPRODUTO       (posição 9)
//   Data/Hora      -> DTAHORMOVIMENTO  (posição 13)
//   Quantidade     -> QTD_VOLUMES      (posição 14)
//   Valor Faturado -> VLRLIQVENDA      (posição 16)
//   Tarefa/Operador-> DESTINO          (posição 17)

const COLUNAS_FATURAMENTO = {

    setor:      { nome:"DESCLINHASEPAR",  posicao:1  },
    sku:        { nome:"SEQPRODUTO",      posicao:9  },
    dataHora:   { nome:"DTAHORMOVIMENTO", posicao:13 },
    quantidade: { nome:"QTD_VOLUMES",     posicao:14 },
    valor:      { nome:"VLRLIQVENDA",     posicao:16 },
    tarefa:     { nome:"DESTINO",         posicao:17 },
    operador:   { nome:"SEQPESSOA",       posicao:8  }

};

function lerFaturamentoTXT(arquivo){

    return new Promise((resolve,reject)=>{

        const leitor =
        new FileReader();

        leitor.onload = e=>{

            try{

                const textoBruto =
                e.target.result;

                // remove eventual bloco de bytes nulos/controle
                // do início do arquivo
                const textoLimpo =
                textoBruto.replace(
                    /^[\x00-\x1F]+/,
                    ""
                );

                const linhas =
                textoLimpo
                .split(/\r?\n/)
                .filter(l=>l.trim());

                if(!linhas.length){

                    resolve([]);
                    return;

                }

                // detecta se a primeira linha é um
                // cabeçalho de verdade (contém as colunas
                // esperadas) ou já é dado
                const primeiraLinha =
                linhas[0].split(";")
                .map(c=>c.trim().toUpperCase());

                const temCabecalho =
                primeiraLinha.includes(
                    COLUNAS_FATURAMENTO.setor.nome
                );

                // monta o índice de cada coluna: pelo nome,
                // se houver cabeçalho; senão, pela posição
                // fixa já validada
                const indice = {};

                Object.keys(COLUNAS_FATURAMENTO).forEach(chave=>{

                    const config =
                    COLUNAS_FATURAMENTO[chave];

                    indice[chave] =
                    temCabecalho
                    ? primeiraLinha.indexOf(config.nome)
                    : config.posicao;

                });

                const linhasDados =
                temCabecalho
                ? linhas.slice(1)
                : linhas;

                const dados = [];

                linhasDados.forEach(linha=>{

                    const campos =
                    linha.split(";");

                    if(campos.length < 14) return;

                    const setor =
                    (campos[indice.setor] || "").trim() ||
                    "SEM SETOR";

                    const sku =
                    (campos[indice.sku] || "").trim();

                    const dataHoraTexto =
                    (campos[indice.dataHora] || "").trim();

                    let dataHora = null;

                    const partesData =
                    dataHoraTexto.match(
                        /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/
                    );

                    if(partesData){

                        dataHora = new Date(
                            Number(partesData[3]),
                            Number(partesData[2]) - 1,
                            Number(partesData[1]),
                            Number(partesData[4]),
                            Number(partesData[5])
                        );

                    }

                    const quantidade =
                    parseFloat(
                        (campos[indice.quantidade] || "0")
                        .replace(".","")
                        .replace(",",".")
                    ) || 0;

                    const valor =
                    parseFloat(
                        (campos[indice.valor] || "0")
                        .replace(".","")
                        .replace(",",".")
                    ) || 0;

                    const tarefaTexto =
                    (campos[indice.tarefa] || "").trim();

                    const matOperador =
                    tarefaTexto.match(
                        /STOK\s*(\d+)/i
                    );

                    const operador =
                    matOperador
                    ? matOperador[1]
                    : (campos[indice.operador] || "").trim();

                    dados.push({

                        setor,
                        sku,
                        dataHora,
                        quantidade,
                        valor,
                        operador

                    });

                });

                resolve(dados);

            }catch(erro){

                reject(erro);

            }

        };

        leitor.onerror = reject;

        leitor.readAsText(
            arquivo,
            "iso-8859-1"
        );

    });

}

// =====================================
// KPIs
// =====================================

function atualizarKPIs(){

    const dias =
    dadosBase.length || 1;

    const somar =
    campo =>
    dadosBase.reduce(
        (s,x)=>s+x[campo],
        0
    );

    const totalCaminhoes = somar("caminhoes");
    const totalDocas = somar("docas");
    const totalLojas = somar("lojas");
    const totalVeiculosA = somar("veiculosTurnoA");
    const totalForaEscala = somar("foraEscala");

    document.getElementById("kpiCaminhoes").innerText =
    totalCaminhoes.toLocaleString("pt-BR");

    document.getElementById("kpiCaminhoesMedia").innerText =
    `Média/dia: ${(totalCaminhoes/dias).toFixed(1)}`;

    document.getElementById("kpiDocas").innerText =
    totalDocas.toLocaleString("pt-BR");

    document.getElementById("kpiDocasMedia").innerText =
    `Média/dia: ${(totalDocas/dias).toFixed(1)}`;

    document.getElementById("kpiLojas").innerText =
    totalLojas.toLocaleString("pt-BR");

    document.getElementById("kpiLojasMedia").innerText =
    `Média/dia: ${(totalLojas/dias).toFixed(1)}`;

    document.getElementById("kpiVeiculosA").innerText =
    totalVeiculosA.toLocaleString("pt-BR");

    document.getElementById("kpiForaEscala").innerText =
    totalForaEscala.toLocaleString("pt-BR");

}

// =====================================
// GRÁFICO (Chart.js)
// =====================================

function renderizarGrafico(){

    const ctx =
    document
    .getElementById("graficoDiario")
    .getContext("2d");

    const labels =
    dadosBase.map(
        item =>
        item.data.toLocaleDateString(
            "pt-BR",
            { day:"2-digit", month:"2-digit" }
        )
    );

    const corGrid = "#2A323B";
    const corTexto = "#8B97A3";

    if(grafico){

        grafico.destroy();

    }

    grafico = new Chart(ctx,{

        type:"bar",

        data:{

            labels,

            datasets:[

                {
                    label:"Caminhões Carregados",
                    data:dadosBase.map(x=>x.caminhoes),
                    backgroundColor:"#4C8FD1",
                    borderRadius:4
                },

                {
                    label:"Docas Produzidas",
                    data:dadosBase.map(x=>x.docas),
                    backgroundColor:"#F2A93B",
                    borderRadius:4
                },

                {
                    label:"Lojas Faturadas",
                    data:dadosBase.map(x=>x.lojas),
                    backgroundColor:"#3DCB82",
                    borderRadius:4
                },

                {
                    label:"Cargas Fora da Escala",
                    data:dadosBase.map(x=>x.foraEscala),
                    backgroundColor:"#E8564F",
                    borderRadius:4
                }

            ]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{

                legend:{

                    labels:{
                        color:corTexto,
                        font:{ family:"Inter", size:11 }
                    }

                }

            },

            scales:{

                x:{
                    ticks:{ color:corTexto },
                    grid:{ color:corGrid }
                },

                y:{
                    beginAtZero:true,
                    ticks:{ color:corTexto },
                    grid:{ color:corGrid }
                }

            }

        }

    });

}

// =====================================
// TABELA
// =====================================

function renderizarTabela(){

    const tbody =
    document.getElementById("tbodyBase");

    let html = "";

    dadosBase.forEach(item=>{

        html += `
        <tr>

            <td>${item.data.toLocaleDateString("pt-BR")}</td>
            <td>${item.caminhoes}</td>
            <td>${item.docas}</td>
            <td>${item.lojas}</td>
            <td>${item.veiculosTurnoA}</td>
            <td>${item.foraEscala}</td>

        </tr>
        `;

    });

    tbody.innerHTML = html;

    const somar =
    campo =>
    dadosBase.reduce(
        (s,x)=>s+x[campo],
        0
    );

    document.getElementById(
        "tfootBase"
    ).innerHTML = `
    <tr>
        <td>TOTAL</td>
        <td>${somar("caminhoes").toLocaleString("pt-BR")}</td>
        <td>${somar("docas").toLocaleString("pt-BR")}</td>
        <td>${somar("lojas").toLocaleString("pt-BR")}</td>
        <td>${somar("veiculosTurnoA").toLocaleString("pt-BR")}</td>
        <td>${somar("foraEscala").toLocaleString("pt-BR")}</td>
    </tr>
    `;

}

// =====================================
// FATURAMENTO — AGREGAÇÃO E RENDER
// =====================================

function obterResumoFaturamento(){

    const porSetor = {};

    let totalValor = 0;
    let totalQuantidade = 0;

    dadosFaturamento.forEach(item=>{

        if(!porSetor[item.setor]){

            porSetor[item.setor] = {

                setor: item.setor,
                linhas: 0,
                quantidade: 0,
                valor: 0

            };

        }

        porSetor[item.setor].linhas++;
        porSetor[item.setor].quantidade += item.quantidade;
        porSetor[item.setor].valor += item.valor;

        totalValor += item.valor;
        totalQuantidade += item.quantidade;

    });

    const setores =
    Object.values(porSetor)
    .sort((a,b)=>b.valor-a.valor);

    const datas =
    dadosFaturamento
    .map(x=>x.dataHora)
    .filter(Boolean);

    return{

        totalValor,
        totalQuantidade,
        totalLinhas: dadosFaturamento.length,
        setores,

        periodoInicio:
        datas.length
        ? new Date(Math.min(...datas))
        : null,

        periodoFim:
        datas.length
        ? new Date(Math.max(...datas))
        : null

    };

}

function atualizarFaturamento(){

    if(!dadosFaturamento.length){

        document.getElementById(
            "placeholderFaturamento"
        ).style.display = "block";

        document.getElementById(
            "painelFaturamento"
        ).style.display = "none";

        return;

    }

    document.getElementById(
        "placeholderFaturamento"
    ).style.display = "none";

    document.getElementById(
        "painelFaturamento"
    ).style.display = "block";

    const resumo =
    obterResumoFaturamento();

    const formatarMoeda =
    valor =>
    valor.toLocaleString(
        "pt-BR",
        { style:"currency", currency:"BRL" }
    );

    document.getElementById("kpiValorFaturado").innerText =
    formatarMoeda(resumo.totalValor);

    document.getElementById("kpiQuantidadeFaturada").innerText =
    resumo.totalQuantidade.toLocaleString("pt-BR");

    document.getElementById("kpiLinhasFaturadas").innerText =
    resumo.totalLinhas.toLocaleString("pt-BR");

    document.getElementById("kpiTicketMedio").innerText =
    formatarMoeda(
        resumo.totalLinhas
        ? resumo.totalValor / resumo.totalLinhas
        : 0
    );

    const tbody =
    document.getElementById(
        "tbodyFaturamentoSetor"
    );

    let html = "";

    resumo.setores.forEach(item=>{

        html += `
        <tr>
            <td>${item.setor}</td>
            <td>${item.linhas.toLocaleString("pt-BR")}</td>
            <td>${item.quantidade.toLocaleString("pt-BR")}</td>
            <td>${formatarMoeda(item.valor)}</td>
        </tr>
        `;

    });

    tbody.innerHTML = html;

}

// =====================================
// BAIXAR IMAGEM EXECUTIVA — FATURAMENTO
// (mesmo estilo usado no relatório da
// Pendência PTL: cabeçalho escuro + ranking
// com barra de proporção por setor)
// =====================================

async function baixarImagemFaturamento(){

    if(!dadosFaturamento.length){

        alert(
            "Nenhum dado de Faturamento processado ainda."
        );

        return;

    }

    if(typeof html2canvas !== "function"){

        alert(
            "Biblioteca html2canvas não carregou. Verifique sua conexão e recarregue a página."
        );

        return;

    }

    mostrarLoading();

    try{

    const resumo =
    obterResumoFaturamento();

    const formatarMoeda =
    valor =>
    valor.toLocaleString(
        "pt-BR",
        { style:"currency", currency:"BRL" }
    );

    const top =
    resumo.setores.slice(0,8);

    const maiorValor =
    top.length ? top[0].valor : 1;

    const periodoTexto =
    resumo.periodoInicio && resumo.periodoFim
    ? `${resumo.periodoInicio.toLocaleDateString("pt-BR")} a ${resumo.periodoFim.toLocaleDateString("pt-BR")}`
    : "período não identificado";

    const agora =
    new Date().toLocaleString(
        "pt-BR",
        {
            day:"2-digit",
            month:"2-digit",
            year:"numeric",
            hour:"2-digit",
            minute:"2-digit"
        }
    );

    const card =
    document.createElement("div");

    card.style.width = "1000px";
    card.style.background = "#ffffff";
    card.style.fontFamily = "'Inter','Segoe UI',sans-serif";
    card.style.color = "#1A1D21";
    card.style.overflow = "hidden";
    card.style.borderRadius = "10px";
    card.style.border = "1px solid #E2E5E9";

    let linhasSetores = "";

    top.forEach((item,indice)=>{

        const largura =
        Math.max(
            8,
            Math.round((item.valor / maiorValor) * 100)
        );

        linhasSetores += `
        <div style="
            padding:14px 28px;
            border-bottom:1px solid #EEF0F2;
        ">

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:baseline;
                gap:12px;
            ">
                <div style="
                    font-size:14px;
                    font-weight:700;
                    color:#1A1D21;
                ">
                    ${indice+1}º · ${item.setor}
                </div>

                <div style="
                    font-family:'JetBrains Mono',Consolas,monospace;
                    font-size:16px;
                    font-weight:700;
                    color:#3DCB82;
                    white-space:nowrap;
                ">
                    ${formatarMoeda(item.valor)}
                </div>
            </div>

            <div style="
                font-size:11px;
                color:#8B97A3;
                margin-top:2px;
            ">
                ${item.linhas.toLocaleString("pt-BR")} linhas ·
                ${item.quantidade.toLocaleString("pt-BR")} unid.
            </div>

            <div style="
                margin-top:8px;
                height:6px;
                background:#EEF0F2;
                border-radius:3px;
                overflow:hidden;
            ">
                <div style="
                    height:100%;
                    width:${largura}%;
                    background:#3DCB82;
                    border-radius:3px;
                "></div>
            </div>

        </div>
        `;

    });

    card.innerHTML = `

        <div style="
            background:#1D2329;
            padding:22px 28px;
            border-bottom:3px solid #3DCB82;
        ">
            <div style="
                font-family:'Oswald','Segoe UI',sans-serif;
                font-size:22px;
                font-weight:700;
                letter-spacing:.03em;
                text-transform:uppercase;
                color:#ffffff;
            ">💰 Relatório Executivo — Faturamento</div>

            <div style="
                font-size:12px;
                color:#9AA5B1;
                margin-top:4px;
            ">Período: ${periodoTexto} · gerado em ${agora}</div>
        </div>

        <div style="
            display:grid;
            grid-template-columns:repeat(3,1fr);
            gap:1px;
            background:#EEF0F2;
        ">

            <div style="background:#fff;padding:18px 24px;">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#8B97A3;">Total Faturado</div>
                <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:22px;font-weight:700;color:#3DCB82;margin-top:6px;">
                    ${formatarMoeda(resumo.totalValor)}
                </div>
            </div>

            <div style="background:#fff;padding:18px 24px;">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#8B97A3;">Quantidade Total</div>
                <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:22px;font-weight:700;color:#4C8FD1;margin-top:6px;">
                    ${resumo.totalQuantidade.toLocaleString("pt-BR")}
                </div>
            </div>

            <div style="background:#fff;padding:18px 24px;">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#8B97A3;">Linhas Faturadas</div>
                <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:22px;font-weight:700;color:#F2A93B;margin-top:6px;">
                    ${resumo.totalLinhas.toLocaleString("pt-BR")}
                </div>
            </div>

        </div>

        <div style="
            padding:16px 28px 8px;
            font-size:11px;
            font-weight:700;
            letter-spacing:.06em;
            text-transform:uppercase;
            color:#8B97A3;
        ">Top Setores por Valor Faturado</div>

        ${linhasSetores}
    `;

    document.body.appendChild(card);

    const canvas =
    await html2canvas(card, { scale:2 });

    const link =
    document.createElement("a");

    link.download = "relatorio-executivo-faturamento.png";

    link.href =
    canvas.toDataURL("image/png");

    link.click();

    card.remove();

    }

    catch(erro){

        console.error(erro);

        alert(
            "Erro ao gerar a imagem executiva do Faturamento."
        );

    }

    finally{

        ocultarLoading();

    }

}

// =====================================
// EXPORTAR EXCEL
// =====================================

function exportarExcel(){

    if(!dadosBase.length){

        alert(
            "Nenhum dado para exportar. Processe o arquivo primeiro."
        );

        return;

    }

    const linhas =
    dadosBase.map(item=>({

        "Data": item.data.toLocaleDateString("pt-BR"),
        "Caminhões Carregados": item.caminhoes,
        "Docas Produzidas": item.docas,
        "Lojas Faturadas": item.lojas,
        "Veículos Turno A": item.veiculosTurnoA,
        "Cargas Fora da Escala": item.foraEscala

    }));

    const planilha =
    XLSX.utils.json_to_sheet(linhas);

    const workbook =
    XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        planilha,
        "Expedição"
    );

    const dataHoje =
    new Date()
    .toISOString()
    .slice(0,10);

    XLSX.writeFile(
        workbook,
        `relatorio_expedicao_${dataHoje}.xlsx`
    );

}

// =====================================
// RELATÓRIO EXECUTIVO (IMPRESSÃO)
// =====================================

// =====================================
// BAIXAR IMAGEM EXECUTIVA — BASE (TURNO B)
// (mesmo estilo do relatório de Faturamento)
// =====================================

async function baixarImagemExecutiva(){

    if(!dadosBase.length){

        alert(
            "Nenhum dado para gerar a imagem. Processe o arquivo primeiro."
        );

        return;

    }

    if(typeof html2canvas !== "function"){

        alert(
            "Biblioteca html2canvas não carregou. Verifique sua conexão e recarregue a página."
        );

        return;

    }

    mostrarLoading();

    try{

        const somar =
        campo =>
        dadosBase.reduce(
            (s,x)=>s+x[campo],
            0
        );

        const dias = dadosBase.length;

        const totalCaminhoes = somar("caminhoes");
        const totalDocas = somar("docas");
        const totalLojas = somar("lojas");
        const totalVeiculosA = somar("veiculosTurnoA");
        const totalForaEscala = somar("foraEscala");

        const periodoTexto =
        `${dadosBase[0].data.toLocaleDateString("pt-BR")} a ${dadosBase[dias-1].data.toLocaleDateString("pt-BR")}`;

        const agora =
        new Date().toLocaleString(
            "pt-BR",
            {
                day:"2-digit",
                month:"2-digit",
                year:"numeric",
                hour:"2-digit",
                minute:"2-digit"
            }
        );

        const maiorCaminhoes =
        Math.max(...dadosBase.map(x=>x.caminhoes), 1);

        let linhasDias = "";

        dadosBase.forEach(item=>{

            const largura =
            Math.max(
                8,
                Math.round((item.caminhoes / maiorCaminhoes) * 100)
            );

            linhasDias += `
            <div style="
                padding:14px 28px;
                border-bottom:1px solid #EEF0F2;
            ">

                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:baseline;
                    gap:12px;
                ">
                    <div style="
                        font-size:14px;
                        font-weight:700;
                        color:#1A1D21;
                    ">
                        📅 ${item.data.toLocaleDateString("pt-BR")}
                    </div>

                    <div style="
                        font-family:'JetBrains Mono',Consolas,monospace;
                        font-size:16px;
                        font-weight:700;
                        color:#4C8FD1;
                        white-space:nowrap;
                    ">
                        ${item.caminhoes} caminhões
                    </div>
                </div>

                <div style="
                    font-size:11px;
                    color:#8B97A3;
                    margin-top:2px;
                ">
                    🚪 ${item.docas} docas ·
                    🏪 ${item.lojas} lojas faturadas ·
                    🔁 ${item.veiculosTurnoA} veíc. Turno A ·
                    ⚠️ ${item.foraEscala} fora da escala
                </div>

                <div style="
                    margin-top:8px;
                    height:6px;
                    background:#EEF0F2;
                    border-radius:3px;
                    overflow:hidden;
                ">
                    <div style="
                        height:100%;
                        width:${largura}%;
                        background:#4C8FD1;
                        border-radius:3px;
                    "></div>
                </div>

            </div>
            `;

        });

        const card =
        document.createElement("div");

        card.style.width = "1000px";
        card.style.background = "#ffffff";
        card.style.fontFamily = "'Inter','Segoe UI',sans-serif";
        card.style.color = "#1A1D21";
        card.style.overflow = "hidden";
        card.style.borderRadius = "10px";
        card.style.border = "1px solid #E2E5E9";

        card.innerHTML = `

            <div style="
                background:#1D2329;
                padding:22px 28px;
                border-bottom:3px solid #F2A93B;
            ">
                <div style="
                    font-family:'Oswald','Segoe UI',sans-serif;
                    font-size:22px;
                    font-weight:700;
                    letter-spacing:.03em;
                    text-transform:uppercase;
                    color:#ffffff;
                ">🚛 Relatório Executivo — Expedição</div>

                <div style="
                    font-size:12px;
                    color:#9AA5B1;
                    margin-top:4px;
                ">Período: ${periodoTexto} · gerado em ${agora}</div>
            </div>

            <div style="
                display:grid;
                grid-template-columns:repeat(5,1fr);
                gap:1px;
                background:#EEF0F2;
            ">

                <div style="background:#fff;padding:16px 14px;">
                    <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#8B97A3;">Caminhões</div>
                    <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:19px;font-weight:700;color:#4C8FD1;margin-top:6px;">
                        ${totalCaminhoes.toLocaleString("pt-BR")}
                    </div>
                </div>

                <div style="background:#fff;padding:16px 14px;">
                    <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#8B97A3;">Docas</div>
                    <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:19px;font-weight:700;color:#F2A93B;margin-top:6px;">
                        ${totalDocas.toLocaleString("pt-BR")}
                    </div>
                </div>

                <div style="background:#fff;padding:16px 14px;">
                    <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#8B97A3;">Lojas Faturadas</div>
                    <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:19px;font-weight:700;color:#3DCB82;margin-top:6px;">
                        ${totalLojas.toLocaleString("pt-BR")}
                    </div>
                </div>

                <div style="background:#fff;padding:16px 14px;">
                    <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#8B97A3;">Veículos Turno A</div>
                    <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:19px;font-weight:700;color:#8B97A3;margin-top:6px;">
                        ${totalVeiculosA.toLocaleString("pt-BR")}
                    </div>
                </div>

                <div style="background:#fff;padding:16px 14px;">
                    <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#8B97A3;">Fora da Escala</div>
                    <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:19px;font-weight:700;color:#E8564F;margin-top:6px;">
                        ${totalForaEscala.toLocaleString("pt-BR")}
                    </div>
                </div>

            </div>

            <div style="
                padding:16px 28px 8px;
                font-size:11px;
                font-weight:700;
                letter-spacing:.06em;
                text-transform:uppercase;
                color:#8B97A3;
            ">Detalhamento por Dia</div>

            ${linhasDias}
        `;

        document.body.appendChild(card);

        const canvas =
        await html2canvas(card, { scale:2 });

        const link =
        document.createElement("a");

        link.download = "relatorio-executivo-expedicao.png";

        link.href =
        canvas.toDataURL("image/png");

        link.click();

        card.remove();

    }

    catch(erro){

        console.error(erro);

        alert(
            "Erro ao gerar a imagem executiva."
        );

    }

    finally{

        ocultarLoading();

    }

}

function imprimirRelatorioExecutivo(){

    if(!dadosBase.length){

        alert(
            "Nenhum dado para gerar o relatório. Processe o arquivo primeiro."
        );

        return;

    }

    const somar =
    campo =>
    dadosBase.reduce(
        (s,x)=>s+x[campo],
        0
    );

    const dias = dadosBase.length;

    const totalCaminhoes = somar("caminhoes");
    const totalDocas = somar("docas");
    const totalLojas = somar("lojas");
    const totalVeiculosA = somar("veiculosTurnoA");
    const totalForaEscala = somar("foraEscala");

    const periodoInicio =
    dadosBase[0].data.toLocaleDateString("pt-BR");

    const periodoFim =
    dadosBase[dias-1].data.toLocaleDateString("pt-BR");

    const agora =
    new Date().toLocaleString(
        "pt-BR",
        {
            day:"2-digit",
            month:"2-digit",
            year:"numeric",
            hour:"2-digit",
            minute:"2-digit"
        }
    );

    let linhasTabela = "";

    dadosBase.forEach(item=>{

        linhasTabela += `
        <tr>
            <td>${item.data.toLocaleDateString("pt-BR")}</td>
            <td>${item.caminhoes}</td>
            <td>${item.docas}</td>
            <td>${item.lojas}</td>
            <td>${item.veiculosTurnoA}</td>
            <td>${item.foraEscala}</td>
        </tr>
        `;

    });

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">

<head>

<meta charset="UTF-8">

<title>Relatório Executivo — Expedição</title>

<style>

@page{
    size:A4 portrait;
    margin:14mm;
}

*{
    box-sizing:border-box;
}

body{
    font-family:'Segoe UI',Arial,sans-serif;
    color:#1A1D21;
    margin:0;
}

.cabecalho{
    display:flex;
    justify-content:space-between;
    align-items:flex-end;
    border-bottom:3px solid #F2A93B;
    padding-bottom:10px;
    margin-bottom:20px;
}

.cabecalho h1{
    margin:0;
    font-size:20px;
    letter-spacing:.03em;
    text-transform:uppercase;
    color:#1D2329;
}

.cabecalho .meta{
    text-align:right;
    font-size:11px;
    color:#5B6570;
    line-height:1.5;
}

.kpis{
    display:grid;
    grid-template-columns:repeat(5,1fr);
    gap:12px;
    margin-bottom:24px;
}

.kpi{
    border:1px solid #E2E5E9;
    border-left:4px solid #4C8FD1;
    border-radius:4px;
    padding:12px 14px;
}

.kpi:nth-child(2){ border-left-color:#F2A93B; }
.kpi:nth-child(3){ border-left-color:#3DCB82; }
.kpi:nth-child(4){ border-left-color:#8B97A3; }
.kpi:nth-child(5){ border-left-color:#E8564F; }

.kpi .label{
    font-size:9.5px;
    text-transform:uppercase;
    letter-spacing:.05em;
    color:#5B6570;
    margin-bottom:6px;
}

.kpi .valor{
    font-size:20px;
    font-weight:700;
    color:#1A1D21;
}

h2{
    font-size:13px;
    text-transform:uppercase;
    letter-spacing:.05em;
    border-left:3px solid #F2A93B;
    padding-left:10px;
    margin-bottom:10px;
}

table{
    width:100%;
    border-collapse:collapse;
    margin-bottom:24px;
}

th{
    background:#1D2329;
    color:#fff;
    padding:8px;
    font-size:10px;
    text-transform:uppercase;
    letter-spacing:.05em;
    text-align:center;
    border:1px solid #1D2329;
}

td{
    border:1px solid #E2E5E9;
    padding:7px 8px;
    font-size:11px;
    text-align:center;
}

tbody tr:nth-child(even){
    background:#FAFBFC;
}

tfoot td{
    font-weight:700;
    background:#F3F4F6;
}

.rodape{
    margin-top:10px;
    text-align:right;
    font-size:11px;
    color:#5B6570;
}

@media print{

    th,
    .kpi{
        -webkit-print-color-adjust:exact;
        print-color-adjust:exact;
    }

}

</style>

</head>

<body>

<div class="cabecalho">

    <h1>🚛 Relatório Executivo — Expedição</h1>

    <div class="meta">
        Período: ${periodoInicio} a ${periodoFim} (${dias} dias)<br>
        Gerado em ${agora}
    </div>

</div>

<div class="kpis">

    <div class="kpi">
        <div class="label">Caminhões Carregados</div>
        <div class="valor">${totalCaminhoes.toLocaleString("pt-BR")}</div>
    </div>

    <div class="kpi">
        <div class="label">Docas Produzidas</div>
        <div class="valor">${totalDocas.toLocaleString("pt-BR")}</div>
    </div>

    <div class="kpi">
        <div class="label">Lojas Faturadas</div>
        <div class="valor">${totalLojas.toLocaleString("pt-BR")}</div>
    </div>

    <div class="kpi">
        <div class="label">Veículos Turno A</div>
        <div class="valor">${totalVeiculosA.toLocaleString("pt-BR")}</div>
    </div>

    <div class="kpi">
        <div class="label">Fora da Escala</div>
        <div class="valor">${totalForaEscala.toLocaleString("pt-BR")}</div>
    </div>

</div>

<h2>Detalhamento Diário</h2>

<table>

    <thead>
        <tr>
            <th>Data</th>
            <th>Caminhões</th>
            <th>Docas</th>
            <th>Lojas Faturadas</th>
            <th>Veículos Turno A</th>
            <th>Fora da Escala</th>
        </tr>
    </thead>

    <tbody>
        ${linhasTabela}
    </tbody>

    <tfoot>
        <tr>
            <td>TOTAL</td>
            <td>${totalCaminhoes.toLocaleString("pt-BR")}</td>
            <td>${totalDocas.toLocaleString("pt-BR")}</td>
            <td>${totalLojas.toLocaleString("pt-BR")}</td>
            <td>${totalVeiculosA.toLocaleString("pt-BR")}</td>
            <td>${totalForaEscala.toLocaleString("pt-BR")}</td>
        </tr>
    </tfoot>

</table>

<div class="rodape">
    Relatório de Expedição · gerado automaticamente
</div>

</body>
</html>
`;

    const janela =
    window.open("", "_blank");

    if(!janela){

        alert(
            "O navegador bloqueou a janela de impressão."
        );

        return;

    }

    janela.document.open();

    janela.document.write(html);

    janela.document.close();

    setTimeout(()=>{

        janela.focus();

        janela.print();

    },500);

}

// =====================================================
// =====================================================
// LANÇAMENTO MANUAL DO DIA
// Preenche os 5 campos direto na tela, sem precisar do
// Excel da Base. Ao salvar, gera um item com o MESMO
// formato de dadosBase (produzido por processarArquivoBase)
// e faz upsert por data — reaproveita 100% dos KPIs,
// gráfico e tabela já existentes, sem duplicar lógica.
// =====================================================
// =====================================================

// ---------- MODAL DE LOJA FATURADA ----------

function abrirModalLoja(){

    document.getElementById("modalLoja").style.display = "flex";

    const campo = document.getElementById("modalLojaInput");

    campo.value = "";

    setTimeout(() => campo.focus(), 50);

}

function fecharModalLoja(){

    document.getElementById("modalLoja").style.display = "none";

}

function confirmarLoja(){

    const campo =
    document.getElementById("modalLojaInput");

    const numero =
    campo.value.trim();

    if(!numero){

        alert("Digita o número da loja.");

        return;

    }

    if(lojasFaturadasHoje.includes(numero)){

        alert(`A loja ${numero} já está na lista.`);

        return;

    }

    lojasFaturadasHoje.push(numero);

    atualizarChipsLojas();

    fecharModalLoja();

}

function removerLoja(numero){

    lojasFaturadasHoje =
    lojasFaturadasHoje.filter(l => l !== numero);

    atualizarChipsLojas();

}

function atualizarChipsLojas(){

    const container =
    document.getElementById("manualLojasChips");

    document.getElementById("manualLojasContador").innerText =
    lojasFaturadasHoje.length;

    if(!lojasFaturadasHoje.length){

        container.innerHTML = `
        <span class="manual-lojas-vazio">
            Nenhuma loja adicionada ainda.
        </span>
        `;

        return;

    }

    container.innerHTML =
    lojasFaturadasHoje
    .map(numero => `
        <span class="chip-loja">
            🏪 ${numero}
            <button type="button" onclick="removerLoja('${numero}')" title="Remover">×</button>
        </span>
    `)
    .join("");

}

// fecha o modal clicando fora da caixa
document
.getElementById("modalLoja")
.addEventListener("click", function(evento){

    if(evento.target === this){

        fecharModalLoja();

    }

});

// ---------- SALVAR / LIMPAR ----------

function obterDataManualComoDate(){

    const valor =
    document.getElementById("manualData").value;

    if(!valor) return null;

    const partes =
    valor.split("-");

    return new Date(
        Number(partes[0]),
        Number(partes[1]) - 1,
        Number(partes[2])
    );

}

function mesmoDia(a, b){

    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );

}

function salvarRegistroManual(){

    const data =
    obterDataManualComoDate();

    if(!data){

        alert("Selecione a data do registro.");

        return;

    }

    const registro = {

        data,

        caminhoes:
        Number(document.getElementById("manualCaminhoes").value) || 0,

        docas:
        Number(document.getElementById("manualDocas").value) || 0,

        lojas:
        lojasFaturadasHoje.length,

        veiculosTurnoA:
        Number(document.getElementById("manualVeiculosTurnoA").value) || 0,

        foraEscala:
        Number(document.getElementById("manualForaEscala").value) || 0

    };

    const indiceExistente =
    dadosBase.findIndex(item => item.data && mesmoDia(item.data, data));

    if(indiceExistente >= 0){

        const confirmaSubstituir =
        confirm(
            `Já existe um registro para ${data.toLocaleDateString("pt-BR")}. Substituir pelos valores preenchidos agora?`
        );

        if(!confirmaSubstituir) return;

        dadosBase[indiceExistente] = registro;

    }else{

        dadosBase.push(registro);

    }

    dadosBase.sort((a,b) => a.data - b.data);

    atualizarKPIs();
    renderizarGrafico();
    renderizarTabela();

    alert(
        `Registro de ${data.toLocaleDateString("pt-BR")} salvo com sucesso.`
    );

}

function limparFormularioManual(){

    document.getElementById("manualData").value = "";
    document.getElementById("manualCaminhoes").value = "";
    document.getElementById("manualDocas").value = "";
    document.getElementById("manualVeiculosTurnoA").value = "";
    document.getElementById("manualForaEscala").value = "";

    lojasFaturadasHoje = [];

    atualizarChipsLojas();

}

// preenche a data com hoje por padrão ao carregar a página
document.addEventListener("DOMContentLoaded", function(){

    const campoData =
    document.getElementById("manualData");

    if(campoData && !campoData.value){

        const hoje = new Date();

        campoData.value =
        hoje.getFullYear() + "-" +
        String(hoje.getMonth()+1).padStart(2,"0") + "-" +
        String(hoje.getDate()).padStart(2,"0");

    }

});

// =====================================================
// =====================================================
// FATURAMENTO POR PRODUTIVO — TURNO B (17h–02h30)
// Reaproveita dadosFaturamento (já lido por
// lerFaturamentoTXT) e o campo "operador" que já é
// extraído da tarefa (padrão STOK <matrícula>), mas
// que até então não era exibido em lugar nenhum.
// =====================================================
// =====================================================

// true se o horário do registro cai dentro da janela
// 17:00 até 02:30 do dia seguinte (turno que atravessa
// a meia-noite)
function estaNoTurnoB(dataHora){

    if(!dataHora) return false;

    const minutosDoDia =
    dataHora.getHours() * 60 + dataHora.getMinutes();

    const inicio = 17 * 60;       // 17:00
    const fim = 2 * 60 + 30;      // 02:30

    return (
        minutosDoDia >= inicio ||
        minutosDoDia <= fim
    );

}

function obterResumoProdutivo(){

    const doTurnoB =
    dadosFaturamento.filter(item => estaNoTurnoB(item.dataHora));

    const porProdutivo = {};

    let totalValor = 0;
    let totalLinhas = 0;

    doTurnoB.forEach(item=>{

        const matricula =
        item.operador || "SEM MATRÍCULA";

        if(!porProdutivo[matricula]){

            porProdutivo[matricula] = {

                matricula,
                linhas: 0,
                quantidade: 0,
                valor: 0

            };

        }

        porProdutivo[matricula].linhas++;
        porProdutivo[matricula].quantidade += item.quantidade;
        porProdutivo[matricula].valor += item.valor;

        totalValor += item.valor;
        totalLinhas++;

    });

    const produtivos =
    Object.values(porProdutivo)
    .sort((a,b) => b.valor - a.valor);

    return { totalValor, totalLinhas, produtivos };

}

function atualizarFaturamentoProdutivo(){

    const resumo =
    obterResumoProdutivo();

    const formatarMoeda =
    valor =>
    valor.toLocaleString("pt-BR",{ style:"currency", currency:"BRL" });

    document.getElementById("kpiValorTurnoB").innerText =
    formatarMoeda(resumo.totalValor);

    document.getElementById("kpiLinhasTurnoB").innerText =
    resumo.totalLinhas.toLocaleString("pt-BR");

    document.getElementById("kpiProdutivosAtivos").innerText =
    resumo.produtivos.length.toLocaleString("pt-BR");

    const tbody =
    document.getElementById("tbodyFaturamentoProdutivo");

    if(!resumo.produtivos.length){

        tbody.innerHTML = `
        <tr>
            <td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">
                Nenhum lançamento dentro do turno 17h–02h30 nesse arquivo.
            </td>
        </tr>
        `;

        return;

    }

    tbody.innerHTML =
    resumo.produtivos.map(item => `
        <tr>
            <td>${item.matricula}</td>
            <td>${item.linhas.toLocaleString("pt-BR")}</td>
            <td>${item.quantidade.toLocaleString("pt-BR")}</td>
            <td>${formatarMoeda(item.valor)}</td>
        </tr>
    `).join("");

}

// encaixa a chamada dentro do fluxo já existente de
// atualizarFaturamento(), sem duplicar o guard de
// "sem dados ainda" que a função original já faz
const atualizarFaturamentoOriginal = atualizarFaturamento;

atualizarFaturamento = function(){

    atualizarFaturamentoOriginal();

    if(dadosFaturamento.length){

        atualizarFaturamentoProdutivo();

    }

};
