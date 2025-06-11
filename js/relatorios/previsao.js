// previsao.js — Controlador geral do módulo previsão

import { carregarDadosPrevisao } from './previsaoDados.js';
import { setDadosPrevisao, gerarTabelaPrevisao, dadosFiltradosPrevisao } from './previsaoTabela.js';
import { exportarPrevisaoCSV, exportarPrevisaoExcel } from './previsaoExportar.js';
import { mostrarSpinner, esconderSpinner } from '../utils.js';

let dadosPrevisao = [];

// 🔄 Atualizar tabela
export async function atualizarTabelaPrevisao() {
  try {
    mostrarSpinner();

    const periodoMeses = parseInt(document.getElementById("input-meses-previsao").value) || 3;
    dadosPrevisao = await carregarDadosPrevisao(periodoMeses);

    setDadosPrevisao(dadosPrevisao);
    gerarTabelaPrevisao();

  } catch (error) {
    console.error("❌ Erro ao atualizar previsão:", error);
  } finally {
    esconderSpinner();
  }
}

// 🧹 Limpar filtros
export function limparFiltrosPrevisao() {
  document.getElementById("input-meses-previsao").value = 3;
  document.getElementById("filtro-nome-previsao").value = "";
  gerarTabelaPrevisao();
}

// 🚀 Inicialização
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("botao-atualizar-previsao")?.addEventListener("click", atualizarTabelaPrevisao);
  document.getElementById("botao-limpar-previsao")?.addEventListener("click", limparFiltrosPrevisao);

  document.getElementById("botao-exportar-csv-previsao")?.addEventListener("click", () => {
    exportarPrevisaoCSV(dadosFiltradosPrevisao());
  });

  document.getElementById("botao-exportar-excel-previsao")?.addEventListener("click", () => {
    exportarPrevisaoExcel(dadosFiltradosPrevisao());
  });

  atualizarTabelaPrevisao();
});
