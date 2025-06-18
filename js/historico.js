import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

const auth = getAuth();

export async function registrarHistorico(produtoId, campo, de, para) {
  try {
    if (de === para) return;
    const usuario = auth.currentUser?.email || 'desconhecido';
    await addDoc(collection(db, 'produtos', produtoId, 'historico'), {
      campo,
      de,
      para,
      usuario,
      data: Timestamp.now()
    });
  } catch (e) {
    console.error('Erro ao registrar histórico:', e);
  }
}

export async function carregarHistorico(produtoId) {
  try {
    const q = query(
      collection(db, 'produtos', produtoId, 'historico'),
      orderBy('data', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Erro ao carregar histórico:', e);
    return [];
  }
}
