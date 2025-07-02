// previsaoDados.js — Dados da previsão de esgotamento

import { db, getEmpresaIdDoUsuario } from '../firebaseConfig.js';
import { collection, getDocs, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { normalizarTexto } from '../utils.js';

export async function carregarDadosPrevisao(periodoMeses = 3) {
  const hoje = new Date();
  const dataInicio = new Date();
  dataInicio.setMonth(dataInicio.getMonth() - periodoMeses);

  const empresaId = await getEmpresaIdDoUsuario();
  const movSnap = await getDocs(
    query(
      collection(db, "empresas", empresaId, "movimentacoes"),
      where("tipo", "==", "saida"),
      where("dataMovimentacao", ">=", Timestamp.fromDate(dataInicio)),
      orderBy("dataMovimentacao", "asc")
    )
  );

  const mapaSaidas = {};
  movSnap.forEach(doc => {
    const d = doc.data();
    const id = d.produtoId;
    if (!id) return;
    const qtd = Number(d.quantidade) || 0;
    const dataMov = d.dataMovimentacao?.toDate();
    if (!dataMov) return;
    if (!mapaSaidas[id]) mapaSaidas[id] = [];
    mapaSaidas[id].push({ data: dataMov, quantidade: qtd });
  });

  const snapshot = await getDocs(collection(db, "empresas", empresaId, "produtos"));

  return snapshot.docs.map(doc => {
    const data = doc.data();

    const saidas = (mapaSaidas[doc.id] || []).sort((a, b) => a.data - b.data);
    const quantidadeEstoque = Number(data.quantidade) || 0;
    const quantidadeMinima = Number(data.quantidadeMinima) || 0;

    let mediaDiasPorUnidade = null;
    let diasPrevisao = Infinity;
    let dataPrevistaEsgotamento = null;
    let consumoMensal = 0;
    let consumoIndefinido = false;

    if (saidas.length >= 2) {
      let somaIntervalos = 0;
      let quantidadeConsumida = 0;
      for (let i = 0; i < saidas.length - 1; i++) {
        const atual = saidas[i];
        const proxima = saidas[i + 1];
        const diffDias = (proxima.data - atual.data) / 86400000;
        somaIntervalos += diffDias;
        quantidadeConsumida += Number(atual.quantidade) || 0;
      }

      const consumoDiario = quantidadeConsumida > 0 ? quantidadeConsumida / somaIntervalos : 0;
      consumoMensal = consumoDiario * 30;
      if (quantidadeConsumida > 0) {
        mediaDiasPorUnidade = somaIntervalos / quantidadeConsumida;
        diasPrevisao = mediaDiasPorUnidade * quantidadeEstoque;
        if (isFinite(diasPrevisao)) {
          dataPrevistaEsgotamento = new Date(hoje.getTime() + diasPrevisao * 86400000);
        }
      } else {
        consumoIndefinido = true;
      }
    } else {
      consumoIndefinido = true;
    }

    const ultimaSaida = saidas.length > 0 ? saidas[saidas.length - 1].data : null;

    const diasDeEstoque = diasPrevisao;

    return {
      id: doc.id,
      nome: data.nome || "-",
      nomeBusca: normalizarTexto(data.nome || ""),
      categoria: data.categoria || "-",
      fornecedor: data.fornecedor || "-",
      quantidade: quantidadeEstoque,
      quantidadeMinima,
      consumoMensal,
      mediaDiasPorUnidade,
      diasDeEstoque,
      diasPrevisao,
      dataPrevistaEsgotamento,
      ultimaSaida,
      consumoIndefinido,
      lote: data.lote || "-",
      observacoes: data.observacoes || ""
    };
  });
}
