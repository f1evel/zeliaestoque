export async function exportarConsumoCSV(dados) {
  const linhas = [
    ["Produto", "Categoria", "Fornecedor", "Quantidade", "Data"],
    ...dados.map(d => [
      d.nome,
      d.categoria,
      d.fornecedor,
      d.quantidade,
      d.data ? d.data.toLocaleDateString('pt-BR') : "-"
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
        nomeArquivo: `relatorio_consumo_${Date.now()}.csv`,
        conteudo: csvContent
      })
    });
  } catch (e) {
    console.error("Erro ao enviar CSV:", e);
  }
}

export async function exportarConsumoExcel(dados) {
  const { utils, writeFile } = await import("https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs");

  const linhas = dados.map(d => ({
    Produto: d.nome,
    Categoria: d.categoria,
    Fornecedor: d.fornecedor,
    Quantidade: d.quantidade,
    Data: d.data ? d.data.toLocaleDateString('pt-BR') : "-"
  }));

  const worksheet = utils.json_to_sheet(linhas);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Consumo");

  writeFile(workbook, `relatorio_consumo_${Date.now()}.xlsx`);
}

export async function exportarConsumoPDF(dados) {
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js');
  const doc = new jsPDF();

  doc.text("Relatório de Consumo", 14, 16);

  const linhas = dados.map(d => [
    d.nome,
    d.categoria,
    d.fornecedor,
    d.quantidade,
    d.data ? d.data.toLocaleDateString('pt-BR') : "-"
  ]);

  doc.autoTable({
    head: [["Produto", "Categoria", "Fornecedor", "Quantidade", "Data"]],
    body: linhas,
    startY: 20
  });

  doc.save(`relatorio_consumo_${Date.now()}.pdf`);
}
