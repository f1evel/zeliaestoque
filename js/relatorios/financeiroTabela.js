// financeiroTabela.js — Geração de tabela e filtros

import { normalizarTexto, parseDataLocal } from '../utils.js';
import { atualizarCardsFinanceiro } from './financeiroTotais.js';
import { gerarTabelaFinanceiroCategorias } from './financeiroCategorias.js';

let dados = [];
let filtrosIniciados = false;

function formatarResumoParcelas(parcelas = []) {
  if (!Array.isArray(parcelas) || parcelas.length === 0) return '-';
  const total = parcelas.length;
  const hoje = new Date();
  return parcelas
    .sort((a, b) => (a.numero || 0) - (b.numero || 0))
    .map(p => {
      let status = 'pendente';
      if (p.status === 'pago') status = 'pago';
      else if (p.vencimento && new Date(p.vencimento) < hoje) status = 'vencida';
      const icone = status === 'pago' ? '✅' : status === 'vencida' ? '❌' : '⚠️';
      return `${p.numero}/${total} – R$ ${(Number(p.valor) || 0).toFixed(2)} – ${icone} ${status}`;
    })
    .join('<br>');
}

function calcularValorAberto(registro) {
  const parcelas = Array.isArray(registro.parcelas) && registro.parcelas.length > 0
    ? registro.parcelas
    : [{ valor: registro.valor, status: registro.status }];
  return parcelas.reduce((s, p) => {
    const v = Number(p.valor) || 0;
    return p.status === 'pago' ? s : s + v;
  }, 0);
}

// 🔥 Setar dados
export function setDadosFinanceiro(novosDados) {
  dados = novosDados;
}

// 🔍 Obter dados conforme filtros aplicados
export function dadosFiltradosFinanceiro() {
  const fornecedorFiltro = document.getElementById('fin-fornecedor').value;
  const formaFiltro = document.getElementById('fin-forma').value;
  const compraFiltro = document.getElementById('fin-compra-id').value.trim();
  const statusFiltro = document.getElementById('fin-status').value;
  const catProdFiltro = document.getElementById('fin-categoria-prod').value;
  const inicio = document.getElementById('fin-data-inicio').value;
  const fim = document.getElementById('fin-data-fim').value;
  const inicioData = inicio ? parseDataLocal(inicio) : null;
  const fimData = fim ? parseDataLocal(fim) : null;

  return dados.filter(d => {
    const fornMatch = fornecedorFiltro === '' || d.fornecedorOuCliente === fornecedorFiltro;
    const formaMatch = formaFiltro === '' || d.formaPagamento === formaFiltro;
    const compraMatch = compraFiltro === '' || d.compraId === compraFiltro;
    const statusMatch = statusFiltro === '' || d.statusParcelas === statusFiltro;
    const catProdMatch = catProdFiltro === '' || (Array.isArray(d.categoriasProdutos) && d.categoriasProdutos.includes(catProdFiltro));

    let vencMatch = true;
    if (inicioData || fimData) {
      const vencs = [];
      if (Array.isArray(d.parcelas)) {
        d.parcelas.forEach(p => {
          if (p.vencimento) vencs.push(parseDataLocal(p.vencimento));
        });
      }
      if (vencs.length === 0 && d.dataVencimento) vencs.push(parseDataLocal(d.dataVencimento));
      vencMatch = vencs.some(v => {
        if (!v || isNaN(v)) return false;
        if (inicioData && v < inicioData) return false;
        if (fimData && v > fimData) return false;
        return true;
      });
    }

    return fornMatch && formaMatch && compraMatch && statusMatch && catProdMatch && vencMatch;
  });
}

// 🔍 Gerar filtros dinâmicos
export function gerarFiltrosFinanceiro() {
  const fornecedores = new Set();
  const formas = new Set();
  const compras = new Set();
  const statusParcelas = new Set();
  const categoriasProd = new Set();

  const selFornecedor = document.getElementById('fin-fornecedor').value;
  const selForma = document.getElementById('fin-forma').value;
  const selStatus = document.getElementById('fin-status').value;
  const selCatProd = document.getElementById('fin-categoria-prod').value;

  dados.forEach(d => {
    if (d.fornecedorOuCliente) fornecedores.add(d.fornecedorOuCliente);
    if (d.formaPagamento) formas.add(d.formaPagamento);
    if (d.compraId) compras.add(d.compraId);
    if (d.statusParcelas) statusParcelas.add(d.statusParcelas);
    if (Array.isArray(d.categoriasProdutos)) d.categoriasProdutos.forEach(c => categoriasProd.add(c));
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

  document.getElementById('fin-categoria-prod').innerHTML =
    `<option value="">Categoria prod.</option>` +
    [...categoriasProd].sort().map(c => `<option value="${c}">${c}</option>`).join('');

  document.getElementById('lista-compra-fin').innerHTML =
    [...compras].sort().map(c => `<option value="${c}">`).join('');

  document.getElementById('fin-fornecedor').value = selFornecedor;
  document.getElementById('fin-forma').value = selForma;
  document.getElementById('fin-status').value = selStatus;
  document.getElementById('fin-categoria-prod').value = selCatProd;

  if (!filtrosIniciados) {
    ['fin-fornecedor','fin-forma','fin-status','fin-categoria-prod','fin-compra-id','fin-data-inicio','fin-data-fim']
      .forEach(id => {
        document.getElementById(id)?.addEventListener('input', gerarTabelaFinanceiro);
      });
    filtrosIniciados = true;
  }
}

// 📊 Renderizar Tabela
export function gerarTabelaFinanceiro() {
  const lista = document.getElementById("tabela-financeiro");

  const filtrados = dadosFiltradosFinanceiro();

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
          <th>Valor em aberto</th>
          <th>Parcelas</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtrados.forEach(d => {
    const lanc = d.dataLancamento?.toLocaleDateString('pt-BR') || '-';
    const aberto = calcularValorAberto(d);
    html += `
      <tr>
        <td>${d.compraId}</td>
        <td>${d.fornecedorOuCliente}</td>
        <td>${lanc}</td>
        <td>${d.formaPagamento}</td>
        <td>R$ ${(d.valor).toFixed(2)}</td>
        <td class="valor-aberto">R$ ${aberto.toFixed(2)}</td>
        <td>
          ${formatarResumoParcelas(d.parcelas)}<br>
          <button onclick="abrirModalParcelas('${d.compraId}')">Ver</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  lista.innerHTML = html;

  atualizarCardsFinanceiro(filtrados);
  gerarTabelaFinanceiroCategorias(filtrados);
}
