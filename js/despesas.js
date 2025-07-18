import { db, getEmpresaIdDoUsuario } from './firebaseConfig.js';
import { collection, doc, getDoc, setDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { formatarPreco, mostrarSpinner, esconderSpinner } from './utils.js';

let categorias = {};
let mesAtual = '';
let anoAtual = '';

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
  return (item.pagamentos || []).reduce((a,b)=> a + (Number(b)||0), 0) + (Number(item.valorRealizado)||0);
}

function porcentagem(item) {
  const prev = Number(item.valorPrevisto)||0;
  if (!prev) return 0;
  return Math.min(100, Math.round((calcularTotalPago(item) / prev) * 100));
}

function classeProgresso(p) {
  if (p >= 100) return 'verde';
  if (p >= 50) return 'amarelo';
  return 'vermelho';
}

function gerarLinha(cat, idx, item) {
  const pagamentos = item.pagamentos || [];
  const totalPago = calcularTotalPago(item);
  const perc = porcentagem(item);
  const barras = `<div class="progresso ${classeProgresso(perc)}"><div style="width:${perc}%"></div></div>`;
  const campoPagamentos = item.insumo ? formatarPreco(item.valorRealizado) :
    [0,1,2,3,4].map(i => `<input type="number" step="0.01" value="${pagamentos[i]??''}" onchange="editarPagamento('${cat}',${idx},${i},this.value)">`).join('');
  return `<tr>
    <td><input type="text" value="${item.nome||''}" onchange="editarCampo('${cat}',${idx},'nome',this.value)"></td>
    <td><input type="number" value="${item.quantidade||''}" onchange="editarCampo('${cat}',${idx},'quantidade',this.value)"></td>
    <td><input type="date" value="${(item.vencimentos&&item.vencimentos[0])||''}" onchange="editarVencimento('${cat}',${idx},0,this.value)"></td>
    <td><input type="number" step="0.01" value="${item.valorPrevisto||''}" onchange="editarCampo('${cat}',${idx},'valorPrevisto',this.value)"></td>
    <td class="pagamentos">${campoPagamentos}</td>
    <td>${formatarPreco(totalPago)}</td>
    <td>${barras}</td>
    <td><textarea onchange="editarCampo('${cat}',${idx},'observacoes',this.value)">${item.observacoes||''}</textarea></td>
  </tr>`;
}

function renderizarCategorias() {
  const cont = document.getElementById('categorias-container');
  cont.innerHTML = '';
  Object.keys(categorias).forEach(cat => {
    const itens = categorias[cat];
    const catId = 'cat_' + cat.replace(/\s+/g,'_');
    const div = document.createElement('div');
    div.className = 'categoria';
    const linhas = itens.map((it,i)=> gerarLinha(cat,i,it)).join('');
    div.innerHTML = `
      <div class="accordion-header" onclick="toggleCategoria('${catId}')">${cat}</div>
      <div class="accordion-content" id="${catId}">
        <table class="tabela">
          <thead>
            <tr>
              <th>Despesa</th>
              <th>Qtd</th>
              <th>Vencimento</th>
              <th>Valor previsto</th>
              <th>Pagamentos</th>
              <th>Total pago</th>
              <th>%</th>
              <th>Obs</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
        <button onclick="adicionarDespesa('${cat}')">+ Adicionar despesa</button>
      </div>`;
    cont.appendChild(div);
  });
}

function atualizarCards() {
  let previsto = 0;
  let realizado = 0;
  Object.values(categorias).forEach(itens => {
    itens.forEach(it => {
      previsto += Number(it.valorPrevisto)||0;
      realizado += calcularTotalPago(it);
    });
  });
  const cards = document.getElementById('cards-despesas');
  cards.innerHTML = `
    <div class="resumo-card"><div class="icone">📤</div><div class="texto"><div class="titulo">A pagar</div><div class="valor" id="valor-previsto">${formatarPreco(previsto)}</div></div></div>
    <div class="resumo-card"><div class="icone">✅</div><div class="texto"><div class="titulo">Pago</div><div class="valor">${formatarPreco(realizado)}</div></div></div>
  `;
}

async function salvarDados() {
  const empresaId = await getEmpresaIdDoUsuario();
  const ref = doc(db,'empresas',empresaId,'despesasGerais',`${anoAtual}-${mesAtual}`);
  const salvar = {};
  Object.keys(categorias).forEach(cat => {
    salvar[cat] = categorias[cat].filter(i => !i.insumo);
  });
  await setDoc(ref,{categorias: salvar},{merge:true});
}

export async function editarCampo(cat, idx, campo, valor) {
  categorias[cat][idx][campo] = valor;
  renderizarCategorias();
  atualizarCards();
  await salvarDados();
}

export async function editarPagamento(cat, idx, ind, valor) {
  if (!categorias[cat][idx].pagamentos) categorias[cat][idx].pagamentos = [];
  categorias[cat][idx].pagamentos[ind] = valor;
  renderizarCategorias();
  atualizarCards();
  await salvarDados();
}

export async function editarVencimento(cat, idx, ind, valor) {
  if (!categorias[cat][idx].vencimentos) categorias[cat][idx].vencimentos = [];
  categorias[cat][idx].vencimentos[ind] = valor;
  await salvarDados();
}

export function toggleCategoria(id) {
  const el = document.getElementById(id);
  if (el) el.parentElement.classList.toggle('accordion-aberto');
}

export async function adicionarCategoria() {
  const nome = prompt('Nome da categoria');
  if (!nome) return;
  if (!categorias[nome]) categorias[nome] = [];
  renderizarCategorias();
  await salvarDados();
}

export async function adicionarDespesa(cat) {
  categorias[cat].push({ nome:'', quantidade:'', vencimentos:[''], valorPrevisto:'', pagamentos:[], observacoes:'' });
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
  const refAnt = doc(db,'empresas',empresaId,'despesasGerais',`${anoAnt}-${String(mesAnt).padStart(2,'0')}`);
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
  const movRef = query(collection(db,'empresas',empresaId,'movimentacoes'), where('tipo','==','entrada'));
  const snap = await getDocs(movRef);
  const itens = [];
  snap.forEach(docu => {
    const d = docu.data();
    if (String(d.categoria||'').toLowerCase().includes('insum')) {
      const data = d.dataMovimentacao?.toDate ? d.dataMovimentacao.toDate() : new Date();
      itens.push({
        nome: d.nomeProduto,
        quantidade: d.quantidade,
        vencimentos:[data.toISOString().slice(0,10)],
        valorPrevisto:'',
        pagamentos:[],
        valorRealizado: Number(d.custoTotal)||Number(d.precoUnitario||0)*Number(d.quantidade||0),
        observacoes: d.observacao||'',
        insumo:true
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
    const ref = doc(db,'empresas',empresaId,'despesasGerais',`${anoAtual}-${mesAtual}`);
    const snap = await getDoc(ref);
    categorias = snap.exists() ? (snap.data().categorias || {}) : {};
    await carregarInsumos();
    renderizarCategorias();
    atualizarCards();
  } catch(e) {
    console.error('Erro ao carregar dados',e);
  } finally {
    esconderSpinner();
  }
}

preencherFiltros();
document.getElementById('mes').addEventListener('change', carregarDados);
document.getElementById('ano').addEventListener('change', carregarDados);
document.getElementById('btn-adicionar-categoria').addEventListener('click', adicionarCategoria);
document.getElementById('btn-copiar').addEventListener('click', copiarMesAnterior);

carregarDados();
