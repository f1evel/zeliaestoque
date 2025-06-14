// produtos.js — Gerenciamento de produtos para o sistema Zélia.

import { db, storage } from "./firebaseConfig.js";
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
import { ref as storageRef, uploadString } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

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
  executarComSpinner
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

// 🔥 Variáveis Globais
let listenerFormulario = null;
let produtosCache = [];

// ==========================
// 🔥 Carregar Produtos
// ==========================
async function carregarProdutos() {
  await executarComSpinner(async () => {
    const lista = document.getElementById("lista-produtos");
    lista.innerHTML = "<p>Carregando produtos...</p>";

    const q = query(collection(db, "produtos"), orderBy("dataEntrada", "desc"));
    const snapshot = await getDocs(q);

    console.log(`✅ Produtos carregados: ${snapshot.docs.length}`);

    produtosCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    renderizarTabela(produtosCache);
  }, "❌ Erro ao carregar produtos.");
}
carregarProdutos();

// ==========================
// 🔥 Filtro da Tabela
// ==========================
document.getElementById("filtro-produto").addEventListener("input", function () {
  const termo = normalizarTexto(this.value.trim());
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

  if (filtrados.length === 0) {
    lista.innerHTML = "<p>❌ Nenhum produto encontrado.</p>";
    return;
  }

  let html = `
    <table class="tabela">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Qtd</th>
          <th>Mín.</th>
          <th>Validade</th>
          <th>Fornecedor</th>
          <th>Localização</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtrados.forEach(p => {
    const dataValidade = formatarData(p.validade);
    const alertaEstoque = p.quantidade <= p.quantidadeMinima;
    const diasParaVencer = calcularDiasParaVencimento(p.validade);
    const alertaValidade = diasParaVencer <= 15;

    const style = alertaEstoque || alertaValidade
      ? "style='background:#ffe5e5;color:#900;'"
      : "";

    html += `
      <tr ${style}>
        <td>${p.nome}</td>
        <td>${p.quantidade}</td>
        <td>${p.quantidadeMinima}</td>
        <td>${dataValidade}</td>
        <td>${p.fornecedor || "-"}</td>
        <td>${p.localizacao || "-"}</td>
        <td><button onclick="editarProduto('${p.id}')">✏️ Editar</button></td>
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
  console.log("🚀 Função adicionarProduto() foi chamada");

  await executarComSpinner(async () => {
    try {
      const nome = document.getElementById("nome").value.trim();
      const categoria = document.getElementById("categoria").value.trim();
      const quantidade = parseInt(document.getElementById("quantidade").value);
      const quantidadeMinima = parseInt(document.getElementById("quantidadeMinima").value);
      const validadeInput = document.getElementById("validade").value;
      const validade = new Date(validadeInput);
      const dataEntrada = new Date(document.getElementById("dataEntrada").value);
      const precoCompraValor = document.getElementById("precoCompra").value.replace(',', '.');
      const precoCompra = parseFloat(precoCompraValor) || 0;
      const fornecedor = document.getElementById("fornecedor").value.trim();
      const prazoEntregaDias = parseInt(document.getElementById("prazoEntregaDias").value);
      const observacoes = document.getElementById("observacoes").value.trim();
      const localizacao = document.getElementById("localizacao").value.trim();
      const lote = document.getElementById("lote")?.value?.trim() || "";

      console.log("🔸 Nome:", nome);
      console.log("🔸 Categoria:", categoria);
      console.log("🔸 Quantidade:", quantidade);
      console.log("🔸 Quantidade mínima:", quantidadeMinima);
      console.log("🔸 Validade (string):", validadeInput);
      console.log("🔸 Validade (Date):", validade);
      console.log("🔸 Data de entrada:", dataEntrada);
      console.log("🔸 Preço de compra:", precoCompra);
      console.log("🔸 Fornecedor:", fornecedor);
      console.log("🔸 Prazo entrega dias:", prazoEntregaDias);
      console.log("🔸 Observações:", observacoes);
      console.log("🔸 Localização:", localizacao);
      console.log("🔸 Lote:", lote);

      if (!nome || isNaN(quantidade) || isNaN(quantidadeMinima) || !validadeInput) {
        alert("❗ Preencha todos os campos obrigatórios (nome, quantidade, quantidade mínima e validade).");
        return;
      }

      const nomeNormalizado = normalizarTexto(nome);
      console.log("🔎 Nome normalizado:", nomeNormalizado);

      const q = query(collection(db, "produtos"), where("nomeBusca", "==", nomeNormalizado));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        console.warn("⚠️ Produto já existe!");
        abrirModalProdutoExiste();
        return;
      }

      try {
        const docRef = await addDoc(collection(db, "produtos"), {
          nome,
          nomeBusca: nomeNormalizado,
          categoria,
          quantidade,
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

        console.log("✅ Produto adicionado ao Firestore:", docRef.id);
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
            lote
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
    const docRef = doc(db, "produtos", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      mostrarErro("❌ Produto não encontrado.");
      return;
    }

    const p = docSnap.data();

    document.getElementById("nome").value = p.nome || "";
    document.getElementById("categoria").value = p.categoria || "";
    document.getElementById("quantidade").value = p.quantidade || "";
    document.getElementById("quantidadeMinima").value = p.quantidadeMinima || "";
    document.getElementById("validade").value = formatarData(p.validade) || "";
    document.getElementById("dataEntrada").value = formatarData(p.dataEntrada) || "";
    document.getElementById("precoCompra").value =
      p.precoCompra !== undefined && p.precoCompra !== null
        ? p.precoCompra.toString().replace('.', ',')
        : "";
    document.getElementById("prazoEntregaDias").value = p.prazoEntregaDias || "";
    document.getElementById("fornecedor").value = p.fornecedor || "";
    document.getElementById("observacoes").value = p.observacoes || "";
    document.getElementById("lote").value = p.lote || "";

    const btn = document.querySelector("#form-produto button[type='submit']");
    btn.textContent = "💾 Salvar Alterações";

    const form = document.getElementById("form-produto");

    if (listenerFormulario) {
      form.removeEventListener("submit", listenerFormulario);
    }

    listenerFormulario = async function (e) {
      e.preventDefault();

      const atualizados = {
        nome: document.getElementById("nome").value.trim(),
        nomeBusca: normalizarTexto(document.getElementById("nome").value.trim()),
        categoria: document.getElementById("categoria").value.trim(),
        quantidade: parseInt(document.getElementById("quantidade").value),
        quantidadeMinima: parseInt(document.getElementById("quantidadeMinima").value),
        validade: (() => {
          const data = new Date(document.getElementById("validade").value);
          return isNaN(data.getTime()) ? null : Timestamp.fromDate(data);
        })(),
        dataEntrada: (() => {
          const data = new Date(document.getElementById("dataEntrada").value);
          return isNaN(data.getTime()) ? null : Timestamp.fromDate(data);
        })(),
        precoCompra: (() => {
          const valor = document.getElementById("precoCompra").value.replace(',', '.');
          return parseFloat(valor) || 0;
        })(),
        prazoEntregaDias: parseInt(document.getElementById("prazoEntregaDias").value),
        fornecedor: document.getElementById("fornecedor").value.trim(),
        observacoes: document.getElementById("observacoes").value.trim(),
        localizacao: document.getElementById("localizacao").value.trim(),
        lote: document.getElementById("lote").value.trim()
      };

      await updateDoc(docRef, atualizados);
      await gerarESalvarCSV();

      mostrarMensagem("✅ Alterações salvas com sucesso!");
      form.reset();
      btn.textContent = "Salvar Produto";
      carregarProdutos();
    };

    form.addEventListener("submit", listenerFormulario);
  });
};

// ==========================
// 🔥 Carregar Sugestões
// ==========================
async function carregarSugestoes() {
  const snapshot = await getDocs(collection(db, "produtos"));
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
// 🔥 Alerta ao Perder Foco
// ==========================
document.getElementById("nome").addEventListener("blur", function () {
  const input = this;
  setTimeout(async () => {
    const termo = normalizarTexto(input.value.trim());
    if (!termo) return;

    const q = query(collection(db, "produtos"), where("nomeBusca", "==", termo));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      abrirModalProdutoExiste();
      input.value = "";
      const sugestoes = document.getElementById("sugestoes-nome");
      if (sugestoes) sugestoes.style.display = "none";
      input.focus();
    }
  }, 200);
});

// ==========================
// 🔥 Gerar e Salvar CSV
// ==========================
async function gerarESalvarCSV() {
  const snapshot = await getDocs(collection(db, "produtos"));
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

  const fileRef = storageRef(storage, "relatorios/produtos.csv");
  await uploadString(fileRef, conteudoCSV, "raw", {
    contentType: "text/csv"
  });

  console.log("✅ CSV salvo com sucesso no Firebase Storage.");
}


// ✅ Acionar salvar produto no submit do formulário
const form = document.getElementById("form-produto");
const btn = document.querySelector("#form-produto button[type='submit']");

if (form && btn) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    adicionarProduto();
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

