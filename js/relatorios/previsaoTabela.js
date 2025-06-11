// previsaoTabela.js — Tabela e filtros da previsão

import { normalizarTexto } from '../utils.js';

let dados = [];

export function setDadosPrevisao(novosDados) {
  dados = novosDados;
}

export function dadosFiltradosPrevisao() {
  const nomeFiltro = normalizarTexto(document.getElementById("filtro-nome-previsao").value.trim());

  return dados.filter(d => {
    return d.nomeBusca.includes(nomeFiltro);
  });
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
        </tr>
      </thead>
      <tbody>
  `;

  filtrados.forEach(p => {
    const dataPrevista = p.dataPrevistaEsgotamento
      ? p.dataPrevistaEsgotamento.toLocaleDateString('pt-BR')
      : "-";

    html += `
      <tr>
        <td>${p.nome}</td>
        <td>${p.categoria}</td>
        <td>${p.fornecedor}</td>
        <td>${p.quantidade}</td>
        <td>${p.consumoMensal}</td>
        <td>${p.diasDeEstoque === Infinity ? "-" : p.diasDeEstoque}</td>
        <td>${dataPrevista}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  lista.innerHTML = html;
}
