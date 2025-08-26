// financeiroTabela.js — Geração de tabela e filtros

import { normalizarTexto, parseDataLocal, formatarCompraIdCurto, formatarDataISOParaBR, formatarPreco } from '../utils.js';
import { atualizarCardsFinanceiro } from './financeiroTotais.js';
import { gerarTabelaFinanceiroCategorias, obterCategoriasEntradas } from './financeiroCategorias.js';
import { atualizarOperacoesPeriodo } from './financeiroOperacoes.js';
import { atualizarProjecao } from './financeiroProjecao.js';

let dados = [];
let filtrosIniciados = false;

// 📝 Atualizar descrição dos filtros aplicados
export function atualizarDescricaoFiltrosFinanceiro() {
  const inicio = document.getElementById('fin-data-inicio').value;
  const fim = document.getElementById('fin-data-fim').value;
  const fornecedor = document.getElementById('fin-fornecedor').value.trim();
  const tipoEl = document.getElementById('fin-data-tipo');
  const tipo = tipoEl && tipoEl.value === 'compra' ? 'compra' : 'vencimento';

  const inicioBR = formatarDataISOParaBR(inicio);
  const fimBR = formatarDataISOParaBR(fim);

  let texto = 'Exibindo todos os dados de compras.';

  if (inicio || fim) {
    texto = `Exibindo compras por ${tipo} de ${inicioBR || '...'} até ${fimBR || '...'}`;
  }

  if (fornecedor) {
    const intervalo = inicio || fim ? ` entre ${inicioBR || '...'} e ${fimBR || '...'} (${tipo})` : '';
    texto = `Exibindo compras do fornecedor ${fornecedor}${intervalo}`;
  }

  const el = document.getElementById('descricao-filtros-fin');
  if (el) el.textContent = texto;
}

function formatarResumoParcelas(parcelas = []) {
  if (!Array.isArray(parcelas) || parcelas.length === 0) return '-';

  const total = parcelas.length;
  const pagas = parcelas.filter(p => p.status === 'pago').length;
  const pendentes = total - pagas;

  let texto;
  if (pendentes === 0) {
    texto = 'Nenhuma pendente';
  } else {
    const plural = pendentes > 1 ? 's' : '';
    texto = `${pendentes} parcela${plural} pendente${plural}`;
  }

  if (pagas > 0 && pendentes > 0) {
    texto += `<br><small>${pagas} de ${total} pagas</small>`;
  }

  return texto;
}

function calcularValorPago(registro) {
  const parcelas = Array.isArray(registro.parcelas) && registro.parcelas.length > 0
    ? registro.parcelas
    : [{ valor: registro.valor, status: registro.status }];
  return parcelas.reduce((s, p) => {
    const v = Number(p.valor) || 0;
    return p.status === 'pago' ? s + v : s;
  }, 0);
}

function calcularValorAberto(registro) {
  const parcelas = Array.isArray(registro.parcelas) && registro.parcelas.length > 0
    ? registro.parcelas
    : [{ valor: registro.valor, status: registro.status }];
  return parcelas.reduce((s, p) => {
    const v = Number(p.valor) || 0;
    return p.status === 'pago' ? s : s + v;
  }, 0);
}

function obterProximoVencimento(registro) {
  let datas = [];
  if (Array.isArray(registro.parcelas) && registro.parcelas.length > 0) {
    datas = registro.parcelas
      .filter(p => p.status !== 'pago' && p.vencimento)
      .map(p => parseDataLocal(p.vencimento))
      .filter(d => !isNaN(d));
  } else if (registro.dataVencimento && registro.status !== 'pago') {
    const d = registro.dataVencimento instanceof Date
      ? registro.dataVencimento
      : parseDataLocal(registro.dataVencimento);
    if (!isNaN(d)) datas = [d];
  }

  if (datas.length === 0) return '-';

  const proximo = datas.reduce((min, d) => d < min ? d : min, datas[0]);
  return proximo.toLocaleDateString('pt-BR');
}

// 🔥 Setar dados
export function setDadosFinanceiro(novosDados) {
  dados = novosDados;
}

// 🔍 Obter dados conforme filtros aplicados
export function dadosFiltradosFinanceiro() {
  const fornecedorFiltro = document.getElementById('fin-fornecedor').value;
  const formaFiltro = document.getElementById('fin-forma').value;
  const statusFiltro = document.getElementById('fin-status').value;
  const catProdFiltro = document.getElementById('fin-categoria-prod').value;
  const catProdNorm = normalizarTexto(catProdFiltro);
  const inicio = document.getElementById('fin-data-inicio').value;
  const fim = document.getElementById('fin-data-fim').value;
  const tipoEl = document.getElementById('fin-data-tipo');
  const tipoData = tipoEl ? tipoEl.value : 'vencimento';
  const inicioData = inicio ? parseDataLocal(inicio) : null;
  const fimData = fim ? parseDataLocal(fim) : null;

  return dados.filter(d => {
    const fornMatch = fornecedorFiltro === '' || d.fornecedorOuCliente === fornecedorFiltro;
    const formaMatch = formaFiltro === '' || d.formaPagamento === formaFiltro;
    let statusMatch = true;
    if (statusFiltro) {
      if (statusFiltro === 'pago') {
        const parcelas = Array.isArray(d.parcelas) && d.parcelas.length > 0
          ? d.parcelas
          : [{ status: d.status }];
        statusMatch = parcelas.some(p => p.status === 'pago');
      } else {
        statusMatch = d.statusParcelas === statusFiltro;
      }
    }
    const catProdMatch = catProdNorm === '' || (Array.isArray(d.categoriasProdutos) && d.categoriasProdutos.some(c => normalizarTexto(c) === catProdNorm));
    let dataMatch = true;
    if (inicioData || fimData) {
      if (tipoData === 'compra') {
        const compra = d.dataLancamento instanceof Date ? d.dataLancamento : parseDataLocal(d.dataLancamento);
        dataMatch = !!compra && (!inicioData || compra >= inicioData) && (!fimData || compra <= fimData);
      } else {
        const vencs = [];
        if (Array.isArray(d.parcelas)) {
          d.parcelas.forEach(p => {
            if (p.vencimento) vencs.push(parseDataLocal(p.vencimento));
          });
        }
        if (vencs.length === 0 && d.dataVencimento) vencs.push(parseDataLocal(d.dataVencimento));
        dataMatch = vencs.some(v => {
          if (!v || isNaN(v)) return false;
          if (inicioData && v < inicioData) return false;
          if (fimData && v > fimData) return false;
          return true;
        });
      }
    }

    return fornMatch && formaMatch && statusMatch && catProdMatch && dataMatch;
  });
}

// 🔍 Gerar filtros dinâmicos
export function gerarFiltrosFinanceiro() {
  const fornecedores = new Set();
  const formas = new Set();
  const statusParcelas = new Set();
  const categoriasProdMap = new Map();
  const categoriasEntradas = obterCategoriasEntradas();

  const selFornecedor = document.getElementById('fin-fornecedor').value;
  const selForma = document.getElementById('fin-forma').value;
  const selStatus = document.getElementById('fin-status').value;
  const selCatProd = document.getElementById('fin-categoria-prod').value;

  dados.forEach(d => {
    if (d.fornecedorOuCliente) fornecedores.add(d.fornecedorOuCliente);
    if (d.formaPagamento) formas.add(d.formaPagamento);
    if (d.statusParcelas) statusParcelas.add(d.statusParcelas);
    if (Array.isArray(d.categoriasProdutos)) {
      d.categoriasProdutos.forEach(c => {
        const norm = normalizarTexto(c);
        if (!categoriasProdMap.has(norm)) categoriasProdMap.set(norm, c);
      });
    }
  });

  categoriasEntradas.forEach(c => {
    const norm = normalizarTexto(c);
    if (!categoriasProdMap.has(norm)) categoriasProdMap.set(norm, c);
  });

  // Garante que todos os status principais estejam disponíveis no filtro
  ['pago', 'pendente', 'vencido'].forEach(s => statusParcelas.add(s));

  document.getElementById('fin-fornecedor').innerHTML =
    `<option value="">Fornecedor</option>` +
    [...fornecedores].sort().map(f => `<option value="${f}">${f}</option>`).join('');

  document.getElementById('fin-forma').innerHTML =
    `<option value="">Forma</option>` +
    [...formas].sort().map(f => `<option value="${f}">${f}</option>`).join('');

  document.getElementById('fin-status').innerHTML =
    `<option value="">Status</option>` +
    [...statusParcelas].sort().map(s => `<option value="${s}">${s}</option>`).join('');

  document.getElementById('fin-categoria-prod').innerHTML =
    `<option value="">Categoria</option>` +
    [...categoriasProdMap.values()].sort((a,b) => a.localeCompare(b)).map(c => {
      const t = c.length > 20 ? c.slice(0,17) + "..." : c;
      return `<option value="${c}" title="${c}">${t}</option>`;
    }).join("");

  document.getElementById('fin-fornecedor').value = selFornecedor;
  document.getElementById('fin-forma').value = selForma;
  document.getElementById('fin-status').value = selStatus;
  document.getElementById('fin-categoria-prod').value = selCatProd;
  document.getElementById("fin-categoria-prod").title = document.getElementById("fin-categoria-prod").value;

  if (!filtrosIniciados) {
    ['fin-fornecedor','fin-forma','fin-status','fin-categoria-prod','fin-data-inicio','fin-data-fim','fin-data-tipo']
      .forEach(id => {
        document.getElementById(id)?.addEventListener('input', gerarTabelaFinanceiro);
      });
    document.getElementById("fin-categoria-prod")?.addEventListener("change", e => { e.target.title = e.target.value; });
    filtrosIniciados = true;
  }
}

// 📊 Renderizar Tabela
export function gerarTabelaFinanceiro() {
  const lista = document.getElementById("tabela-financeiro");

  const filtrados = dadosFiltradosFinanceiro();
  const catFiltroNorm = normalizarTexto(document.getElementById('fin-categoria-prod').value);

  if (filtrados.length === 0) {
    const msg = catFiltroNorm
      ? 'Nenhum gasto encontrado nesta categoria no período selecionado.'
      : '❌ Nenhum dado encontrado.';
    lista.innerHTML = `<p>${msg}</p>`;
    atualizarCardsFinanceiro([]);
    gerarTabelaFinanceiroCategorias([]);
    atualizarDescricaoFiltrosFinanceiro();
    atualizarOperacoesPeriodo();
    atualizarProjecao([]);
    return;
  }

  let html = `
    <table class="tabela">
      <thead>
        <tr>
          <th>CompraID</th>
          <th>Fornecedor</th>
          <th>Próximo<br>vencimento</th>
          <th>Forma<br>de Pagamento</th>
          <th>Valor total</th>
          <th>Valor pago</th>
          <th>Valor em aberto</th>
          <th>Parcelas</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtrados.forEach(d => {
    const proxVenc = obterProximoVencimento(d);
    const aberto = calcularValorAberto(d);
    const pago = calcularValorPago(d);
    const nomeFornecedor = d.fornecedorOuCliente || '-';
    const fornecedorEscapado = nomeFornecedor.replace(/"/g, '&quot;');
    const fornecedorCurto = nomeFornecedor.length > 20
      ? nomeFornecedor.slice(0, 20) + '...'
      : nomeFornecedor;
    const compraEscapado = (d.compraId || '').replace(/"/g, '&quot;');
    const classeStatus = d.statusParcelas ? `status-${d.statusParcelas}` : '';
    html += `
      <tr class="${classeStatus}">
        <td class="compra-id-cell" title="${compraEscapado}">${formatarCompraIdCurto(d.compraId)}</td>
        <td class="fornecedor-cell" title="${fornecedorEscapado}">${fornecedorCurto}</td>
        <td>${proxVenc}</td>
        <td>${d.formaPagamento}</td>
        <td>${formatarPreco(d.valor)}</td>
        <td>${formatarPreco(pago)}</td>
        <td class="valor-aberto">${formatarPreco(aberto)}</td>
        <td>
          ${formatarResumoParcelas(d.parcelas)}<br>
          <button onclick="abrirModalParcelas('${d.compraId}')">Detalhes</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  lista.innerHTML = html;

  atualizarCardsFinanceiro(filtrados);
  gerarTabelaFinanceiroCategorias(filtrados);
  atualizarDescricaoFiltrosFinanceiro();
  atualizarOperacoesPeriodo();
  atualizarProjecao(filtrados);
}

// 👉 Rolar e destacar a primeira linha vencida na tabela
export function rolarParaPrimeiraVencida() {
  const linha = document.querySelector('#tabela-financeiro tr.status-vencido');
  if (linha) {
    linha.classList.add('destacar');
    linha.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => linha.classList.remove('destacar'), 2000);
  } else {
    document.getElementById('tabela-financeiro')?.scrollIntoView({ behavior: 'smooth' });
  }
}
