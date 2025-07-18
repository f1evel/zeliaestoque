import { db, getEmpresaIdDoUsuario } from './firebaseConfig.js';
import { collection, doc, getDoc, setDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { formatarPreco, mostrarSpinner, esconderSpinner } from './utils.js';

let categorias = {};
let mesAtual = '';
let anoAtual = '';
let categoriaModal = '';
let indiceModal = null;

function preencherFiltros() {
  const selMes = document.getElementById('mes');
  const selAno = document.getElementById('ano');
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = String(m).padStart(2, '0');
    opt.textContent = opt.value;
    selMes.appendChild(opt);
  }
  const ano = new Date().getFullYear();
  for (let a = ano - 1; a <= ano + 1; a++) {
    const opt = document.createElement('option');
    opt.value = String(a);
    opt.textContent = String(a);
    selAno.appendChild(opt);
  }
  selMes.value = String(new Date().getMonth() + 1).padStart(2, '0');
  selAno.value = String(new Date().getFullYear());
}

function calcularTotalPago(item) {
  return (item.pagamentos || []).reduce((a, b) => a + (Number(b) || 0), 0) + (Number(item.valorRealizado) || 0);
}

function porcentagem(item) {
  const prev = Number(item.valorPrevisto) || 0;
  if (!prev) return 0;
  return Math.min(100, Math.round((calcularTotalPago(item) / prev) * 100));
}

function classeProgresso(p) {
  if (p >= 100) return 'verde';
  if (p >= 50) return 'amarelo';
  return 'vermelho';
}

function totaisCategoria(itens) {
  let previsto = 0;
  let pago = 0;
  itens.forEach(it => {
    previsto += Number(it.valorPrevisto) || 0;
    pago += calcularTotalPago(it);
  });
  return { previsto, pago };
}

function gerarLinha(cat, idx, item) {
  const pagamentos = item.pagamentos || [];
  const totalPago = calcularTotalPago(item);
  const perc = porcentagem(item);
  const barras = `<div class="progresso ${classeProgresso(perc)}"><div style="width:${perc}%"></div></div>`;
  const campoPagamentos = item.insumo
    ? formatarPreco(item.valorRealizado)
    : pagamentos.map(v => formatarPreco(v)).join('<br>');
  const btnEditar = item.insumo ? '' : `<button onclick="abrirModalEditarDespesa('${cat}',${idx})">Editar</button>`;
  const venc = (item.vencimentos || []).join('<br>');
  return `<tr>
    <td>${item.nome || '-'}</td>
    <td>${item.quantidade || ''}</td>
    <td>${venc}</td>
    <td>${formatarPreco(item.valorPrevisto)}</td>
    <td>${campoPagamentos}</td>
    <td>${formatarPreco(totalPago)}</td>
    <td>${barras}</td>
    <td>${btnEditar}</td>
  </tr>`;
}

function renderizarCategorias() {
  const cont = document.getElementById('categorias-container');
  cont.innerHTML = '';
  Object.keys(categorias).forEach(cat => {
    const itens = categorias[cat];
    const { previsto, pago } = totaisCategoria(itens);
    const perc = previsto ? Math.min(100, Math.round((pago / previsto) * 100)) : 0;
    const catId = 'cat_' + cat.replace(/\s+/g, '_');
    const linhas = itens.map((it, i) => gerarLinha(cat, i, it)).join('');
    const header = `
      <div class="accordion-header" onclick="toggleCategoria('${catId}')">
        <span>${cat}</span>
        <div class="totais">
          <span>${formatarPreco(previsto)}</span>
          <span>${formatarPreco(pago)}</span>
          <div class="barra-progresso">
            <div class="progresso ${classeProgresso(perc)}"><div style="width:${perc}%"></div></div>
          </div>
        </div>
      </div>`;
    const conteudo = `
      <div class="accordion-content" id="${catId}">
        <table class="tabela">
          <thead>
            <tr>
              <th>Despesa</th>
              <th>Qtd</th>
              <th>Vencimentos</th>
              <th>Valor previsto</th>
              <th>Pagamentos</th>
              <th>Total pago</th>
              <th>%</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${linhas || '<tr><td colspan="8">Nenhum dado</td></tr>'}</tbody>
        </table>
        ${cat !== 'INSUMOS' ? `<button onclick="abrirModalNovaDespesa('${cat}')">+ Adicionar despesa</button>` : ''}
      </div>`;
    const div = document.createElement('div');
    div.className = 'categoria';
    div.innerHTML = header + conteudo;
    cont.appendChild(div);
  });
}

function atualizarCards() {
  let previsto = 0;
  let realizado = 0;
  Object.values(categorias).forEach(itens => {
    itens.forEach(it => {
      previsto += Number(it.valorPrevisto) || 0;
      realizado += calcularTotalPago(it);
    });
  });
  const diferenca = previsto - realizado;
  const dias = Number(document.getElementById('dias-faturamento').value) || 25;
  const diario = dias ? diferenca / dias : 0;
  const cards = document.getElementById('cards-despesas');
  cards.innerHTML = `
    <div class="resumo-card"><div class="icone">💰</div><div class="texto"><div class="titulo">Total previsto</div><div class="valor">${formatarPreco(previsto)}</div></div></div>
    <div class="resumo-card pago"><div class="icone">✅</div><div class="texto"><div class="titulo">Total pago</div><div class="valor">${formatarPreco(realizado)}</div></div></div>
    <div class="resumo-card pendente"><div class="icone">📤</div><div class="texto"><div class="titulo">Diferença</div><div class="valor">${formatarPreco(diferenca)}</div></div></div>
    <div class="resumo-card"><div class="icone">📈</div><div class="texto"><div class="titulo">Faturamento diário necessário</div><div class="valor">${formatarPreco(diario)}</div></div></div>`;
}

async function salvarDados() {
  const empresaId = await getEmpresaIdDoUsuario();
  const ref = doc(db, 'empresas', empresaId, 'despesasGerais', `${anoAtual}-${mesAtual}`);
  const salvar = {};
  Object.keys(categorias).forEach(cat => {
    salvar[cat] = categorias[cat].filter(i => !i.insumo);
  });
  await setDoc(ref, { categorias: salvar }, { merge: true });
}

function toggleCategoria(id) {
  const el = document.getElementById(id);
  if (el) el.parentElement.classList.toggle('accordion-aberto');
}

function abrirModalNovaDespesa(cat) {
  categoriaModal = cat;
  indiceModal = null;
  document.getElementById('titulo-modal-despesa').textContent = 'Adicionar Despesa';
  preencherModal({});
  abrirModal();
}

function abrirModalEditarDespesa(cat, idx) {
  categoriaModal = cat;
  indiceModal = idx;
  document.getElementById('titulo-modal-despesa').textContent = 'Editar Despesa';
  preencherModal(categorias[cat][idx] || {});
  abrirModal();
}

function abrirModal() {
  document.getElementById('modal-despesa').style.display = 'block';
  document.getElementById('fundo-modal-despesa').style.display = 'block';
}

function fecharModalDespesa() {
  document.getElementById('modal-despesa').style.display = 'none';
  document.getElementById('fundo-modal-despesa').style.display = 'none';
}

function preencherModal(item) {
  document.getElementById('despesa-nome').value = item.nome || '';
  document.getElementById('despesa-quantidade').value = item.quantidade || '';
  document.getElementById('despesa-previsto').value = item.valorPrevisto || '';
  const vencInputs = document.querySelectorAll('#despesa-vencimentos input');
  vencInputs.forEach((el, i) => { el.value = (item.vencimentos && item.vencimentos[i]) || ''; });
  const pagInputs = document.querySelectorAll('#despesa-pagamentos input');
  pagInputs.forEach((el, i) => { el.value = (item.pagamentos && item.pagamentos[i]) !== undefined ? item.pagamentos[i] : ''; });
  document.getElementById('despesa-observacoes').value = item.observacoes || '';
  document.getElementById('despesa-recorrente').checked = !!item.recorrente;
  document.getElementById('despesa-arquivado').checked = !!item.arquivado;

  if (item.insumo) {
    pagInputs.forEach(el => el.disabled = true);
    document.getElementById('despesa-previsto').disabled = true;
  } else {
    pagInputs.forEach(el => el.disabled = false);
    document.getElementById('despesa-previsto').disabled = false;
  }
}

async function salvarDespesa() {
  const nome = document.getElementById('despesa-nome').value;
  const quantidade = document.getElementById('despesa-quantidade').value;
  const valorPrevisto = document.getElementById('despesa-previsto').value;
  const vencimentos = Array.from(document.querySelectorAll('#despesa-vencimentos input')).map(el => el.value).filter(v => v);
  const pagamentos = Array.from(document.querySelectorAll('#despesa-pagamentos input')).map(el => el.value).filter(v => v !== '');
  const observacoes = document.getElementById('despesa-observacoes').value;
  const recorrente = document.getElementById('despesa-recorrente').checked;
  const arquivado = document.getElementById('despesa-arquivado').checked;

  const item = { nome, quantidade, valorPrevisto, vencimentos, pagamentos, observacoes, recorrente, arquivado };

  if (indiceModal === null) {
    if (!categorias[categoriaModal]) categorias[categoriaModal] = [];
    categorias[categoriaModal].push(item);
  } else {
    Object.assign(categorias[categoriaModal][indiceModal], item);
  }

  renderizarCategorias();
  atualizarCards();
  await salvarDados();
  fecharModalDespesa();
}

async function adicionarCategoria() {
  const nome = prompt('Nome da categoria');
  if (!nome) return;
  if (!categorias[nome]) categorias[nome] = [];
  renderizarCategorias();
  await salvarDados();
}

async function copiarMesAnterior() {
  const mes = Number(mesAtual);
  const ano = Number(anoAtual);
  let mesAnt = mes - 1;
  let anoAnt = ano;
  if (mesAnt <= 0) { mesAnt = 12; anoAnt -= 1; }
  const empresaId = await getEmpresaIdDoUsuario();
  const refAnt = doc(db, 'empresas', empresaId, 'despesasGerais', `${anoAnt}-${String(mesAnt).padStart(2, '0')}`);
  const snapAnt = await getDoc(refAnt);
  if (!snapAnt.exists()) {
    alert('Mês anterior sem dados');
    return;
  }
  categorias = JSON.parse(JSON.stringify(snapAnt.data().categorias || {}));
  await salvarDados();
  await carregarDados();
}

async function carregarInsumos() {
  const empresaId = await getEmpresaIdDoUsuario();
  const movRef = query(collection(db, 'empresas', empresaId, 'movimentacoes'), where('tipo', '==', 'entrada'));
  const snap = await getDocs(movRef);
  const itens = [];
  snap.forEach(docu => {
    const d = docu.data();
    if (String(d.categoria || '').toLowerCase().includes('insum')) {
      const data = d.dataMovimentacao?.toDate ? d.dataMovimentacao.toDate() : new Date();
      itens.push({
        nome: d.nomeProduto,
        quantidade: d.quantidade,
        vencimentos: [data.toISOString().slice(0,10)],
        valorPrevisto: '',
        pagamentos: [],
        valorRealizado: Number(d.custoTotal) || Number(d.precoUnitario || 0) * Number(d.quantidade || 0),
        observacoes: d.observacao || '',
        insumo: true
      });
    }
  });
  if (!categorias['INSUMOS']) categorias['INSUMOS'] = [];
  categorias['INSUMOS'] = categorias['INSUMOS'].concat(itens);
}

async function carregarDados() {
  mostrarSpinner();
  try {
    mesAtual = document.getElementById('mes').value;
    anoAtual = document.getElementById('ano').value;
    const empresaId = await getEmpresaIdDoUsuario();
    const ref = doc(db, 'empresas', empresaId, 'despesasGerais', `${anoAtual}-${mesAtual}`);
    const snap = await getDoc(ref);
    categorias = snap.exists() ? (snap.data().categorias || {}) : {};
    await carregarInsumos();
    renderizarCategorias();
    atualizarCards();
  } catch (e) {
    console.error('Erro ao carregar dados', e);
  } finally {
    esconderSpinner();
  }
}

preencherFiltros();
document.getElementById('mes').addEventListener('change', carregarDados);
document.getElementById('ano').addEventListener('change', carregarDados);
document.getElementById('dias-faturamento').addEventListener('input', atualizarCards);
document.getElementById('btn-adicionar-categoria').addEventListener('click', adicionarCategoria);
document.getElementById('btn-copiar').addEventListener('click', copiarMesAnterior);
document.getElementById('btn-salvar-despesa').addEventListener('click', salvarDespesa);

carregarDados();

window.toggleCategoria = toggleCategoria;
window.abrirModalNovaDespesa = abrirModalNovaDespesa;
window.abrirModalEditarDespesa = abrirModalEditarDespesa;
window.fecharModalDespesa = fecharModalDespesa;
*