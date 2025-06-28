// consumoGraficos.js — gráficos do relatório de consumo
let graficoMes = null;
let graficoCategoria = null;

export function gerarGraficoConsumo(dados) {
  const canvasMes = document.getElementById('grafico-consumo-mes');
  const canvasCat = document.getElementById('grafico-consumo-categoria');
  if (!canvasMes || !canvasCat) {
    console.warn('⚠️ Canvas do gráfico de consumo não encontrado.');
    return;
  }
  const ctxMes = canvasMes.getContext('2d');
  const ctxCat = canvasCat.getContext('2d');
  if (!ctxMes || !ctxCat || typeof Chart === 'undefined') {
    console.warn('⚠️ Chart.js não está disponível ou contexto 2D inválido.');
    return;
  }

  if (graficoMes) graficoMes.destroy();
  if (graficoCategoria) graficoCategoria.destroy();

  // Totais por mês (YYYY-MM)
  const mensal = {};
  dados.forEach(d => {
    if (d.mes) mensal[d.mes] = (mensal[d.mes] || 0) + d.quantidade;
  });

  const mesesOrdenados = Object.keys(mensal).sort();
  const quantidadesMes = mesesOrdenados.map(m => mensal[m]);
  const variacoes = quantidadesMes.map((v, i, arr) => i === 0 ? 0 : v - arr[i - 1]);

  graficoMes = new Chart(ctxMes, {
    type: 'bar',
    data: {
      labels: mesesOrdenados,
      datasets: [{
        label: 'Consumo',
        data: quantidadesMes,
        backgroundColor: 'rgba(0,150,136,0.5)',
        borderColor: 'rgba(0,150,136,1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Consumo por Mês' },
        tooltip: {
          callbacks: {
            afterLabel: ctx => {
              const diff = variacoes[ctx.dataIndex];
              if (ctx.dataIndex === 0) return '';
              const sinal = diff >= 0 ? '+' : '';
              return `Variação: ${sinal}${diff}`;
            }
          }
        }
      },
      scales: { y: { beginAtZero: true } }
    }
  });

  // Totais por categoria
  const categorias = {};
  dados.forEach(d => {
    categorias[d.categoria] = (categorias[d.categoria] || 0) + d.quantidade;
  });
  const cores = Object.keys(categorias).map((_, i, arr) => `hsl(${i * 360 / arr.length},70%,60%)`);

  graficoCategoria = new Chart(ctxCat, {
    type: 'pie',
    data: {
      labels: Object.keys(categorias),
      datasets: [{
        label: 'Consumo por Categoria',
        data: Object.values(categorias),
        backgroundColor: cores
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Consumo por Categoria' }
      }
    }
  });
}
