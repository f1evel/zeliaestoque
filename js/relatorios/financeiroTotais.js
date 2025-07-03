// financeiroTotais.js — Cálculo e atualização dos cards
import { formatarPreco } from '../utils.js';

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

  document.getElementById('total-comprado').textContent = formatarPreco(totais.totalComprado);
  document.getElementById('total-pago').textContent = formatarPreco(totais.totalPago);
  document.getElementById('total-pendente').textContent = formatarPreco(totais.totalPendente);
  document.getElementById('total-vencido').textContent = formatarPreco(totais.totalVencido);
}
