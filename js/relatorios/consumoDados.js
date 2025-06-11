import { db } from '../firebaseConfig.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { normalizarTexto } from '../utils.js';

export async function carregarDadosConsumo() {
  const snapshot = await getDocs(
    query(collection(db, "movimentacoes"), where("tipo", "==", "saida"), orderBy("dataMovimentacao", "desc"))
  );

  return snapshot.docs.map(doc => {
    const d = doc.data();
    const dataMov = d.dataMovimentacao?.toDate();

    return {
      id: doc.id,
      nome: d.nomeProduto || "-",
      categoria: d.categoria || "-",
      fornecedor: d.fornecedor || "-",
      unidade: d.unidadeMedida || "-",
      quantidade: Number(d.quantidade) || 0,
      precoUnitario: Number(d.precoUnitario) || 0,
      custoTotal: Number(d.custoTotal) || 0,
      data: dataMov || null,
      mes: dataMov ? `${dataMov.getFullYear()}-${String(dataMov.getMonth() + 1).padStart(2, '0')}` : "",
      nomeBusca: normalizarTexto(d.nomeProduto || "")
    };
  });
}
