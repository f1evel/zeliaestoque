import { carregarDadosEntradas } from './entradasDados.js';
import { gerarTabelaEntradas, gerarFiltrosEntradas, limparFiltrosEntradas } from './entradasTabela.js';
import { exportarEntradasExcel } from './entradasExportar.js';
import { mostrarSpinner, esconderSpinner } from '../utils.js';

let dados = [];

export async function atualizarTabelaEntradas() {
  try {
    mostrarSpinner();
    dados = await carregarDadosEntradas();
    gerarTabelaEntradas(dados);
    gerarFiltrosEntradas(dados);
  } catch (e) {
    console.error('Erro ao carregar entradas:', e);
  } finally {
    esconderSpinner();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('botao-limpar-entradas')?.addEventListener('click', limparFiltrosEntradas);
  document.getElementById('botao-exportar-excel-entradas')?.addEventListener('click', () => exportarEntradasExcel(dados));
  atualizarTabelaEntradas();
});
