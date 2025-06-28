import { carregarDadosEntradas } from './entradasDados.js';
import { gerarTabelaEntradas, gerarFiltrosEntradas, limparFiltrosEntradas } from './entradasTabela.js';
import { exportarEntradasExcel, exportarEntradasPDF } from './entradasExportar.js';
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
  document.getElementById('botao-exportar-pdf-entradas')?.addEventListener('click', () => exportarEntradasPDF(dados));
  atualizarTabelaEntradas();
});

// Modal de detalhes da entrada
window.abrirModalDetalhesEntrada = function(id) {
  const registro = dados.find(d => d.id === id);
  if (!registro) return;

  document.getElementById('detalhes-data').textContent = registro.data ? registro.data.toLocaleDateString('pt-BR') : '-';
  document.getElementById('detalhes-produto').textContent = registro.nome;
  document.getElementById('detalhes-quantidade').textContent = registro.quantidade;
  document.getElementById('detalhes-validade').textContent = registro.validade ? registro.validade.toLocaleDateString('pt-BR') : '-';
  document.getElementById('detalhes-fornecedor').textContent = registro.fornecedor;
  document.getElementById('detalhes-observacoes').textContent = registro.observacao || '-';
  document.getElementById('detalhes-id').textContent = registro.id;

  document.getElementById('modal-detalhes-entrada').style.display = 'block';
  document.getElementById('fundo-modal-detalhes-entrada').style.display = 'block';
};

window.fecharModalDetalhesEntrada = function() {
  document.getElementById('modal-detalhes-entrada').style.display = 'none';
  document.getElementById('fundo-modal-detalhes-entrada').style.display = 'none';
};
