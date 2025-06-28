// estoqueTotais.js — Atualização dos cards

export function atualizarCardsEstoque(dados) {
  const diasValidade = parseInt(document.getElementById("input-dias-val").value) || 15;
  const totalAlertas = dados.filter(d =>
    d.quantidade <= d.quantidadeMinima ||
    (d.diasParaVencer !== null && d.diasParaVencer <= diasValidade)
  ).length;
  document.getElementById("card-estoque-alerta").textContent = totalAlertas;
}
