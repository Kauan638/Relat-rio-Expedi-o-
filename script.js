// =====================================
// VARIÁVEIS GLOBAIS
// =====================================

let dadosBase = [];
let grafico = null;

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

    if(!arquivo){

        alert(
            "Selecione o arquivo da Base."
        );

        return;

    }

    mostrarLoading();

    try{

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

    catch(erro){

        console.error(erro);

        alert(
            "Erro ao processar o arquivo. Confira se a aba 'Base' existe e tem os cabeçalhos esperados."
        );

    }

    finally{

        ocultarLoading();

    }

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
