// financeiroDados.js — Buscar dados do Firestore

import { db, getEmpresaIdDoUsuario } from '../firebaseConfig.js';
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

export async function carregarDadosFinanceiro(periodoMeses = 3) {
  const hoje = new Date();
  const dataLimite = new Date();
  dataLimite.setMonth(hoje.getMonth() - periodoMeses);

  const empresaId = await getEmpresaIdDoUsuario();
  const snapshot = await getDocs(
    query(collection(db, "empresas", empresaId, "financeiro"), orderBy("dataLancamento", "desc"))
  );

  const categoriasPorCompra = {};
  const movSnap = await getDocs(
    query(collection(db, 'empresas', empresaId, 'movimentacoes'), where('tipo', '==', 'entrada'))
  );
  movSnap.forEach(m => {
    const d = m.data();
    if (!d.compraId) return;
    if (!categoriasPorCompra[d.compraId]) categoriasPorCompra[d.compraId] = new Set();
    if (d.categoria) categoriasPorCompra[d.compraId].add(d.categoria);
  });

  return snapshot.docs
    .map(doc => {
      const d = doc.data();
      const dataLanc = d.dataLancamento?.toDate?.() || null;
      const dataVenc = d.dataVencimento?.toDate?.() || null;
      const dataPag = d.dataPagamento?.toDate?.() || null;

      const parcelas = Array.isArray(d.parcelas) ? d.parcelas : [];

      const hoje = new Date();
      let statusParcelas = "pago";
      let temVencida = false;
      parcelas.forEach(p => {
        const venc = p.vencimento ? new Date(p.vencimento) : null;
        if (p.status !== "pago") {
          statusParcelas = "pendente";
          if (venc && venc < hoje) temVencida = true;
        }
      });
      if (temVencida) statusParcelas = "vencido";

      const categorias = categoriasPorCompra[d.compraId]
        ? Array.from(categoriasPorCompra[d.compraId])
        : [];

      return {
        id: doc.id,
        tipo: d.tipo || "-",
        descricao: d.descricao || "-",
        categoria: d.categoria || "-",
        valor: Number(d.valorTotal) || 0,
        status: d.status || "pendente",
        compraId: d.compraId || "-",
        parcelas,
        statusParcelas,
        categoriasProdutos: categorias,
        fornecedorOuCliente: d.fornecedorOuCliente || "-",
        formaPagamento: d.formaPagamento || "-",
        dataLancamento: dataLanc,
        dataVencimento: dataVenc,
        dataPagamento: dataPag,
        observacoes: d.observacoes || "-",
        produtos: Array.isArray(d.produtos) ? d.produtos : [],
        mes: dataLanc ? `${dataLanc.getFullYear()}-${String(dataLanc.getMonth() + 1).padStart(2, '0')}` : "",
      };
    })
    .filter(item => !item.dataLancamento || item.dataLancamento >= dataLimite);
}
