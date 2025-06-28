import { db } from './firebaseConfig.js';
import { collection, getDocs, updateDoc, doc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

async function carregar(){
  const snap = await getDocs(collection(db,'usuarios'));
  const container = document.getElementById('lista-usuarios');
  let html = '<table class="tabela"><thead><tr><th>Email</th><th>Empresa</th><th>Autorizado</th><th>Ações</th></tr></thead><tbody>';
  snap.forEach(d => {
    const u = d.data();
    html += `<tr><td>${u.email || ''}</td><td>${u.empresaId || ''}</td><td>${u.autorizado ? 'Sim' : 'Não'}</td><td><button data-id="${d.id}" data-acao="aprovar">Aprovar</button><button data-id="${d.id}" data-acao="reprovar">Reprovar</button></td></tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const acao = btn.dataset.acao;
      const id = btn.dataset.id;
      await updateDoc(doc(db,'usuarios',id), { autorizado: acao === 'aprovar' });
      carregar();
    });
  });
}

carregar();
