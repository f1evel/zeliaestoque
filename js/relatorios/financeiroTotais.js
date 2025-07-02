// financeiroTotais.js — Cálculo e atualização dos cards

export function calcularTotaisFinanceiro(dados) {
  let totalComprado = 0;
  let totalPago = 0;
  let totalPendente = 0;
  let totalVencido = 0;

  const hoje = new Date();

  dados.forEach(d => {
    const parcelas = Array.isArray(d.parcelas) && d.parcelas.length > 0
      ? d.parcelas
      : [{ valor: d.valor, vencimento: d.dataVencimento, status: d.status }];

    parcelas.forEach(p => {
      const valor = Number(p.valor) || 0;
      totalComprado += valor;

      if (p.status === 'pago') {
        totalPago += valor;
      } else {
        const venc = p.vencimento ? new Date(p.vencimento) : null;
        if (venc && venc < hoje) {
          totalVencido += valor;
        } else {
          totalPendente += valor;
        }
      }
    });
  });

  return { totalComprado, totalPago, totalPendente, totalVencido };
}

export function atualizarCardsFinanceiro(dados) {
  const totais = calcularTotaisFinanceiro(dados);

  document.getElementById('total-comprado').textContent = `R$ ${totais.totalComprado.toFixed(2)}`;
  document.getElementById('total-pago').textContent = `R$ ${totais.totalPago.toFixed(2)}`;
  document.getElementById('total-pendente').textContent = `R$ ${totais.totalPendente.toFixed(2)}`;
  document.getElementById('total-vencido').textContent = `R$ ${totais.totalVencido.toFixed(2)}`;
}
