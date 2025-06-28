// previsaoTotais.js — Atualiza os cards de totais da Previsão de Esgotamento

export function atualizarCardsPrevisao(dados) {
  const totalItens = dados.length;

  const itensEmRisco = dados.filter(d => 
    d.diasDeEstoque !== null && d.diasDeEstoque !== Infinity && d.diasDeEstoque <= 30
  ).length;

  const totalCategorias = new Set(
    dados.map(d => d.categoria).filter(c => c && c !== "-")
  ).size;

  const totalFornecedores = new Set(
    dados.map(d => d.fornecedor).filter(f => f && f !== "-")
  ).size;

  document.getElementById("card-previsao-itens").textContent = totalItens;
  document.getElementById("card-previsao-risco").textContent = itensEmRisco;
  document.getElementById("card-previsao-categorias").textContent = totalCategorias;
  document.getElementById("card-previsao-fornecedores").textContent = totalFornecedores;
}
