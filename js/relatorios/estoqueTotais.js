// estoqueTotais.js — Atualização dos cards

export function atualizarCardsEstoque(dados) {
  const totalAlertas = dados.length;
  document.getElementById("card-estoque-alerta").textContent = totalAlertas;
}
