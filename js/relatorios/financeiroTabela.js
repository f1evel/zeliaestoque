// financeiroTabela.js — Geração de tabela e filtros

import { normalizarTexto } from '../utils.js';

let dados = [];
let ordemCrescente = true;

// 🔥 Setar dados
export function setDadosFinanceiro(novosDados) {
  dados = novosDados;
}

// 🔍 Gerar filtros dinâmicos
export function gerarFiltrosFinanceiro() {
  const categorias = new Set();
  const status = new Set();
  const meses = new Set();

  dados.forEach(d => {
    if (d.categoria) categorias.add(d.categoria);
    if (d.status) status.add(d.status);
    if (d.mes) meses.add(d.mes);
  });

  document.getElementById("filtro-categoria-fin").innerHTML =
    `<option value="">Todas</option>` + [...categorias].sort().map(c => `<option value="${c}">${c}</option>`).join("");

  document.getElementById("filtro-status-fin").innerHTML =
    `<option value="">Todos</option>` + [...status].sort().map(s => `<option value="${s}">${s}</option>`).join("");

  document.getElementById("filtro-mes-fin").innerHTML =
    `<option value="">Todos</option>` + [...meses].sort().map(m => `<option value="${m}">${m}</option>`).join("");
}

// 📊 Renderizar Tabela
export function gerarTabelaFinanceiro() {
  const lista = document.getElementById("tabela-financeiro");

  const descricaoFiltro = normalizarTexto(document.getElementById("filtro-descricao").value.trim());
  const categoriaFiltro = document.getElementById("filtro-categoria-fin").value;
  const statusFiltro = document.getElementById("filtro-status-fin").value;
  const mesFiltro = document.getElementById("filtro-mes-fin").value;

  const filtrados = dados.filter(d => {
    const nomeMatch = normalizarTexto(d.descricao).includes(descricaoFiltro);
    const categoriaMatch = categoriaFiltro === "" || d.categoria === categoriaFiltro;
    const statusMatch = statusFiltro === "" || d.status === statusFiltro;
    const mesMatch = mesFiltro === "" || d.mes === mesFiltro;

    return nomeMatch && categoriaMatch && statusMatch && mesMatch;
  });

  if (filtrados.length === 0) {
    lista.innerHTML = "<p>❌ Nenhum dado encontrado.</p>";
    return;
  }

  let html = `
    <table class="tabela">
      <thead>
        <tr>
          <th onclick="ordenarPorDescricao()" style="cursor:pointer;">Descrição ⬍</th>
          <th>Categoria</th>
          <th>Valor</th>
          <th>Status</th>
          <th>Data Lançamento</th>
          <th>Vencimento</th>
          <th>Pagamento</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtrados.forEach(d => {
    const lanc = d.dataLancamento?.toLocaleDateString('pt-BR') || "-";
    const venc = d.dataVencimento?.toLocaleDateString('pt-BR') || "-";
    const pag = d.dataPagamento?.toLocaleDateString('pt-BR') || "-";

    html += `
      <tr>
        <td>${d.descricao}</td>
        <td>${d.categoria}</td>
        <td>R$ ${(d.valor).toFixed(2)}</td>
        <td>${d.status}</td>
        <td>${lanc}</td>
        <td>${venc}</td>
        <td>${pag}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  lista.innerHTML = html;
}

// 🔃 Ordenar por descrição
window.ordenarPorDescricao = function () {
  dados.sort((a, b) => {
    const nomeA = (a.descricao || "").toLowerCase();
    const nomeB = (b.descricao || "").toLowerCase();
    if (nomeA < nomeB) return ordemCrescente ? -1 : 1;
    if (nomeA > nomeB) return ordemCrescente ? 1 : -1;
    return 0;
  });

  ordemCrescente = !ordemCrescente;
  gerarTabelaFinanceiro();
};
