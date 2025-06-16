import { db } from '../firebaseConfig.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { normalizarTexto } from '../utils.js';

export async function carregarDadosSaidas() {
  const snapshot = await getDocs(
    query(collection(db, 'movimentacoes'), where('tipo', '==', 'saida'), orderBy('dataMovimentacao', 'desc'))
  );

  return snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      nome: d.nomeProduto || '-',
      quantidade: Number(d.quantidade) || 0,
      data: d.dataMovimentacao?.toDate() || null,
      motivo: d.observacao || '',
      responsavel: d.usuario || '-',
      categoria: d.categoria || '-',
      nomeBusca: normalizarTexto(d.nomeProduto || '')
    };
  });
}
