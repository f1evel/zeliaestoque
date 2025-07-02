// previsaoExportar.js — Exportação CSV e Excel da previsão

// 👉 Exportar dados para CSV
export async function exportarPrevisaoCSV(dados) {
  const linhas = [
    ["Produto", "Categoria", "Fornecedor", "Qtd", "Consumo/Mês", "Média Dias/Unid", "Dias Estoque", "Prev. Esgotamento", "Última Saída"],
    ...dados.map(d => [
      d.nome,
      d.categoria,
      d.fornecedor,
      d.quantidade,
      d.consumoMensal,
      d.mediaDiasPorUnidade,
      d.diasDeEstoque === Infinity ? "-" : d.diasDeEstoque,
      d.dataPrevistaEsgotamento ? d.dataPrevistaEsgotamento.toLocaleDateString('pt-BR') : "-",
      d.ultimaSaida ? d.ultimaSaida.toLocaleDateString('pt-BR') : "-"
    ])
  ];

  const csvContent = linhas
    .map(linha =>
      linha
        .map(campo => `"${(campo ?? "").toString().replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  try {
    await fetch("https://us-central1-zelia-1.cloudfunctions.net/salvarCSV", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomeArquivo: `relatorio_previsao_${Date.now()}.csv`,
        conteudo: csvContent
      })
    });
  } catch (e) {
    console.error("Erro ao enviar CSV:", e);
  }
}

// 👉 Exportar dados para Excel (.xlsx)
export async function exportarPrevisaoExcel(dados) {
  const { utils, writeFile } = await import("https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs");

  const linhas = dados.map(d => ({
    Produto: d.nome,
    Categoria: d.categoria,
    Fornecedor: d.fornecedor,
    Quantidade: d.quantidade,
    Consumo_Mensal: d.consumoMensal,
    Media_Dias_Unidade: d.mediaDiasPorUnidade,
    Dias_Previsao: d.diasPrevisao === Infinity ? "-" : d.diasPrevisao,
    Dias_Estoque: d.diasDeEstoque === Infinity ? "-" : d.diasDeEstoque,
    Previsao_Esgotamento: d.dataPrevistaEsgotamento ? d.dataPrevistaEsgotamento.toLocaleDateString('pt-BR') : "-",
    Ultima_Saida: d.ultimaSaida ? d.ultimaSaida.toLocaleDateString('pt-BR') : "-"
  }));

  const worksheet = utils.json_to_sheet(linhas);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Previsao");

  writeFile(workbook, `relatorio_previsao_${Date.now()}.xlsx`);
}
