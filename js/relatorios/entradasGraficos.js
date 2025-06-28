let grafico = null;

export function gerarGraficoEntradas(dados) {
  const canvas = document.getElementById('grafico-entradas');
  if (!canvas) {
    console.warn('⚠️ Canvas do gráfico de entradas não encontrado.');
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof Chart === 'undefined') {
    console.warn('⚠️ Chart.js não está disponível ou contexto inválido.');
    return;
  }

  if (grafico) grafico.destroy();

  const mensal = {};
  dados.forEach(d => {
    if (d.data instanceof Date) {
      const mes = `${d.data.getFullYear()}-${String(d.data.getMonth() + 1).padStart(2, '0')}`;
      mensal[mes] = (mensal[mes] || 0) + (d.quantidade || 0);
    }
  });
  const meses = Object.keys(mensal).sort();
  const quantidades = meses.map(m => mensal[m]);

  grafico = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: meses,
      datasets: [{
        label: 'Entradas',
        data: quantidades,
        backgroundColor: 'rgba(0,150,136,0.5)',
        borderColor: 'rgba(0,150,136,1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Entradas por Mês' }
      },
      scales: { y: { beginAtZero: true } }
    }
  });
}
