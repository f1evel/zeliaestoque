import { normalizarTexto } from '../utils.js';
import { atualizarCardsConsumo } from './consumoTotais.js';
import { gerarGraficoConsumo } from './consumoGraficos.js';

let dadosOriginais = [];

export function gerarTabelaConsumo(dados) {
  dadosOriginais = dados;
  gerarFiltrosConsumo(dados);
  aplicarFiltrosEAtualizarTabela();
}

function aplicarFiltrosEAtualizarTabela() {
  const lista = document.getElementById("tabela-consumo");
  const nomeFiltro = normalizarTexto(document.getElementById("filtro-nome-consumo").value.trim());
  const categoriaFiltro = document.getElementById("filtro-categoria-consumo").value;
  const fornecedorFiltro = document.getElementById("filtro-fornecedor-consumo").value;
  const mesFiltro = document.getElementById("filtro-mes-consumo").value;

  const filtrados = dadosOriginais.filter(d => {
    const nomeMatch = d.nomeBusca.includes(nomeFiltro);
    const categoriaMatch = categoriaFiltro === "" || d.categoria === categoriaFiltro;
    const fornecedorMatch = fornecedorFiltro === "" || d.fornecedor === fornecedorFiltro;
    const mesMatch = mesFiltro === "" || d.mes === mesFiltro;
    return nomeMatch && categoriaMatch && fornecedorMatch && mesMatch;
  });

  if (filtrados.length === 0) {
    lista.innerHTML = "<p>❌ Nenhum dado encontrado.</p>";
    atualizarCardsConsumo([]);
    gerarGraficoConsumo([]);
    return;
  }

  let html = `
    <table class="tabela">
      <thead>
        <tr>
          <th>Produto</th>
          <th>Mês/Ano</th>
          <th>Quantidade</th>
          <th>Unidade</th>
          <th>Categoria</th>
          <th>Fornecedor</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtrados.forEach(d => {
    const mesAno = d.data ? `${String(d.data.getMonth()+1).padStart(2,'0')}/${d.data.getFullYear()}` : "-";
    html += `
      <tr>
        <td>${d.nome}</td>
        <td>${mesAno}</td>
        <td>${(d.quantidade || 0).toLocaleString('pt-BR')}</td>
        <td>${d.unidade}</td>
        <td>${d.categoria}</td>
        <td>${d.fornecedor}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  lista.innerHTML = html;
  atualizarCardsConsumo(filtrados);
  gerarGraficoConsumo(filtrados);
}

export function gerarFiltrosConsumo(dados) {
  const categorias = new Set();
  const fornecedores = new Set();
  const meses = new Set();
  const nomes = new Set();

  dados.forEach(d => {
    if (d.categoria) categorias.add(d.categoria);
    if (d.fornecedor) fornecedores.add(d.fornecedor);
    if (d.mes) meses.add(d.mes);
    if (d.nome) nomes.add(d.nome);
  });

  const preencherSelect = (id, valores, labelPadrao) => {
    document.getElementById(id).innerHTML =
      `<option value="">${labelPadrao}</option>` +
      [...valores].sort().map(v => `<option value="${v}">${v}</option>`).join("");
  };

  preencherSelect("filtro-categoria-consumo", categorias, "Todas as categorias");
  preencherSelect("filtro-fornecedor-consumo", fornecedores, "Todos os fornecedores");
  preencherSelect("filtro-mes-consumo", meses, "Todos os meses");

  document.getElementById("sugestoes-produtos").innerHTML =
    [...nomes].sort().map(n => `<option value="${n}">`).join("");

  // Atualiza automaticamente ao interagir com filtros
  ["filtro-nome-consumo", "filtro-categoria-consumo", "filtro-fornecedor-consumo", "filtro-mes-consumo"]
    .forEach(id => {
      document.getElementById(id)?.addEventListener("input", aplicarFiltrosEAtualizarTabela);
    });
}
