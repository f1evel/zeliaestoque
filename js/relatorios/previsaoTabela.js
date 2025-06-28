// previsaoTabela.js — Tabela e filtros da previsão

import { normalizarTexto } from '../utils.js';

let dados = [];

export function setDadosPrevisao(novosDados) {
  dados = novosDados;
}

export function dadosFiltradosPrevisao() {
  const nomeFiltro = normalizarTexto(document.getElementById("filtro-nome-previsao").value.trim());
  const categoriaFiltro = document.getElementById("filtro-categoria-previsao").value;
  const apenasCritico = document.getElementById("check-apenas-critico").checked;
  const limite = parseInt(document.getElementById("input-limite-previsao").value) || 30;

  return dados.filter(d => {
    const nomeMatch = d.nomeBusca.includes(nomeFiltro);
    const catMatch = categoriaFiltro === "" || d.categoria === categoriaFiltro;
    const criticoMatch = !apenasCritico || (d.diasDeEstoque !== Infinity && d.diasDeEstoque <= limite);
    return nomeMatch && catMatch && criticoMatch;
  });
}

export function gerarFiltrosPrevisao() {
  const categorias = new Set(dados.map(d => d.categoria).filter(c => c && c !== "-"));
  document.getElementById("filtro-categoria-previsao").innerHTML =
    `<option value="">Todas</option>` +
    [...categorias].sort().map(c => `<option value="${c}">${c}</option>`).join("");
}

export function gerarTabelaPrevisao() {
  const lista = document.getElementById("tabela-previsao");
  const filtrados = dadosFiltradosPrevisao();

  if (filtrados.length === 0) {
    lista.innerHTML = "<p>❌ Nenhum dado encontrado.</p>";
    return;
  }

  let html = `
    <table class="tabela">
      <thead>
        <tr>
          <th>Produto</th>
          <th>Categoria</th>
          <th>Fornecedor</th>
          <th>Qtd</th>
          <th>Consumo/Mês</th>
          <th>Dias Estoque</th>
          <th>Prev. Esgotamento</th>
          <th>Última Saída</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;

  filtrados.forEach(p => {
    const dataPrevista = p.dataPrevistaEsgotamento
      ? p.dataPrevistaEsgotamento.toLocaleDateString('pt-BR')
      : "-";
    const dataUltima = p.ultimaSaida ? p.ultimaSaida.toLocaleDateString('pt-BR') : "-";
    const classe = p.diasDeEstoque !== Infinity && p.diasDeEstoque <= 15 ? 'critico' : '';

    html += `
      <tr class="${classe}">
        <td>${p.nome}</td>
        <td>${p.categoria}</td>
        <td>${p.fornecedor}</td>
        <td>${p.quantidade}</td>
        <td>${p.consumoMensal}</td>
        <td>${p.diasDeEstoque === Infinity ? "-" : p.diasDeEstoque}</td>
        <td>${dataPrevista}</td>
        <td>${dataUltima}</td>
        <td><button class="btn-repor" onclick="solicitarReposicao('${p.id}')">Reposição</button></td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  lista.innerHTML = html;
}
