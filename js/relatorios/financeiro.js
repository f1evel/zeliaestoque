// financeiro.js — Controlador geral do módulo financeiro

import { carregarDadosFinanceiro } from './financeiroDados.js';
import { setDadosFinanceiro, gerarFiltrosFinanceiro, gerarTabelaFinanceiro } from './financeiroTabela.js';
import { atualizarCardsFinanceiro } from './financeiroTotais.js';
import { exportarFinanceiroCSV, exportarFinanceiroExcel } from './financeiroExportar.js';
import { mostrarSpinner, esconderSpinner } from '../utils.js';

let dadosFinanceiro = [];

// 🔄 Atualizar tudo
export async function atualizarTabelaFinanceiro() {
  try {
    mostrarSpinner();

    const periodoMeses = parseInt(document.getElementById("input-meses-fin")?.value) || 3;
    dadosFinanceiro = await carregarDadosFinanceiro(periodoMeses);

    setDadosFinanceiro(dadosFinanceiro);
    gerarFiltrosFinanceiro();
    gerarTabelaFinanceiro();
    atualizarCardsFinanceiro(dadosFinanceiro);

  } catch (error) {
    console.error("❌ Erro ao atualizar financeiro:", error);
  } finally {
    esconderSpinner();
  }
}

// 🧹 Limpar filtros
export function limparFiltrosFinanceiro() {
  document.getElementById("input-meses-fin").value = 3;
  document.getElementById("filtro-descricao").value = "";
  document.getElementById("filtro-categoria-fin").value = "";
  document.getElementById("filtro-status-fin").value = "";
  document.getElementById("filtro-mes-fin").value = "";

  gerarTabelaFinanceiro();
}

// 🚀 Executa na carga da página
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("botao-atualizar-fin")?.addEventListener("click", atualizarTabelaFinanceiro);
  document.getElementById("botao-limpar-fin")?.addEventListener("click", limparFiltrosFinanceiro);

  document.getElementById("botao-exportar-csv-fin")?.addEventListener("click", () => {
    exportarFinanceiroCSV(dadosFinanceiro);
  });

  document.getElementById("botao-exportar-excel-fin")?.addEventListener("click", () => {
    exportarFinanceiroExcel(dadosFinanceiro);
  });

  atualizarTabelaFinanceiro();
});
