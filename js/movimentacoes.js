// movimentacoes.js — Gerenciamento de entradas e saídas de produtos no sistema Zélia.

import { db } from "./firebaseConfig.js";
import {
  collection, getDocs, addDoc, query, where, doc, updateDoc, orderBy, Timestamp, getDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

import {
  normalizarTexto,
  mostrarMensagem,
  mostrarErro,
  calcularDiasParaVencimento,
  mostrarSpinner,
  esconderSpinner
} from './utils.js';

import {
  abrirModalConfirmacao,
  cancelarConfirmacao,
  confirmarAcao
} from './modais.js';

// =========================
// 🔥 Variáveis Globais
// =========================
let movimentacoesCache = [];
let produtosCache = [];
let produtosPorNome = {}; // Novo: agrupamento por nome normalizado
let mapaValidades = {}; // Novo: quantidades por validade

// =========================
// 🔥 Carregar Movimentações
// =========================
async function carregarMovimentacoes() {
  mostrarSpinner();
  try {
    const lista = document.getElementById("lista-movimentacoes");
    lista.innerHTML = "<p>Carregando movimentações...</p>";

    const q = query(collection(db, "movimentacoes"), orderBy("dataMovimentacao", "desc"));
    const snapshot = await getDocs(q);
    movimentacoesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    renderizarTabela(movimentacoesCache);
  } catch (error) {
    console.error("❌ Erro ao carregar movimentações:", error);
    mostrarErro("Erro ao carregar movimentações.", error);
  } finally {
    esconderSpinner();
  }
}

carregarMovimentacoes();

document.addEventListener("DOMContentLoaded", () => {
  const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
  const campoData = document.getElementById("data-movimentacao");
  if (campoData && !campoData.value) {
    campoData.value = hoje;
  }
});

// =========================
// 🔥 Carregar Produtos (para autocomplete)
// =========================
async function carregarProdutos() {
  const snapshot = await getDocs(collection(db, "produtos"));
  produtosCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Agrupa os produtos por nome normalizado
  produtosPorNome = {};
  produtosCache.forEach(prod => {
    const nomeNormalizado = normalizarTexto(prod.nome);
    if (!produtosPorNome[nomeNormalizado]) {
      produtosPorNome[nomeNormalizado] = [];
    }
    produtosPorNome[nomeNormalizado].push(prod);
  });
}

carregarProdutos();

// =========================
// 🔥 Autocomplete com Teclado (corrigido)
// =========================
let timeoutBusca = null;
let indiceSelecionado = -1;
let itensSugestao = [];

const inputProduto = document.getElementById("nome-produto");
const lista = document.getElementById("sugestoes-produto");

// 🔍 Autocomplete ao digitar
inputProduto.addEventListener("input", function () {
  const termoOriginal = this.value.trim();
  const termo = normalizarTexto(termoOriginal);
  lista.innerHTML = "";
  lista.style.display = "none";
  atualizarCamposPorTipo();
  indiceSelecionado = -1;
  itensSugestao = [];

  if (termo.length < 2) return;

  clearTimeout(timeoutBusca);
  timeoutBusca = setTimeout(() => {
    const nomesEncontrados = Object.keys(produtosPorNome)
      .filter(nome => nome.includes(termo))
      .map(nome => produtosPorNome[nome][0].nome);

    if (nomesEncontrados.length) {
      nomesEncontrados.forEach(n => {
        const item = document.createElement("li");
        item.textContent = n;
        item.className = "autocomplete-item";
        item.addEventListener("click", () => {
          produtoFoiSelecionado = true; // ✅ marca que foi clicado
          inputProduto.value = n;
          lista.innerHTML = "";
          lista.style.display = "none";
          atualizarCamposPorTipo();
          setTimeout(() => {
            document.getElementById("tipo-movimentacao").focus();
          }, 10);
        });

        lista.appendChild(item);
        itensSugestao.push(item);
      });
      lista.style.display = "block";
    }
  }, 300);
});

// ⌨️ Teclas para navegar no autocomplete
inputProduto.addEventListener("keydown", function (e) {
  if (!lista || itensSugestao.length === 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (indiceSelecionado < itensSugestao.length - 1) {
      indiceSelecionado++;
      atualizarSelecao();
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (indiceSelecionado > 0) {
      indiceSelecionado--;
      atualizarSelecao();
    }
  } else if (e.key === "Enter" || e.key === "Tab") {
    if (indiceSelecionado >= 0 && indiceSelecionado < itensSugestao.length) {
      e.preventDefault();
      itensSugestao[indiceSelecionado].click();
    }
  }
});

// ✅ Verifica se o nome do produto existe ao sair do campo
let produtoFoiSelecionado = false;

inputProduto.addEventListener("blur", () => {
  // ⚠️ Só dispara se o usuário não tiver clicado numa sugestão
  setTimeout(() => {
    if (produtoFoiSelecionado) {
      produtoFoiSelecionado = false;
      return;
    }

    const nomeDigitado = inputProduto.value.trim();
    const nomeNormalizado = normalizarTexto(nomeDigitado);

    if (nomeDigitado.length < 2) return;

    const produtoExiste = Object.keys(produtosPorNome).includes(nomeNormalizado);

    if (!produtoExiste) {
      alert(`❌ Produto não encontrado no estoque. Para cadastrar um novo produto, vá para a aba Produtos.`);
    }
  }, 200); // espera autocomplete finalizar clique
});

function atualizarSelecao() {
  itensSugestao.forEach((item, index) => {
    item.classList.toggle("selecionado", index === indiceSelecionado);
  });
}


// =========================
// 🔥 Ocultar campos e preencher validades com estoque disponível
// =========================

const grupoValidadeSaida = document.getElementById("grupo-validade-saida");
const selectValidadeSaida = document.getElementById("select-validade-saida");

document.getElementById("tipo-movimentacao").addEventListener("change", atualizarCamposPorTipo);
document.getElementById("nome-produto").addEventListener("change", atualizarCamposPorTipo);

function atualizarCamposPorTipo() {
  const tipo = document.getElementById("tipo-movimentacao").value;
  const nome = document.getElementById("nome-produto").value.trim();
  const campoValidade = document.getElementById("validade").parentElement;
  const campoLote = document.getElementById("lote").parentElement;
  const grupoValidadeSaida = document.getElementById("grupo-validade-saida");

  if (tipo === "saida") {
    campoValidade.style.display = "none";
    campoLote.style.display = "none";
    grupoValidadeSaida.style.display = "block";

    // ✅ Chama a função correta para exibir validades e preços
    if (nome.length > 0) carregarValidadesEPrecos(nome);
  } else {
    campoValidade.style.display = "block";
    campoLote.style.display = "block";
    grupoValidadeSaida.style.display = "none";
  }
}


async function preencherValidadesDisponiveis() {
  const nome = document.getElementById("nome-produto").value.trim();
  const tipo = document.getElementById("tipo-movimentacao").value;
  mapaValidades = {};

  // 🔍 Pega validade e quantidade da aba Produtos, se houver
  const produtoBase = produtosCache.find(p =>
    normalizarTexto(p.nome) === normalizarTexto(nome)
  );

  if (produtoBase?.validade && produtoBase?.quantidade > 0) {
    let dataValidade;

    if (produtoBase.validade?.toDate) {
      dataValidade = produtoBase.validade.toDate();
    } else {
      dataValidade = new Date(produtoBase.validade);
    }

    if (!isNaN(dataValidade.getTime())) {
      const valStr = dataValidade.toISOString().split("T")[0];

      if (!mapaValidades[valStr]) {
        mapaValidades[valStr] = produtoBase.quantidade;
      }
    }
  }

selectValidadeSaida.innerHTML = "";


  if (tipo !== "saida" || nome.length < 2) return;

  const nomeNormalizado = normalizarTexto(nome);
  const snapshot = await getDocs(query(
    collection(db, "movimentacoes"),
    where("nomeBusca", "==", nomeNormalizado)
  ));

  snapshot.forEach(doc => {
    const d = doc.data();
    if (d.validade?.toDate) {
      const val = d.validade.toDate().toISOString().split("T")[0];
      const qtd = d.quantidade || 0;
      if (d.tipo === "entrada") {
        mapaValidades[val] = (mapaValidades[val] || 0) + qtd;
      } else if (d.tipo === "saida") {
        mapaValidades[val] = (mapaValidades[val] || 0) - qtd;
      }
    }
  });
 // 🔄 Preenche o select com as validades em estoque
console.log("Mapa final de validades:", mapaValidades);
const validadesDisponiveis = Object.entries(mapaValidades)
  .filter(([_, qtd]) => qtd > 0)
  .sort(([a], [b]) => new Date(a) - new Date(b));

if (validadesDisponiveis.length > 0) {
  validadesDisponiveis.forEach(([val, qtd]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = `${new Date(val).toLocaleDateString("pt-BR")} — ${qtd} unidade(s)`;
    selectValidadeSaida.appendChild(opt);
  });

  // 👉 Garante que o valor escondido também seja preenchido
  document.getElementById("validade").value = validadesDisponiveis[0][0];

  // 💰 Garante preenchimento automático do preço mesmo na primeira seleção
  const precoInicial = await obterPrecoDaValidade(nome, validadesDisponiveis[0][0]);
  if (precoInicial !== null) {
    document.getElementById("preco-unitario").value = precoInicial;
  }

  selectValidadeSaida.addEventListener("change", () => {
    document.getElementById("validade").value = selectValidadeSaida.value;
  });

  selectValidadeSaida.addEventListener("change", async () => {
    const validadeSelecionada = selectValidadeSaida.value;
    document.getElementById("validade").value = validadeSelecionada;

    const preco = await obterPrecoDaValidade(nome, validadeSelecionada);
    if (preco !== null) {
      document.getElementById("preco-unitario").value = preco;
    }
  });

} else {
  // ❌ Nenhuma validade com estoque positivo
  const opt = document.createElement("option");
  opt.disabled = true;
  opt.selected = true;
  opt.textContent = "❌ Produto esgotado para saída";
  selectValidadeSaida.appendChild(opt);

  document.getElementById("validade").value = "";
}

// ✅ Exibe o campo sempre que for saída (inclusive sem estoque)
grupoValidadeSaida.style.display = "block";

}

// =========================
// 🔥 Filtro da Tabela
// =========================
document.getElementById("filtro-movimentacao").addEventListener("input", function () {
  const termo = normalizarTexto(this.value.trim());
  renderizarTabela(movimentacoesCache, termo);
});

// =========================
// 🔥 Registrar Movimentação
// =========================
document.getElementById("form-movimentacao").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nomeProduto = document.getElementById("nome-produto").value.trim();
  const tipo = document.getElementById("tipo-movimentacao").value;
  const quantidade = parseFloat(document.getElementById("quantidade").value);
  const precoUnitario = parseFloat(document.getElementById("preco-unitario").value) || 0;
  const dataMov = new Date(document.getElementById("data-movimentacao").value);
  const observacoes = document.getElementById("observacoes").value.trim();
  const validade = tipo === "saida"
    ? new Date(document.getElementById("select-validade-saida").value)
    : new Date(document.getElementById("validade").value);

  if (isNaN(validade.getTime())) {
    alert("❗ Informe a data de validade.");
    return;
  }

  if (tipo === "saida") {
    const validadeStr = validade.toISOString().split("T")[0];
    const disponivel = mapaValidades[validadeStr] || 0;

    if (quantidade > disponivel) {
      alert(`❌ Estoque insuficiente. Só há ${disponivel} unidade(s) disponíveis para essa validade.`);
      return;
    }
  }

  const lote = document.getElementById("lote").value.trim();

  if (!nomeProduto || !quantidade || isNaN(quantidade)) {
    alert("❗ Informe nome do produto e quantidade.");
    return;
  }

  const produtoEncontrado = produtosCache.find(p => normalizarTexto(p.nome) === normalizarTexto(nomeProduto));

  if (!produtoEncontrado) {
    alert("❌ Produto não encontrado.");
    return;
  }

  const produtoRef = doc(db, "produtos", produtoEncontrado.id);
  const produtoSnap = await getDoc(produtoRef);
  const produto = produtoSnap.data();

  const novaQuantidade = tipo === "entrada"
    ? (produto.quantidade || 0) + quantidade
    : (produto.quantidade || 0) - quantidade;

  if (novaQuantidade < 0) {
    alert("❌ Estoque insuficiente para realizar a saída.");
    return;
  }

  abrirModalConfirmacao(
    `Deseja confirmar ${tipo === "entrada" ? "entrada" : "saída"} de ${quantidade} unidade(s) do produto "${produto.nome}"?`,
    async () => {
      try {
        await updateDoc(produtoRef, { quantidade: novaQuantidade });

        const dataTimestamp = Timestamp.fromDate(dataMov);

        await addDoc(collection(db, "movimentacoes"), {
          produtoId: produtoEncontrado.id,
          nomeProduto: produto.nome,
          nomeBusca: normalizarTexto(produto.nome),
          categoria: produto.categoria,
          fornecedor: produto.fornecedor,
          unidadeMedida: produto.unidadeMedida || "unidade",
          tipo,
          quantidade,
          precoUnitario,
          custoTotal: quantidade * precoUnitario,
          dataMovimentacao: dataTimestamp,
          observacao: observacoes,
          validade: isNaN(validade.getTime()) ? null : Timestamp.fromDate(validade),
          lote,
          usuario: "admin@zelia.com"
        });

        mostrarMensagem("✅ Movimentação registrada com sucesso.");
        document.getElementById("form-movimentacao").reset();
        const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
        document.getElementById("data-movimentacao").value = hoje;
        carregarMovimentacoes();
      } catch (error) {
        console.error("Erro ao registrar movimentação:", error);
        mostrarErro("Erro ao registrar movimentação.", error);
      }
    }
  );
});

// =========================
// 🔥 Renderizar Tabela
// =========================
function renderizarTabela(movimentacoes, termo = "") {
  const lista = document.getElementById("lista-movimentacoes");

  const filtradas = movimentacoes.filter(m => {
    const nomeNormalizado = normalizarTexto(m.nomeProduto || "");
    return nomeNormalizado.includes(normalizarTexto(termo));
  });

  if (filtradas.length === 0) {
    lista.innerHTML = "<p>❌ Nenhuma movimentação encontrada.</p>";
    return;
  }

  let html = `
    <table border="1" cellpadding="8">
      <tr>
        <th>Produto</th>
        <th>Tipo</th>
        <th>Qtd</th>
        <th>Preço Unit.</th>
        <th>Custo Total</th>
        <th>Data</th>
        <th>Validade</th>
        <th>Lote</th>
        <th>Observações</th>
      </tr>`;

  filtradas.forEach(m => {
    const dataMov = m.dataMovimentacao?.toDate()?.toLocaleDateString("pt-BR") || "-";
    html += `<tr>
      <td>${m.nomeProduto}</td>
      <td>${m.tipo}</td>
      <td>${m.quantidade}</td>
      <td>R$ ${m.precoUnitario?.toFixed(2) || "-"}</td>
      <td>R$ ${(m.custoTotal || 0).toFixed(2)}</td>
      <td>${dataMov}</td>
      <td>${m.validade?.toDate()?.toLocaleDateString("pt-BR") || "-"}</td>
      <td>${m.lote || "-"}</td>
      <td>${m.observacao || "-"}</td>
    </tr>`;
  });

  html += "</table>";
  lista.innerHTML = html;
}


// =========================
// 🔎 Buscar todas as validades e precos
// =========================
async function carregarValidadesEPrecos(nome) {
  const nomeNormalizado = normalizarTexto(nome);
  const opcoes = [];

  // 🔍 Produtos
  produtosCache.forEach(p => {
    if (
      normalizarTexto(p.nome) === nomeNormalizado &&
      p.quantidade > 0 &&
      p.validade &&
      typeof p.precoCompra === "number"
    ) {
      let dataValidade;
      if (p.validade?.toDate) {
        dataValidade = p.validade.toDate();
      } else {
        dataValidade = new Date(p.validade);
      }

      if (!isNaN(dataValidade.getTime())) {
        opcoes.push({
          validade: dataValidade,
          preco: p.precoCompra,
          qtd: p.quantidade
        });
      }
    }
  });

  // 🔍 Movimentações (tipo entrada)
  const snap = await getDocs(query(
    collection(db, "movimentacoes"),
    where("nomeBusca", "==", nomeNormalizado),
    where("tipo", "==", "entrada")
  ));

  snap.forEach(doc => {
    const d = doc.data();
    if (
      d.validade instanceof Timestamp &&
      typeof d.precoUnitario === "number" &&
      d.quantidade > 0
    ) {
      const dataVal = d.validade.toDate();
      if (!isNaN(dataVal.getTime())) {
        opcoes.push({
          validade: dataVal,
          preco: d.precoUnitario,
          qtd: d.quantidade
        });
      }
    }
  });

  // 🧾 Preencher <select> com todas as opções
  const select = document.getElementById("select-validade-saida");
  const precoInput = document.getElementById("preco-unitario");
  const campoOcultoValidade = document.getElementById("validade");

  select.innerHTML = "";

  if (opcoes.length === 0) {
    const opt = document.createElement("option");
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = "❌ Nenhuma validade encontrada";
    select.appendChild(opt);
    campoOcultoValidade.value = "";
    precoInput.value = "";
    return;
  }

  // 📅 Ordenar por validade mais próxima
  opcoes.sort((a, b) => a.validade - b.validade);

  opcoes.forEach(({ validade, preco, qtd }, index) => {
    const valStr = validade.toISOString().split("T")[0];
    const opt = document.createElement("option");
    opt.value = JSON.stringify({ validade: valStr, preco });
    opt.textContent = `${validade.toLocaleDateString("pt-BR")} — ${qtd} unidade(s) — R$ ${preco.toFixed(2)}`;
    if (index === 0) {
      opt.selected = true;
      precoInput.value = preco.toFixed(2);
      campoOcultoValidade.value = valStr;
    }
    select.appendChild(opt);
  });

  // 🌀 Evento de troca
  select.addEventListener("change", e => {
    const dados = JSON.parse(e.target.value);
    campoOcultoValidade.value = dados.validade;
    precoInput.value = dados.preco.toFixed(2);
  });
}
