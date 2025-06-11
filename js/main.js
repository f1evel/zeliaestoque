// Importa os módulos do Firebase
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Suas credenciais do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDlFchQ4jpvTtaR5jRRbEmmzYiXEHDlRGM",
  authDomain: "zelia-1.firebaseapp.com",
  projectId: "zelia-1",
  storageBucket: "zelia-1.appspot.com",
  messagingSenderId: "276186984066",
  appId: "1:276186984066:web:af8d09733e7f179aad4e9b"
};

// Inicializa o Firebase
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Função de login
window.login = function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorBox = document.getElementById("error");
  errorBox.textContent = "";

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      // Sucesso no login
      console.log("Login realizado:", userCredential.user);
      alert("Login realizado com sucesso!");
      window.location.href = "dashboard.html"; // Redireciona para o painel
    })
    .catch((error) => {
      // Erro no login
      console.error("Erro no login:", error.message);
      errorBox.textContent = "Erro: " + error.message;
    });
};
