// financeiroDados.js — Buscar dados do Firestore

import { db } from '../firebaseConfig.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

export async function carregarDadosFinanceiro(periodoMeses = 3) {
  const hoje = new Date();
  const dataLimite = new Date();
  dataLimite.setMonth(hoje.getMonth() - periodoMeses);

  const snapshot = await getDocs(
    query(collection(db, "financeiro"), orderBy("dataLancamento", "desc"))
  );

  return snapshot.docs
    .map(doc => {
      const d = doc.data();
      const dataLanc = d.dataLancamento?.toDate?.() || null;
      const dataVenc = d.dataVencimento?.toDate?.() || null;
      const dataPag = d.dataPagamento?.toDate?.() || null;

      return {
        id: doc.id,
        tipo: d.tipo || "-",
        descricao: d.descricao || "-",
        categoria: d.categoria || "-",
        valor: Number(d.valorTotal) || 0,
        status: d.status || "pendente",
        fornecedorOuCliente: d.fornecedorOuCliente || "-",
        formaPagamento: d.formaPagamento || "-",
        dataLancamento: dataLanc,
        dataVencimento: dataVenc,
        dataPagamento: dataPag,
        observacoes: d.observacoes || "-",
        mes: dataLanc ? `${dataLanc.getFullYear()}-${String(dataLanc.getMonth() + 1).padStart(2, '0')}` : "",
      };
    })
    .filter(item => !item.dataLancamento || item.dataLancamento >= dataLimite);
}
