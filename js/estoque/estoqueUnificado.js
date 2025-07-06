// js/estoque/estoqueUnificado.js
// Página unificada de relatórios de estoque

import { db, getEmpresaIdDoUsuario } from '../firebaseConfig.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { normalizarTexto, parseDataLocal, formatarPreco, formatarDataBrasileira } from '../utils.js';

// Dados carregados do Firestore
let dadosOriginais = [];

let dadosFiltrados = [];
let graficoMeses = null;
let graficoGasto = null;
let graficoInvestido = null;
let graficoAtual = null;
let movimentacoesLista = [];
let periodoConsumoMeses = 3;

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
    if (periodoConsumoMeses) {
      inicioConsumo.setMonth(inicioConsumo.getMonth() - periodoConsumoMeses);
    } else {
      inicioConsumo.setTime(0); // desde o início
    }

    movimentacoesLista = [];
    movSnap.forEach(doc => {
      const m = doc.data();
      const nome = m.nomeBusca || normalizarTexto(m.nomeProduto || '');
      if (!movimentos[nome]) movimentos[nome] = { entradas: 0, saidas: 0, saidasDetalhes: [] };
      const qtd = Number(m.quantidade) || 0;
      const dataMov = m.dataMovimentacao?.toDate?.() || new Date(m.dataMovimentacao);
      movimentacoesLista.push({
        tipo: m.tipo || '-',
        categoria: m.categoria || '-',
        fornecedor: m.fornecedor || '-',
        quantidade: qtd,
        preco: Number(m.precoUnitario) || 0,
        data: dataMov
      });
      if (m.tipo === 'entrada') movimentos[nome].entradas += qtd;
      if (m.tipo === 'saida') {
        movimentos[nome].saidas += qtd;
        if (dataMov && dataMov >= inicioConsumo) {
          movimentos[nome].saidasDetalhes.push({ data: dataMov, quantidade: qtd });
        }
      }
    });

    dadosOriginais = prodSnap.docs.map(doc => {
      const d = doc.data();
      const nomeBusca = d.nomeBusca || normalizarTexto(d.nome || '');
      const mov = movimentos[nomeBusca] || { entradas: 0, saidas: 0, saidasDetalhes: [] };

      const validadeStr = (() => {
        if (d.validade?.toDate) return d.validade.toDate().toISOString().split('T')[0];
        if (d.validade instanceof Date) return d.validade.toISOString().split('T')[0];
        if (typeof d.validade === 'string') return d.validade;
        return '';
      })();

      const saidasOrdenadas = (mov.saidasDetalhes || []).slice().sort((a,b) => a.data - b.data);
      const consumoMedio = calcularConsumoMedio(saidasOrdenadas, inicioConsumo);

      return {
        nome: d.nome || '-',
        categoria: d.categoria || '-',
        fornecedor: d.fornecedor || '-',
        quantidade: Number(d.quantidade) || 0,
        quantidadeMinima: Number(d.quantidadeMinima) || 0,
        entradas: mov.entradas,
        saidas: mov.saidas,
        preco: Number(d.precoCompra) || 0,
        consumoMedio,
        saidasDetalhes: saidasOrdenadas,
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
  const diasEsgotamento = parseInt(document.getElementById('filtro-dias-esgotamento').value) || 30;

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
    if (critico) criticoOk = d.quantidade < d.quantidadeMinima;

    let previsaoOk = true;
    if (previsao) {
      const dias = calculaPrevisao(d);
      previsaoOk = dias < diasEsgotamento;
    }

    return nomeOk && catOk && fornOk && dataOk && validadeOk && tipoOk && criticoOk && previsaoOk;
  });

  renderizarTabela();
  atualizarCards();
  gerarGraficos();
}

function calcularConsumoMedio(saidasOrdenadas, inicioPeriodo) {
  if (!saidasOrdenadas || saidasOrdenadas.length === 0) return 0;

  const consumoTotal = saidasOrdenadas.reduce(
    (acc, s) => acc + (Number(s.quantidade) || 0),
    0
  );
  if (!consumoTotal) return 0;

  const hoje = new Date();
  const primeiro = saidasOrdenadas[0].data;
  const ultimo = saidasOrdenadas[saidasOrdenadas.length - 1].data;

  const inicio = primeiro < inicioPeriodo ? inicioPeriodo : primeiro;
  const fim = saidasOrdenadas.length === 1 ? hoje : ultimo;
  const dias = (fim - inicio) / (1000 * 60 * 60 * 24);
  if (dias <= 0) return 0;

  return dias / consumoTotal;
}

function calculaPrevisao(item) {
  if (!item.consumoMedio || item.consumoMedio === 0) return Infinity;
  return Math.floor(item.consumoMedio * item.quantidade);
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
    <th>Mínimo</th>
    <th>Entradas</th>
    <th>Saídas</th>
    <th>Preço Médio</th>
    <th>Consumo/Mês</th>
    <th>Previsão (dias)</th>
    <th>Validade</th>
    <th>Categoria</th>
    <th>Fornecedor</th>
  </tr></thead><tbody>`;

  dadosFiltrados.forEach(d => {
    const dias = calculaPrevisao(d);
    const diasTxt = dias === Infinity ? 'Sem dados' : dias;
    const classe = d.quantidade < d.quantidadeMinima ?
      (document.getElementById('filtro-critico').checked ? 'critico' : 'critico-suave') : '';
    const fornTxt = d.fornecedor || '-';
    const fornEsc = fornTxt.replace(/"/g, '&quot;');
    const fornCurto = fornTxt.length > 20 ? fornTxt.slice(0, 20) + '...' : fornTxt;
    html += `<tr class="${classe}">
      <td>${d.nome}</td>
      <td>${d.quantidade}</td>
      <td>${d.quantidadeMinima}</td>
      <td>${d.entradas}</td>
      <td>${d.saidas}</td>
      <td>${formatarPreco(d.preco)}</td>
      <td>${d.consumoMedio.toFixed(1)}</td>
      <td>${diasTxt}</td>
      <td>${formatarDataBrasileira(d.validade)}</td>
      <td>${d.categoria}</td>
      <td class="fornecedor-cell" title="${fornEsc}">${fornCurto}</td>
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
  document.getElementById('card-valor-medio').textContent = formatarPreco(valorMedio);
  document.getElementById('card-valor-total').textContent = formatarPreco(totalValor);
}

function gerarGraficos() {
  const ctxMes = document.getElementById('grafico-meses');
  const inicio = parseDataLocal(document.getElementById('graficos-inicio').value);
  const fim = parseDataLocal(document.getElementById('graficos-fim').value);
  const agrup = document.getElementById('agrupamento-graficos').value || 'categoria';

  const agrField = agrup === 'categoria' ? 'categoria' : 'fornecedor';

  const dadosGasto = {};
  const dadosInvest = {};

  movimentacoesLista.forEach(m => {
    if (m.data && !isNaN(inicio) && m.data < inicio) return;
    if (m.data && !isNaN(fim) && m.data > fim) return;
    const chave = m[agrField] || '-';
    const valor = (m.quantidade || 0) * (m.preco || 0);
    if (m.tipo === 'saida') dadosGasto[chave] = (dadosGasto[chave] || 0) + valor;
    if (m.tipo === 'entrada') dadosInvest[chave] = (dadosInvest[chave] || 0) + valor;
  });

  const dadosAtual = {};
  dadosOriginais.forEach(p => {
    if (p.quantidade <= 0) return;
    const chave = p[agrField] || '-';
    dadosAtual[chave] = (dadosAtual[chave] || 0) + p.quantidade * p.preco;
  });

  const cores = labels => labels.map((_,i)=>`hsl(${(i*360/labels.length)},70%,60%)`);

  // ---- Grafico Valor Gasto ----
  const labelsGasto = Object.keys(dadosGasto);
  const valoresGasto = Object.values(dadosGasto);
  const ctxGasto = document.getElementById('grafico-valor-gasto');
  if (graficoGasto) graficoGasto.destroy();
  graficoGasto = new Chart(ctxGasto, {
    type: 'pie',
    data: { labels: labelsGasto, datasets:[{ data: valoresGasto, backgroundColor: cores(labelsGasto) }] },
    options: { plugins:{ legend:{ position:'bottom' } } }
  });

  // ---- Grafico Valor Investido ----
  const labelsInvest = Object.keys(dadosInvest);
  const valoresInvest = Object.values(dadosInvest);
  const ctxInvest = document.getElementById('grafico-valor-investido');
  if (graficoInvestido) graficoInvestido.destroy();
  graficoInvestido = new Chart(ctxInvest, {
    type: 'pie',
    data: { labels: labelsInvest, datasets:[{ data: valoresInvest, backgroundColor: cores(labelsInvest) }] },
    options: { plugins:{ legend:{ position:'bottom' } } }
  });

  // ---- Grafico Valor Atual ----
  const labelsAtual = Object.keys(dadosAtual);
  const valoresAtual = Object.values(dadosAtual);
  const ctxAtual = document.getElementById('grafico-valor-atual');
  if (graficoAtual) graficoAtual.destroy();
  graficoAtual = new Chart(ctxAtual, {
    type: 'pie',
    data: { labels: labelsAtual, datasets:[{ data: valoresAtual, backgroundColor: cores(labelsAtual) }] },
    options: { plugins:{ legend:{ position:'bottom' } } }
  });

  const meses = ['Entradas', 'Saídas'];
  const dadosLinha = [
    dadosFiltrados.reduce((a,d) => a + d.entradas, 0),
    dadosFiltrados.reduce((a,d) => a + d.saidas, 0)
  ];

  if (graficoMeses) graficoMeses.destroy();
  graficoMeses = new Chart(ctxMes, {
    type: 'bar',
    data: { labels: meses, datasets:[{ label: 'Movimentações', data: dadosLinha, backgroundColor: '#009688' }] }
  });

  atualizarTextosGraficos(agrup, dadosGasto, dadosInvest, dadosAtual);
}

function atualizarTextosGraficos(agrup, dadosGasto, dadosInvest, dadosAtual) {
  const tituloGasto = document.getElementById('titulo-grafico-gasto');
  const subGasto = document.getElementById('subtitulo-grafico-gasto');
  const tituloInvest = document.getElementById('titulo-grafico-investido');
  const subInvest = document.getElementById('subtitulo-grafico-investido');
  const tituloAtual = document.getElementById('titulo-grafico-atual');
  const subAtual = document.getElementById('subtitulo-grafico-atual');
  const card = document.getElementById('card-interpretacao');

  const campo = agrup === 'categoria' ? 'categoria' : 'fornecedor';

  tituloGasto.textContent = `Valor gasto por ${campo} (saídas de estoque)`;
  subGasto.textContent = `Mostra quanto foi consumido por ${campo} no período selecionado.`;

  tituloInvest.textContent = `Valor investido por ${campo} (entradas de estoque)`;
  subInvest.textContent = `Mostra quanto foi investido por ${campo} no período selecionado.`;

  tituloAtual.textContent = `Valor total atual por ${campo} (estoque disponível)`;
  subAtual.textContent = `Mostra o valor em estoque agrupado por ${campo}.`;

  const dataset = agrup === 'categoria' ? dadosGasto : dadosInvest;
  const total = Object.values(dataset).reduce((a,v)=>a+v,0);
  const entradasOrdenadas = Object.entries(dataset).sort((a,b)=>b[1]-a[1]);
  if (total === 0 || entradasOrdenadas.length === 0) {
    card.textContent = 'ℹ️ Sem dados para o período selecionado.';
    return;
  }
  const [primeiro, segundo] = entradasOrdenadas;
  const pct1 = ((primeiro[1]/total)*100).toFixed(0);
  let texto = '';
  if (agrup === 'categoria') {
    texto = `ℹ️ Neste período, a categoria que mais consumiu recursos foi ${primeiro[0]}, com ${formatarPreco(primeiro[1])} (${pct1}%) do total gasto em saídas.`;
  } else {
    texto = `ℹ️ Neste período, o fornecedor que mais recebeu investimentos foi ${primeiro[0]}, com ${formatarPreco(primeiro[1])} (${pct1}%) do total de entradas.`;
  }
  if (segundo) {
    const pct2 = ((segundo[1]/total)*100).toFixed(0);
    texto += ` Em seguida, ${segundo[0]} teve ${formatarPreco(segundo[1])} (${pct2}%).`;
  }
  card.textContent = texto;
}

// 🧹 Limpar todos os filtros
function limparFiltros() {
  document.getElementById('filtro-nome').value = '';
  document.getElementById('filtro-categoria').value = '';
  document.getElementById('filtro-fornecedor').value = '';
  document.getElementById('filtro-inicio').value = '';
  document.getElementById('filtro-fim').value = '';
  document.getElementById('filtro-tipo').value = 'todos';
  document.getElementById('filtro-validade').value = '';
  document.getElementById('filtro-critico').checked = false;
  document.getElementById('filtro-previsao').checked = false;
  document.getElementById('filtro-periodo').value = '3';
  document.getElementById('filtro-dias-esgotamento').value = 30;
  document.getElementById('container-periodo').style.display = 'none';
  document.getElementById('container-dias-esgotamento').style.display = 'none';
  periodoConsumoMeses = 3;
  carregarDados();
}

// 📄 Exportar dados filtrados para CSV
async function exportarCSV(dados) {
  const linhas = [
    ['Produto','Qtd Atual','Mínimo','Entradas','Saídas','Preço Médio','Consumo/Mês','Previsão','Validade','Categoria','Fornecedor'],
    ...dados.map(d => [
      d.nome,
      d.quantidade,
      d.quantidadeMinima,
      d.entradas,
      d.saidas,
      d.preco,
      d.consumoMedio.toFixed(1),
      (function(){ const p = calculaPrevisao(d); return p === Infinity ? 'Sem dados' : p; })(),
      d.validade ? new Date(d.validade).toLocaleDateString('pt-BR') : '-',
      d.categoria,
      d.fornecedor
    ])
  ];

  const csvContent = linhas
    .map(l => l.map(c => `"${(c ?? '').toString().replace(/"/g,'""')}"`).join(','))
    .join('\n');

  try {
    await fetch('https://us-central1-zelia-1.cloudfunctions.net/salvarCSV', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomeArquivo: `relatorio_estoque_${Date.now()}.csv`,
        conteudo: csvContent
      })
    });
  } catch(e) {
    console.error('Erro ao enviar CSV:', e);
  }
}

// 🖨️ Exportar dados filtrados para PDF
async function exportarPDF(dados) {
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js');

  const doc = new jsPDF();
  doc.text('Relatório de Estoque', 14, 16);

  const linhas = dados.map(d => [
    d.nome,
    d.quantidade,
    d.quantidadeMinima,
    d.entradas,
    d.saidas,
    d.preco,
    d.consumoMedio.toFixed(1),
    (function(){ const p = calculaPrevisao(d); return p === Infinity ? 'Sem dados' : p; })(),
    d.validade ? new Date(d.validade).toLocaleDateString('pt-BR') : '-',
    d.categoria,
    d.fornecedor
  ]);

  doc.autoTable({
    head: [[
      'Produto','Qtd','Mín','Entradas','Saídas','Preço','Cons/Mês','Prev','Validade','Categoria','Fornecedor'
    ]],
    body: linhas,
    startY: 20
  });

  doc.save(`relatorio_estoque_${Date.now()}.pdf`);
}

function registrarEventos() {
  ['filtro-nome','filtro-categoria','filtro-fornecedor','filtro-inicio','filtro-fim','filtro-tipo','filtro-validade','filtro-critico','filtro-previsao','filtro-periodo','filtro-dias-esgotamento']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', aplicaFiltros);
    });

  const chk = document.getElementById('filtro-previsao');
  const contPeriodo = document.getElementById('container-periodo');
  const contDias = document.getElementById('container-dias-esgotamento');
  chk.addEventListener('change', () => {
    const ativo = chk.checked;
    contPeriodo.style.display = ativo ? 'block' : 'none';
    contDias.style.display = ativo ? 'block' : 'none';
    aplicaFiltros();
  });

  document.getElementById('filtro-periodo').addEventListener('change', () => {
    const val = parseInt(document.getElementById('filtro-periodo').value);
    periodoConsumoMeses = val === 0 ? null : val;
    carregarDados();
  });

  document.getElementById('botao-limpar-estoque-geral')?.addEventListener('click', limparFiltros);
  document.getElementById('botao-exportar-csv-estoque-geral')?.addEventListener('click', () => exportarCSV(dadosFiltrados));
  document.getElementById('botao-exportar-pdf-estoque-geral')?.addEventListener('click', () => exportarPDF(dadosFiltrados));

  ['agrupamento-graficos','graficos-inicio','graficos-fim'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', gerarGraficos);
  });

  document.getElementById('botao-scroll-graficos')?.addEventListener('click', () => {
    document.getElementById('secao-graficos')?.scrollIntoView({ behavior: 'smooth' });
  });
}

// Inicialização
window.addEventListener('DOMContentLoaded', () => {
  const hoje = new Date();
  const inicioPadrao = new Date();
  inicioPadrao.setDate(hoje.getDate() - 30);
  document.getElementById('graficos-fim').value = hoje.toISOString().split('T')[0];
  document.getElementById('graficos-inicio').value = inicioPadrao.toISOString().split('T')[0];

  registrarEventos();
  carregarDados();
});
