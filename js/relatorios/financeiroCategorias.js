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
      quantidade: Number(d.quantidade) || 0,
      custoTotal: custo,
      dataMovimentacao: dataMov
    };
  });
  return entradas;
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
    if (!totais[cat]) totais[cat] = { valor: 0, quantidade: 0 };
    totais[cat].valor += e.custoTotal || 0;
    totais[cat].quantidade += e.quantidade || 0;

    if (data) {
      if (!minData || data < minData) minData = data;
      if (!maxData || data > maxData) maxData = data;
    }
  });

  const categorias = Object.keys(totais);
  if (categorias.length === 0) {
    cont.innerHTML = '<p>Nenhum gasto encontrado nesta categoria no período selecionado.</p>';
    return;
  }

  let html = `<table class="tabela"><thead><tr><th>Categoria</th><th>Quantidade comprada</th><th>Valor total gasto</th></tr></thead><tbody>`;
  categorias.sort().forEach(cat => {
    const info = totais[cat];
    html += `<tr><td>${cat}</td><td>${info.quantidade.toLocaleString('pt-BR')} unidades</td><td>R$ ${info.valor.toFixed(2)}</td></tr>`;
  });
  html += '</tbody></table>';
  cont.innerHTML = html;
}

