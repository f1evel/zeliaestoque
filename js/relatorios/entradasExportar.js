export async function exportarEntradasExcel(dados) {
  const { utils, writeFile } = await import('https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs');

  const linhas = dados.map(d => ({
    Produto: d.nome,
    Quantidade: d.quantidade,
    Validade: d.validade ? d.validade.toLocaleDateString('pt-BR') : '-',
    PrecoUnitario: d.preco,
    Fornecedor: d.fornecedor,
    CompraID: d.compraId,
    Data: d.data ? d.data.toLocaleDateString('pt-BR') : '-'
  }));

  const worksheet = utils.json_to_sheet(linhas);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, 'Entradas');
  writeFile(workbook, `relatorio_entradas_${Date.now()}.xlsx`);
}
