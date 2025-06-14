// estoque.js — Controlador geral do módulo estoque

import { carregarDadosEstoque } from './estoqueDados.js';
import { setDadosEstoque, gerarTabelaEstoque, dadosFiltradosEstoque } from './estoqueTabela.js';
import { exportarEstoqueCSV, exportarEstoqueExcel } from './estoqueExportar.js';
import { atualizarCardsEstoque } from './estoqueTotais.js';
import { mostrarSpinner, esconderSpinner } from '../utils.js';

let dadosEstoque = [];

// 🔄 Atualizar tabela
export async function atualizarTabelaEstoque() {
  try {
    mostrarSpinner();

    const diasValidade = parseInt(document.getElementById("input-dias-val").value) || 15;
    dadosEstoque = await carregarDadosEstoque(diasValidade);

    setDadosEstoque(dadosEstoque);
    gerarTabelaEstoque();
    atualizarCardsEstoque(dadosFiltradosEstoque());

  } catch (error) {
    console.error("❌ Erro ao atualizar estoque:", error);
  } finally {
    esconderSpinner();
  }
}

// 🧹 Limpar filtros
export function limparFiltrosEstoque() {
  document.getElementById("filtro-nome-estoque").value = "";
  document.getElementById("input-dias-val").value = 15;
  document.getElementById("filtro-alerta-tipo").value = "todos";
  document.getElementById("filtro-categoria-estoque").value = "";
  document.getElementById("filtro-fornecedor-estoque").value = "";
  document.getElementById("filtro-lote-ativo").checked = false;
  gerarTabelaEstoque();
  atualizarCardsEstoque(dadosFiltradosEstoque());
}

// 🚀 Inicialização
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("botao-atualizar-estoque")?.addEventListener("click", atualizarTabelaEstoque);
  document.getElementById("botao-limpar-estoque")?.addEventListener("click", limparFiltrosEstoque);

  document.getElementById("botao-exportar-csv-estoque")?.addEventListener("click", () => {
    exportarEstoqueCSV(dadosFiltradosEstoque());
  });

  document.getElementById("botao-exportar-excel-estoque")?.addEventListener("click", () => {
    exportarEstoqueExcel(dadosFiltradosEstoque());
  });

  document.getElementById("botao-gerar-pedido")?.addEventListener("click", () => {
    const itens = dadosFiltradosEstoque();
    localStorage.setItem("carrinhoReposicao", JSON.stringify(itens));
    alert(`Pedido gerado com ${itens.length} itens.`);
  });

  atualizarTabelaEstoque();
});
