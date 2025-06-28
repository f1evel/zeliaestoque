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

export async function exportarEntradasPDF(dados) {
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js');

  const doc = new jsPDF();
  doc.text('Relatório de Entradas', 14, 16);

  const filtros = [];
  const nome = document.getElementById('filtro-nome-entradas').value;
  const fornecedor = document.getElementById('filtro-fornecedor-entradas').value;
  const compra = document.getElementById('filtro-compra-entradas').value;
  const dataInicio = document.getElementById('filtro-data-inicio-entradas').value;
  const dataFim = document.getElementById('filtro-data-fim-entradas').value;

  if (nome) filtros.push(`Produto: ${nome}`);
  if (fornecedor) filtros.push(`Fornecedor: ${fornecedor}`);
  if (compra) filtros.push(`Compra: ${compra}`);
  if (dataInicio || dataFim) filtros.push(`Período: ${dataInicio || '-'} a ${dataFim || '-'}`);

  let startY = 22;
  filtros.forEach(f => {
    doc.text(f, 14, startY);
    startY += 6;
  });

  const linhas = dados.map(d => [
    d.nome,
    d.quantidade,
    d.validade ? d.validade.toLocaleDateString('pt-BR') : '-',
    d.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    d.fornecedor,
    d.compraId,
    d.data ? d.data.toLocaleDateString('pt-BR') : '-'
  ]);

  doc.autoTable({
    head: [['Produto', 'Quantidade', 'Validade', 'Preço Unitário', 'Fornecedor', 'CompraID', 'Data']],
    body: linhas,
    startY: startY + 2
  });

  doc.save(`relatorio_entradas_${Date.now()}.pdf`);
}
