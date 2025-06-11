// financeiroGraficos.js — Gera gráfico para o relatório de Financeiro

let grafico = null;

export function gerarGraficoFinanceiro(dados) {
  const ctx = document.getElementById('grafico-financeiro').getContext('2d');
  if (grafico) grafico.destroy();

  const categorias = {};
  dados.forEach(d => {
    categorias[d.categoria] = (categorias[d.categoria] || 0) + (d.valor || d.quantidade || 0);
  });

  grafico = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(categorias),
      datasets: [{
        label: 'Lançamentos por Categoria',
        data: Object.values(categorias),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Lançamentos por Categoria' }
      }
    }
  });
}