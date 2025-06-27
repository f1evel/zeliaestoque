import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getEmpresaIdDoUsuario, db } from './firebaseConfig.js';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// 🔐 Firebase config (a mesma que você já está usando)
const firebaseConfig = {
  apiKey: "AIzaSyDlFchQ4jpvTtaR5jRRbEmmzYiXEHDlRGM",
  authDomain: "zelia-1.firebaseapp.com",
  projectId: "zelia-1",
  storageBucket: "zelia-1.appspot.com",
  messagingSenderId: "276186984066",
  appId: "1:276186984066:web:af8d09733e7f179aad4e9b"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// 🔁 Verifica se o usuário está logado
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const ref = doc(db, 'usuarios', user.uid);
  let snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || '',
      empresaId: user.uid,
      nome: user.displayName || user.email || '',
      tipo: 'admin',
      autorizado: true,
      termoAceito: false,
      dataAceite: null
    });
    snap = await getDoc(ref);
  }

  const dados = snap.data() || {};
  if (!dados.autorizado) {
    mostrarBloqueio();
    return;
  }

  if (!dados.termoAceito) {
    mostrarTermo(ref);
    return;
  }

  getEmpresaIdDoUsuario();
});

// 🔓 Função para sair
window.logout = function () {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
};

function criarModalBase(id) {
  let fundo = document.getElementById(`fundo-${id}`);
  if (!fundo) {
    fundo = document.createElement('div');
    fundo.id = `fundo-${id}`;
    fundo.className = 'fundo-modal';
    document.body.appendChild(fundo);
  }

  let modal = document.getElementById(id);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  fundo.style.display = 'block';
  modal.style.display = 'block';
  return modal;
}

function mostrarBloqueio() {
  const modal = criarModalBase('modal-bloqueio');
  modal.innerHTML = '<p>Aguardando aprovação do administrador.</p>';
}

function mostrarTermo(ref) {
  const modal = criarModalBase('modal-termo');
  modal.innerHTML = `
    <p>Para utilizar o sistema gratuitamente, o usuário é o único responsável por exportar regularmente seus dados em CSV.</p>
    <button id="btn-aceitar-termo">✅ Aceito e compreendo.</button>
  `;
  document.getElementById('btn-aceitar-termo').onclick = async () => {
    await updateDoc(ref, { termoAceito: true, dataAceite: Timestamp.now() });
    document.getElementById('modal-termo').style.display = 'none';
    document.getElementById('fundo-modal-termo')?.style.display = 'none';
    location.reload();
  };
}
