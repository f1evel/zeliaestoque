// Importa os módulos do Firebase
import { auth, getEmpresaIdDoUsuario } from './firebaseConfig.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

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
      getEmpresaIdDoUsuario().then(() => {
        alert("Login realizado com sucesso!");
        window.location.href = "dashboard.html"; // Redireciona para o painel
      });
    })
    .catch((error) => {
      // Erro no login
      console.error("Erro no login:", error.message);
      errorBox.textContent = "Erro: " + error.message;
    });
};
