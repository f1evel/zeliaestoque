import { carregarDadosSaidas } from './saidasDados.js';
import { gerarTabelaSaidas, gerarFiltrosSaidas, limparFiltrosSaidas } from './saidasTabela.js';
import { exportarSaidasExcel } from './saidasExportar.js';
import { mostrarSpinner, esconderSpinner } from '../utils.js';

let dados = [];

export async function atualizarTabelaSaidas() {
  try {
    mostrarSpinner();
    dados = await carregarDadosSaidas();
    gerarTabelaSaidas(dados);
    gerarFiltrosSaidas(dados);
  } catch (e) {
    console.error('Erro ao carregar saídas:', e);
  } finally {
    esconderSpinner();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('botao-limpar-saidas')?.addEventListener('click', limparFiltrosSaidas);
  document.getElementById('botao-exportar-excel-saidas')?.addEventListener('click', () => exportarSaidasExcel(dados));
  atualizarTabelaSaidas();
});
