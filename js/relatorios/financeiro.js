// financeiro.js — Controlador geral do módulo financeiro

import { carregarDadosFinanceiro } from './financeiroDados.js';
import { setDadosFinanceiro, gerarFiltrosFinanceiro, gerarTabelaFinanceiro } from './financeiroTabela.js';
import { exportarFinanceiroCSV, exportarFinanceiroExcel } from './financeiroExportar.js';
import { mostrarSpinner, esconderSpinner, mostrarMensagem } from '../utils.js';
import { db, getEmpresaIdDoUsuario } from '../firebaseConfig.js';
import { collection, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

let dadosFinanceiro = [];

// 🔄 Atualizar tudo
export async function atualizarTabelaFinanceiro() {
  try {
    mostrarSpinner();

    dadosFinanceiro = await carregarDadosFinanceiro();

    setDadosFinanceiro(dadosFinanceiro);
    gerarFiltrosFinanceiro();
    gerarTabelaFinanceiro();

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
    exportarFinanceiroExcel(dadosFinanceiro);
  });

  atualizarTabelaFinanceiro();
});

// 📑 Modal de parcelas
window.abrirModalParcelas = async function (compraId) {
  const registro = dadosFinanceiro.find(d => d.compraId === compraId);
  if (!registro) return;

  document.getElementById('modal-compra-id').textContent = compraId;
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
    html += `<h4>Parcelas</h4><table class="tabela"><thead><tr><th>#</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead><tbody>`;
    registro.parcelas.forEach(p => {
      const venc = p.vencimento ? new Date(p.vencimento).toLocaleDateString('pt-BR') : '-';
      const pago = p.status === 'pago';
      const btn = pago ? '' : `<button onclick="marcarParcelaComoPaga('${compraId}', ${p.numero})">Marcar como pago</button>`;
      html += `<tr><td>${p.numero}</td><td>R$ ${(p.valor || 0).toFixed(2)}</td><td>${venc}</td><td>${p.status}</td><td>${btn}</td></tr>`;
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
  const hoje = new Date().toISOString().split('T')[0];
  const data = prompt('Data do pagamento (yyyy-mm-dd):', hoje);
  if (!data) return;

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
