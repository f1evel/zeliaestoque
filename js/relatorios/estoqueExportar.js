// estoqueExportar.js — Exportação CSV e Excel do estoque

// 👉 Exportar dados para CSV
export function exportarEstoqueCSV(dados) {
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
    .map(linha => linha.map(campo => `"${(campo ?? "").toString().replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio_estoque_${Date.now()}.csv`;
  link.click();
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
