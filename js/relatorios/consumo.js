import { carregarDadosConsumo } from './consumoDados.js';
import { gerarTabelaConsumo, gerarFiltrosConsumo } from './consumoTabela.js';
import { exportarConsumoCSV, exportarConsumoExcel, exportarConsumoPDF } from './consumoExportar.js';
import { atualizarCardsConsumo } from './consumoTotais.js';
import { gerarGraficoConsumo } from './consumoGraficos.js';
import { mostrarSpinner, esconderSpinner } from '../utils.js';

let dados = [];

export async function atualizarTabelaConsumo() {
  try {
    mostrarSpinner();
    dados = await carregarDadosConsumo();
    gerarTabelaConsumo(dados);
    gerarFiltrosConsumo(dados);
    atualizarCardsConsumo(dados);
    gerarGraficoConsumo(dados);
  } catch (e) {
    console.error("❌ Erro ao carregar dados de consumo:", e);
  } finally {
    esconderSpinner();
  }
}

export function limparFiltrosConsumo() {
  document.getElementById("filtro-nome-consumo").value = "";
  document.getElementById("filtro-categoria-consumo").value = "";
  document.getElementById("filtro-fornecedor-consumo").value = "";
  document.getElementById("filtro-mes-consumo").value = "";
  atualizarTabelaConsumo();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById("botao-atualizar-consumo").addEventListener("click", atualizarTabelaConsumo);
  document.getElementById("botao-limpar-consumo").addEventListener("click", limparFiltrosConsumo);
  document.getElementById("botao-exportar-csv-consumo").addEventListener("click", () => exportarConsumoCSV(dados));
  document.getElementById("botao-exportar-excel-consumo").addEventListener("click", () => exportarConsumoExcel(dados));
  document.getElementById("botao-exportar-pdf-consumo").addEventListener("click", () => exportarConsumoPDF(dados));

  atualizarTabelaConsumo();
});
