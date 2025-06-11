// estoqueDados.js — Buscar dados de estoque (alertas)

import { db } from '../firebaseConfig.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { normalizarTexto } from '../utils.js';

export async function carregarDadosEstoque(diasValidade = 30) {
  const snapshot = await getDocs(
    query(collection(db, "produtos"), orderBy("nome"))
  );

  const hoje = new Date();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    const validade = data.validade?.toDate() || null;
    const diasParaVencer = validade ? Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24)) : null;

    return {
      id: doc.id,
      nome: data.nome || "-",
      nomeBusca: normalizarTexto(data.nome || ""),
      categoria: data.categoria || "-",
      fornecedor: data.fornecedor || "-",
      quantidade: Number(data.quantidade) || 0,
      quantidadeMinima: Number(data.quantidadeMinima) || 0,
      validade: validade,
      diasParaVencer: diasParaVencer,
      precoCompra: Number(data.precoCompra) || 0,
      lote: data.lote || "-",
      observacoes: data.observacoes || "",

      alertaEstoque: (data.quantidade || 0) <= (data.quantidadeMinima || 0),
      alertaValidade: diasParaVencer !== null && diasParaVencer <= diasValidade
    };
  });
}
