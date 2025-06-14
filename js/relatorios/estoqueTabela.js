// estoqueTabela.js — Tabela e filtros do estoque

import { normalizarTexto } from '../utils.js';

let dados = [];

export function setDadosEstoque(novosDados) {
  dados = novosDados;
  gerarFiltrosEstoque();
}

// 🔍 Captura dados filtrados
export function dadosFiltradosEstoque() {
  const nomeFiltro = normalizarTexto(document.getElementById("filtro-nome-estoque").value.trim());
  const diasValidade = parseInt(document.getElementById("input-dias-val").value) || 15;
  const tipoAlerta = document.getElementById("filtro-alerta-tipo").value;
  const categoriaFiltro = document.getElementById("filtro-categoria-estoque").value;
  const fornecedorFiltro = document.getElementById("filtro-fornecedor-estoque").value;
  const soLoteAtivo = document.getElementById("filtro-lote-ativo").checked;

  return dados.filter(d => {
    const nomeMatch = d.nomeBusca.includes(nomeFiltro);
    const estoqueCritico = d.quantidade <= d.quantidadeMinima;
    const validadeProxima = d.diasParaVencer !== null && d.diasParaVencer <= diasValidade;
    const tipoMatch =
      tipoAlerta === "todos" ||
      (tipoAlerta === "critico" && estoqueCritico) ||
      (tipoAlerta === "validade" && validadeProxima);
    const categoriaMatch = categoriaFiltro === "" || d.categoria === categoriaFiltro;
    const fornecedorMatch = fornecedorFiltro === "" || d.fornecedor === fornecedorFiltro;
    const loteMatch = !soLoteAtivo || d.quantidade > 0;

    return nomeMatch && tipoMatch && categoriaMatch && fornecedorMatch && loteMatch;
  });
}

// 📦 Renderizar tabela
export function gerarTabelaEstoque() {
  const lista = document.getElementById("tabela-estoque");
  const diasValidade = parseInt(document.getElementById("input-dias-val").value) || 15;
  const filtrados = dadosFiltradosEstoque();

  filtrados.sort((a, b) => {
    const alertaA = a.quantidade <= a.quantidadeMinima || (a.diasParaVencer !== null && a.diasParaVencer <= diasValidade);
    const alertaB = b.quantidade <= b.quantidadeMinima || (b.diasParaVencer !== null && b.diasParaVencer <= diasValidade);
    if (alertaA !== alertaB) return alertaA ? -1 : 1;

    const diasA = a.diasParaVencer ?? Infinity;
    const diasB = b.diasParaVencer ?? Infinity;
    if (diasA !== diasB) return diasA - diasB;

    const diffA = (a.quantidade - a.quantidadeMinima);
    const diffB = (b.quantidade - b.quantidadeMinima);
    return diffA - diffB;
  });

  if (filtrados.length === 0) {
    lista.innerHTML = "<p>❌ Nenhum produto encontrado.</p>";
    return;
  }

  let html = `
    <table class="tabela">
      <thead>
        <tr>
          <th>Produto</th>
          <th>Qtd</th>
          <th>Mínimo</th>
          <th>Validade</th>
          <th>Dias p/ vencer</th>
          <th>Categoria</th>
          <th>Fornecedor</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtrados.forEach(p => {
    const validadeFormatada = p.validade ? p.validade.toLocaleDateString('pt-BR') : "-";
    const estoqueCritico = p.quantidade <= p.quantidadeMinima;
    const validadeProxima = p.diasParaVencer !== null && p.diasParaVencer <= diasValidade;
    let cor = "";
    if (estoqueCritico && validadeProxima) cor = "background:#ffe5e5;"; // vermelho claro
    else if (validadeProxima) cor = "background:#fff4e5;"; // laranja claro
    else if (estoqueCritico) cor = "background:#fffbe5;"; // amarelo claro

    html += `
      <tr style="${cor}">
        <td>${p.nome}</td>
        <td>${p.quantidade}</td>
        <td>${p.quantidadeMinima}</td>
        <td>${validadeFormatada}</td>
        <td>${p.diasParaVencer ?? "-"}</td>
        <td>${p.categoria}</td>
        <td>${p.fornecedor}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  lista.innerHTML = html;
}

// 🔽 Preencher filtros de categoria e fornecedor
export function gerarFiltrosEstoque() {
  const categorias = new Set();
  const fornecedores = new Set();

  dados.forEach(d => {
    if (d.categoria) categorias.add(d.categoria);
    if (d.fornecedor) fornecedores.add(d.fornecedor);
  });

  const selCat = document.getElementById("filtro-categoria-estoque");
  const selForn = document.getElementById("filtro-fornecedor-estoque");
  if (!selCat || !selForn) return;

  selCat.innerHTML = `<option value="">Categoria</option>` +
    [...categorias].sort().map(c => `<option value="${c}">${c}</option>`).join("");

  selForn.innerHTML = `<option value="">Fornecedor</option>` +
    [...fornecedores].sort().map(f => `<option value="${f}">${f}</option>`).join("");

  // Atualiza ao mudar filtros
  ["filtro-alerta-tipo","filtro-categoria-estoque","filtro-fornecedor-estoque","filtro-lote-ativo","filtro-nome-estoque","input-dias-val"].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      gerarTabelaEstoque();
    });
  });
}
