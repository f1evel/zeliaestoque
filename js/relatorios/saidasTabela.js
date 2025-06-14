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
  const motivoFiltro = document.getElementById('filtro-motivo-saidas').value;
  const responsavelFiltro = document.getElementById('filtro-responsavel-saidas').value;
  const dataInicio = document.getElementById('filtro-data-inicio-saidas').value;
  const dataFim = document.getElementById('filtro-data-fim-saidas').value;

  const filtrados = dadosOriginais.filter(d => {
    const nomeMatch = d.nomeBusca.includes(nomeFiltro);
    const motivoMatch = motivoFiltro === '' || d.motivo === motivoFiltro;
    const respMatch = responsavelFiltro === '' || d.responsavel === responsavelFiltro;

    let dataMatch = true;
    if (dataInicio) dataMatch = d.data && d.data >= new Date(dataInicio);
    if (dataFim) dataMatch = dataMatch && d.data && d.data <= new Date(dataFim);

    return nomeMatch && motivoMatch && respMatch && dataMatch;
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
  const motivos = new Set();
  const responsaveis = new Set();

  dados.forEach(d => {
    if (d.nome) nomes.add(d.nome);
    if (d.motivo) motivos.add(d.motivo);
    if (d.responsavel) responsaveis.add(d.responsavel);
  });

  document.getElementById('lista-produtos-saidas').innerHTML =
    [...nomes].sort().map(n => `<option value="${n}">`).join('');

  const fill = (id, values, label) => {
    document.getElementById(id).innerHTML =
      `<option value="">${label}</option>` +
      [...values].sort().map(v => `<option value="${v}">${v}</option>`).join('');
  };

  fill('filtro-motivo-saidas', motivos, 'Todos os motivos');
  fill('filtro-responsavel-saidas', responsaveis, 'Todos os responsáveis');

  ['filtro-nome-saidas','filtro-motivo-saidas','filtro-responsavel-saidas','filtro-data-inicio-saidas','filtro-data-fim-saidas']
    .forEach(id => {
      document.getElementById(id)?.addEventListener('input', aplicarFiltros);
    });
}

export function limparFiltrosSaidas() {
  document.getElementById('filtro-nome-saidas').value = '';
  document.getElementById('filtro-motivo-saidas').value = '';
  document.getElementById('filtro-responsavel-saidas').value = '';
  document.getElementById('filtro-data-inicio-saidas').value = '';
  document.getElementById('filtro-data-fim-saidas').value = '';
  aplicarFiltros();
}
