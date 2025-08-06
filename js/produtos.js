// produtos.js — Gerenciamento de produtos para o sistema Zélia.

import { db, storage, getEmpresaIdDoUsuario } from "./firebaseConfig.js";

import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  doc,
  updateDoc,
  orderBy,
  Timestamp,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

import { registrarHistorico, carregarHistorico } from './historico.js';

import {
  abrirModalProdutoExiste
} from './modais.js';

import {
  abrirModalEntrada
} from './modalEntrada.js';

import {
  normalizarTexto,
  mostrarMensagem,
  mostrarErro,
  calcularDiasParaVencimento,
  executarComSpinner,
  parseDataLocal,
  distanciaLevenshtein,
  formatarPreco
} from './utils.js';

// 🔧 Formatador de datas
function formatarData(data) {
  try {
    if (data instanceof Timestamp) return data.toDate().toLocaleDateString('pt-BR');
    if (data instanceof Date) return data.toLocaleDateString('pt-BR');
    if (typeof data === 'string' && data) {
      const d = new Date(data);
      return isNaN(d.getTime()) ? "-" : d.toLocaleDateString('pt-BR');
    }
    return "-";
  } catch {
    return "-";
  }
}

// 🔧 Formato ISO para inputs (yyyy-mm-dd)
function formatarDataInput(data) {
  try {
    if (data?.toDate) return data.toDate().toISOString().split('T')[0];
    if (data instanceof Date) return data.toISOString().split('T')[0];
    if (typeof data === 'string' && data) {
      const d = new Date(data);
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    }
    return '';
  } catch {
    return '';
  }
}

// 🔥 Variáveis Globais
let produtosCache = [];
let editandoProdutoId = null;
let produtoEmEdicao = null;
let docRefEmEdicao = null;
let metricasPrecoPorNome = {};
let quantidadeTotalPorNome = {};
let nomesProdutosUnicos = [];
let timeoutSugestaoNome = null;
let indiceSugestaoNome = -1;
let itensSugestaoNome = [];


// ==========================
// 🔥 Carregar Produtos
// ==========================
async function carregarProdutos() {
  await executarComSpinner(async () => {
    const lista = document.getElementById("lista-produtos");
    lista.innerHTML = "<p>Carregando produtos...</p>";

    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(collection(db, "empresas", empresaId, "produtos"), orderBy("dataEntrada", "desc"));
    const snapshot = await getDocs(q);

    // console.log(`✅ Produtos carregados: ${snapshot.docs.length}`);

    produtosCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    nomesProdutosUnicos = [...new Set(produtosCache.map(p => p.nome))];

    quantidadeTotalPorNome = {};
    produtosCache.forEach(p => {
      const nome = p.nomeBusca || normalizarTexto(p.nome || "");
      quantidadeTotalPorNome[nome] = (quantidadeTotalPorNome[nome] || 0) + (p.quantidade || 0);
    });

    metricasPrecoPorNome = await carregarMetricasDePreco(empresaId);

    renderizarTabela(produtosCache);
  }, "❌ Erro ao carregar produtos.");
}
// Torna a função acessível globalmente para atualizações externas
window.carregarProdutos = carregarProdutos;
carregarProdutos();

async function carregarMetricasDePreco(empresaId) {
  const resultado = {};
  const q = query(
    collection(db, 'empresas', empresaId, 'movimentacoes'),
    where('tipo', '==', 'entrada')
  );
  const snap = await getDocs(q);
  snap.forEach(docu => {
    const d = docu.data();
    const nome = d.nomeBusca || normalizarTexto(d.nomeProduto || d.nome || '');
    const preco = Number(d.precoUnitario);
    const qtd = Number(d.quantidade) || 0;
    if (isNaN(preco)) return;
    if (!resultado[nome]) {
      resultado[nome] = {
        min: preco,
        max: preco,
        total: preco * qtd,
        qtd
      };
    } else {
      const r = resultado[nome];
      r.min = Math.min(r.min, preco);
      r.max = Math.max(r.max, preco);
      r.total += preco * qtd;
      r.qtd += qtd;
    }
  });
  Object.keys(resultado).forEach(n => {
    const r = resultado[n];
    r.media = r.qtd ? r.total / r.qtd : r.min;
  });
  return resultado;
}

// ==========================
// 🔥 Filtro da Tabela
// ==========================
document.getElementById("filtro-produto").addEventListener("input", function () {
  const termo = normalizarTexto(this.value.trim());
  renderizarTabela(produtosCache, termo);
});

document.getElementById("ordenacao-produto").addEventListener("change", () => {
  const termo = normalizarTexto(document.getElementById("filtro-produto").value.trim());
  renderizarTabela(produtosCache, termo);
});

// ==========================
// 🔥 Renderizar Tabela
// ==========================
function renderizarTabela(produtos, termo = "") {
  const lista = document.getElementById("lista-produtos");

  const filtrados = produtos.filter(p => {
    const nomeNormalizado = normalizarTexto(p.nome || "");
    return nomeNormalizado.includes(termo);
  });

  const criterio = document.getElementById("ordenacao-produto")?.value || "recentes";
  const obterData = d => {
    if (!d) return new Date(0);
    if (d.toDate) return d.toDate();
    if (d instanceof Date) return d;
    const x = new Date(d);
    return isNaN(x.getTime()) ? new Date(0) : x;
  };

  const ordenados = filtrados.slice().sort((a, b) => {
    switch (criterio) {
      case 'nome':
        return normalizarTexto(a.nome).localeCompare(normalizarTexto(b.nome));
      case 'validade':
        return obterData(a.validade) - obterData(b.validade);
      case 'fornecedor':
        return normalizarTexto(a.fornecedor).localeCompare(normalizarTexto(b.fornecedor));
      case 'categoria':
        return normalizarTexto(a.categoria).localeCompare(normalizarTexto(b.categoria));
      case 'preco':
        return (a.precoCompra || 0) - (b.precoCompra || 0);
      default:
        return obterData(b.dataEntrada) - obterData(a.dataEntrada);
    }
  });

  if (filtrados.length === 0) {
    lista.innerHTML = "<p>❌ Nenhum produto encontrado.</p>";
    return;
  }

  let html = `
    <table class="tabela">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Categoria</th>
          <th>Estoque Atual</th>
          <th>Mín.</th>
          <th>Preço</th>
          <th>Preço Mín.</th>
          <th>Preço Máx.</th>
          <th>Preço Médio</th>
          <th>Validade</th>
          <th>Fornecedor</th>
          <th>Localização</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
  `;

  ordenados.forEach(p => {
    const nomeRef = p.nomeBusca || normalizarTexto(p.nome || "");
    const estoqueAtual = quantidadeTotalPorNome[nomeRef] || 0;
    const dataValidade = estoqueAtual === 0 ? '-' : formatarData(p.validade);
    const alertaEstoque = estoqueAtual <= p.quantidadeMinima;
    const diasParaVencer = calcularDiasParaVencimento(p.validade);
    const alertaValidade = diasParaVencer <= 15;

    const style = alertaEstoque || alertaValidade
      ? "style='background:#ffe5e5;color:#900;'"
      : "";

    const preco =
      p.precoCompra !== undefined && p.precoCompra !== null
        ? formatarPreco(Number(p.precoCompra) || 0)
        : "-";
    const metrica = metricasPrecoPorNome[nomeRef] || {};
    const precoMin =
      metrica.min !== undefined ? formatarPreco(metrica.min) : "-";
    const precoMax =
      metrica.max !== undefined ? formatarPreco(metrica.max) : "-";
    const precoMed =
      metrica.media !== undefined ? formatarPreco(metrica.media) : "-";

    html += `
      <tr ${style}>
        <td>${p.nome}</td>
        <td>${p.categoria || "-"}</td>
        <td>${estoqueAtual}</td>
        <td>${p.quantidadeMinima}</td>
        <td>${preco}</td>
        <td>${precoMin}</td>
        <td>${precoMax}</td>
        <td>${precoMed}</td>
        <td>${dataValidade}</td>
        <td class="fornecedor-cell" title="${(p.fornecedor || '-').replace(/"/g, '&quot;')}">${(p.fornecedor || '-').length > 20 ? (p.fornecedor || '-').slice(0, 20) + '...' : (p.fornecedor || '-')}</td>
        <td>${p.localizacao || "-"}</td>
        <td>
          <button onclick="verDetalhes('${p.id}')">👁️ Detalhes</button>
          <button onclick="editarProduto('${p.id}')">✏️ Editar</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  lista.innerHTML = html;
}

// ==========================
// 🔥 Adicionar Produto
// ==========================
async function adicionarProduto() {
  // console.log("🚀 Função adicionarProduto() foi chamada");

  await executarComSpinner(async () => {
    try {
      const nome = document.getElementById("nome").value.trim();
      const categoria = document.getElementById("categoria").value.trim();
      const quantidade = parseInt(document.getElementById("quantidade").value);
      const quantidadeMinima = parseInt(document.getElementById("quantidadeMinima").value);
      const validadeInput = document.getElementById("validade").value;
      const validade = parseDataLocal(validadeInput);
      const dataEntrada = parseDataLocal(document.getElementById("dataEntrada").value);
      const precoCompraValor = document.getElementById("precoCompra").value.replace(',', '.');
      const precoCompra = parseFloat(precoCompraValor) || 0;
      const fornecedor = document.getElementById("fornecedor").value.trim();
      const prazoEntregaDias = parseInt(document.getElementById("prazoEntregaDias").value);
      const observacoes = document.getElementById("observacoes").value.trim();
      const localizacao = document.getElementById("localizacao").value.trim();
      const lote = document.getElementById("lote")?.value?.trim() || "";

      // console.log("🔸 Nome:", nome);
      // console.log("🔸 Categoria:", categoria);
      // console.log("🔸 Quantidade:", quantidade);
      // console.log("🔸 Quantidade mínima:", quantidadeMinima);
      // console.log("🔸 Validade (string):", validadeInput);
      // console.log("🔸 Validade (Date):", validade);
      // console.log("🔸 Data de entrada:", dataEntrada);
      // console.log("🔸 Preço de compra:", precoCompra);
      // console.log("🔸 Fornecedor:", fornecedor);
      // console.log("🔸 Prazo entrega dias:", prazoEntregaDias);
      // console.log("🔸 Observações:", observacoes);
      // console.log("🔸 Localização:", localizacao);
      // console.log("🔸 Lote:", lote);

      if (!nome || isNaN(quantidade) || isNaN(quantidadeMinima) || !validadeInput) {
        alert("❗ Preencha todos os campos obrigatórios (nome, quantidade, quantidade mínima e validade).");
        return;
      }

      const nomeNormalizado = normalizarTexto(nome);
      // console.log("🔎 Nome normalizado:", nomeNormalizado);

      const empresaId = await getEmpresaIdDoUsuario();
      const q = query(collection(db, "empresas", empresaId, "produtos"), where("nomeBusca", "==", nomeNormalizado));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        abrirModalProdutoExiste(nome);
        return;
      }

      try {
        const docRef = await addDoc(collection(db, "empresas", empresaId, "produtos"), {
          nome,
          nomeBusca: nomeNormalizado,
          categoria,
          quantidade: 0, // quantidade será adicionada via entrada
          quantidadeMinima,
          validade: isNaN(validade.getTime()) ? null : Timestamp.fromDate(validade),
          dataEntrada: isNaN(dataEntrada.getTime()) ? null : Timestamp.fromDate(dataEntrada),
          precoCompra,
          fornecedor,
          prazoEntregaDias,
          observacoes,
          localizacao,
          lote
        });

        // console.log("✅ Produto adicionado ao Firestore:", docRef.id);
        mostrarMensagem("✅ Produto adicionado com sucesso!");

        try {
          abrirModalEntrada({
            id: docRef.id,
            nome,
            categoria,
            fornecedor,
            unidadeMedida: "unidade",
            quantidade,
            precoCompra,
            dataEntrada,
            validade,
            lote,
            novoCadastro: true
          });
        } catch (erroModal) {
          console.error("❌ Erro ao abrir modal de entrada:", erroModal);
          mostrarErro("❌ Produto salvo, mas houve erro ao abrir o modal de entrada.");
        }

        document.getElementById("form-produto").reset();
        carregarProdutos();
      } catch (erro) {
        console.error("❌ Erro ao salvar produto:", erro);
        mostrarErro("❌ Não foi possível salvar o produto.");
      }

    } catch (erro) {
      console.error("❌ Erro inesperado ao adicionar produto:", erro);
      throw erro;
    }
  });
}

// ==========================
// 🔥 Editar Produto
// ==========================
window.editarProduto = async function (id) {
  await executarComSpinner(async () => {
    const empresaId = await getEmpresaIdDoUsuario();
    const ref = doc(db, 'empresas', empresaId, 'produtos', id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      mostrarErro('❌ Produto não encontrado.');
      return;
    }

    const p = snap.data();
    docRefEmEdicao = ref;
    editandoProdutoId = id;
    produtoEmEdicao = p;

    document.getElementById('nome').value = p.nome || '';
    document.getElementById('categoria').value = p.categoria || '';
    document.getElementById('quantidade').value = p.quantidade || '';
    document.getElementById('quantidadeMinima').value = p.quantidadeMinima || '';
    document.getElementById('validade').value = formatarDataInput(p.validade);
    document.getElementById('dataEntrada').value = formatarDataInput(p.dataEntrada);
    document.getElementById('precoCompra').value =
      p.precoCompra !== undefined && p.precoCompra !== null
        ? p.precoCompra.toString().replace('.', ',')
        : '';
    document.getElementById('prazoEntregaDias').value = p.prazoEntregaDias || '';
    document.getElementById('fornecedor').value = p.fornecedor || '';
    document.getElementById('observacoes').value = p.observacoes || '';
    document.getElementById('localizacao').value = p.localizacao || '';
    document.getElementById('lote').value = p.lote || '';

    const btn = document.querySelector('#form-produto button[type="submit"]');
    btn.textContent = '💾 Salvar Alterações';
    const cancelar = document.getElementById('cancelar-edicao');
    if (cancelar) cancelar.style.display = 'inline-block';

    const finContainer = document.getElementById('financeiro-pendente-container');
    const finBtn = document.getElementById('btn-adicionar-financeiro');
    if (finContainer && finBtn) {
      finContainer.style.display = 'block';
      finBtn.textContent = p.entradaFinanceiraPendente ? '📄 Adicionar entrada financeira' : '✏️ Alterar dados financeiros';
    }

    const form = document.getElementById('form-produto');
    form.dataset.editando = 'true';
  });
};

async function salvarAlteracoesProduto() {
  const form = document.getElementById('form-produto');
  if (!docRefEmEdicao || !form) return;

  const atualizados = {
    nome: document.getElementById('nome').value.trim(),
    nomeBusca: normalizarTexto(document.getElementById('nome').value.trim()),
    categoria: document.getElementById('categoria').value.trim(),
    quantidade: parseInt(document.getElementById('quantidade').value),
    quantidadeMinima: parseInt(document.getElementById('quantidadeMinima').value),
    validade: (() => {
      const data = parseDataLocal(document.getElementById('validade').value);
      return isNaN(data.getTime()) ? null : Timestamp.fromDate(data);
    })(),
    dataEntrada: (() => {
      const data = parseDataLocal(document.getElementById('dataEntrada').value);
      return isNaN(data.getTime()) ? null : Timestamp.fromDate(data);
    })(),
    precoCompra: (() => {
      const valor = document.getElementById('precoCompra').value.replace(',', '.');
      return parseFloat(valor) || 0;
    })(),
    prazoEntregaDias: parseInt(document.getElementById('prazoEntregaDias').value),
    fornecedor: document.getElementById('fornecedor').value.trim(),
    observacoes: document.getElementById('observacoes').value.trim(),
    localizacao: document.getElementById('localizacao').value.trim(),
    lote: document.getElementById('lote').value.trim()
  };

  try {
    await updateDoc(docRefEmEdicao, atualizados);

    // 🔄 Se o nome mudou, atualiza nas movimentações relacionadas
    if ((produtoEmEdicao.nome || '') !== atualizados.nome) {
      await atualizarNomeMovimentacoes(editandoProdutoId, atualizados.nome);
      await registrarHistorico(
        editandoProdutoId,
        'nome',
        produtoEmEdicao.nome,
        atualizados.nome
      );
    }

    // 🔄 Se a validade mudou, atualiza nas movimentações relacionadas
    const antigaValidade = produtoEmEdicao.validade?.toDate
      ? produtoEmEdicao.validade.toDate().toISOString()
      : produtoEmEdicao.validade || null;
    const novaValidade = atualizados.validade?.toDate
      ? atualizados.validade.toDate().toISOString()
      : atualizados.validade || null;

    if (antigaValidade !== novaValidade) {
      await atualizarValidadeMovimentacoes(editandoProdutoId, atualizados.validade);
    }

    // 🔄 Se o preço mudou, atualiza nas movimentações relacionadas
    if (produtoEmEdicao.precoCompra !== atualizados.precoCompra) {
      await atualizarPrecoMovimentacoes(editandoProdutoId, atualizados.precoCompra);
    }

    const conv = v => {
      if (v?.toDate) return v.toDate().toISOString();
      return v ?? '';
    };

    await registrarHistorico(editandoProdutoId, 'quantidade', produtoEmEdicao.quantidade, atualizados.quantidade);
    await registrarHistorico(editandoProdutoId, 'precoCompra', produtoEmEdicao.precoCompra, atualizados.precoCompra);
    await registrarHistorico(editandoProdutoId, 'validade', conv(produtoEmEdicao.validade), conv(atualizados.validade));
    await registrarHistorico(editandoProdutoId, 'fornecedor', produtoEmEdicao.fornecedor, atualizados.fornecedor);

    await gerarESalvarCSV();

    mostrarMensagem('✅ Alterações salvas com sucesso!');
    form.reset();
    const btnSalvar = document.querySelector('#form-produto button[type="submit"]');
    if (btnSalvar) btnSalvar.textContent = 'Salvar Produto';
    const cancelar = document.getElementById('cancelar-edicao');
    if (cancelar) cancelar.style.display = 'none';
    const finContainer = document.getElementById('financeiro-pendente-container');
    if (finContainer) finContainer.style.display = 'none';
    form.dataset.editando = '';
    carregarProdutos();
    editandoProdutoId = null;
    docRefEmEdicao = null;
    produtoEmEdicao = null;
  } catch (erro) {
    console.error('❌ Erro ao salvar alterações:', erro);
    mostrarErro('❌ Não foi possível salvar as alterações.', erro);
  }
}

function cancelarEdicao() {
  const form = document.getElementById('form-produto');
  form.reset();
  form.dataset.editando = '';
  const btnSalvar = document.querySelector('#form-produto button[type="submit"]');
  if (btnSalvar) btnSalvar.textContent = 'Salvar Produto';
  const cancelar = document.getElementById('cancelar-edicao');
  if (cancelar) cancelar.style.display = 'none';
  const finContainer = document.getElementById('financeiro-pendente-container');
  if (finContainer) finContainer.style.display = 'none';
  editandoProdutoId = null;
  docRefEmEdicao = null;
  produtoEmEdicao = null;
}

// ==========================
// 🔥 Carregar Sugestões
// ==========================
async function carregarSugestoes() {
  const empresaId = await getEmpresaIdDoUsuario();
  const snapshot = await getDocs(collection(db, "empresas", empresaId, "produtos"));
  const categorias = new Set();
  const fornecedores = new Set();

  snapshot.forEach(doc => {
    const p = doc.data();
    if (p.categoria) categorias.add(p.categoria.trim());
    if (p.fornecedor) fornecedores.add(p.fornecedor.trim());
  });

  document.getElementById("lista-categorias").innerHTML =
    [...categorias].sort().map(c => `<option value="${c}">`).join("");

  document.getElementById("lista-fornecedores").innerHTML =
    [...fornecedores].sort().map(f => `<option value="${f}">`).join("");
}

carregarSugestoes();

// ==========================
// 🔍 Autocomplete de Nome
// ==========================
const inputNomeProduto = document.getElementById('nome');
const listaSugestoesNome = document.getElementById('sugestoes-nome');

inputNomeProduto.addEventListener('input', () => {
  const termoOriginal = inputNomeProduto.value.trim();
  const termo = normalizarTexto(termoOriginal);
  if (listaSugestoesNome) {
    listaSugestoesNome.innerHTML = '';
    listaSugestoesNome.style.display = 'none';
  }
  indiceSugestaoNome = -1;
  itensSugestaoNome = [];

  if (termo.length < 2) return;

  clearTimeout(timeoutSugestaoNome);
  timeoutSugestaoNome = setTimeout(() => {
    const encontrados = nomesProdutosUnicos.filter(n => {
      const norm = normalizarTexto(n);
      if (norm.includes(termo) || termo.includes(norm)) return true;
      return distanciaLevenshtein(norm, termo) <= 2;
    });

    if (encontrados.length && listaSugestoesNome) {
      encontrados.slice(0, 10).forEach(n => {
        const item = document.createElement('li');
        item.textContent = n;
        item.className = 'autocomplete-item';
        item.addEventListener('click', () => {
          inputNomeProduto.value = n;
          listaSugestoesNome.innerHTML = '';
          listaSugestoesNome.style.display = 'none';
          if (confirm('⚠️ Um produto com nome semelhante já existe. Deseja ir para a aba de Movimentações para dar entrada ou saída neste item?')) {
            sessionStorage.setItem('nomeProdutoMovimentacao', n);
            window.location.href = 'movimentacoes.html';
          }
        });
        listaSugestoesNome.appendChild(item);
        itensSugestaoNome.push(item);
      });
      listaSugestoesNome.style.display = 'block';
    }
  }, 300);
});

inputNomeProduto.addEventListener('keydown', e => {
  if (!listaSugestoesNome || itensSugestaoNome.length === 0) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (indiceSugestaoNome < itensSugestaoNome.length - 1) {
      indiceSugestaoNome++;
      atualizarSelecaoNome();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (indiceSugestaoNome > 0) {
      indiceSugestaoNome--;
      atualizarSelecaoNome();
    }
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    if (indiceSugestaoNome >= 0 && indiceSugestaoNome < itensSugestaoNome.length) {
      e.preventDefault();
      itensSugestaoNome[indiceSugestaoNome].click();
    }
  }
});

function atualizarSelecaoNome() {
  itensSugestaoNome.forEach((item, index) => {
    item.classList.toggle('selecionado', index === indiceSugestaoNome);
  });
}

// ==========================
// 🔥 Alerta ao Perder Foco
// ==========================
document.getElementById("nome").addEventListener("blur", function () {
  const input = this;
  setTimeout(async () => {
    const termo = normalizarTexto(input.value.trim());
    if (!termo) return;

    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(collection(db, "empresas", empresaId, "produtos"), where("nomeBusca", "==", termo));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const existeOutro = snapshot.docs.some(doc => doc.id !== editandoProdutoId);
      if (existeOutro) {
        abrirModalProdutoExiste(input.value.trim());
        input.value = "";
        const sugestoes = document.getElementById("sugestoes-nome");
        if (sugestoes) sugestoes.style.display = "none";
        input.focus();
      }
    }
  }, 200);
});

// ==========================
// 🔥 Gerar e Salvar CSV
// ==========================
async function gerarESalvarCSV() {
  const empresaId = await getEmpresaIdDoUsuario();
  const snapshot = await getDocs(collection(db, "empresas", empresaId, "produtos"));
  const produtos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  if (!produtos.length) return;

  const cabecalho = [
    "ID", "Nome", "Categoria", "Quantidade", "Quantidade Mínima",
    "Validade", "Data Entrada", "Preço Compra", "Fornecedor",
    "Prazo Entrega", "Observações", "Lote", "Localização"
  ];

  const linhas = produtos.map(p => [
    p.id,
    p.nome,
    p.categoria,
    p.quantidade,
    p.quantidadeMinima,
    formatarData(p.validade),
    formatarData(p.dataEntrada),
    p.precoCompra,
    p.fornecedor,
    p.prazoEntregaDias,
    `"${(p.observacoes || "").replace(/"/g, '""')}"`,
    p.lote || "",
    p.localizacao || ""
  ].join(","));

  const conteudoCSV = [cabecalho.join(","), ...linhas].join("\n");

  try {
    await fetch(
      "https://us-central1-zelia-1.cloudfunctions.net/salvarCSV",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeArquivo: "produtos.csv",
          conteudo: conteudoCSV
        })
      }
    );
  } catch (e) {
    console.error("Erro ao enviar CSV:", e);
  }

  // console.log("✅ CSV enviado para a Cloud Function.");
}


// ✅ Acionar salvar produto no submit do formulário
const form = document.getElementById("form-produto");
const btn = document.querySelector("#form-produto button[type='submit']");
const btnCancelar = document.getElementById('cancelar-edicao');
const btnFinanceiro = document.getElementById('btn-adicionar-financeiro');
let listenerPadrao = null;

if (form && btn) {
  listenerPadrao = (e) => {
    e.preventDefault();
    if (form.dataset.editando === 'true') {
      salvarAlteracoesProduto();
      return;
    }
    adicionarProduto();
  };
  form.addEventListener('submit', listenerPadrao);
}

if (btnCancelar) {
  btnCancelar.addEventListener('click', cancelarEdicao);
}

if (btnFinanceiro) {
  btnFinanceiro.addEventListener('click', () => {
    if (!editandoProdutoId) return;
    const nome = document.getElementById('nome').value.trim();
    const categoria = document.getElementById('categoria').value.trim();
    const fornecedor = document.getElementById('fornecedor').value.trim();
    const quantidade = parseInt(document.getElementById('quantidade').value) || 0;
    const precoCompra = parseFloat(document.getElementById('precoCompra').value.replace(',', '.')) || 0;
    const validade = parseDataLocal(document.getElementById('validade').value);
    const dataEntrada = parseDataLocal(document.getElementById('dataEntrada').value);
    const lote = document.getElementById('lote')?.value?.trim() || '';
    abrirModalEntrada({
      id: editandoProdutoId,
      nome,
      categoria,
      fornecedor,
      unidadeMedida: 'unidade',
      quantidade,
      precoCompra,
      dataEntrada,
      validade,
      lote
    });
  });
}

// 🔧 Preencher data de entrada com a data atual ao carregar a página
const campoDataEntrada = document.getElementById("dataEntrada");
if (campoDataEntrada && !campoDataEntrada.value) {
  const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
  campoDataEntrada.value = hoje;
}

// ==========================
// 🔥 Ver Detalhes do Produto
// ==========================
window.verDetalhes = async function(id) {
  await executarComSpinner(async () => {
    const empresaId = await getEmpresaIdDoUsuario();
    const docRef = doc(db, 'empresas', empresaId, 'produtos', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      mostrarErro('❌ Produto não encontrado.');
      return;
    }

    const p = snap.data();
    document.getElementById('det-nome').textContent = p.nome || '-';
    document.getElementById('det-categoria').textContent = p.categoria || '-';
    document.getElementById('det-quantidade').textContent = p.quantidade ?? '-';
    document.getElementById('det-preco').textContent =
      p.precoCompra !== undefined && p.precoCompra !== null
        ? formatarPreco(Number(p.precoCompra) || 0)
        : '-';
    document.getElementById('det-fornecedor').textContent = p.fornecedor || '-';
    document.getElementById('det-validade').textContent = formatarData(p.validade);

    const historico = await carregarHistorico(id);
    const lista = document.getElementById('lista-historico');
    if (lista) {
      if (historico.length === 0) {
        lista.innerHTML = '<p>Sem alterações registradas.</p>';
      } else {
        let html = `<table class="tabela"><thead><tr><th>Campo</th><th>De</th><th>Para</th><th>Usuário</th><th>Data</th></tr></thead><tbody>`;
        historico.forEach(h => {
          const data = h.data?.toDate ? h.data.toDate() : new Date(h.data);
          const dataStr = data.toLocaleString('pt-BR');
          html += `<tr><td>${h.campo}</td><td>${h.de ?? '-'}</td><td>${h.para ?? '-'}</td><td>${h.usuario || '-'}</td><td>${dataStr}</td></tr>`;
        });
        html += '</tbody></table>';
        lista.innerHTML = html;
      }
    }

    document.getElementById('modal-detalhes-produto').style.display = 'block';
    document.getElementById('fundo-modal-detalhes-produto').style.display = 'block';
    mostrarAbaDetalhes();
  });
};

window.fecharModalDetalhes = function() {
  document.getElementById('modal-detalhes-produto').style.display = 'none';
  document.getElementById('fundo-modal-detalhes-produto').style.display = 'none';
};

window.mostrarAbaDetalhes = function() {
  document.getElementById('aba-detalhes').style.display = 'block';
  document.getElementById('aba-historico').style.display = 'none';
};

window.mostrarAbaHistorico = function() {
  document.getElementById('aba-detalhes').style.display = 'none';
  document.getElementById('aba-historico').style.display = 'block';
};

// ==========================
// 📥 Importar Produtos via CSV
// ==========================
async function importarCSV(file) {
  const Papa = await import('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm');
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (res) => {
      const empresaId = await getEmpresaIdDoUsuario();
      for (const linha of res.data) {
        const dados = {
          nome: linha.nome,
          categoria: linha.categoria,
          quantidade: Number(linha.quantidade) || 0,
          quantidadeMinima: Number(linha.quantidadeMinima) || 0,
          validade: linha.validade || null,
          dataEntrada: linha.dataEntrada || null,
          precoCompra: Number(linha.precoCompra) || 0,
          fornecedor: linha.fornecedor || '',
          prazoEntregaDias: Number(linha.prazoEntregaDias) || 0,
          observacoes: linha.observacoes || '',
          lote: linha.lote || '',
          localizacao: linha.localizacao || '',
          nomeBusca: normalizarTexto(linha.nome)
        };
        await addDoc(collection(db, 'empresas', empresaId, 'produtos'), dados);
      }
      mostrarMensagem('Importação concluída');
      carregarProdutos();
    }
  });
}

document.getElementById('btn-importar-csv')?.addEventListener('click', () => {
  document.getElementById('arquivo-csv').click();
});

document.getElementById('arquivo-csv')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importarCSV(file);
});

// ==========================
// 🔄 Atualizar preço nas movimentações
// ==========================
async function atualizarPrecoMovimentacoes(produtoId, novoPreco) {
  try {
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(
      collection(db, 'empresas', empresaId, 'movimentacoes'),
      where('produtoId', '==', produtoId)
    );
    const snap = await getDocs(q);
    const promises = [];
    snap.forEach(docSnap => {
      const dados = docSnap.data();
      const ref = doc(db, 'empresas', empresaId, 'movimentacoes', docSnap.id);
      const quantidade = Number(dados.quantidade) || 0;
      const custoTotal = quantidade * (Number(novoPreco) || 0);
      promises.push(updateDoc(ref, { precoUnitario: novoPreco, custoTotal }));
    });
    await Promise.all(promises);
  } catch (e) {
    console.error('Erro ao atualizar preço nas movimentações:', e);
  }
}

// ==========================
// 🔄 Atualizar validade nas movimentações
// ==========================
async function atualizarValidadeMovimentacoes(produtoId, novaValidade) {
  try {
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(
      collection(db, 'empresas', empresaId, 'movimentacoes'),
      where('produtoId', '==', produtoId)
    );
    const snap = await getDocs(q);
    const promises = [];
    snap.forEach(docSnap => {
      const ref = doc(db, 'empresas', empresaId, 'movimentacoes', docSnap.id);
      promises.push(updateDoc(ref, { validade: novaValidade }));
    });
    await Promise.all(promises);
  } catch (e) {
    console.error('Erro ao atualizar validade nas movimentações:', e);
  }
}

// ==========================
// 🔄 Atualizar nome nas movimentações
// ==========================
async function atualizarNomeMovimentacoes(produtoId, novoNome) {
  try {
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(
      collection(db, 'empresas', empresaId, 'movimentacoes'),
      where('produtoId', '==', produtoId)
    );
    const snap = await getDocs(q);
    const promises = [];
    const nomeBusca = normalizarTexto(novoNome || '');
    snap.forEach(docSnap => {
      const ref = doc(db, 'empresas', empresaId, 'movimentacoes', docSnap.id);
      promises.push(updateDoc(ref, { nomeProduto: novoNome, nomeBusca }));
    });
    await Promise.all(promises);
  } catch (e) {
    console.error('Erro ao atualizar nome nas movimentações:', e);
  }
}

