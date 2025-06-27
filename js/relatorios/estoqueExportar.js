// estoqueExportar.js — Exportação CSV e Excel do estoque

// 👉 Exportar dados para CSV
export async function exportarEstoqueCSV(dados) {
  const linhas = [
    ["Produto", "Categoria", "Fornecedor", "Quantidade", "Mínima", "Validade", "Dias p/ vencer"],
    ...dados.map(d => [
      d.nome,
      d.categoria,
      d.fornecedor,
      d.quantidade,
      d.quantidadeMinima,
      d.validade ? d.validade.toLocaleDateString('pt-BR') : "-",
      d.diasParaVencer ?? "-"
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
        nomeArquivo: `relatorio_estoque_${Date.now()}.csv`,
        conteudo: csvContent
      })
    });
  } catch (e) {
    console.error("Erro ao enviar CSV:", e);
  }
}

// 👉 Exportar dados para Excel (.xlsx)
export async function exportarEstoqueExcel(dados) {
  const { utils, writeFile } = await import("https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs");

  const linhas = dados.map(d => ({
    Produto: d.nome,
    Categoria: d.categoria,
    Fornecedor: d.fornecedor,
    Quantidade: d.quantidade,
    Minima: d.quantidadeMinima,
    Validade: d.validade ? d.validade.toLocaleDateString('pt-BR') : "-",
    Dias_para_vencer: d.diasParaVencer ?? "-"
  }));

  const worksheet = utils.json_to_sheet(linhas);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Estoque");

  writeFile(workbook, `relatorio_estoque_${Date.now()}.xlsx`);
}
