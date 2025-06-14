// financeiroTabela.js — Geração de tabela e filtros

import { normalizarTexto } from '../utils.js';
import { atualizarCardsFinanceiro } from './financeiroTotais.js';

let dados = [];
let filtrosIniciados = false;

// 🔥 Setar dados
export function setDadosFinanceiro(novosDados) {
  dados = novosDados;
}

// 🔍 Gerar filtros dinâmicos
export function gerarFiltrosFinanceiro() {
  const fornecedores = new Set();
  const formas = new Set();
  const compras = new Set();
  const statusParcelas = new Set();

  const selFornecedor = document.getElementById('fin-fornecedor').value;
  const selForma = document.getElementById('fin-forma').value;
  const selStatus = document.getElementById('fin-status').value;

  dados.forEach(d => {
    if (d.fornecedorOuCliente) fornecedores.add(d.fornecedorOuCliente);
    if (d.formaPagamento) formas.add(d.formaPagamento);
    if (d.compraId) compras.add(d.compraId);
    if (d.statusParcelas) statusParcelas.add(d.statusParcelas);
  });

  document.getElementById('fin-fornecedor').innerHTML =
    `<option value="">Fornecedor</option>` +
    [...fornecedores].sort().map(f => `<option value="${f}">${f}</option>`).join('');

  document.getElementById('fin-forma').innerHTML =
    `<option value="">Forma</option>` +
    [...formas].sort().map(f => `<option value="${f}">${f}</option>`).join('');

  document.getElementById('fin-status').innerHTML =
    `<option value="">Status</option>` +
    [...statusParcelas].sort().map(s => `<option value="${s}">${s}</option>`).join('');

  document.getElementById('lista-compra-fin').innerHTML =
    [...compras].sort().map(c => `<option value="${c}">`).join('');

  document.getElementById('fin-fornecedor').value = selFornecedor;
  document.getElementById('fin-forma').value = selForma;
  document.getElementById('fin-status').value = selStatus;

  if (!filtrosIniciados) {
    ['fin-fornecedor','fin-forma','fin-status','fin-compra-id','fin-data-inicio','fin-data-fim']
      .forEach(id => {
        document.getElementById(id)?.addEventListener('input', gerarTabelaFinanceiro);
      });
    filtrosIniciados = true;
  }
}

// 📊 Renderizar Tabela
export function gerarTabelaFinanceiro() {
  const lista = document.getElementById("tabela-financeiro");

  const fornecedorFiltro = document.getElementById('fin-fornecedor').value;
  const formaFiltro = document.getElementById('fin-forma').value;
  const compraFiltro = document.getElementById('fin-compra-id').value.trim();
  const statusFiltro = document.getElementById('fin-status').value;
  const inicio = document.getElementById('fin-data-inicio').value;
  const fim = document.getElementById('fin-data-fim').value;
  const inicioData = inicio ? new Date(inicio) : null;
  const fimData = fim ? new Date(fim) : null;

  const filtrados = dados.filter(d => {
    const fornMatch = fornecedorFiltro === '' || d.fornecedorOuCliente === fornecedorFiltro;
    const formaMatch = formaFiltro === '' || d.formaPagamento === formaFiltro;
    const compraMatch = compraFiltro === '' || d.compraId === compraFiltro;
    const statusMatch = statusFiltro === '' || d.statusParcelas === statusFiltro;

    let vencMatch = true;
    if (inicioData || fimData) {
      const vencs = [];
      if (Array.isArray(d.parcelas)) {
        d.parcelas.forEach(p => {
          if (p.vencimento) vencs.push(new Date(p.vencimento));
        });
      }
      if (vencs.length === 0 && d.dataVencimento) vencs.push(new Date(d.dataVencimento));
      vencMatch = vencs.some(v => {
        if (!v || isNaN(v)) return false;
        if (inicioData && v < inicioData) return false;
        if (fimData && v > fimData) return false;
        return true;
      });
    }

    return fornMatch && formaMatch && compraMatch && statusMatch && vencMatch;
  });

  if (filtrados.length === 0) {
    lista.innerHTML = "<p>❌ Nenhum dado encontrado.</p>";
    atualizarCardsFinanceiro([]);
    return;
  }

  let html = `
    <table class="tabela">
      <thead>
        <tr>
          <th>CompraID</th>
          <th>Fornecedor</th>
          <th>Data da compra</th>
          <th>Forma de pagamento</th>
          <th>Valor total</th>
          <th>Parcelas</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtrados.forEach(d => {
    const lanc = d.dataLancamento?.toLocaleDateString('pt-BR') || '-';
    html += `
      <tr>
        <td>${d.compraId}</td>
        <td>${d.fornecedorOuCliente}</td>
        <td>${lanc}</td>
        <td>${d.formaPagamento}</td>
        <td>R$ ${(d.valor).toFixed(2)}</td>
        <td>
          ${d.parcelas.length} (${d.statusParcelas})
          <button onclick="abrirModalParcelas('${d.compraId}')">Ver</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  lista.innerHTML = html;

  atualizarCardsFinanceiro(filtrados);
}
