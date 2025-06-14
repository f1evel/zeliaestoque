import { normalizarTexto } from '../utils.js';

let dadosOriginais = [];

export function gerarTabelaSaidas(dados) {
  dadosOriginais = dados;
  gerarFiltrosSaidas(dados);
  aplicarFiltros();
}

function aplicarFiltros() {
  const lista = document.getElementById('tabela-saidas');
  const nomeFiltro = normalizarTexto(document.getElementById('filtro-nome-saidas').value.trim());
  const categoriaFiltro = document.getElementById('filtro-categoria-saidas').value;
  const dataInicio = document.getElementById('filtro-data-inicio-saidas').value;
  const dataFim = document.getElementById('filtro-data-fim-saidas').value;

  const filtrados = dadosOriginais.filter(d => {
    const nomeMatch = d.nomeBusca.includes(nomeFiltro);
    const categoriaMatch = categoriaFiltro === '' || d.categoria === categoriaFiltro;

    let dataMatch = true;
    if (dataInicio) dataMatch = d.data && d.data >= new Date(dataInicio);
    if (dataFim) dataMatch = dataMatch && d.data && d.data <= new Date(dataFim);

    return nomeMatch && categoriaMatch && dataMatch;
  });

  if (filtrados.length === 0) {
    lista.innerHTML = '<p>❌ Nenhum dado encontrado.</p>';
    return;
  }

  let html = `<table class="tabela">
      <thead>
        <tr>
          <th>Produto</th>
          <th>Quantidade</th>
          <th>Data</th>
          <th>Motivo</th>
          <th>Responsável</th>
        </tr>
      </thead>
      <tbody>`;

  filtrados.forEach(d => {
    html += `<tr>
        <td>${d.nome}</td>
        <td>${d.quantidade}</td>
        <td>${d.data ? d.data.toLocaleDateString('pt-BR') : '-'}</td>
        <td>${d.motivo || '-'}</td>
        <td>${d.responsavel || '-'}</td>
      </tr>`;
  });

  html += '</tbody></table>';
  lista.innerHTML = html;
}

export function gerarFiltrosSaidas(dados) {
  const nomes = new Set();
  const categorias = new Set();

  dados.forEach(d => {
    if (d.nome) nomes.add(d.nome);
    if (d.categoria) categorias.add(d.categoria);
  });

  document.getElementById('lista-produtos-saidas').innerHTML =
    [...nomes].sort().map(n => `<option value="${n}">`).join('');

  const fill = (id, values, label) => {
    document.getElementById(id).innerHTML =
      `<option value="">${label}</option>` +
      [...values].sort().map(v => `<option value="${v}">${v}</option>`).join('');
  };

  fill('filtro-categoria-saidas', categorias, 'Todas as categorias');
  ['filtro-nome-saidas','filtro-categoria-saidas','filtro-data-inicio-saidas','filtro-data-fim-saidas']
    .forEach(id => {
      document.getElementById(id)?.addEventListener('input', aplicarFiltros);
    });
}

export function limparFiltrosSaidas() {
  document.getElementById('filtro-nome-saidas').value = '';
  document.getElementById('filtro-categoria-saidas').value = '';
  document.getElementById('filtro-data-inicio-saidas').value = '';
  document.getElementById('filtro-data-fim-saidas').value = '';
  aplicarFiltros();
}
