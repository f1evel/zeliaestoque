// js/estoque/estoqueUnificado.js
// Página unificada de relatórios de estoque

import { db, getEmpresaIdDoUsuario } from '../firebaseConfig.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { normalizarTexto, parseDataLocal } from '../utils.js';

// Dados carregados do Firestore
let dadosOriginais = [];

let dadosFiltrados = [];
let graficoCategoria = null;
let graficoMeses = null;

// Carrega produtos e movimentações do Firestore
async function carregarDados() {
  try {
    const empresaId = await getEmpresaIdDoUsuario();

    const [prodSnap, movSnap] = await Promise.all([
      getDocs(collection(db, 'empresas', empresaId, 'produtos')),
      getDocs(collection(db, 'empresas', empresaId, 'movimentacoes'))
    ]);

    const movimentos = {};
    const inicioConsumo = new Date();
    inicioConsumo.setMonth(inicioConsumo.getMonth() - 3);

    movSnap.forEach(doc => {
      const m = doc.data();
      const nome = m.nomeBusca || normalizarTexto(m.nomeProduto || '');
      if (!movimentos[nome]) movimentos[nome] = { entradas: 0, saidas: 0, consumo: 0 };
      const qtd = Number(m.quantidade) || 0;
      if (m.tipo === 'entrada') movimentos[nome].entradas += qtd;
      if (m.tipo === 'saida') {
        movimentos[nome].saidas += qtd;
        const dataMov = m.dataMovimentacao?.toDate?.() || new Date(m.dataMovimentacao);
        if (dataMov && dataMov >= inicioConsumo) movimentos[nome].consumo += qtd;
      }
    });

    dadosOriginais = prodSnap.docs.map(doc => {
      const d = doc.data();
      const nomeBusca = d.nomeBusca || normalizarTexto(d.nome || '');
      const mov = movimentos[nomeBusca] || { entradas: 0, saidas: 0, consumo: 0 };

      const validadeStr = (() => {
        if (d.validade?.toDate) return d.validade.toDate().toISOString().split('T')[0];
        if (d.validade instanceof Date) return d.validade.toISOString().split('T')[0];
        if (typeof d.validade === 'string') return d.validade;
        return '';
      })();

      const diasPeriodo = Math.max(1, Math.round((Date.now() - inicioConsumo.getTime()) / 86400000));
      const consumoMedio = mov.consumo / diasPeriodo;

      return {
        nome: d.nome || '-',
        categoria: d.categoria || '-',
        fornecedor: d.fornecedor || '-',
        quantidade: Number(d.quantidade) || 0,
        entradas: mov.entradas,
        saidas: mov.saidas,
        preco: Number(d.precoCompra) || 0,
        consumoMedio,
        validade: validadeStr
      };
    });

    popularFiltros();
    aplicaFiltros();
  } catch (e) {
    console.error('Erro ao carregar dados do estoque:', e);
    dadosOriginais = [];
    popularFiltros();
    aplicaFiltros();
  }
}

function popularFiltros() {
  const categorias = new Set();
  const fornecedores = new Set();
  const nomes = new Set();

  dadosOriginais.forEach(d => {
    categorias.add(d.categoria);
    fornecedores.add(d.fornecedor);
    nomes.add(d.nome);
  });

  const selCat = document.getElementById('filtro-categoria');
  selCat.innerHTML = '<option value="">Categoria</option>' +
    [...categorias].map(c => `<option value="${c}">${c}</option>`).join('');

  const selFor = document.getElementById('filtro-fornecedor');
  selFor.innerHTML = '<option value="">Fornecedor</option>' +
    [...fornecedores].map(f => `<option value="${f}">${f}</option>`).join('');

  const listaProdutos = document.getElementById('lista-produtos');
  listaProdutos.innerHTML = [...nomes].map(n => `<option value="${n}">`).join('');
}

function aplicaFiltros() {
  const nome = normalizarTexto(document.getElementById('filtro-nome').value);
  const categoria = document.getElementById('filtro-categoria').value;
  const fornecedor = document.getElementById('filtro-fornecedor').value;
  const inicio = parseDataLocal(document.getElementById('filtro-inicio').value);
  const fim = parseDataLocal(document.getElementById('filtro-fim').value);
  const tipo = document.getElementById('filtro-tipo').value;
  const validade = parseDataLocal(document.getElementById('filtro-validade').value);
  const critico = document.getElementById('filtro-critico').checked;
  const previsao = document.getElementById('filtro-previsao').checked;

  dadosFiltrados = dadosOriginais.filter(d => {
    const nomeOk = !nome || normalizarTexto(d.nome).includes(nome);
    const catOk = !categoria || d.categoria === categoria;
    const fornOk = !fornecedor || d.fornecedor === fornecedor;

    let dataOk = true;
    if (!isNaN(inicio) && !isNaN(fim)) {
      // Nesta versão não filtramos por período de movimentação
      dataOk = true;
    }

    let validadeOk = true;
    if (!isNaN(validade)) {
      validadeOk = parseDataLocal(d.validade) <= validade;
    }

    let tipoOk = true;
    if (tipo === 'entrada') tipoOk = d.entradas > 0;
    else if (tipo === 'saida') tipoOk = d.saidas > 0;

    let criticoOk = true;
    if (critico) criticoOk = d.quantidade < 50;

    let previsaoOk = true;
    if (previsao) {
      const dias = calculaPrevisao(d);
      previsaoOk = dias <= 30;
    }

    return nomeOk && catOk && fornOk && dataOk && validadeOk && tipoOk && criticoOk && previsaoOk;
  });

  renderizarTabela();
  atualizarCards();
  gerarGraficos();
}

function calculaPrevisao(item) {
  if (!item.consumoMedio || item.consumoMedio === 0) return Infinity;
  return Math.floor(item.quantidade / item.consumoMedio);
}

function renderizarTabela() {
  const div = document.getElementById('tabela-estoque-geral');
  if (dadosFiltrados.length === 0) {
    div.innerHTML = '<p>Nenhum dado encontrado.</p>';
    return;
  }
  let html = `<table class="tabela"><thead><tr>
    <th>Produto</th>
    <th>Qtd Atual</th>
    <th>Entradas</th>
    <th>Saídas</th>
    <th>Preço Médio</th>
    <th>Consumo Médio</th>
    <th>Previsão (dias)</th>
    <th>Validade</th>
    <th>Categoria</th>
    <th>Fornecedor</th>
  </tr></thead><tbody>`;

  dadosFiltrados.forEach(d => {
    const dias = calculaPrevisao(d);
    html += `<tr>
      <td>${d.nome}</td>
      <td>${d.quantidade}</td>
      <td>${d.entradas}</td>
      <td>${d.saidas}</td>
      <td>${d.preco.toFixed(2)}</td>
      <td>${d.consumoMedio}</td>
      <td>${dias}</td>
      <td>${d.validade}</td>
      <td>${d.categoria}</td>
      <td>${d.fornecedor}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  div.innerHTML = html;
}

function atualizarCards() {
  const totalProdutos = dadosFiltrados.length;
  const totalUnidades = dadosFiltrados.reduce((acc, d) => acc + d.quantidade, 0);
  const totalValor = dadosFiltrados.reduce((acc, d) => acc + d.quantidade * d.preco, 0);
  const valorMedio = totalUnidades ? (totalValor / totalUnidades) : 0;

  document.getElementById('card-produtos').textContent = totalProdutos;
  document.getElementById('card-unidades').textContent = totalUnidades;
  document.getElementById('card-valor-medio').textContent = valorMedio.toFixed(2);
  document.getElementById('card-valor-total').textContent = totalValor.toFixed(2);
}

function gerarGraficos() {
  const ctxCat = document.getElementById('grafico-categoria');
  const ctxMes = document.getElementById('grafico-meses');

  const porCategoria = {};
  dadosFiltrados.forEach(d => {
    porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + d.saidas;
  });

  const catLabels = Object.keys(porCategoria);
  const catDados = Object.values(porCategoria);

  if (graficoCategoria) graficoCategoria.destroy();
  graficoCategoria = new Chart(ctxCat, {
    type: 'pie',
    data: {
      labels: catLabels,
      datasets: [{ data: catDados, backgroundColor: ['#009688', '#4caf50', '#ffc107'] }]
    }
  });

  const meses = ['Entradas', 'Saídas'];
  const dadosLinha = [
    dadosFiltrados.reduce((a,d) => a + d.entradas, 0),
    dadosFiltrados.reduce((a,d) => a + d.saidas, 0)
  ];

  if (graficoMeses) graficoMeses.destroy();
  graficoMeses = new Chart(ctxMes, {
    type: 'bar',
    data: {
      labels: meses,
      datasets: [{ label: 'Movimentações', data: dadosLinha, backgroundColor: '#009688' }]
    }
  });
}

function registrarEventos() {
  ['filtro-nome','filtro-categoria','filtro-fornecedor','filtro-inicio','filtro-fim','filtro-tipo','filtro-validade','filtro-critico','filtro-previsao']
    .forEach(id => {
      document.getElementById(id).addEventListener('input', aplicaFiltros);
    });
}

// Inicialização
window.addEventListener('DOMContentLoaded', () => {
  registrarEventos();
  carregarDados();
});
