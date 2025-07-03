// financeiro.js — Controlador geral do módulo financeiro

import { carregarDadosFinanceiro } from './financeiroDados.js';
import { setDadosFinanceiro, gerarFiltrosFinanceiro, gerarTabelaFinanceiro, dadosFiltradosFinanceiro } from './financeiroTabela.js';
import { carregarEntradasFinanceiro } from './financeiroCategorias.js';
import { exportarFinanceiroCSV, exportarFinanceiroExcel, exportarFinanceiroPDF } from './financeiroExportar.js';
import { mostrarSpinner, esconderSpinner, mostrarMensagem, parseDataBR, formatarCompraIdCurto } from '../utils.js';
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
    aviso.innerHTML = `⚠️ Atenção: Você possui ${totalVencidas} parcelas vencidas. <a href="#" id="btn-ver-vencidas">Clique aqui</a> para visualizá-las.`;
    aviso.style.display = 'block';
    const btn = document.getElementById('btn-ver-vencidas');
    btn?.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('fin-status').value = 'vencido';
      gerarTabelaFinanceiro();
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
  document.getElementById('fin-compra-id').value = '';
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
  const cont = document.getElementById('parcelas-detalhes');

  let html = '';

  // Produtos relacionados
  try {
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(collection(db, 'empresas', empresaId, 'movimentacoes'), where('compraId', '==', compraId), where('tipo', '==', 'entrada'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      html += '<h4>Produtos</h4><table class="tabela"><thead><tr><th>Produto</th><th>Categoria</th><th>Qtd</th><th>Preço unitário</th><th>Subtotal</th></tr></thead><tbody>';
      snap.docs.forEach(doc => {
        const d = doc.data();
        const subtotal = (d.quantidade || 0) * (d.precoUnitario || 0);
        html += `<tr><td>${d.nomeProduto}</td><td>${d.categoria || '-'}</td><td>${d.quantidade}</td><td>R$ ${(d.precoUnitario || 0).toFixed(2)}</td><td>R$ ${subtotal.toFixed(2)}</td></tr>`;
      });
      html += '</tbody></table><br />';
    }
  } catch (e) {
    console.error('Erro ao buscar produtos da compra', e);
  }

  // Parcelas
  if (!registro.parcelas || registro.parcelas.length === 0) {
    html += '<p>Sem parcelas cadastradas.</p>';
  } else {
    const total = registro.parcelas.length;
    html += `<h4>Parcelas</h4><table class="tabela"><thead><tr><th>#</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>`;
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
      html += `<tr><td>${p.numero}/${total}</td><td>R$ ${(p.valor || 0).toFixed(2)}</td><td>${venc}</td><td>${statusTexto}</td><td>${btn}</td></tr>`;
    });
    html += '</tbody></table>';
  }

  cont.innerHTML = html;

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
