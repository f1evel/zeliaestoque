// js/firebaseConfig.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

// 🔥 Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDlFchQ4jpvTtaR5jRRbEmmzYiXEHDlRGM",
  authDomain: "zelia-1.firebaseapp.com",
  projectId: "zelia-1",
  storageBucket: "zelia-1.appspot.com",
  messagingSenderId: "276186984066",
  appId: "1:276186984066:web:af8d09733e7f179aad4e9b"
};

// 🚀 Inicializar app (evita inicializar mais de uma vez)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// 🔗 Exportar serviços
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// 🏢 Empresa vinculada ao usuário logado
let empresaIdCache = null;

/**
 * Retorna o empresaId do usuário logado. Se não existir na coleção
 * `usuarios`, um registro básico é criado automaticamente usando o UID.
 */
export async function getEmpresaIdDoUsuario() {
  if (empresaIdCache) return empresaIdCache;
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const ref = doc(db, 'usuarios', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() || {};
      empresaIdCache = data.empresaId || user.uid;
    } else {
      empresaIdCache = user.uid;
      await setDoc(ref, {
        uid: user.uid,
        empresaId: empresaIdCache,
        nome: user.displayName || user.email || '',
        tipo: 'admin',
        autorizado: true,
        termoAceito: false,
        dataAceite: null
      });
    }
  } catch (e) {
    console.error('Erro ao obter empresaId:', e);
    empresaIdCache = user.uid;
  }
  return empresaIdCache;
}
