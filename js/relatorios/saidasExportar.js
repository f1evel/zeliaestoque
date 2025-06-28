export async function exportarSaidasExcel(dados) {
  const { utils, writeFile } = await import('https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs');

  const linhas = dados.map(d => ({
    Produto: d.nome,
    Quantidade: d.quantidade,
    Data: d.data ? d.data.toLocaleDateString('pt-BR') : '-',
    Motivo: d.motivo,
    Responsavel: d.responsavel
  }));

  const worksheet = utils.json_to_sheet(linhas);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, 'Saidas');
  writeFile(workbook, `relatorio_saidas_${Date.now()}.xlsx`);
}
