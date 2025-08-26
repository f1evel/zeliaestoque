// financeiro.js — Controlador geral do módulo financeiro

import { carregarDadosFinanceiro } from './financeiroDados.js';
import { setDadosFinanceiro, gerarFiltrosFinanceiro, gerarTabelaFinanceiro, dadosFiltradosFinanceiro, rolarParaPrimeiraVencida } from './financeiroTabela.js';
import { carregarEntradasFinanceiro } from './financeiroCategorias.js';
import { carregarOperacoes } from './financeiroOperacoes.js';
import { exportarFinanceiroCSV, exportarFinanceiroExcel, exportarFinanceiroPDF } from './financeiroExportar.js';
import { mostrarSpinner, esconderSpinner, mostrarMensagem, parseDataBR, formatarCompraIdCurto, formatarPreco } from '../utils.js';
import { db, getEmpresaIdDoUsuario } from '../firebaseConfig.js';
import { collection, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

let dadosFinanceiro = [];
let entradasFinanceiro = [];

function exibirAlertaVencidas() {
  const aviso = document.getElementById('alerta-vencidas');
  if (!aviso) return;

  const hoje = new Date();
  let totalVencidas = 0;

  dadosFinanceiro.forEach(d => {
    const parcelas = Array.isArray(d.parcelas) && d.parcelas.length > 0
      ? d.parcelas
      : [{ vencimento: d.dataVencimento, status: d.status }];
    parcelas.forEach(p => {
      const venc = p.vencimento ? new Date(p.vencimento) : null;
      if (p.status !== 'pago' && venc && venc < hoje) totalVencidas++;
    });
  });

  if (totalVencidas > 0) {
    const textoSingular = `⚠️ Atenção: Você possui 1 parcela vencida. <a href="#" id="btn-ver-vencidas">Clique aqui</a> para visualizá-la.`;
    const textoPlural = `⚠️ Atenção: Você possui ${totalVencidas} parcelas vencidas. <a href="#" id="btn-ver-vencidas">Clique aqui</a> para visualizá-las.`;
    aviso.innerHTML = totalVencidas === 1 ? textoSingular : textoPlural;
    aviso.style.display = 'block';
    const btn = document.getElementById('btn-ver-vencidas');
    btn?.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('fin-status').value = 'vencido';
      gerarTabelaFinanceiro();
      rolarParaPrimeiraVencida();
      aviso.style.display = 'none';
    }, { once: true });
  } else {
    aviso.style.display = 'none';
    aviso.innerHTML = '';
  }
}

// 🔢 Calcula status geral das parcelas de uma compra
function calcularStatusParcelas(parcelas = []) {
  const hoje = new Date();
  let status = 'pago';
  let temVencida = false;
  parcelas.forEach(p => {
    const venc = p.vencimento ? new Date(p.vencimento) : null;
    if (p.status !== 'pago') {
      status = 'pendente';
      if (venc && venc < hoje) temVencida = true;
    }
  });
  return temVencida ? 'vencido' : status;
}

// 🔄 Atualizar tudo
export async function atualizarTabelaFinanceiro() {
  try {
    mostrarSpinner();

    dadosFinanceiro = await carregarDadosFinanceiro();
    entradasFinanceiro = await carregarEntradasFinanceiro();
    await carregarOperacoes();

    setDadosFinanceiro(dadosFinanceiro);
    gerarFiltrosFinanceiro();
    gerarTabelaFinanceiro();
    exibirAlertaVencidas();

  } catch (error) {
    console.error("❌ Erro ao atualizar financeiro:", error);
  } finally {
    esconderSpinner();
  }
}

// 🧹 Limpar filtros
export function limparFiltrosFinanceiro() {
  document.getElementById('fin-data-inicio').value = '';
  document.getElementById('fin-data-fim').value = '';
  document.getElementById('fin-data-tipo').value = 'vencimento';
  document.getElementById('fin-fornecedor').value = '';
  document.getElementById('fin-forma').value = '';
  document.getElementById('fin-status').value = '';
  document.getElementById('fin-categoria-prod').value = '';

  gerarTabelaFinanceiro();
}

// 🚀 Executa na carga da página
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("botao-atualizar-fin")?.addEventListener("click", atualizarTabelaFinanceiro);
  document.getElementById("botao-limpar-fin")?.addEventListener("click", limparFiltrosFinanceiro);

  document.getElementById("botao-exportar-csv-fin")?.addEventListener("click", () => {
    exportarFinanceiroCSV(dadosFinanceiro);
  });

  document.getElementById("botao-exportar-excel-fin")?.addEventListener("click", () => {
    exportarFinanceiroExcel(dadosFiltradosFinanceiro());
  });

  document.getElementById("botao-exportar-pdf-fin")?.addEventListener("click", () => {
    exportarFinanceiroPDF(dadosFiltradosFinanceiro());
  });

  atualizarTabelaFinanceiro();
});

// 📑 Modal de parcelas

window.abrirModalParcelas = async function (compraId) {
  const registro = dadosFinanceiro.find(d => d.compraId === compraId);
  if (!registro) return;

  document.getElementById('modal-compra-id').textContent = formatarCompraIdCurto(compraId);
  const contParcelas = document.getElementById('parcelas-detalhes');
  const contProdutos = document.getElementById('produtos-compra-detalhes');
  const contInfo = document.getElementById('info-compra');

  let htmlParcelas = '';
  let htmlProdutos = '';
  let htmlInfo = '';
  let totalCompra = 0;

  // Informações básicas da compra
  // Informações resumidas removidas por serem redundantes com a tabela de parcelas
  htmlInfo = '';

  // Parcelas
  if (!registro.parcelas || registro.parcelas.length === 0) {
    htmlParcelas += '<p>Sem parcelas cadastradas.</p>';
  } else {
    const total = registro.parcelas.length;
    htmlParcelas += `<h4>Parcelas</h4><table class="tabela"><thead><tr><th>#</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>`;
    registro.parcelas.forEach(p => {
      const vencDate = p.vencimento ? new Date(p.vencimento) : null;
      const venc = vencDate ? vencDate.toLocaleDateString('pt-BR') : '-';
      const pago = p.status === 'pago';
      let statusTexto = '❌ Pendente';
      if (pago) {
        statusTexto = '✅ Pago';
      } else if (vencDate && vencDate < new Date()) {
        statusTexto = '⚠️ Vencido';
      }
      const btn = pago
        ? `<button onclick="marcarParcelaComoNaoPaga('${compraId}', ${p.numero})">Marcar como não pago</button>`
        : `<button onclick="marcarParcelaComoPaga('${compraId}', ${p.numero})">Marcar como pago</button>`;
      htmlParcelas += `<tr><td>${p.numero}/${total}</td><td>${formatarPreco(p.valor || 0)}</td><td>${venc}</td><td>${statusTexto}</td><td>${btn}</td></tr>`;
    });
    htmlParcelas += '</tbody></table>';
  }

  // Produtos relacionados
  let movSnap = null;
  try {
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(
      collection(db, 'empresas', empresaId, 'movimentacoes'),
      where('compraId', '==', compraId),
      where('tipo', '==', 'entrada')
    );
    movSnap = await getDocs(q);
  } catch (e) {
    console.error('Erro ao buscar produtos da compra', e);
  }

  if (movSnap && !movSnap.empty) {
    const agrupados = {};
    movSnap.docs.forEach(doc => {
      const d = doc.data();
      const key = `${d.produtoId || d.nomeProduto}|${d.precoUnitario || 0}`;
      if (!agrupados[key]) {
        agrupados[key] = {
          nome: d.nomeProduto,
          quantidade: 0,
          preco: Number(d.precoUnitario) || 0
        };
      }
      agrupados[key].quantidade += Number(d.quantidade) || 0;
    });

    htmlProdutos += '<h4>Produtos</h4><table class="tabela"><thead><tr><th>Produto</th><th>Quantidade</th><th>Preço unitário</th><th>Total</th></tr></thead><tbody>';
    Object.values(agrupados).forEach(p => {
      const total = p.quantidade * p.preco;
      totalCompra += total;
      htmlProdutos += `<tr><td>${p.nome}</td><td>${p.quantidade}</td><td>${formatarPreco(p.preco)}</td><td>${formatarPreco(total)}</td></tr>`;
    });
    htmlProdutos += `</tbody><tfoot><tr><th colspan="3" style="text-align:right;">Total da compra</th><th>${formatarPreco(totalCompra || registro.valor)}</th></tr></tfoot></table>`;
  } else if (Array.isArray(registro.produtos) && registro.produtos.length > 0) {
    htmlProdutos += '<h4>Produtos</h4><table class="tabela"><thead><tr><th>Produto</th><th>Quantidade</th><th>Preço unitário</th><th>Total</th></tr></thead><tbody>';
    registro.produtos.forEach(p => {
      const preco = Number(p.preco) || 0;
      const qtd = Number(p.quantidade) || 0;
      const total = qtd * preco;
      totalCompra += total;
      htmlProdutos += `<tr><td>${p.nome}</td><td>${qtd}</td><td>${formatarPreco(preco)}</td><td>${formatarPreco(total)}</td></tr>`;
    });
    htmlProdutos += `</tbody><tfoot><tr><th colspan="3" style="text-align:right;">Total da compra</th><th>${formatarPreco(totalCompra || registro.valor)}</th></tr></tfoot></table>`;
  } else {
    htmlProdutos += `<p>Produtos não localizados para esta compra. Total registrado: ${formatarPreco(registro.valor)}</p>`;
  }

  contInfo.innerHTML = htmlInfo;
  contParcelas.innerHTML = htmlParcelas;
  contProdutos.innerHTML = htmlProdutos;

  document.getElementById('modal-parcelas').style.display = 'block';
  document.getElementById('fundo-modal-parcelas').style.display = 'block';
};

window.fecharModalParcelas = function () {
  document.getElementById('modal-parcelas').style.display = 'none';
  document.getElementById('fundo-modal-parcelas').style.display = 'none';
};

// ✅ Marcar parcela como paga
window.marcarParcelaComoPaga = async function (compraId, numero) {
  const hojeStr = new Date().toLocaleDateString('pt-BR');
  const entrada = prompt('Digite a data (DD/MM/AAAA):', hojeStr);
  if (!entrada) return;

  const dataObj = parseDataBR(entrada);
  if (isNaN(dataObj.getTime())) {
    alert('Data inválida. Utilize o formato DD/MM/AAAA.');
    return;
  }

  const data = dataObj.toISOString().split('T')[0];

  try {
    mostrarSpinner();
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(collection(db, 'empresas', empresaId, 'financeiro'), where('compraId', '==', compraId));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Registro não encontrado');
    const ref = snap.docs[0].ref;
    const finData = snap.docs[0].data();
    const parcelas = Array.isArray(finData.parcelas) ? finData.parcelas.slice() : [];
    const idx = parcelas.findIndex(p => p.numero === numero);
    if (idx === -1) throw new Error('Parcela não encontrada');
    parcelas[idx] = { ...parcelas[idx], status: 'pago', dataPagamento: data };
    await updateDoc(ref, { parcelas });

    // Atualiza localmente para refletir imediatamente na tabela
    const pos = dadosFinanceiro.findIndex(d => d.compraId === compraId);
    if (pos !== -1) {
      dadosFinanceiro[pos].parcelas = parcelas;
      dadosFinanceiro[pos].statusParcelas = calcularStatusParcelas(parcelas);
      setDadosFinanceiro(dadosFinanceiro);
      gerarTabelaFinanceiro();
    }

    mostrarMensagem('✅ Parcela marcada como paga!');
    await atualizarTabelaFinanceiro();
    abrirModalParcelas(compraId);
  } catch (e) {
    console.error('Erro ao atualizar parcela', e);
    alert('❌ Erro ao marcar parcela como paga.');
  } finally {
    esconderSpinner();
  }
};

// ❌ Marcar parcela como não paga
window.marcarParcelaComoNaoPaga = async function (compraId, numero) {
  if (!confirm('Marcar esta parcela como não paga?')) return;

  try {
    mostrarSpinner();
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(collection(db, 'empresas', empresaId, 'financeiro'), where('compraId', '==', compraId));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Registro não encontrado');
    const ref = snap.docs[0].ref;
    const finData = snap.docs[0].data();
    const parcelas = Array.isArray(finData.parcelas) ? finData.parcelas.slice() : [];
    const idx = parcelas.findIndex(p => p.numero === numero);
    if (idx === -1) throw new Error('Parcela não encontrada');
    parcelas[idx] = { ...parcelas[idx], status: 'pendente', dataPagamento: null };
    await updateDoc(ref, { parcelas });

    const pos = dadosFinanceiro.findIndex(d => d.compraId === compraId);
    if (pos !== -1) {
      dadosFinanceiro[pos].parcelas = parcelas;
      dadosFinanceiro[pos].statusParcelas = calcularStatusParcelas(parcelas);
      setDadosFinanceiro(dadosFinanceiro);
      gerarTabelaFinanceiro();
    }

    mostrarMensagem('❌ Parcela marcada como não paga!');
    await atualizarTabelaFinanceiro();
    abrirModalParcelas(compraId);
  } catch (e) {
    console.error('Erro ao atualizar parcela', e);
    alert('❌ Erro ao marcar parcela como não paga.');
  } finally {
    esconderSpinner();
  }
};
