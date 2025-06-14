import { normalizarTexto } from '../utils.js';

let dadosOriginais = [];

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
  const validadeFiltro = document.getElementById('filtro-validade-entradas').value;

  const filtrados = dadosOriginais.filter(d => {
    const nomeMatch = d.nomeBusca.includes(nomeFiltro);
    const fornMatch = fornecedorFiltro === '' || d.fornecedor === fornecedorFiltro;
    const compraMatch = compraFiltro === '' || d.compraId === compraFiltro;

    let dataMatch = true;
    if (dataInicio) dataMatch = d.data && d.data >= new Date(dataInicio);
    if (dataFim) dataMatch = dataMatch && d.data && d.data <= new Date(dataFim);

    let valMatch = true;
    if (validadeFiltro) {
      valMatch = d.validade && d.validade.toISOString().split('T')[0] === validadeFiltro;
    }

    return nomeMatch && fornMatch && compraMatch && dataMatch && valMatch;
  });

  if (filtrados.length === 0) {
    lista.innerHTML = '<p>❌ Nenhum dado encontrado.</p>';
    return;
  }

  let html = `
    <table class="tabela">
      <thead>
        <tr>
          <th>Produto</th>
          <th>Quantidade</th>
          <th>Validade</th>
          <th>Preço Unitário</th>
          <th>Fornecedor</th>
          <th>CompraID</th>
          <th>Data</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtrados.forEach(d => {
    const validade = d.validade ? d.validade.toLocaleDateString('pt-BR') : '-';
    const data = d.data ? d.data.toLocaleDateString('pt-BR') : '-';
    html += `
      <tr>
        <td>${d.nome}</td>
        <td>${d.quantidade}</td>
        <td>${validade}</td>
        <td>${d.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        <td>${d.fornecedor}</td>
        <td>${d.compraId}</td>
        <td>${data}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  lista.innerHTML = html;
}

export function gerarFiltrosEntradas(dados) {
  const nomes = new Set();
  const fornecedores = new Set();
  const compras = new Set();
  const validades = new Set();

  dados.forEach(d => {
    if (d.nome) nomes.add(d.nome);
    if (d.fornecedor) fornecedores.add(d.fornecedor);
    if (d.compraId) compras.add(d.compraId);
    if (d.validade) validades.add(d.validade.toISOString().split('T')[0]);
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
  fill('filtro-validade-entradas', validades, 'Todas as validades');

  ['filtro-nome-entradas','filtro-fornecedor-entradas','filtro-compra-entradas','filtro-data-inicio-entradas','filtro-data-fim-entradas','filtro-validade-entradas']
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
  aplicarFiltros();
}
