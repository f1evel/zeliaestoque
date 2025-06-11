// estoqueTabela.js — Tabela e filtros do estoque

import { normalizarTexto } from '../utils.js';

let dados = [];

export function setDadosEstoque(novosDados) {
  dados = novosDados;
}

// 🔍 Captura dados filtrados
export function dadosFiltradosEstoque() {
  const nomeFiltro = normalizarTexto(document.getElementById("filtro-nome-estoque").value.trim());
  const diasValidade = parseInt(document.getElementById("input-dias-val").value) || 15;

  return dados.filter(d => {
    const nomeMatch = d.nomeBusca.includes(nomeFiltro);
    const estoqueCritico = d.quantidade <= d.quantidadeMinima;
    const validadeProxima = d.diasParaVencer !== null && d.diasParaVencer <= diasValidade;

    return nomeMatch && (estoqueCritico || validadeProxima);
  });
}

// 📦 Renderizar tabela
export function gerarTabelaEstoque() {
  const lista = document.getElementById("tabela-estoque");
  const filtrados = dadosFiltradosEstoque();

  if (filtrados.length === 0) {
    lista.innerHTML = "<p>❌ Nenhum produto em alerta encontrado.</p>";
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
          <th>Min</th>
          <th>Validade</th>
          <th>Dias p/ vencer</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtrados.forEach(p => {
    const validadeFormatada = p.validade ? p.validade.toLocaleDateString('pt-BR') : "-";
    html += `
      <tr>
        <td>${p.nome}</td>
        <td>${p.categoria}</td>
        <td>${p.fornecedor}</td>
        <td>${p.quantidade}</td>
        <td>${p.quantidadeMinima}</td>
        <td>${validadeFormatada}</td>
        <td>${p.diasParaVencer ?? "-"}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  lista.innerHTML = html;
}
