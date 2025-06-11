// previsaoExportar.js — Exportação CSV e Excel da previsão

// 👉 Exportar dados para CSV
export function exportarPrevisaoCSV(dados) {
  const linhas = [
    ["Produto", "Categoria", "Fornecedor", "Qtd", "Consumo/Mês", "Dias Estoque", "Prev. Esgotamento"],
    ...dados.map(d => [
      d.nome,
      d.categoria,
      d.fornecedor,
      d.quantidade,
      d.consumoMensal,
      d.diasDeEstoque === Infinity ? "-" : d.diasDeEstoque,
      d.dataPrevistaEsgotamento ? d.dataPrevistaEsgotamento.toLocaleDateString('pt-BR') : "-"
    ])
  ];

  const csvContent = linhas
    .map(linha => linha.map(campo => `"${(campo ?? "").toString().replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio_previsao_${Date.now()}.csv`;
  link.click();
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
    Dias_Estoque: d.diasDeEstoque === Infinity ? "-" : d.diasDeEstoque,
    Previsao_Esgotamento: d.dataPrevistaEsgotamento ? d.dataPrevistaEsgotamento.toLocaleDateString('pt-BR') : "-"
  }));

  const worksheet = utils.json_to_sheet(linhas);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Previsao");

  writeFile(workbook, `relatorio_previsao_${Date.now()}.xlsx`);
}
