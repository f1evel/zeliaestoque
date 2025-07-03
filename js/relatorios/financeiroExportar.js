// financeiroExportar.js

import { formatarPreco } from '../utils.js';

function nomeRelatorio(ext) {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const data = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}`;
  return `relatorio_financeiro_${data}.${ext}`;
}

// 👉 Exportar para CSV (mantido para compatibilidade)
export async function exportarFinanceiroCSV(dados) {
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
    .map(l => l.map(c => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(","))
    .join("\n");

  try {
    await fetch("https://us-central1-zelia-1.cloudfunctions.net/salvarCSV", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomeArquivo: nomeRelatorio('csv'), conteudo: csvContent })
    });
  } catch (e) {
    console.error("Erro ao enviar CSV:", e);
  }
}

// 👉 Exportar para Excel com compras e parcelas filtradas
export async function exportarFinanceiroExcel(dados) {
  const { utils, writeFile } = await import('https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs');

  const linhas = [];
  dados.forEach(d => {
    const parcelas = Array.isArray(d.parcelas) && d.parcelas.length > 0
      ? d.parcelas
      : [{ numero: 1, valor: d.valor, vencimento: d.dataVencimento, status: d.status, dataPagamento: d.dataPagamento }];

    parcelas.forEach(p => {
      linhas.push({
        CompraID: d.compraId,
        Fornecedor: d.fornecedorOuCliente,
        DataCompra: d.dataLancamento ? d.dataLancamento.toLocaleDateString('pt-BR') : '-',
        FormaPagamento: d.formaPagamento,
        ValorTotal: d.valor,
        Parcela: p.numero,
        ValorParcela: p.valor,
        Vencimento: p.vencimento ? new Date(p.vencimento).toLocaleDateString('pt-BR') : '-',
        StatusParcela: p.status,
        Pagamento: p.dataPagamento ? new Date(p.dataPagamento).toLocaleDateString('pt-BR') : '-'
      });
    });
  });

  const worksheet = utils.json_to_sheet(linhas);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, 'Financeiro');

  writeFile(workbook, nomeRelatorio('xlsx'));
}

// 👉 Exportar relatório em PDF
export async function exportarFinanceiroPDF(dados) {
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js');
  const { calcularTotaisFinanceiro } = await import('./financeiroTotais.js');

  const doc = new jsPDF();
  doc.text('Relatório Financeiro', 14, 16);

  const inicio = document.getElementById('fin-data-inicio').value;
  const fim = document.getElementById('fin-data-fim').value;
  if (inicio || fim) {
    doc.text(`Período: ${inicio || '-'} a ${fim || '-'}`, 14, 22);
  }

  const totais = calcularTotaisFinanceiro(dados);
  doc.text(`Total comprado: ${formatarPreco(totais.totalComprado)}`, 14, 30);
  doc.text(`Total pago: ${formatarPreco(totais.totalPago)}`, 14, 36);
  doc.text(`Total pendente: ${formatarPreco(totais.totalPendente)}`, 14, 42);
  doc.text(`Total vencido: ${formatarPreco(totais.totalVencido)}`, 14, 48);

  const linhas = [];
  dados.forEach(d => {
    const base = [
      d.compraId,
      d.fornecedorOuCliente,
      d.dataLancamento ? d.dataLancamento.toLocaleDateString('pt-BR') : '-',
      d.formaPagamento,
      formatarPreco(d.valor || 0)
    ];
    const parcelas = Array.isArray(d.parcelas) && d.parcelas.length > 0
      ? d.parcelas
      : [{ numero: 1, valor: d.valor, vencimento: d.dataVencimento, status: d.status, dataPagamento: d.dataPagamento }];
    parcelas.forEach(p => {
      linhas.push([
        ...base,
        p.numero,
        formatarPreco(p.valor || 0),
        p.vencimento ? new Date(p.vencimento).toLocaleDateString('pt-BR') : '-',
        p.status,
        p.dataPagamento ? new Date(p.dataPagamento).toLocaleDateString('pt-BR') : '-'
      ]);
    });
  });

  doc.autoTable({
    head: [[
      'CompraID','Fornecedor','Data','Forma','Valor compra','Parcela','Valor','Vencimento','Status','Pagamento'
    ]],
    body: linhas,
    startY: 54
  });

  doc.save(nomeRelatorio('pdf'));
}
