import { normalizarTexto } from '../utils.js';
import { atualizarCardsEntradas } from './entradasTotais.js';
import { gerarGraficoEntradas } from './entradasGraficos.js';

let dadosOriginais = [];
let colunaOrdenacao = '';
let ordemAsc = true;

function ordenarDados(lista) {
  if (!colunaOrdenacao) return lista;
  return [...lista].sort((a, b) => {
    let valA = a[colunaOrdenacao];
    let valB = b[colunaOrdenacao];

    if (valA === null || valA === undefined) valA = '';
    if (valB === null || valB === undefined) valB = '';

    if (valA instanceof Date && valB instanceof Date) {
      return ordemAsc ? valA - valB : valB - valA;
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      return ordemAsc ? valA - valB : valB - valA;
    }

    valA = valA.toString().toLowerCase();
    valB = valB.toString().toLowerCase();
    return ordemAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
  });
}

function cabecalhoOrdenavel(coluna, titulo) {
  const seta = colunaOrdenacao === coluna ? (ordemAsc ? ' ↑' : ' ↓') : '';
  return `<th data-col="${coluna}" class="ordenavel">${titulo}${seta}</th>`;
}

function adicionarEventosOrdenacao() {
  document.querySelectorAll('#tabela-entradas th.ordenavel').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (colunaOrdenacao === col) {
        ordemAsc = !ordemAsc;
      } else {
        colunaOrdenacao = col;
        ordemAsc = true;
      }
      aplicarFiltros();
    });
  });
}

export function gerarTabelaEntradas(dados) {
  dadosOriginais = dados;
  gerarFiltrosEntradas(dados);
  aplicarFiltros();
}

function aplicarFiltros() {
  const lista = document.getElementById('tabela-entradas');
  const nomeFiltro = normalizarTexto(document.getElementById('filtro-nome-entradas').value.trim());
  const fornecedorFiltro = document.getElementById('filtro-fornecedor-entradas').value;
  const compraFiltro = document.getElementById('filtro-compra-entradas').value;
  const dataInicio = document.getElementById('filtro-data-inicio-entradas').value;
  const dataFim = document.getElementById('filtro-data-fim-entradas').value;
  const validadeFim = document.getElementById('filtro-validade-entradas').value;
  const precoMin = parseFloat(document.getElementById('filtro-preco-min-entradas').value);
  const precoMax = parseFloat(document.getElementById('filtro-preco-max-entradas').value);

  const filtrados = dadosOriginais.filter(d => {
    const nomeMatch = d.nomeBusca.includes(nomeFiltro);
    const fornMatch = fornecedorFiltro === '' || d.fornecedor === fornecedorFiltro;
    const compraMatch = compraFiltro === '' || d.compraId === compraFiltro;

    let dataMatch = true;
    if (dataInicio) dataMatch = d.data && d.data >= new Date(dataInicio);
    if (dataFim) dataMatch = dataMatch && d.data && d.data <= new Date(dataFim);

    let validadeMatch = true;
    if (validadeFim) validadeMatch = d.validade && d.validade <= new Date(validadeFim);

    let precoMatch = true;
    if (!isNaN(precoMin)) precoMatch = d.preco >= precoMin;
    if (!isNaN(precoMax)) precoMatch = precoMatch && d.preco <= precoMax;

    return nomeMatch && fornMatch && compraMatch && dataMatch && validadeMatch && precoMatch;
  });

  const ordenados = ordenarDados(filtrados);

  if (filtrados.length === 0) {
    lista.innerHTML = '<p>❌ Nenhum dado encontrado.</p>';
    atualizarCardsEntradas([]);
    gerarGraficoEntradas([]);
    return;
  }

  // Verifica se pelo menos um registro possui CompraID preenchido
  const mostrarCompraId = filtrados.some(d => d.compraId && d.compraId !== '-' && String(d.compraId).trim() !== '');

  let html = `
    <table class="tabela">
      <thead>
        <tr>
          ${cabecalhoOrdenavel('nome','Produto')}
          ${cabecalhoOrdenavel('quantidade','Quantidade')}
          ${cabecalhoOrdenavel('validade','Validade')}
          ${cabecalhoOrdenavel('preco','Preço Unitário')}
          ${cabecalhoOrdenavel('fornecedor','Fornecedor')}
          ${cabecalhoOrdenavel('compraId','CompraID')}
          ${cabecalhoOrdenavel('data','Data')}
         </tr>
      </thead>
      <tbody>
  `;

  ordenados.forEach(d => {
    const validade = d.validade ? d.validade.toLocaleDateString('pt-BR') : '-';
    const data = d.data ? d.data.toLocaleDateString('pt-BR') : '-';
    const modificado = d.modificado ? d.modificado.toLocaleDateString('pt-BR') : '-';
    let tooltip = `Usuário: ${d.usuario || '-'}\nObs.: ${d.observacoes || 'Nenhuma'}\nModificado: ${modificado}`;
    tooltip = tooltip.replace(/"/g, '&quot;');

    html += `
      <tr title="${tooltip}">
        <td>${d.nome}</td>
        <td>${d.quantidade}</td>
        <td>${validade}</td>
        <td>${d.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        <td>${d.fornecedor}</td>
        ${mostrarCompraId ? `<td>${d.compraId}</td>` : ''}
        <td>${data}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  lista.innerHTML = html;

  atualizarCardsEntradas(filtrados);
  gerarGraficoEntradas(filtrados);
  aplicarCabecalhoFixo();
  adicionarEventosOrdenacao();
  atualizarCardsEntradas(ordenados);
}

export function gerarFiltrosEntradas(dados) {
  const nomes = new Set();
  const fornecedores = new Set();
  const compras = new Set();

  dados.forEach(d => {
    if (d.nome) nomes.add(d.nome);
    if (d.fornecedor) fornecedores.add(d.fornecedor);
    if (d.compraId) compras.add(d.compraId);
  });

  document.getElementById('lista-produtos-entradas').innerHTML =
    [...nomes].sort().map(n => `<option value="${n}">`).join('');

  const fill = (id, valores, label) => {
    document.getElementById(id).innerHTML =
      `<option value="">${label}</option>` +
      [...valores].sort().map(v => `<option value="${v}">${v}</option>`).join('');
  };

  fill('filtro-fornecedor-entradas', fornecedores, 'Todos os fornecedores');
  fill('filtro-compra-entradas', compras, 'Todas as compras');

  ['filtro-nome-entradas','filtro-fornecedor-entradas','filtro-compra-entradas','filtro-data-inicio-entradas','filtro-data-fim-entradas','filtro-validade-entradas','filtro-preco-min-entradas','filtro-preco-max-entradas']

    .forEach(id => {
      document.getElementById(id)?.addEventListener('input', aplicarFiltros);
    });
}

export function limparFiltrosEntradas() {
  document.getElementById('filtro-nome-entradas').value = '';
  document.getElementById('filtro-fornecedor-entradas').value = '';
  document.getElementById('filtro-compra-entradas').value = '';
  document.getElementById('filtro-data-inicio-entradas').value = '';
  document.getElementById('filtro-data-fim-entradas').value = '';
  document.getElementById('filtro-validade-entradas').value = '';
  document.getElementById('filtro-preco-min-entradas').value = '';
  document.getElementById('filtro-preco-max-entradas').value = '';
  aplicarFiltros();
}

function aplicarCabecalhoFixo() {
  const tabela = document.querySelector('#tabela-entradas table');
  if (tabela) tabela.classList.add('tabela-cabecalho-fixo');
}
