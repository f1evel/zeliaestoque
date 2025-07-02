// financeiroCategorias.js — Gasto por categoria de produto

import { db, getEmpresaIdDoUsuario } from '../firebaseConfig.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { parseDataLocal } from '../utils.js';

let entradas = [];

export async function carregarEntradasFinanceiro() {
  const empresaId = await getEmpresaIdDoUsuario();
  const snap = await getDocs(
    query(collection(db, 'empresas', empresaId, 'movimentacoes'), where('tipo', '==', 'entrada'))
  );
  entradas = snap.docs.map(doc => {
    const d = doc.data();
    const dataMov = d.dataMovimentacao?.toDate?.() || null;
    const custo = typeof d.custoTotal === 'number'
      ? d.custoTotal
      : (Number(d.quantidade) || 0) * (Number(d.precoUnitario) || 0);
    return {
      compraId: d.compraId || '-',
      categoria: d.categoria || '-',
      custoTotal: custo,
      dataMovimentacao: dataMov
    };
  });
  return entradas;
}

function mesesEntre(inicio, fim) {
  if (!inicio || !fim) return 1;
  const i = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const f = new Date(fim.getFullYear(), fim.getMonth(), 1);
  return (f.getFullYear() - i.getFullYear()) * 12 + (f.getMonth() - i.getMonth()) + 1;
}

export function gerarTabelaFinanceiroCategorias(finDados) {
  const cont = document.getElementById('tabela-fin-categorias');
  if (!cont) return;

  const inicioStr = document.getElementById('fin-data-inicio').value;
  const fimStr = document.getElementById('fin-data-fim').value;
  const inicioData = inicioStr ? parseDataLocal(inicioStr) : null;
  const fimData = fimStr ? parseDataLocal(fimStr) : null;

  const compraIds = finDados.map(d => d.compraId);
  const totais = {};
  let minData = null;
  let maxData = null;

  entradas.forEach(e => {
    if (!compraIds.includes(e.compraId)) return;
    const data = e.dataMovimentacao;
    if (inicioData && data && data < inicioData) return;
    if (fimData && data && data > fimData) return;

    const cat = e.categoria || '-';
    const val = e.custoTotal || 0;
    totais[cat] = (totais[cat] || 0) + val;

    if (data) {
      if (!minData || data < minData) minData = data;
      if (!maxData || data > maxData) maxData = data;
    }
  });

  const categorias = Object.keys(totais);
  if (categorias.length === 0) {
    cont.innerHTML = '<p>❌ Nenhum dado encontrado.</p>';
    return;
  }

  const meses = inicioData && fimData ? mesesEntre(inicioData, fimData) : mesesEntre(minData, maxData);

  let html = `<table class="tabela"><thead><tr><th>Categoria</th><th>Total Gasto</th><th>Custo Médio por Mês</th></tr></thead><tbody>`;
  categorias.sort().forEach(cat => {
    const total = totais[cat];
    const medio = total / (meses || 1);
    html += `<tr><td>${cat}</td><td>R$ ${total.toFixed(2)}</td><td>R$ ${medio.toFixed(2)}</td></tr>`;
  });
  html += '</tbody></table>';
  cont.innerHTML = html;
}

