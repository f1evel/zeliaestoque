// consumoGraficos.js
let grafico = null;

export function gerarGraficoConsumo(dados) {
  const canvas = document.getElementById('grafico-consumo');
  if (!canvas) {
    console.warn("⚠️ Canvas 'grafico-consumo' não encontrado.");
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx || typeof Chart === 'undefined') {
    console.warn("⚠️ Chart.js não está disponível ou contexto 2D inválido.");
    return;
  }

  if (grafico) grafico.destroy();

  const categorias = {};
  dados.forEach(d => {
    categorias[d.categoria] = (categorias[d.categoria] || 0) + d.quantidade;
  });

  grafico = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(categorias),
      datasets: [{
        label: 'Consumo por Categoria',
        data: Object.values(categorias),
        backgroundColor: 'rgba(0, 150, 136, 0.5)',
        borderColor: 'rgba(0, 150, 136, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Consumo por Categoria',
          padding: 10,
          font: { size: 16 }
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}
