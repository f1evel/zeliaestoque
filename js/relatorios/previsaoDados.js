// previsaoDados.js — Dados da previsão de esgotamento

import { db } from '../firebaseConfig.js';
import { collection, getDocs, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { normalizarTexto } from '../utils.js';

export async function carregarDadosPrevisao(periodoMeses = 3) {
  const hoje = new Date();
  const dataInicio = new Date();
  dataInicio.setMonth(dataInicio.getMonth() - periodoMeses);

  const movSnap = await getDocs(
    query(
      collection(db, "movimentacoes"),
      where("tipo", "==", "saida"),
      where("dataMovimentacao", ">=", Timestamp.fromDate(dataInicio)),
      orderBy("dataMovimentacao", "desc")
    )
  );

  const mapaConsumo = {};
  movSnap.forEach(doc => {
    const d = doc.data();
    const id = d.produtoId;
    if (!id) return;
    const qtd = Number(d.quantidade) || 0;
    const dataMov = d.dataMovimentacao?.toDate();
    if (!mapaConsumo[id]) {
      mapaConsumo[id] = { total: 0, ultimaSaida: null };
    }
    mapaConsumo[id].total += qtd;
    if (dataMov && (!mapaConsumo[id].ultimaSaida || dataMov > mapaConsumo[id].ultimaSaida)) {
      mapaConsumo[id].ultimaSaida = dataMov;
    }
  });

  const snapshot = await getDocs(collection(db, "produtos"));

  return snapshot.docs.map(doc => {
    const data = doc.data();

    const consumoTotal = mapaConsumo[doc.id]?.total || 0;
    const ultimaSaida = mapaConsumo[doc.id]?.ultimaSaida || null;
    const consumoMensal = consumoTotal / periodoMeses;
    const quantidade = Number(data.quantidade) || 0;
    const quantidadeMinima = Number(data.quantidadeMinima) || 0;

    const diasDeEstoque = consumoMensal > 0 ? Math.floor((quantidade * 30) / consumoMensal) : Infinity;

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
      ultimaSaida,
      lote: data.lote || "-",
      observacoes: data.observacoes || ""
    };
  });
}
