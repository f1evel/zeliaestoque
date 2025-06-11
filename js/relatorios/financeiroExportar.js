// financeiroExportar.js

// 👉 Exportar para CSV
export function exportarFinanceiroCSV(dados) {
  const linhas = [
    ["Descrição", "Categoria", "Valor", "Status", "Data Lançamento", "Vencimento", "Pagamento"],
    ...dados.map(d => [
      d.descricao,
      d.categoria,
      d.valor,
      d.status,
      d.dataLancamento ? d.dataLancamento.toLocaleDateString('pt-BR') : "-",
      d.dataVencimento ? d.dataVencimento.toLocaleDateString('pt-BR') : "-",
      d.dataPagamento ? d.dataPagamento.toLocaleDateString('pt-BR') : "-"
    ])
  ];

  const csvContent = linhas
    .map(l => l.map(campo => `"${(campo ?? "").toString().replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio_financeiro_${Date.now()}.csv`;
  link.click();
}

// 👉 Exportar para Excel
export async function exportarFinanceiroExcel(dados) {
  const { utils, writeFile } = await import("https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs");

  const linhas = dados.map(d => ({
    Descricao: d.descricao,
    Categoria: d.categoria,
    Valor: d.valor,
    Status: d.status,
    DataLancamento: d.dataLancamento ? d.dataLancamento.toLocaleDateString('pt-BR') : "-",
    Vencimento: d.dataVencimento ? d.dataVencimento.toLocaleDateString('pt-BR') : "-",
    Pagamento: d.dataPagamento ? d.dataPagamento.toLocaleDateString('pt-BR') : "-"
  }));

  const worksheet = utils.json_to_sheet(linhas);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Financeiro");

  writeFile(workbook, `relatorio_financeiro_${Date.now()}.xlsx`);
}
