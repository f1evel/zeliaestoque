import { carregarDadosEntradas } from './entradasDados.js';
import { carregarDadosConsumo } from './consumoDados.js';
import { parseDataLocal, normalizarTexto, formatarPreco } from '../utils.js';

let entradas = [];
let saidas = [];
let grafico = null;

export async function carregarOperacoes() {
  entradas = await carregarDadosEntradas();
  saidas = await carregarDadosConsumo();
}

function filtrar(lista, inicio, fim, categoria, fornecedor) {
  const catNorm = normalizarTexto(categoria);
  const fornNorm = normalizarTexto(fornecedor);
  return lista.filter(item => {
    const data = item.data;
    if (inicio && data && data < inicio) return false;
    if (fim && data && data > fim) return false;
    if (categoria && normalizarTexto(item.categoria) !== catNorm) return false;
    if (fornecedor && normalizarTexto(item.fornecedor) !== fornNorm) return false;
    return true;
  });
}

function formatarMes(chave) {
  const [ano, mes] = chave.split('-');
  return `${mes}/${ano}`;
}

function gerarGrafico(entradasFiltradas, saidasFiltradas) {
  const canvas = document.getElementById('grafico-operacoes');
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');
  if (grafico) grafico.destroy();

  const mesesSet = new Set();
  entradasFiltradas.forEach(e => {
    if (e.data) mesesSet.add(`${e.data.getFullYear()}-${String(e.data.getMonth()+1).padStart(2,'0')}`);
  });
  saidasFiltradas.forEach(s => {
    if (s.data) mesesSet.add(`${s.data.getFullYear()}-${String(s.data.getMonth()+1).padStart(2,'0')}`);
  });
  const meses = Array.from(mesesSet).sort();

  const dadosEntradas = meses.map(m =>
    entradasFiltradas
      .filter(e => e.data && `${e.data.getFullYear()}-${String(e.data.getMonth() + 1).padStart(2, '0')}` === m)
      .reduce((a, c) => a + (c.quantidade || 0) * (c.preco || 0), 0)
  );
  const dadosSaidas = meses.map(m =>
    saidasFiltradas
      .filter(s => s.data && `${s.data.getFullYear()}-${String(s.data.getMonth() + 1).padStart(2, '0')}` === m)
      .reduce((a, c) => a + (c.custoTotal || (c.quantidade || 0) * (c.precoUnitario || 0)), 0)
  );

  grafico = new Chart(ctx, {
    type: 'line',
    data: {
      labels: meses.map(formatarMes),
      datasets: [
        {
          label: 'Entradas',
          data: dadosEntradas,
          borderColor: '#3b82f6',
          backgroundColor: 'transparent',
          tension: 0.2,
          pointRadius: 3
        },
        {
          label: 'Saídas',
          data: dadosSaidas,
          borderColor: '#ef4444',
          backgroundColor: 'transparent',
          tension: 0.2,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, title: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 12 } } },
        y: { beginAtZero: true, grid: { color: '#e5e7eb' }, ticks: { color: '#6b7280', font: { size: 12 } } }
      }
    }
  });
}

export function atualizarOperacoesPeriodo() {
  const inicioStr = document.getElementById('fin-data-inicio').value;
  const fimStr = document.getElementById('fin-data-fim').value;
  const categoria = document.getElementById('fin-categoria-prod').value;
  const fornecedor = document.getElementById('fin-fornecedor').value;
  const inicio = inicioStr ? parseDataLocal(inicioStr) : null;
  const fim = fimStr ? parseDataLocal(fimStr) : null;

  const entradasFiltradas = filtrar(entradas, inicio, fim, categoria, fornecedor);
  const saidasFiltradas = filtrar(saidas, inicio, fim, categoria, fornecedor);

  const valorCompras = entradasFiltradas.reduce((s,e) => s + (e.quantidade || 0)*(e.preco || 0), 0);
  const valorSaidas = saidasFiltradas.reduce((s,sai) => s + (sai.custoTotal || (sai.quantidade || 0)*(sai.precoUnitario || 0)), 0);

  document.getElementById('valor-gasto-compras').textContent = formatarPreco(valorCompras);
  document.getElementById('valor-total-saidas').textContent = formatarPreco(valorSaidas);

  gerarGrafico(entradasFiltradas, saidasFiltradas);
}

// Inicializa ao carregar a página
document.addEventListener('DOMContentLoaded', async () => {
  await carregarOperacoes();
  atualizarOperacoesPeriodo();
});
