import { db, getEmpresaIdDoUsuario } from './firebaseConfig.js';
import { collection, doc, getDocs, updateDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { formatarPreco, formatarDataBrasileira, mostrarSpinner, esconderSpinner, normalizarTexto } from './utils.js';

let dados = [];
let idAtual = null;

function preencherFiltros() {
  const selMes = document.getElementById('filtro-mes');
  const selAno = document.getElementById('filtro-ano');
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = String(m).padStart(2, '0');
    opt.textContent = opt.value;
    selMes.appendChild(opt);
  }
  const anoAtual = new Date().getFullYear();
  for (let a = anoAtual - 1; a <= anoAtual + 1; a++) {
    const opt = document.createElement('option');
    opt.value = String(a);
    opt.textContent = String(a);
    selAno.appendChild(opt);
  }
  selMes.value = String(new Date().getMonth() + 1).padStart(2, '0');
  selAno.value = String(anoAtual);
}

async function carregarDados() {
  mostrarSpinner();
  try {
    const empresaId = await getEmpresaIdDoUsuario();
    const mes = document.getElementById('filtro-mes').value;
    const ano = document.getElementById('filtro-ano').value;
    const ref = collection(db, 'empresas', empresaId, 'contasReceber', `${ano}-${mes}`, 'clientes');
    const snap = await getDocs(ref);
    dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    gerarTabela();
    atualizarCards();
  } catch (e) {
    console.error('Erro ao carregar dados', e);
  } finally {
    esconderSpinner();
  }
}

function calcularStatus(item) {
  const debito = (item.valorTotal || 0) - (item.totalPago || 0);
  const vencido = new Date(item.vencimento) < new Date();
  if (debito <= 0) return 'pago';
  if (item.totalPago > 0) return vencido ? 'inadimplente' : 'parcial';
  return vencido ? 'inadimplente' : 'aberto';
}

function statusTexto(s) {
  switch (s) {
    case 'pago':
      return 'Pago';
    case 'parcial':
      return 'Parcialmente pago';
    case 'inadimplente':
      return 'Inadimplente';
    default:
      return 'Em aberto';
  }
}

function gerarTabela() {
  const busca = normalizarTexto(document.getElementById('busca-cliente').value);
  const filtroStatus = document.getElementById('filtro-status').value;
  const tbody = [];
  dados.forEach(item => {
    const status = calcularStatus(item);
    if (filtroStatus && status !== filtroStatus) return;
    if (busca && !normalizarTexto(item.cliente).includes(busca)) return;
    const debito = (item.valorTotal || 0) - (item.totalPago || 0);
    tbody.push(`
      <tr>
        <td>${item.cliente || '-'}</td>
        <td>${formatarPreco(item.valorTotal)}</td>
        <td>${formatarDataBrasileira(item.vencimento)}</td>
        <td>${formatarPreco(item.totalPago || 0)}</td>
        <td>${formatarPreco(debito)}</td>
        <td>${statusTexto(status)}</td>
        <td><button onclick="abrirDetalhes('${item.id}')">Ver detalhes</button></td>
      </tr>
    `);
  });
  const html = `
    <table class="tabela">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Valor total</th>
          <th>Data de vencimento</th>
          <th>Total pago</th>
          <th>Débito final</th>
          <th>Situação</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${tbody.join('') || '<tr><td colspan="7">Nenhum dado</td></tr>'}
      </tbody>
    </table>`;
  document.getElementById('tabela-contas').innerHTML = html;
}

function atualizarCards() {
  let total = 0;
  let recebido = 0;
  let inad = 0;
  dados.forEach(item => {
    total += item.valorTotal || 0;
    recebido += item.totalPago || 0;
    const deb = (item.valorTotal || 0) - (item.totalPago || 0);
    if (deb > 0 && new Date(item.vencimento) < new Date()) inad += deb;
  });
  document.getElementById('valor-total-receber').textContent = formatarPreco(total);
  document.getElementById('valor-total-recebido').textContent = formatarPreco(recebido);
  document.getElementById('valor-total-inadimplente').textContent = formatarPreco(inad);
}

window.abrirDetalhes = function(id) {
  const item = dados.find(d => d.id === id);
  if (!item) return;
  idAtual = id;
  document.getElementById('modal-nome-cliente').textContent = item.cliente || '';
  document.getElementById('modal-valor').textContent = formatarPreco(item.valorTotal);
  document.getElementById('modal-vencimento').textContent = formatarDataBrasileira(item.vencimento);
  const pag = item.pagamentos || [];
  const cont = document.getElementById('modal-pagamentos');
  cont.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const val = pag[i] ?? '';
    cont.innerHTML += `<div class="form-group"><label>Pagamento ${i + 1}</label><input type="number" step="0.01" id="pag${i}" value="${val}"></div>`;
  }
  document.getElementById('modal-observacoes').value = item.observacoes || '';
  document.getElementById('modal-detalhes').style.display = 'block';
  document.getElementById('fundo-modal-detalhes').style.display = 'block';
};

window.fecharModal = function() {
  document.getElementById('modal-detalhes').style.display = 'none';
  document.getElementById('fundo-modal-detalhes').style.display = 'none';
};

window.salvarDetalhes = async function() {
  if (!idAtual) return;
  const item = dados.find(d => d.id === idAtual);
  if (!item) return;
  const pagamentos = [];
  for (let i = 0; i < 4; i++) {
    const v = parseFloat(document.getElementById('pag' + i).value);
    if (!isNaN(v)) pagamentos[i] = v;
  }
  const totalPago = pagamentos.reduce((a, b) => a + (b || 0), 0);
  const obs = document.getElementById('modal-observacoes').value;
  const empresaId = await getEmpresaIdDoUsuario();
  const mes = document.getElementById('filtro-mes').value;
  const ano = document.getElementById('filtro-ano').value;
  const ref = doc(db, 'empresas', empresaId, 'contasReceber', `${ano}-${mes}`, 'clientes', idAtual);
  await updateDoc(ref, { pagamentos, totalPago, observacoes: obs });
  item.pagamentos = pagamentos;
  item.totalPago = totalPago;
  item.observacoes = obs;
  gerarTabela();
  atualizarCards();
  fecharModal();
};

window.marcarQuitado = async function() {
  if (!idAtual) return;
  const item = dados.find(d => d.id === idAtual);
  if (!item) return;
  const empresaId = await getEmpresaIdDoUsuario();
  const mes = document.getElementById('filtro-mes').value;
  const ano = document.getElementById('filtro-ano').value;
  const ref = doc(db, 'empresas', empresaId, 'contasReceber', `${ano}-${mes}`, 'clientes', idAtual);
  await updateDoc(ref, { totalPago: item.valorTotal });
  item.totalPago = item.valorTotal;
  gerarTabela();
  atualizarCards();
  fecharModal();
};

document.getElementById('filtro-mes').addEventListener('change', carregarDados);
document.getElementById('filtro-ano').addEventListener('change', carregarDados);
document.getElementById('filtro-status').addEventListener('change', gerarTabela);
document.getElementById('busca-cliente').addEventListener('input', gerarTabela);
document.getElementById('btn-salvar').addEventListener('click', salvarDetalhes);
document.getElementById('btn-quitar').addEventListener('click', marcarQuitado);

preencherFiltros();
carregarDados();
