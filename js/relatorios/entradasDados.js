import { db, getEmpresaIdDoUsuario } from '../firebaseConfig.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { normalizarTexto } from '../utils.js';

export async function carregarDadosEntradas() {
  const empresaId = await getEmpresaIdDoUsuario();
  const snapshot = await getDocs(
    query(collection(db, 'empresas', empresaId, 'movimentacoes'), where('tipo', '==', 'entrada'), orderBy('dataMovimentacao', 'desc'))
  );

  return snapshot.docs.map(doc => {
    const d = doc.data();
    const dataMov = d.dataMovimentacao?.toDate() || null;
    const modificado = d.dataAtualizacao?.toDate() ||
      (dataMov ? new Date(dataMov.getTime() + 86400000) : null); // simulado

    return {
      id: doc.id,
      nome: d.nomeProduto || '-',
      fornecedor: d.fornecedor || '-',
      categoria: d.categoria || '-',
      quantidade: Number(d.quantidade) || 0,
      validade: d.validade?.toDate() || null,
      preco: Number(d.precoUnitario) || 0,
      compraId: d.compraId || '-',
      data: dataMov,
      usuario: d.usuario || 'admin@zelia.com',
      observacoes: d.observacao || '',
      modificado,
      nomeBusca: normalizarTexto(d.nomeProduto || '')
    };
  });
}
