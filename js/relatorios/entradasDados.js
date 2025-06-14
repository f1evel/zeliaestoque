import { db } from '../firebaseConfig.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { normalizarTexto } from '../utils.js';

export async function carregarDadosEntradas() {
  const snapshot = await getDocs(
    query(collection(db, 'movimentacoes'), where('tipo', '==', 'entrada'), orderBy('dataMovimentacao', 'desc'))
  );

  return snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      nome: d.nomeProduto || '-',
      fornecedor: d.fornecedor || '-',
      quantidade: Number(d.quantidade) || 0,
      validade: d.validade?.toDate() || null,
      preco: Number(d.precoUnitario) || 0,
      compraId: d.compraId || '-',
      data: d.dataMovimentacao?.toDate() || null,
      nomeBusca: normalizarTexto(d.nomeProduto || '')
    };
  });
}
