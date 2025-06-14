// previsao.js — Controlador geral do módulo previsão

import { carregarDadosPrevisao } from './previsaoDados.js';
import { setDadosPrevisao, gerarTabelaPrevisao, dadosFiltradosPrevisao, gerarFiltrosPrevisao } from './previsaoTabela.js';
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
    gerarFiltrosPrevisao();
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
  document.getElementById("filtro-categoria-previsao").value = "";
  document.getElementById("check-apenas-critico").checked = false;
  document.getElementById("input-limite-previsao").value = 30;
  gerarTabelaPrevisao();
}

// 🚀 Inicialização
function initPrevisao() {
  document.getElementById("botao-atualizar-previsao")?.addEventListener("click", atualizarTabelaPrevisao);
  document.getElementById("botao-limpar-previsao")?.addEventListener("click", limparFiltrosPrevisao);

  ["filtro-nome-previsao","filtro-categoria-previsao","check-apenas-critico","input-limite-previsao"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", gerarTabelaPrevisao);
  });

  document.getElementById("botao-exportar-csv-previsao")?.addEventListener("click", () => {
    exportarPrevisaoCSV(dadosFiltradosPrevisao());
  });

  document.getElementById("botao-exportar-excel-previsao")?.addEventListener("click", () => {
    exportarPrevisaoExcel(dadosFiltradosPrevisao());
  });

  document.getElementById("botao-exportar-filtrado-previsao")?.addEventListener("click", () => {
    exportarPrevisaoExcel(dadosFiltradosPrevisao());
  });

  atualizarTabelaPrevisao();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPrevisao);
} else {
  initPrevisao();
}

// placeholder para solicitar reposição
window.solicitarReposicao = function(id) {
  alert(`Solicitar reposição para produto ${id}`);
};
