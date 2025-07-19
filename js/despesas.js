import { db, getEmpresaIdDoUsuario } from './firebaseConfig.js';
import { collection, doc, getDoc, setDoc, getDocs, query, where, updateDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { formatarPreco, mostrarSpinner, esconderSpinner, formatarCompraIdCurto, mostrarMensagem, parseDataBR } from './utils.js';

console.log('despesas.js carregado');

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
  if (cat === 'INSUMOS' || item.insumo) {
    const venc = item.vencimento || (item.vencimentos || [])[0] || '-';
    const btn = `<button onclick="abrirModalParcelas('${item.compraId}')">Ver detalhes</button>`;
    return `<tr>
      <td>${item.descricao || item.nome || '-'}</td>
      <td>${formatarPreco(item.valor)}</td>
      <td>${venc}</td>
      <td>${item.parcelaStatus || item.status || '-'}</td>
      <td>${item.formaPagamento || '-'}</td>
      <td>${item.fornecedorOuCliente || '-'}</td>
      <td>${formatarCompraIdCurto(item.compraId)}</td>
      <td>${btn}</td>
    </tr>`;
  }

  const pagamentos = item.pagamentos || [];
  const totalPago = calcularTotalPago(item);
  const perc = porcentagem(item);
  const barras = `<div class="progresso ${classeProgresso(perc)}"><div style="width:${perc}%"></div></div>`;
  const campoPagamentos = pagamentos.map(v => formatarPreco(v)).join('<br>');
  const btnEditar = `<button onclick="abrirModalEditarDespesa('${cat}',${idx})">Editar</button>`;
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
  console.log('renderizarCategorias iniciado');
  const cont = document.getElementById('categorias-container');
  cont.innerHTML = '';
  if (Object.keys(categorias).length === 0) {
    cont.innerHTML = '<div class="alert-aviso">Nenhum dado encontrado para este mês</div>';
    return;
  }
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
    let conteudo = '';
    if (cat === 'INSUMOS') {
      conteudo = `
      <div class="accordion-content" id="${catId}">
        <table class="tabela">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th>Forma</th>
              <th>Fornecedor</th>
              <th>CompraID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${linhas || '<tr><td colspan="8">Nenhum dado</td></tr>'}</tbody>
        </table>
      </div>`;
    } else {
      conteudo = `
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
        <button onclick="abrirModalNovaDespesa('${cat}')">+ Adicionar despesa</button>
      </div>`;
    }
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
  console.log('Executando adicionarCategoria');
  const nome = prompt('Nome da categoria');
  if (!nome) return;
  if (!categorias[nome]) categorias[nome] = [];
  renderizarCategorias();
  await salvarDados();
}

async function copiarMesAnterior() {
  console.log('copiarMesAnterior clicado');
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
  console.log('Dados do mês anterior copiados');
  await salvarDados();
  await carregarDados();
}

async function copiarMesAnteriorAutomatico(empresaId) {
  const mes = Number(mesAtual);
  const ano = Number(anoAtual);
  let mesAnt = mes - 1;
  let anoAnt = ano;
  if (mesAnt <= 0) { mesAnt = 12; anoAnt -= 1; }
  const refAnt = doc(db, 'empresas', empresaId, 'despesasGerais', `${anoAnt}-${String(mesAnt).padStart(2, '0')}`);
  const snapAnt = await getDoc(refAnt);
  if (!snapAnt.exists()) {
    console.warn('Mês anterior sem dados para cópia automática');
    return false;
  }
  const dadosAnt = snapAnt.data().categorias || {};
  const novasCategorias = {};
  Object.keys(dadosAnt).forEach(cat => {
    novasCategorias[cat] = dadosAnt[cat].map(item => {
      const novoItem = { ...item, pagamentos: [] };
      return novoItem;
    });
  });
  const refAtual = doc(db, 'empresas', empresaId, 'despesasGerais', `${anoAtual}-${mesAtual}`);
  await setDoc(refAtual, { categorias: novasCategorias, copiadoAutomaticamente: true });
  categorias = novasCategorias;
  console.log('Cópia automática do mês anterior realizada');
  return true;
}

async function carregarInsumos() {
  const empresaId = await getEmpresaIdDoUsuario();
  const finRef = collection(db, 'empresas', empresaId, 'financeiro');
  const finSnap = await getDocs(finRef);

  const movSnap = await getDocs(
    query(collection(db, 'empresas', empresaId, 'movimentacoes'), where('tipo', '==', 'entrada'))
  );
  const comprasValidas = new Set();
  movSnap.forEach(m => { const d = m.data(); if (d.compraId) comprasValidas.add(d.compraId); });

  const itens = [];

  finSnap.forEach(docu => {
    const d = docu.data();
    if (!d.compraId) return;
    if (comprasValidas.size > 0 && !comprasValidas.has(d.compraId)) return;

    const parcelas = Array.isArray(d.parcelas) ? d.parcelas : [];
    parcelas.forEach(p => {
      const venc = p.vencimento || '';
      const [ano, mes] = venc.split('-');
      if (ano === anoAtual && mes === mesAtual) {
        const valor = Number(p.valor) || 0;
        itens.push({
          descricao: d.descricao || '-',
          valor,
          vencimento: venc,
          status: p.status || d.status,
          formaPagamento: d.formaPagamento || '-',
          fornecedorOuCliente: d.fornecedorOuCliente || '-',
          compraId: d.compraId,
          parcelaNumero: p.numero,
          parcelaStatus: p.status,
          nome: d.descricao || d.fornecedorOuCliente || 'Compra',
          quantidade: '',
          vencimentos: [venc],
          valorPrevisto: valor,
          pagamentos: p.status === 'pago' ? [valor] : [],
          valorRealizado: p.status === 'pago' ? valor : 0,
          observacoes: d.observacoes || '',
          insumo: true
        });
      }
    });
  });

  categorias['INSUMOS'] = itens;
}

async function carregarDados() {
  console.log('carregarDados iniciado');
  mostrarSpinner();
  try {
    mesAtual = document.getElementById('mes').value;
    anoAtual = document.getElementById('ano').value;
    const empresaId = await getEmpresaIdDoUsuario();
    const ref = doc(db, 'empresas', empresaId, 'despesasGerais', `${anoAtual}-${mesAtual}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      console.warn('Documento do mês não encontrado');
      const copiado = await copiarMesAnteriorAutomatico(empresaId);
      if (!copiado) {
        categorias = {};
      }
    } else {
      categorias = snap.data().categorias || {};
    }
    console.log('Categorias carregadas', categorias);
    await carregarInsumos();
    renderizarCategorias();
    console.log('renderizarCategorias executado');
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
console.log('Listeners registrados');

carregarDados();

window.toggleCategoria = toggleCategoria;
window.abrirModalNovaDespesa = abrirModalNovaDespesa;
window.abrirModalEditarDespesa = abrirModalEditarDespesa;
window.fecharModalDespesa = fecharModalDespesa;

window.abrirModalParcelas = async function (compraId) {
  try {
    mostrarSpinner();
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(
      collection(db, 'empresas', empresaId, 'financeiro'),
      where('compraId', '==', compraId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const registro = snap.docs[0].data();

    document.getElementById('modal-compra-id').textContent = formatarCompraIdCurto(compraId);
    const contParcelas = document.getElementById('parcelas-detalhes');
    const contProdutos = document.getElementById('produtos-compra-detalhes');
    const contInfo = document.getElementById('info-compra');

    let htmlParcelas = '';
    let htmlProdutos = '';
    let htmlInfo = '';
    let totalCompra = 0;

    if (!registro.parcelas || registro.parcelas.length === 0) {
      htmlParcelas += '<p>Sem parcelas cadastradas.</p>';
    } else {
      const total = registro.parcelas.length;
      htmlParcelas += `<h4>Parcelas</h4><table class="tabela"><thead><tr><th>#</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>`;
      registro.parcelas.forEach(p => {
        const vencDate = p.vencimento ? new Date(p.vencimento) : null;
        const venc = vencDate ? vencDate.toLocaleDateString('pt-BR') : '-';
        const pago = p.status === 'pago';
        let statusTexto = '❌ Pendente';
        if (pago) {
          statusTexto = '✅ Pago';
        } else if (vencDate && vencDate < new Date()) {
          statusTexto = '⚠️ Vencido';
        }
        const btn = pago
          ? `<button onclick="marcarParcelaComoNaoPaga('${compraId}', ${p.numero})">Marcar como não pago</button>`
          : `<button onclick="marcarParcelaComoPaga('${compraId}', ${p.numero})">Marcar como pago</button>`;
        htmlParcelas += `<tr><td>${p.numero}/${total}</td><td>${formatarPreco(p.valor || 0)}</td><td>${venc}</td><td>${statusTexto}</td><td>${btn}</td></tr>`;
      });
      htmlParcelas += '</tbody></table>';
    }

    let movSnap = null;
    try {
      const qMov = query(
        collection(db, 'empresas', empresaId, 'movimentacoes'),
        where('compraId', '==', compraId),
        where('tipo', '==', 'entrada')
      );
      movSnap = await getDocs(qMov);
    } catch (e) {
      console.error('Erro ao buscar produtos da compra', e);
    }

    if (movSnap && !movSnap.empty) {
      const agrupados = {};
      movSnap.docs.forEach(doc => {
        const d = doc.data();
        const key = `${d.produtoId || d.nomeProduto}|${d.precoUnitario || 0}`;
        if (!agrupados[key]) {
          agrupados[key] = {
            nome: d.nomeProduto,
            quantidade: 0,
            preco: Number(d.precoUnitario) || 0
          };
        }
        agrupados[key].quantidade += Number(d.quantidade) || 0;
      });

      htmlProdutos += '<h4>Produtos</h4><table class="tabela"><thead><tr><th>Produto</th><th>Quantidade</th><th>Preço unitário</th><th>Total</th></tr></thead><tbody>';
      Object.values(agrupados).forEach(p => {
        const total = p.quantidade * p.preco;
        totalCompra += total;
        htmlProdutos += `<tr><td>${p.nome}</td><td>${p.quantidade}</td><td>${formatarPreco(p.preco)}</td><td>${formatarPreco(total)}</td></tr>`;
      });
      htmlProdutos += `</tbody><tfoot><tr><th colspan="3" style="text-align:right;">Total da compra</th><th>${formatarPreco(totalCompra || registro.valor)}</th></tr></tfoot></table>`;
    } else if (Array.isArray(registro.produtos) && registro.produtos.length > 0) {
      htmlProdutos += '<h4>Produtos</h4><table class="tabela"><thead><tr><th>Produto</th><th>Quantidade</th><th>Preço unitário</th><th>Total</th></tr></thead><tbody>';
      registro.produtos.forEach(p => {
        const preco = Number(p.preco) || 0;
        const qtd = Number(p.quantidade) || 0;
        const total = qtd * preco;
        totalCompra += total;
        htmlProdutos += `<tr><td>${p.nome}</td><td>${qtd}</td><td>${formatarPreco(preco)}</td><td>${formatarPreco(total)}</td></tr>`;
      });
      htmlProdutos += `</tbody><tfoot><tr><th colspan="3" style="text-align:right;">Total da compra</th><th>${formatarPreco(totalCompra || registro.valor)}</th></tr></tfoot></table>`;
    } else {
      htmlProdutos += `<p>Produtos não localizados para esta compra. Total registrado: ${formatarPreco(registro.valor)}</p>`;
    }

    contInfo.innerHTML = htmlInfo;
    contParcelas.innerHTML = htmlParcelas;
    contProdutos.innerHTML = htmlProdutos;

    document.getElementById('modal-parcelas').style.display = 'block';
    document.getElementById('fundo-modal-parcelas').style.display = 'block';
  } finally {
    esconderSpinner();
  }
};

window.fecharModalParcelas = function () {
  document.getElementById('modal-parcelas').style.display = 'none';
  document.getElementById('fundo-modal-parcelas').style.display = 'none';
};

window.marcarParcelaComoPaga = async function (compraId, numero) {
  const hojeStr = new Date().toLocaleDateString('pt-BR');
  const entrada = prompt('Digite a data (DD/MM/AAAA):', hojeStr);
  if (!entrada) return;

  const dataObj = parseDataBR(entrada);
  if (isNaN(dataObj.getTime())) {
    alert('Data inválida. Utilize o formato DD/MM/AAAA.');
    return;
  }

  const data = dataObj.toISOString().split('T')[0];

  try {
    mostrarSpinner();
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(collection(db, 'empresas', empresaId, 'financeiro'), where('compraId', '==', compraId));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Registro não encontrado');
    const ref = snap.docs[0].ref;
    const finData = snap.docs[0].data();
    const parcelas = Array.isArray(finData.parcelas) ? finData.parcelas.slice() : [];
    const idx = parcelas.findIndex(p => p.numero === numero);
    if (idx === -1) throw new Error('Parcela não encontrada');
    parcelas[idx] = { ...parcelas[idx], status: 'pago', dataPagamento: data };
    await updateDoc(ref, { parcelas });

    mostrarMensagem('✅ Parcela marcada como paga!');
    abrirModalParcelas(compraId);
  } catch (e) {
    console.error('Erro ao atualizar parcela', e);
    alert('❌ Erro ao marcar parcela como paga.');
  } finally {
    esconderSpinner();
  }
};

window.marcarParcelaComoNaoPaga = async function (compraId, numero) {
  if (!confirm('Marcar esta parcela como não paga?')) return;

  try {
    mostrarSpinner();
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(collection(db, 'empresas', empresaId, 'financeiro'), where('compraId', '==', compraId));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Registro não encontrado');
    const ref = snap.docs[0].ref;
    const finData = snap.docs[0].data();
    const parcelas = Array.isArray(finData.parcelas) ? finData.parcelas.slice() : [];
    const idx = parcelas.findIndex(p => p.numero === numero);
    if (idx === -1) throw new Error('Parcela não encontrada');
    parcelas[idx] = { ...parcelas[idx], status: 'pendente', dataPagamento: null };
    await updateDoc(ref, { parcelas });

    mostrarMensagem('❌ Parcela marcada como não paga!');
    abrirModalParcelas(compraId);
  } catch (e) {
    console.error('Erro ao atualizar parcela', e);
    alert('❌ Erro ao marcar parcela como não paga.');
  } finally {
    esconderSpinner();
  }
};
