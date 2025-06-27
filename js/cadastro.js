import { auth, db } from './firebaseConfig.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

async function cadastrar(){
  const email = document.getElementById('cad-email').value;
  const senha = document.getElementById('cad-senha').value;
  const empresa = document.getElementById('cad-empresa').value.trim();
  const erro = document.getElementById('cad-erro');
  erro.textContent = '';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    const empresaId = empresa || cred.user.uid;
    await setDoc(doc(db,'usuarios',cred.user.uid),{
      uid: cred.user.uid,
      email,
      empresaId,
      tipo: 'usuario',
      autorizado: false,
      termoAceito: false,
      dataAceite: null
    });
    alert('Cadastro realizado com sucesso! Aguarde aprovação do administrador.');
    window.location.href = 'index.html';
  } catch(e){
    erro.textContent = 'Erro: ' + e.message;
  }
}

document.getElementById('btn-cadastrar').addEventListener('click', cadastrar);
