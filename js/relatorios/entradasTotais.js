export function atualizarCardsEntradas(dados) {
  const totalQuantidade = dados.reduce((acc, cur) => acc + (cur.quantidade || 0), 0);
  const totalValor = dados.reduce((acc, cur) => acc + (cur.quantidade || 0) * (cur.preco || 0), 0);
  const custoMedio = totalQuantidade ? totalValor / totalQuantidade : 0;

  document.getElementById('card-entradas-quantidade').textContent = totalQuantidade.toLocaleString('pt-BR');
  document.getElementById('card-entradas-valor').textContent = totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const custoEl = document.getElementById('card-entradas-custo');
  if (custoEl) {
    custoEl.textContent = custoMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
