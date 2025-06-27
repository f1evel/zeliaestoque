import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getEmpresaIdDoUsuario } from './firebaseConfig.js';

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
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html"; // Redireciona para login
  } else {
    // Carrega e mantém em cache o empresaId do usuário
    getEmpresaIdDoUsuario();
  }
});

// 🔓 Função para sair
window.logout = function () {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
};
