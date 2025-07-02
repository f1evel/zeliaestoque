// financeiroProjecao.js — Projeção de pagamentos futuros
import { carregarDadosFinanceiro } from './financeiroDados.js';
import { mostrarSpinner, esconderSpinner } from '../utils.js';

let grafico = null;

function formatarMes(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number);
  const d = new Date(ano, mes - 1, 1);
  return `${('0' + (d.getMonth() + 1)).slice(-2)}/${d.getFullYear()}`;
}

function gerarTabela(projecoes) {
  const cont = document.getElementById('tabela-projecao');
  if (!cont) return;

  if (projecoes.length === 0) {
    cont.innerHTML = '<p>❌ Nenhuma parcela pendente encontrada.</p>';
    return;
  }

  let html = `<table class="tabela"><thead><tr><th>Mês</th><th>Valor Total Previsto</th></tr></thead><tbody>`;
  projecoes.forEach(p => {
    html += `<tr><td>${formatarMes(p.mes)}</td><td>R$ ${p.valor.toFixed(2)}</td></tr>`;
  });
  html += '</tbody></table>';
  cont.innerHTML = html;
}

function gerarGrafico(projecoes) {
  const canvas = document.getElementById('grafico-projecao');
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');
  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: projecoes.map(p => formatarMes(p.mes)),
      datasets: [{
        label: 'Valor previsto',
        data: projecoes.map(p => p.valor),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Projeção de Pagamentos Futuros' }
      },
      scales: { y: { beginAtZero: true } }
    }
  });
}

async function atualizarProjecao() {
  try {
    mostrarSpinner();
    const dados = await carregarDadosFinanceiro();
    const mapa = {};
    dados.forEach(d => {
      const parcelas = Array.isArray(d.parcelas) && d.parcelas.length > 0
        ? d.parcelas
        : [{ valor: d.valor, vencimento: d.dataVencimento, status: d.status }];
      parcelas.forEach(p => {
        if (p.status === 'pago') return;
        const venc = p.vencimento ? new Date(p.vencimento) : null;
        if (!venc || isNaN(venc)) return;
        const chave = `${venc.getFullYear()}-${('0'+(venc.getMonth()+1)).slice(-2)}`;
        mapa[chave] = (mapa[chave] || 0) + (Number(p.valor) || 0);
      });
    });
    const projecoes = Object.keys(mapa).sort().map(m => ({ mes: m, valor: mapa[m] }));
    gerarTabela(projecoes);
    gerarGrafico(projecoes);
  } catch (e) {
    console.error('Erro ao gerar projeção de pagamentos', e);
  } finally {
    esconderSpinner();
  }
}

document.addEventListener('DOMContentLoaded', atualizarProjecao);

