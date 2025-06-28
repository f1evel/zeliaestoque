export function atualizarCardsConsumo(dados) {
  const totalItens = dados.length;
  const totalCategorias = new Set(dados.map(d => d.categoria)).size;
  const totalFornecedores = new Set(dados.map(d => d.fornecedor)).size;
  const totalQuantidade = dados.reduce((acc, cur) => acc + cur.quantidade, 0);

  document.getElementById("card-consumo-itens").textContent = totalItens;
  document.getElementById("card-consumo-categorias").textContent = totalCategorias;
  document.getElementById("card-consumo-fornecedores").textContent = totalFornecedores;
  document.getElementById("card-consumo-quantidade").textContent = totalQuantidade.toLocaleString('pt-BR');
}
