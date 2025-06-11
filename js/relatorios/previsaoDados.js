// previsaoDados.js — Dados da previsão de esgotamento

import { db } from '../firebaseConfig.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { normalizarTexto } from '../utils.js';

export async function carregarDadosPrevisao(periodoMeses = 3) {
  const snapshot = await getDocs(collection(db, "produtos"));
  const hoje = new Date();

  return snapshot.docs.map(doc => {
    const data = doc.data();

    const consumoMensal = Number(data.consumoMedioMensal) || 0;
    const quantidade = Number(data.quantidade) || 0;
    const quantidadeMinima = Number(data.quantidadeMinima) || 0;

    const diasDeEstoque = consumoMensal > 0 ? Math.floor((quantidade / (consumoMensal / 30))) : Infinity;

    const dataPrevistaEsgotamento = consumoMensal > 0
      ? new Date(hoje.getTime() + diasDeEstoque * 24 * 60 * 60 * 1000)
      : null;

    return {
      id: doc.id,
      nome: data.nome || "-",
      nomeBusca: normalizarTexto(data.nome || ""),
      categoria: data.categoria || "-",
      fornecedor: data.fornecedor || "-",
      quantidade,
      quantidadeMinima,
      consumoMensal,
      diasDeEstoque,
      dataPrevistaEsgotamento,
      lote: data.lote || "-",
      observacoes: data.observacoes || ""
    };
  });
}
