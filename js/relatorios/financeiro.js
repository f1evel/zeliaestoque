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

    dadosFinanceiro = await carregarDadosFinanceiro();

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
  document.getElementById('fin-data-inicio').value = '';
  document.getElementById('fin-data-fim').value = '';
  document.getElementById('fin-compra-id').value = '';
  document.getElementById('fin-fornecedor').value = '';
  document.getElementById('fin-forma').value = '';
  document.getElementById('fin-status').value = '';

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

// 📑 Modal de parcelas
window.abrirModalParcelas = function (compraId) {
  const registro = dadosFinanceiro.find(d => d.compraId === compraId);
  if (!registro) return;

  document.getElementById('modal-compra-id').textContent = compraId;
  const cont = document.getElementById('parcelas-detalhes');

  if (!registro.parcelas || registro.parcelas.length === 0) {
    cont.innerHTML = '<p>Sem parcelas cadastradas.</p>';
  } else {
    let html = `<table class="tabela"><thead><tr><th>#</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>`;
    registro.parcelas.forEach(p => {
      const venc = p.vencimento ? new Date(p.vencimento).toLocaleDateString('pt-BR') : '-';
      html += `<tr><td>${p.numero}</td><td>R$ ${(p.valor || 0).toFixed(2)}</td><td>${venc}</td><td>${p.status}</td></tr>`;
    });
    html += '</tbody></table>';
    cont.innerHTML = html;
  }

  document.getElementById('modal-parcelas').style.display = 'block';
  document.getElementById('fundo-modal-parcelas').style.display = 'block';
};

window.fecharModalParcelas = function () {
  document.getElementById('modal-parcelas').style.display = 'none';
  document.getElementById('fundo-modal-parcelas').style.display = 'none';
};
