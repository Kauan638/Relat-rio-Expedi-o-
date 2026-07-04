// ========================================
// DADOS GLOBAIS
// ========================================

let dadosOriginais = [];
let dadosFiltrados = [];
let agrupado = {};
let mapaApanhas = {};
let mapaPulmoes = {};

// ========================================
// NOME DO ARQUIVO SELECIONADO
// ========================================

document
.getElementById("arquivo")
.addEventListener("change", function(){

    const arquivo = this.files[0];

    document
    .getElementById("nomeArquivo")
    .innerText =
    arquivo
    ? arquivo.name
    : "Nenhum arquivo selecionado";

});

document
.getElementById("arquivoEnderecos")
.addEventListener("change", function(){

    const arquivo = this.files[0];

    document
    .getElementById("nomeEnderecos")
    .innerText =
    arquivo
    ? arquivo.name
    : "Nenhum arquivo selecionado";

});

// ========================================
// LOADING
// ========================================

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

// ========================================
// PROCESSAR ARQUIVO
// ========================================

async function processarArquivo(){

    const arquivo =
    document.getElementById(
        "arquivo"
    ).files[0];

    if(!arquivo){

        alert(
            "Selecione o arquivo principal."
        );

        return;
    }

    mostrarLoading();

    try{

        // Carrega apanhas e pulmões a partir do
        // arquivo único de Posição de Endereços
        if(
            document.getElementById(
                "arquivoEnderecos"
            )?.files[0]
        ){

            await carregarEnderecos();

        }
        
        const nome =
        arquivo.name.toLowerCase();

        if(
            nome.endsWith(".csv")
        ){

            lerCSV(
                arquivo
            );

        }else{

            lerExcel(
                arquivo
            );

        }

    }catch(erro){

        console.error(
            erro
        );

        alert(
            "Erro ao ler arquivo."
        );

        ocultarLoading();

    }

}
// ========================================
// LEITURA CSV
// ========================================

function lerCSV(arquivo){

    const reader =
    new FileReader();

    reader.onload =
    function(e){

        const texto =
        e.target.result;

        const linhas =
        texto
        .split(/\r?\n/)
        .filter(
            l=>l.trim()
        );

        const cabecalho =
        linhas[0]
        .split(";");

        const dados = [];

        for(
            let i = 1;
            i < linhas.length;
            i++
        ){

            const valores =
            linhas[i]
            .split(";");

            const obj = {};

            cabecalho.forEach(
                (col,idx)=>{

                    obj[
                        col.trim()
                    ] =
                    valores[idx]
                    ? valores[idx].trim()
                    : "";

                }
            );

            dados.push(obj);

        }

        console.log(
            "COLUNAS CSV:",
            Object.keys(dados[0])
        );

        tratarDados(dados);

    };

    reader.readAsText(
        arquivo,
        "latin1"
    );

}
// ========================================
// LEITURA XLSX
// ========================================

function lerExcel(
    arquivo
){

    const reader =
    new FileReader();

    reader.onload =
    function(e){

        const data =
        new Uint8Array(
            e.target.result
        );

        const workbook =
        XLSX.read(
            data,
            {
                type:"array"
            }
        );

        const aba =
        workbook.SheetNames[0];

        const dados =
        XLSX.utils.sheet_to_json(
            workbook.Sheets[aba],
            {
                defval:""
            }
        );

        tratarDados(
            dados
        );

    };

    reader.readAsArrayBuffer(
        arquivo
    );

}

// ========================================
// LEITURA POSIÇÃO DE ENDEREÇOS
// (arquivo único: gera mapaApanhas e mapaPulmoes)
// Layout: DEPOSITO;PAVILHAO;SUBDIVISAO;CODRUA;NROPREDIO;
// NROAPARTAMENTO;NROSALA;ESPECIE_END;CODIGO;DESCRICAO;
// EMBALAGEM;QTD_END;NORMA_PULMAO;NORMA_APANHA;
// NORMA_MIUDEZA;TIPEND;STATUS_ENDERECO;CAT_1;CAT_2;CAT_3
// ========================================

async function carregarEnderecos(){

    const arquivo =
    document.getElementById(
        "arquivoEnderecos"
    ).files[0];

    if(!arquivo) return;

    const reader =
    new FileReader();

    return new Promise(resolve=>{

        reader.onload =
        function(e){

            const texto =
            e.target.result;

            const linhas =
            texto
            .split(/\r?\n/)
            .filter(
                l => l.trim()
            );

            mapaApanhas = {};
            mapaPulmoes = {};

            for(
                let i = 1;
                i < linhas.length;
                i++
            ){

                const colunas =
                linhas[i]
                .split(";");

                const codrua =
                colunas[3]?.trim();

                const nropredio =
                colunas[4]?.trim();

                const nroapartamento =
                colunas[5]?.trim();

                const nrosala =
                colunas[6]?.trim();

                const especieEnd =
                colunas[7]?.trim();

                const sku =
                colunas[8]?.trim();

                const statusEndereco =
                colunas[16]?.trim();

                // Só endereços ocupados têm SKU válido
                if(
                    !sku ||
                    statusEndereco !== "Ocupado"
                ) continue;

                const endereco =
                `${codrua}.${nropredio}.${nroapartamento}.${nrosala}`;

                if(especieEnd === "Apanha"){

                    mapaApanhas[sku] =
                    endereco;

                }else if(especieEnd === "Pulmão"){

                    if(!mapaPulmoes[sku]){

                        mapaPulmoes[sku] = [];

                    }

                    if(
                        !mapaPulmoes[sku]
                        .includes(endereco)
                    ){

                        mapaPulmoes[sku]
                        .push(endereco);

                    }

                }

            }

            console.log(
                "Apanhas carregadas:",
                Object.keys(
                    mapaApanhas
                ).length
            );

            console.log(
                "Pulmões carregados:",
                Object.keys(
                    mapaPulmoes
                ).length
            );

            resolve();

        };

        reader.readAsText(
            arquivo,
            "latin1"
        );

    });

}


// ========================================
// TRATAMENTO INICIAL
// ========================================

function tratarDados(dados){

    console.log("COLUNAS:");
    console.log(Object.keys(dados[0]));

    dadosOriginais =
    dados.map(linha=>{

        const loja =
        String(
            linha["tipEspecie"] ||
            linha["Espécie"] ||
            ""
        )
        .replace(/^S/i,"");

        const skuPrincipal =
        String(
            linha["Código do produto"]
        ).trim();

        // ======================
        // TRATAMENTO DATA
        // ======================

        let data = "";

        if(
            linha["(Global)H. Integrado"]
        ){

            data =
            String(
                linha["(Global)H. Integrado"]
            )
            .split(",")[0]
            .trim();

        }

        return{

            loja,

            data,

            ptl:
            linha["(Palete)Posição"] ||
            linha["Posição"] ||
            "",

            sku:
            skuPrincipal,

            descricao:
            linha["Produto"] ||
            "",

            volumes:
            Number(
                linha["quantidadeTotal"]
            ) || 0,

            master:
            linha["(Palete)Master"] ||
            "",

            apanha:
            mapaApanhas[
                skuPrincipal
            ] || "Sem Apanha",

            pulmao:
            (
                mapaPulmoes[
                    skuPrincipal
                ] || []
            ).join(" | ")

        };

    });

    dadosFiltrados =
    [...dadosOriginais];

console.log(dadosOriginais[0]);
    
    gerarAgrupamento();

    ocultarLoading();

}
// ========================================
// AGRUPAMENTO
// ========================================

function gerarAgrupamento(){

    agrupado = {};

    dadosFiltrados.forEach(item=>{

        const loja =
        item.loja || "SEM LOJA";

        const ptl =
        item.ptl || "SEM PTL";

        if(!agrupado[loja]){

            agrupado[loja] = {};

        }

        if(!agrupado[loja][ptl]){

            agrupado[loja][ptl] = [];

        }

        agrupado[loja][ptl].push(
            item
        );

    });

    atualizarKPIs();

    renderizar();

}

// ========================================
// KPIs
// ========================================

function atualizarKPIs(){

    const lojas =
    Object.keys(
        agrupado
    ).length;

    let ptls = 0;

    let volumes = 0;

    const skusUnicos =
    new Set();

    Object.values(
        agrupado
    ).forEach(loja=>{

        ptls +=
        Object.keys(
            loja
        ).length;

        Object.values(
            loja
        ).forEach(ptl=>{

            ptl.forEach(item=>{

                if(item.sku){

                    skusUnicos.add(
                        String(item.sku).trim()
                    );

                }

                volumes++;

            });

        });

    });

    document.getElementById(
        "kpiLojas"
    ).textContent = lojas;

    document.getElementById(
        "kpiPtls"
    ).textContent = ptls;

    document.getElementById(
        "kpiSkus"
    ).textContent =
    skusUnicos.size;

    document.getElementById(
        "kpiVolumes"
    ).textContent =
    volumes.toLocaleString(
        "pt-BR"
    );

}

// ========================================
// FILTROS
// ========================================

function aplicarFiltros(){

    const lojaFiltro =
    document
    .getElementById("filtroLoja")
    .value
    .toLowerCase();

    const ptlFiltro =
    document
    .getElementById("filtroPTL")
    .value
    .toLowerCase();

    const skuFiltro =
    document
    .getElementById("filtroSKU")
    .value
    .toLowerCase();

    const filtroData =
    document
    .getElementById("filtroData")
    .value;

    dadosFiltrados =
    dadosOriginais.filter(item=>{

        let dataItem = "";

        if(item.data){

            const partes =
            item.data.split("/");

            if(partes.length === 3){

                dataItem =
                `${partes[2]}-${partes[1]}-${partes[0]}`;

            }

        }

        return (

            item.loja
            .toLowerCase()
            .includes(lojaFiltro)

            &&

            item.ptl
            .toLowerCase()
            .includes(ptlFiltro)

            &&

            String(item.sku)
            .toLowerCase()
            .includes(skuFiltro)

            &&

            (
                filtroData === "" ||
                dataItem === filtroData
            )

        );

    });

    gerarAgrupamento();

}

// ========================================
// RENDERIZAÇÃO
// ========================================

function renderizar(){

    const resultado =
    document.getElementById(
        "resultado"
    );

    resultado.innerHTML = "";

    const lojas =
    Object.keys(
        agrupado
    )
    .sort(
        (a,b)=>
        Number(a)-Number(b)
    );

    lojas.forEach(loja=>{

        const cardLoja =
        document.createElement(
            "div"
        );

        cardLoja.className =
        "loja-card";

        cardLoja.innerHTML =
        `
        <div class="loja-titulo">
            🏪 LOJA ${loja}
        </div>
        `;

        const ptls =
        Object.keys(
            agrupado[loja]
        ).sort();

        ptls.forEach(ptl=>{

            const itens =
            agrupado[loja][ptl];

            let totalVolumes = 0;

            itens.forEach(i=>{

                totalVolumes +=
                Number(i.volumes) || 0;

            });

            let htmlTabela =
            `
            <div class="ptl-card">

                <div class="ptl-titulo">
                    📦 ${ptl}
                </div>

                <table class="tabela">

       <thead>
    <tr>
        <th>SKU</th>
        <th>Descrição</th>
        <th>Data</th>
        <th>Apanha</th>
        <th>Pulmão</th>
        <th>Volumes</th>
    </tr>
</thead>

                <tbody>
            `;

            const skuAgrupado = {};

            itens.forEach(item=>{

                const chave =
                item.sku;

                if(!skuAgrupado[chave]){

                  
skuAgrupado[chave] = {

    sku: item.sku,

    descricao:
    item.descricao,

    data:
    item.data,

    apanha:
    item.apanha || "Sem Apanha",

    pulmao:
    item.pulmao || "-",

    volumes: 0

};

                }

                skuAgrupado[chave]
                .volumes++;

            });

            Object.values(
                skuAgrupado
            ).forEach(item=>{
htmlTabela +=
`
<tr>
    <td>${item.sku}</td>
    <td>${item.descricao}</td>
    <td>${item.data || "-"}</td>
    <td>${item.apanha}</td>
    <td>${item.pulmao}</td>
    <td>${item.volumes}</td>
</tr>
`;

            });

            htmlTabela +=
            `
                </tbody>
                </table>

                <div class="resumo-ptl">

                    SKUs:
                    ${Object.keys(skuAgrupado).length}

                    |

                    Volumes:
                    ${totalVolumes}

                </div>

            </div>
            `;

            cardLoja.innerHTML +=
            htmlTabela;

        });

        resultado.appendChild(
            cardLoja
        );

    });

}

// ========================================
// TEXTO WHATSAPP
// ========================================

function gerarTextoWhatsapp(){

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

    let texto =
`🚨 *PENDÊNCIAS PTL*
🗓️ ${agora}
────────────────

`;

    let totalLojas = 0;
    let totalPTLs = 0;
    let totalVolumes = 0;

    const skusUnicos =
    new Set();

    const lojas =
    Object.keys(agrupado)
    .sort(
        (a,b)=>
        Number(a)-Number(b)
    );

    lojas.forEach(loja=>{

        totalLojas++;

        texto +=
`🏪 *LOJA ${loja}*

`;

        const ptls =
        Object.keys(
            agrupado[loja]
        ).sort();

        ptls.forEach(ptl=>{

            totalPTLs++;

            const itens =
            agrupado[loja][ptl];

            let volumesPTL = 0;

            itens.forEach(item=>{

                if(item.sku){

                    skusUnicos.add(
                        String(item.sku).trim()
                    );

                }

                volumesPTL++;

            });

            totalVolumes +=
            volumesPTL;

            texto +=
`   📦 ${ptl}
      • SKUs: ${new Set(itens.map(i => i.sku)).size}
      • Volumes: ${volumesPTL.toLocaleString("pt-BR")}

`;

        });

        texto +=
`────────────────

`;

    });

    texto +=
`📊 *RESUMO GERAL*

🏪 Lojas: ${totalLojas}
📦 PTLs: ${totalPTLs}
🔑 SKUs: ${skusUnicos.size.toLocaleString("pt-BR")}
📦 Volumes: ${totalVolumes.toLocaleString("pt-BR")}`;

    document.getElementById(
        "textoWhatsapp"
    ).value = texto;

}

// ========================================
// COPIAR WHATSAPP
// ========================================

function copiarWhatsapp(){

    gerarTextoWhatsapp();

    const campo =
    document.getElementById(
        "textoWhatsapp"
    );

    campo.select();

    document.execCommand(
        "copy"
    );

    alert(
        "Texto copiado!"
    );

}

// ========================================
// IMPRIMIR RESULTADO (TELA)
// ========================================

function imprimirResultado(){

    if(!Object.keys(agrupado).length){

        alert(
            "Nenhum dado para imprimir. Processe os arquivos primeiro."
        );

        return;

    }

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

    const totalVolumes =
    Object.values(agrupado)
    .flatMap(loja=>Object.values(loja))
    .flat()
    .length;

    document.getElementById(
        "metaImpressao"
    ).innerText =
    `Gerado em ${agora} · ${totalVolumes.toLocaleString("pt-BR")} volumes`;

    window.print();

}

// ========================================
// EXPORTAR EXCEL
// ========================================

function exportarExcel(){

    const exportacao = [];

    Object.keys(
        agrupado
    ).forEach(loja=>{

        Object.keys(
            agrupado[loja]
        ).forEach(ptl=>{

            agrupado[
                loja
            ][ptl]
            .forEach(item=>{

              exportacao.push({

    Loja:
    item.loja,

    PTL:
    item.ptl,

    SKU:
    item.sku,

    Descricao:
    item.descricao,

    Apanha:
    item.apanha,

    Pulmao:
    item.pulmao || "-",

    Volumes:
    item.volumes,

    Master:
    item.master

});

            });

        });

    });

    const ws =
    XLSX.utils.json_to_sheet(
        exportacao
    );

    const wb =
    XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        wb,
        ws,
        "Pendencias"
    );

    XLSX.writeFile(
        wb,
        "Pendencia_PTL.xlsx"
    );

}

// ========================================
// RESUMO AUTOMÁTICO
// ========================================

function atualizarResumo(){

    gerarTextoWhatsapp();

}

// ========================================
// PROCESSAMENTO FINAL
// ========================================

const gerarAgrupamentoOriginal =
gerarAgrupamento;

gerarAgrupamento =
function(){

    gerarAgrupamentoOriginal();

    atualizarResumo();

};

// ========================================
// ATALHO ENTER FILTROS
// ========================================

document
.querySelectorAll(
    ".filtros input"
)
.forEach(input=>{

    input.addEventListener(
        "keyup",
        ()=>{
            aplicarFiltros();
        }
    );

});

// ========================================
// CARREGAMENTO
// ========================================

window.onload =
function(){

    document.getElementById(
        "textoWhatsapp"
    ).value =
`Faça upload do arquivo para gerar o relatório.`;

};


// (funções copiarWhatsappCompleto, copiarWhatsappResumo e
// baixarImagemResumo ficam definidas mais abaixo, já na
// versão final/profissional usada pelos botões)


function copiarWhatsappCompleto(){

    gerarTextoWhatsapp();

    const texto =
    document.getElementById(
        "textoWhatsapp"
    ).value;

    navigator.clipboard.writeText(
        texto
    );

    alert(
        "Relatório completo copiado!"
    );

}


function copiarWhatsappResumo(){

    gerarTextoWhatsapp();

    const textoOriginal =
    document.getElementById(
        "textoWhatsapp"
    ).value;

    const marcador =
    "📊 *RESUMO GERAL*";

    const posicao =
    textoOriginal.indexOf(
        marcador
    );

    const blocoResumo =
    posicao >= 0
    ? textoOriginal.slice(posicao)
    : textoOriginal;

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

    const resumo =
`🚨 *PENDÊNCIAS PTL*
🗓️ ${agora}
────────────────

${blocoResumo}`;

    navigator.clipboard.writeText(
        resumo
    );

    alert(
        "Resumo copiado!"
    );

}

async function baixarImagemResumo(){

    const blocos = [];

    Object.keys(agrupado)
    .sort((a,b)=>Number(a)-Number(b))
    .forEach(loja=>{

        Object.keys(
            agrupado[loja]
        )
        .sort()
        .forEach(ptl=>{

            const itens =
            agrupado[loja][ptl];

            const skus =
            new Set(
                itens.map(
                    i => i.sku
                )
            ).size;

            const volumes =
            itens.length;

            blocos.push({
                loja,
                ptl,
                skus,
                volumes
            });

        });

    });

    const itensPorImagem = 10;

    const paginas = [];

    for(
        let i = 0;
        i < blocos.length;
        i += itensPorImagem
    ){

        paginas.push(
            blocos.slice(
                i,
                i + itensPorImagem
            )
        );

    }

    const totalPaginas =
    Math.min(
        paginas.length,
        18
    );

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

    for(
        let pagina = 0;
        pagina < totalPaginas;
        pagina++
    ){

        const itensPagina =
        paginas[pagina];

        const volumesPagina =
        itensPagina.reduce(
            (s,x)=>s+x.volumes,
            0
        );

        const card =
        document.createElement(
            "div"
        );

        card.style.width =
        "1000px";

        card.style.background =
        "#ffffff";

        card.style.fontFamily =
        "'Inter','Segoe UI',sans-serif";

        card.style.color =
        "#1A1D21";

        card.style.overflow =
        "hidden";

        card.style.borderRadius =
        "10px";

        card.style.border =
        "1px solid #E2E5E9";

        let linhas = "";

        itensPagina.forEach(item=>{

            linhas += `
            <div style="
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:16px;
                padding:16px 28px;
                border-bottom:1px solid #EEF0F2;
                background:#FFFFFF;
            ">

                <div style="
                    display:flex;
                    align-items:center;
                    gap:14px;
                    min-width:0;
                ">

                    <div style="
                        width:4px;
                        align-self:stretch;
                        min-height:36px;
                        background:#F2A93B;
                        border-radius:2px;
                        flex-shrink:0;
                    "></div>

                    <div style="min-width:0;">

                        <div style="
                            font-size:12px;
                            font-weight:700;
                            letter-spacing:.06em;
                            text-transform:uppercase;
                            color:#8B97A3;
                        ">
                            🏪 Loja ${item.loja}
                        </div>

                        <div style="
                            font-size:17px;
                            font-weight:700;
                            color:#1A1D21;
                            margin-top:2px;
                        ">
                            📦 ${item.ptl}
                        </div>

                    </div>

                </div>

                <div style="
                    display:flex;
                    gap:22px;
                    flex-shrink:0;
                    text-align:center;
                ">

                    <div>
                        <div style="
                            font-family:'JetBrains Mono',Consolas,monospace;
                            font-size:20px;
                            font-weight:700;
                            color:#4C8FD1;
                        ">${item.skus}</div>
                        <div style="
                            font-size:10px;
                            letter-spacing:.08em;
                            text-transform:uppercase;
                            color:#8B97A3;
                        ">SKUs</div>
                    </div>

                    <div>
                        <div style="
                            font-family:'JetBrains Mono',Consolas,monospace;
                            font-size:20px;
                            font-weight:700;
                            color:#3DCB82;
                        ">${item.volumes}</div>
                        <div style="
                            font-size:10px;
                            letter-spacing:.08em;
                            text-transform:uppercase;
                            color:#8B97A3;
                        ">Volumes</div>
                    </div>

                </div>

            </div>
            `;

        });

        card.innerHTML = `

            <div style="
                background:#1D2329;
                padding:22px 28px;
                display:flex;
                align-items:center;
                justify-content:space-between;
                border-bottom:3px solid #F2A93B;
            ">

                <div>
                    <div style="
                        font-family:'Oswald','Segoe UI',sans-serif;
                        font-size:22px;
                        font-weight:700;
                        letter-spacing:.03em;
                        text-transform:uppercase;
                        color:#ffffff;
                    ">🚨 Pendência PTL</div>

                    <div style="
                        font-size:12px;
                        color:#9AA5B1;
                        margin-top:4px;
                    ">Relatório gerado em ${agora}</div>
                </div>

                <div style="
                    font-family:'JetBrains Mono',Consolas,monospace;
                    font-size:12px;
                    color:#F2A93B;
                    font-weight:700;
                    white-space:nowrap;
                ">Página ${pagina+1}/${totalPaginas}</div>

            </div>

            ${linhas}

            <div style="
                display:flex;
                justify-content:flex-end;
                gap:24px;
                padding:14px 28px;
                background:#FAFBFC;
            ">
                <div style="
                    font-size:12px;
                    color:#5B6570;
                ">
                    Volumes nesta página:
                    <b style="color:#1A1D21;">
                        ${volumesPagina.toLocaleString("pt-BR")}
                    </b>
                </div>
            </div>
        `;

        document.body.appendChild(
            card
        );

        const canvas =
        await html2canvas(
            card,
            {
                scale:2
            }
        );

        const link =
        document.createElement(
            "a"
        );

        link.download =
        `pendencia-ptl-${String(
            pagina+1
        ).padStart(
            2,
            "0"
        )}.png`;

        link.href =
        canvas.toDataURL(
            "image/png"
        );

        link.click();

        card.remove();

        await new Promise(
            r=>setTimeout(
                r,
                300
            )
        );

    }

}


// ========================================
// BAIXAR IMAGEM — TOP 10 MAIORES PENDÊNCIAS
// ========================================

function obterTopPendencias(limite = 10){

    const itens = [];

    Object.keys(agrupado).forEach(loja=>{

        Object.keys(agrupado[loja]).forEach(ptl=>{

            const skuAgrupado = {};

            agrupado[loja][ptl].forEach(item=>{

                if(!skuAgrupado[item.sku]){

                    skuAgrupado[item.sku] = {

                        loja: item.loja,
                        ptl: item.ptl,
                        sku: item.sku,
                        descricao: item.descricao,
                        volumes: 0

                    };

                }

                skuAgrupado[item.sku]
                .volumes++;

            });

            itens.push(
                ...Object.values(skuAgrupado)
            );

        });

    });

    return itens
    .sort((a,b)=>b.volumes-a.volumes)
    .slice(0,limite);

}

async function baixarImagemTop10(){

    const top =
    obterTopPendencias(10);

    if(!top.length){

        alert(
            "Nenhum dado para gerar o ranking. Processe os arquivos primeiro."
        );

        return;

    }

    const medalhas = ["🥇","🥈","🥉"];

    const maiorVolume =
    top[0].volumes || 1;

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
    document.createElement(
        "div"
    );

    card.style.width =
    "1000px";

    card.style.background =
    "#ffffff";

    card.style.fontFamily =
    "'Inter','Segoe UI',sans-serif";

    card.style.color =
    "#1A1D21";

    card.style.overflow =
    "hidden";

    card.style.borderRadius =
    "10px";

    card.style.border =
    "1px solid #E2E5E9";

    let linhas = "";

    top.forEach((item,indice)=>{

        const posicao =
        indice + 1;

        const destaque =
        posicao <= 3;

        const corBarra =
        posicao === 1
        ? "#E8564F"
        : posicao <= 3
        ? "#F2A93B"
        : "#4C8FD1";

        const larguraBarra =
        Math.max(
            8,
            Math.round(
                (item.volumes / maiorVolume) * 100
            )
        );

        linhas += `
        <div style="
            display:flex;
            align-items:center;
            gap:16px;
            padding:${destaque ? "18px" : "14px"} 28px;
            border-bottom:1px solid #EEF0F2;
            background:${destaque ? "#FFFBF2" : "#FFFFFF"};
        ">

            <div style="
                width:38px;
                flex-shrink:0;
                text-align:center;
                font-size:${destaque ? "24px" : "16px"};
                font-weight:700;
                font-family:'JetBrains Mono',Consolas,monospace;
                color:${destaque ? "#1A1D21" : "#8B97A3"};
            ">
                ${medalhas[indice] || posicao + "º"}
            </div>

            <div style="flex:1;min-width:0;">

                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:baseline;
                    gap:12px;
                ">

                    <div style="min-width:0;">

                        <div style="
                            font-size:${destaque ? "16px" : "14px"};
                            font-weight:700;
                            color:#1A1D21;
                            white-space:nowrap;
                            overflow:hidden;
                            text-overflow:ellipsis;
                        ">
                            ${item.sku} — ${item.descricao}
                        </div>

                        <div style="
                            font-size:11px;
                            color:#8B97A3;
                            margin-top:2px;
                        ">
                            🏪 Loja ${item.loja} · 📦 ${item.ptl}
                        </div>

                    </div>

                    <div style="
                        font-family:'JetBrains Mono',Consolas,monospace;
                        font-size:${destaque ? "22px" : "18px"};
                        font-weight:700;
                        color:${corBarra};
                        white-space:nowrap;
                        flex-shrink:0;
                    ">
                        ${item.volumes.toLocaleString("pt-BR")}
                    </div>

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
                        width:${larguraBarra}%;
                        background:${corBarra};
                        border-radius:3px;
                    "></div>
                </div>

            </div>

        </div>
        `;

    });

    card.innerHTML = `

        <div style="
            background:#1D2329;
            padding:22px 28px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            border-bottom:3px solid #E8564F;
        ">

            <div>
                <div style="
                    font-family:'Oswald','Segoe UI',sans-serif;
                    font-size:22px;
                    font-weight:700;
                    letter-spacing:.03em;
                    text-transform:uppercase;
                    color:#ffffff;
                ">🏆 Top ${top.length} Maiores Pendências</div>

                <div style="
                    font-size:12px;
                    color:#9AA5B1;
                    margin-top:4px;
                ">Ranking por volume · gerado em ${agora}</div>
            </div>

        </div>

        ${linhas}
    `;

    document.body.appendChild(
        card
    );

    const canvas =
    await html2canvas(
        card,
        {
            scale:2
        }
    );

    const link =
    document.createElement(
        "a"
    );

    link.download =
    "pendencia-ptl-top10.png";

    link.href =
    canvas.toDataURL(
        "image/png"
    );

    link.click();

    card.remove();

}


function imprimirPorVolume(){

    const dados = [];

    Object.keys(agrupado).forEach(loja=>{

        Object.keys(agrupado[loja]).forEach(ptl=>{

            const itens = agrupado[loja][ptl];

            const skuAgrupado = {};

            itens.forEach(item=>{

                if(!skuAgrupado[item.sku]){

                    skuAgrupado[item.sku] = {

                        loja: item.loja,
                        ptl: item.ptl,
                        sku: item.sku,
                        descricao: item.descricao,
                        apanha: item.apanha || "Sem Apanha",
                        pulmao: item.pulmao || "-",
                        volumes: 0

                    };

                }

                skuAgrupado[item.sku]
                .volumes++;

            });

            dados.push(
                ...Object.values(
                    skuAgrupado
                )
            );

        });

    });

    if(!dados.length){

        alert(
            "Nenhum dado para imprimir. Processe os arquivos primeiro."
        );

        return;

    }

    const grupos = [

        {
            titulo:"Acima de 50 Volumes",
            emoji:"🔴",
            cor:"#E8564F",
            corFundo:"#FDECEB",
            itens: dados.filter(x => x.volumes > 50)
        },

        {
            titulo:"De 20 a 49 Volumes",
            emoji:"🟠",
            cor:"#F2A93B",
            corFundo:"#FEF6E7",
            itens: dados.filter(
                x => x.volumes >=20 && x.volumes <=49
            )
        },

        {
            titulo:"De 10 a 19 Volumes",
            emoji:"🟡",
            cor:"#D7B740",
            corFundo:"#FBF8E7",
            itens: dados.filter(
                x => x.volumes >=10 && x.volumes <=19
            )
        },

        {
            titulo:"Até 9 Volumes",
            emoji:"🟢",
            cor:"#3DCB82",
            corFundo:"#EAFAF2",
            itens: dados.filter(x => x.volumes <=9)
        }

    ];

    const totalGeral =
    dados.reduce(
        (s,x)=>s+x.volumes,
        0
    );

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

    let html = `
<!DOCTYPE html>
<html lang="pt-BR">

<head>

<meta charset="UTF-8">

<title>Pendência PTL — Por Volume</title>

<style>

@page{
    size:A4 landscape;
    margin:12mm;
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
    margin-bottom:16px;
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

.secao{
    margin-bottom:22px;
    page-break-inside:avoid;
}

.secao-titulo{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:8px 14px;
    border-radius:4px;
    font-size:13px;
    font-weight:700;
    letter-spacing:.04em;
    text-transform:uppercase;
    margin-bottom:6px;
}

table{
    width:100%;
    border-collapse:collapse;
    table-layout:fixed;
}

thead{
    display:table-header-group;
}

tr{
    page-break-inside:avoid;
}

th{
    background:#1D2329;
    color:#fff;
    padding:7px 8px;
    font-size:10px;
    letter-spacing:.05em;
    text-transform:uppercase;
    text-align:left;
    border:1px solid #1D2329;
}

td{
    border:1px solid #E2E5E9;
    padding:6px 8px;
    font-size:11px;
    vertical-align:top;
    word-wrap:break-word;
}

tbody tr:nth-child(even){
    background:#FAFBFC;
}

.colLoja{ width:6%; }
.colPtl{ width:12%; }
.colSku{ width:9%; }
.colDescricao{ width:29%; }
.colApanha{ width:12%; }
.colPulmao{ width:20%; }
.colVolumes{
    width:8%;
    text-align:center;
    font-weight:700;
}

.rodape{
    margin-top:10px;
    text-align:right;
    font-size:11px;
    color:#5B6570;
}

@media print{

    .secao-titulo,
    th{
        -webkit-print-color-adjust:exact;
        print-color-adjust:exact;
    }

}

</style>

</head>

<body>

<div class="cabecalho">

    <h1>
        🚨 Pendência PTL — Relatório por Volume
    </h1>

    <div class="meta">
        Gerado em ${agora}<br>
        Total geral: <b>${totalGeral.toLocaleString("pt-BR")}</b> volumes
        em <b>${dados.length.toLocaleString("pt-BR")}</b> SKUs
    </div>

</div>
`;

    grupos.forEach(grupo=>{

        if(!grupo.itens.length) return;

        const volumesGrupo =
        grupo.itens.reduce(
            (s,x)=>s+x.volumes,
            0
        );

        html += `
        <div class="secao">

            <div class="secao-titulo" style="
                background:${grupo.corFundo};
                color:${grupo.cor};
                border-left:5px solid ${grupo.cor};
            ">
                <span>${grupo.emoji} ${grupo.titulo}</span>
                <span>${grupo.itens.length} SKUs · ${volumesGrupo.toLocaleString("pt-BR")} volumes</span>
            </div>

            <table>

                <thead>
                    <tr>
                        <th class="colLoja">Loja</th>
                        <th class="colPtl">PTL</th>
                        <th class="colSku">SKU</th>
                        <th class="colDescricao">Descrição</th>
                        <th class="colApanha">Apanha</th>
                        <th class="colPulmao">Pulmão</th>
                        <th class="colVolumes">Volumes</th>
                    </tr>
                </thead>

                <tbody>
        `;

        grupo.itens
        .sort((a,b)=>b.volumes-a.volumes)
        .forEach(item=>{

            html += `
            <tr>
                <td class="colLoja">${item.loja}</td>
                <td class="colPtl">${item.ptl}</td>
                <td class="colSku">${item.sku}</td>
                <td class="colDescricao">${item.descricao}</td>
                <td class="colApanha">${item.apanha}</td>
                <td class="colPulmao">${item.pulmao}</td>
                <td class="colVolumes" style="color:${grupo.cor};">${item.volumes}</td>
            </tr>
            `;

        });

        html += `
                </tbody>
            </table>

        </div>
        `;

    });

    html += `
    <div class="rodape">
        Pendência PTL · relatório gerado automaticamente
    </div>
    </body>
    </html>
    `;

    const janela =
    window.open(
        "",
        "_blank"
    );

    if(!janela){

        alert(
            "O navegador bloqueou a janela de impressão."
        );

        return;

    }

    janela.document.open();

    janela.document.write(
        html
    );

    janela.document.close();

    setTimeout(()=>{

        janela.focus();

        janela.print();

    },500);

}
