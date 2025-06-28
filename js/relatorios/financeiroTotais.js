// financeiroTotais.js — Cálculo e atualização dos cards

export function calcularTotaisFinanceiro(dados) {
  let totalPagar = 0;
  let pagos = 0;
  let recebidos = 0;

  dados.forEach(d => {
    if (d.tipo === "pagar") {
      totalPagar += d.valor;
      if (d.status === "pago") pagos += d.valor;
    }
    if (d.tipo === "receber") {
      if (d.status === "recebido") recebidos += d.valor;
    }
  });

  return { totalPagar, pagos, recebidos };
}

export function atualizarCardsFinanceiro(dados) {
  const totais = calcularTotaisFinanceiro(dados);

  document.getElementById("total-pagar").textContent = `R$ ${totais.totalPagar.toFixed(2)}`;
  document.getElementById("total-pagos").textContent = `R$ ${totais.pagos.toFixed(2)}`;
  document.getElementById("total-recebidos").textContent = `R$ ${totais.recebidos.toFixed(2)}`;
}
