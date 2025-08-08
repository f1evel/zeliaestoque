// movimentacoes.js — Gerenciamento de entradas e saídas de produtos no sistema Zélia.

import { db, getEmpresaIdDoUsuario } from "./firebaseConfig.js";
import {
  collection, getDocs, addDoc, query, where, doc, updateDoc, orderBy, Timestamp, getDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

import {
  normalizarTexto,
  mostrarMensagem,
  mostrarErro,
  calcularDiasParaVencimento,
  mostrarSpinner,
  esconderSpinner,
  parseDataLocal,
  formatarPreco
} from './utils.js';
import { registrarHistorico } from './historico.js';
import { abrirScanner } from './scanner.js';

import {
  abrirModalConfirmacao,
  cancelarConfirmacao,
  confirmarAcao
} from './modais.js';
import { abrirModalEntrada } from './modalEntrada.js';

// =========================
// 🔥 Variáveis Globais
// =========================
let movimentacoesCache = [];
let produtosCache = [];
let produtosPorNome = {}; // Novo: agrupamento por nome normalizado
let mapaValidades = {}; // Novo: quantidades por validade
let listenerFormulario = null; // usado ao editar uma movimentacao
let fornecedoresSet = new Set();
let compraIdSet = new Set();
let fornecedorOriginalEdicao = null; // armazena fornecedor original durante edição

// =========================
// 🔥 Carregar Movimentações
// =========================
async function carregarMovimentacoes() {
  mostrarSpinner();
  try {
    const lista = document.getElementById("lista-movimentacoes");
    lista.innerHTML = "<p>Carregando movimentações...</p>";

    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(collection(db, "empresas", empresaId, "movimentacoes"), orderBy("dataMovimentacao", "desc"));
    const snapshot = await getDocs(q);
    movimentacoesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    compraIdSet = new Set();
    movimentacoesCache.forEach(m => {
      if (m.compraId) compraIdSet.add(m.compraId);
      if (m.fornecedor) fornecedoresSet.add(m.fornecedor.trim());
    });

    atualizarListaFornecedores();
    atualizarDatalistsFiltros();
    aplicarFiltros();
  } catch (error) {
    console.error("❌ Erro ao carregar movimentações:", error);
    mostrarErro("Erro ao carregar movimentações.", error);
  } finally {
    esconderSpinner();
  }
}

carregarMovimentacoes();
window.carregarMovimentacoes = carregarMovimentacoes;

document.addEventListener("DOMContentLoaded", () => {
  const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
  const campoData = document.getElementById("data-movimentacao");
  if (campoData && !campoData.value) {
    campoData.value = hoje;
  }

  const nomeArmazenado = sessionStorage.getItem('nomeProdutoMovimentacao');
  if (nomeArmazenado) {
    const inputNome = document.getElementById('nome-produto');
    if (inputNome) {
      inputNome.value = nomeArmazenado;
      sessionStorage.removeItem('nomeProdutoMovimentacao');
      setTimeout(() => {
        document.getElementById('tipo-movimentacao')?.focus();
      }, 10);
    }
  }

  const btnScan = document.getElementById('btn-ler-barcode-mov');
  if (btnScan) {
    btnScan.addEventListener('click', async () => {
      try {
        const codigo = await abrirScanner();
        if (codigo) preencherProdutoPorCodigo(codigo.trim());
      } catch (e) {
        console.error('scanner mov', e);
      }
    });
  }
});

// =========================
// 🔥 Carregar Produtos (para autocomplete)
// =========================
async function carregarProdutos() {
  const empresaId = await getEmpresaIdDoUsuario();
  const snapshot = await getDocs(collection(db, "empresas", empresaId, "produtos"));
  produtosCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Agrupa os produtos por nome normalizado
  produtosPorNome = {};
  fornecedoresSet = new Set();
  produtosCache.forEach(prod => {
    const nomeNormalizado = normalizarTexto(prod.nome);
    if (!produtosPorNome[nomeNormalizado]) {
      produtosPorNome[nomeNormalizado] = [];
    }
    produtosPorNome[nomeNormalizado].push(prod);
    if (prod.fornecedor) fornecedoresSet.add(prod.fornecedor.trim());
  });

  // 🔄 Também carrega fornecedores existentes nas movimentações
  await carregarFornecedoresDasMovimentacoes(empresaId);

  const listaFor = document.getElementById("lista-fornecedores-mov");
  if (listaFor) {
    listaFor.innerHTML = [...fornecedoresSet]
      .sort()
      .map(f => `<option value="${f}">`)
      .join("");
  }

  atualizarListaFornecedores();
  atualizarDatalistsFiltros();
}

function atualizarListaFornecedores() {
  const listaFor = document.getElementById("lista-fornecedores-mov");
  const listaFiltro = document.getElementById("lista-fornecedores-filtro");
  const html = [...fornecedoresSet]
    .sort()
    .map(f => `<option value="${f}">`)
    .join("");
  if (listaFor) listaFor.innerHTML = html;
  if (listaFiltro) listaFiltro.innerHTML = html;
}

function adicionarFornecedor(fornecedor) {
  if (!fornecedor) return;
  const trim = fornecedor.trim();
  if (!trim) return;
  if (!fornecedoresSet.has(trim)) {
    fornecedoresSet.add(trim);
    atualizarListaFornecedores();
  }
}

window.adicionarFornecedor = adicionarFornecedor;

// ==========================
// 🔥 Carregar Fornecedores das Movimentações
// ==========================
async function carregarFornecedoresDasMovimentacoes(empresaId) {
  const snap = await getDocs(collection(db, "empresas", empresaId, "movimentacoes"));
  snap.forEach(docu => {
    const mov = docu.data();
    if (mov.fornecedor) fornecedoresSet.add(mov.fornecedor.trim());
  });
}

function atualizarDatalistsFiltros() {
  const listaProdutos = document.getElementById("lista-produtos-filtro");
  if (listaProdutos) {
    const nomes = [...new Set(produtosCache.map(p => p.nome))].sort();
    listaProdutos.innerHTML = nomes.map(n => `<option value="${n}">`).join("");
  }

  const listaCompra = document.getElementById("lista-compra-id-filtro");
  if (listaCompra) {
    listaCompra.innerHTML = [...compraIdSet]
      .sort()
      .map(id => `<option value="${id}">`)
      .join("");
  }
}

carregarProdutos();

async function preencherProdutoPorCodigo(codigo) {
  const prod = produtosCache.find(p => p.barcode === codigo || (p.altBarcodes || []).includes(codigo));
  if (prod) {
    const campo = document.getElementById('nome-produto');
    if (campo) campo.value = prod.nome;
    return;
  }
  if (confirm('Produto não encontrado. Deseja cadastrá-lo?')) {
    window.location.href = `produtos.html?barcode=${encodeURIComponent(codigo)}`;
  }
}

// ==========================
// 🔍 Obter preço de uma validade específica
// ==========================
async function obterPrecoDaValidade(nome, validadeStr) {
  const nomeNormalizado = normalizarTexto(nome);
  const dataVal = new Date(validadeStr);
  if (isNaN(dataVal.getTime())) return null;
  const validadeTs = Timestamp.fromDate(dataVal);

  try {
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(
      collection(db, "empresas", empresaId, "movimentacoes"),
      where("nomeBusca", "==", nomeNormalizado),
      where("tipo", "==", "entrada"),
      where("validade", "==", validadeTs)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0].data();
      if (typeof d.precoUnitario === "number") {
        return d.precoUnitario;
      }
    }
  } catch (e) {
    console.error("Erro ao buscar preço da validade:", e);
  }

  const prod = produtosCache.find(
    p => normalizarTexto(p.nome) === nomeNormalizado
  );
  if (prod) {
    let val;
    if (prod.validade?.toDate) {
      val = prod.validade.toDate();
    } else {
      val = new Date(prod.validade);
    }
    if (!isNaN(val.getTime()) && val.toISOString().split("T")[0] === validadeStr) {
      return typeof prod.precoCompra === "number" ? prod.precoCompra : null;
    }
  }
  return null;
}

async function obterFornecedorDaValidade(nome, validadeStr) {
  const nomeNormalizado = normalizarTexto(nome);
  const dataVal = new Date(validadeStr);
  if (isNaN(dataVal.getTime())) return null;
  const validadeTs = Timestamp.fromDate(dataVal);

  try {
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(
      collection(db, "empresas", empresaId, "movimentacoes"),
      where("nomeBusca", "==", nomeNormalizado),
      where("tipo", "==", "entrada"),
      where("validade", "==", validadeTs)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0].data();
      return d.fornecedor || null;
    }
  } catch (e) {
    console.error("Erro ao buscar fornecedor da validade:", e);
  }
  const prod = produtosCache.find(p => normalizarTexto(p.nome) === nomeNormalizado);
  return prod ? prod.fornecedor || null : null;
}

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
selectValidadeSaida.addEventListener("change", atualizarPrecoPorValidade);

async function atualizarPrecoPorValidade() {
  const validadeSelecionada = selectValidadeSaida.value;
  const nome = document.getElementById("nome-produto").value.trim();
  document.getElementById("validade").value = validadeSelecionada;

  if (!validadeSelecionada || !nome) return;

  const preco = await obterPrecoDaValidade(nome, validadeSelecionada);
  if (preco !== null) {
    document.getElementById("preco-unitario").value = preco;
  }

  const fornecedor = await obterFornecedorDaValidade(nome, validadeSelecionada);
  const inputFornecedor = document.getElementById("fornecedor-mov");
  if (inputFornecedor) {
    inputFornecedor.value = fornecedor || "";
  }
}

document.getElementById("tipo-movimentacao").addEventListener("change", atualizarCamposPorTipo);
document.getElementById("nome-produto").addEventListener("change", atualizarCamposPorTipo);

function atualizarCamposPorTipo() {
  const tipo = document.getElementById("tipo-movimentacao").value;
  const nome = document.getElementById("nome-produto").value.trim();
  const campoValidade = document.getElementById("validade").parentElement;
  const campoLote = document.getElementById("lote").parentElement;
  const grupoValidadeSaida = document.getElementById("grupo-validade-saida");
  const grupoFornecedor = document.getElementById("grupo-fornecedor");
  const inputFornecedor = document.getElementById("fornecedor-mov");

  if (tipo === "saida") {
    campoValidade.style.display = "none";
    campoLote.style.display = "none";
    grupoValidadeSaida.style.display = "block";
    if (grupoFornecedor) grupoFornecedor.style.display = "none";
    if (inputFornecedor) {
      inputFornecedor.value = "";
      inputFornecedor.required = false;
    }

    // ✅ Preenche validades disponíveis e preços ao selecionar produto
    if (nome.length > 0) preencherValidadesDisponiveis();
  } else {
    campoValidade.style.display = "block";
    campoLote.style.display = "block";
    grupoValidadeSaida.style.display = "none";
    if (grupoFornecedor) grupoFornecedor.style.display = "block";
    if (inputFornecedor) {
      inputFornecedor.required = true;
    }
    if (inputFornecedor && !inputFornecedor.value) {
      if (fornecedorOriginalEdicao !== null) {
        inputFornecedor.value = fornecedorOriginalEdicao;
      } else if (nome) {
        const prodSel = produtosCache.find(p => normalizarTexto(p.nome) === normalizarTexto(nome));
        if (prodSel) {
          inputFornecedor.value = prodSel.fornecedor || "";
        }
      }
    }
  }
}


async function preencherValidadesDisponiveis() {
  const nome = document.getElementById("nome-produto").value.trim();
  const tipo = document.getElementById("tipo-movimentacao").value;
  mapaValidades = {};

  // Limpa opções antigas do select
  selectValidadeSaida.innerHTML = "";

  if (tipo !== "saida" || nome.length < 2) return;

  const nomeNormalizado = normalizarTexto(nome);
  const empresaId = await getEmpresaIdDoUsuario();
  const snapshot = await getDocs(query(
    collection(db, "empresas", empresaId, "movimentacoes"),
    where("nomeBusca", "==", nomeNormalizado)
  ));

  let temMovimentacoes = false;
  snapshot.forEach(doc => {
    const d = doc.data();
    if (d.validade?.toDate) {
      const val = d.validade.toDate().toISOString().split("T")[0];
      const qtd = Number(d.quantidade) || 0;
      if (qtd === 0) return;
      if (d.tipo === "entrada") {
        mapaValidades[val] = (mapaValidades[val] || 0) + qtd;
      } else if (d.tipo === "saida") {
        mapaValidades[val] = (mapaValidades[val] || 0) - qtd;
      }
      temMovimentacoes = true;
    }
  });

  if (!temMovimentacoes) {
    const produtoBase = produtosCache.find(p =>
      normalizarTexto(p.nome) === nomeNormalizado
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
        mapaValidades[valStr] = produtoBase.quantidade;
      }
    }
  }
 // 🔄 Preenche o select com as validades em estoque
 // console.log("Mapa final de validades:", mapaValidades);
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

  selectValidadeSaida.value = validadesDisponiveis[0][0];
  await atualizarPrecoPorValidade();

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
// 🔥 Filtros Dinâmicos
// =========================
function aplicarFiltros() {
  const tipo = document.getElementById("filtro-tipo-mov").value;
  const nome = normalizarTexto(document.getElementById("filtro-produto-mov").value.trim());
  const fornecedor = document.getElementById("filtro-fornecedor-mov").value.trim();
  const compraId = document.getElementById("filtro-compra-mov").value.trim();
  const dataInicio = document.getElementById("filtro-data-inicio-mov").value;
  const dataFim = document.getElementById("filtro-data-fim-mov").value;

  const filtradas = movimentacoesCache.filter(m => {
    if (tipo && m.tipo !== tipo) return false;
    if (nome && !normalizarTexto(m.nomeProduto || "").includes(nome)) return false;
    if (fornecedor && (m.fornecedor || "") !== fornecedor) return false;
    if (compraId && (m.compraId || "") !== compraId) return false;

    let dataMov = m.dataMovimentacao?.toDate();
    if (dataInicio && (!dataMov || dataMov < parseDataLocal(dataInicio))) return false;
    if (dataFim && (!dataMov || dataMov > parseDataLocal(dataFim))) return false;
    return true;
  });

  renderizarTabela(filtradas);
  const contador = document.getElementById("contador-movimentacoes");
  if (contador) contador.textContent = `Exibindo ${filtradas.length} movimentações`;
}

function limparFiltrosMovimentacoes() {
  document.getElementById("filtro-tipo-mov").value = "";
  document.getElementById("filtro-produto-mov").value = "";
  document.getElementById("filtro-fornecedor-mov").value = "";
  document.getElementById("filtro-compra-mov").value = "";
  document.getElementById("filtro-data-inicio-mov").value = "";
  document.getElementById("filtro-data-fim-mov").value = "";
  aplicarFiltros();
}

document.addEventListener("DOMContentLoaded", () => {
  [
    "filtro-tipo-mov",
    "filtro-produto-mov",
    "filtro-fornecedor-mov",
    "filtro-compra-mov",
    "filtro-data-inicio-mov",
    "filtro-data-fim-mov",
  ].forEach(id => {
    document.getElementById(id)?.addEventListener("input", aplicarFiltros);
  });
  document.getElementById("botao-limpar-filtros")?.addEventListener("click", limparFiltrosMovimentacoes);
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
  const dataMov = parseDataLocal(document.getElementById("data-movimentacao").value);
  const observacoes = document.getElementById("observacoes").value.trim();
  const validadeStr = document.getElementById("validade").value;
  const validade = validadeStr ? parseDataLocal(validadeStr) : new Date(NaN);
  const fornecedorMov = document.getElementById("fornecedor-mov").value.trim();

  if (tipo === "saida") {
    if (!validadeStr) {
      alert("❌ Selecione a validade da saída.");
      return;
    }
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

  const empresaId = await getEmpresaIdDoUsuario();
  const produtoRef = doc(db, "empresas", empresaId, "produtos", produtoEncontrado.id);
  const produtoSnap = await getDoc(produtoRef);
  const produto = produtoSnap.data();

  const novaQuantidade = tipo === "entrada"
    ? (produto.quantidade || 0) + quantidade
    : (produto.quantidade || 0) - quantidade;

  if (novaQuantidade < 0) {
    alert("❌ Estoque insuficiente para realizar a saída.");
    return;
  }

  if (tipo === "entrada") {
    try {
      const quantidadeAnterior = produto.quantidade || 0;
      const novaQtd = quantidadeAnterior + quantidade;
      await updateDoc(produtoRef, { quantidade: novaQtd });
      await registrarHistorico(produtoEncontrado.id, 'quantidade', quantidadeAnterior, novaQtd);

      const dataTimestamp = Timestamp.fromDate(dataMov);
      const validadeTs = isNaN(validade.getTime()) ? null : Timestamp.fromDate(validade);

      const movRef = await addDoc(collection(db, "empresas", empresaId, "movimentacoes"), {
        produtoId: produtoEncontrado.id,
        nomeProduto: produto.nome,
        nomeBusca: normalizarTexto(produto.nome),
        categoria: produto.categoria,
        fornecedor: fornecedorMov || produto.fornecedor,
        unidadeMedida: produto.unidadeMedida || "unidade",
        tipo: "entrada",
        quantidade,
        precoUnitario,
        custoTotal: quantidade * precoUnitario,
        dataMovimentacao: dataTimestamp,
        observacao: observacoes,
        validade: validadeTs,
        lote,
        usuario: "admin@zelia.com"
      });

      abrirModalEntrada({
        id: produtoEncontrado.id,
        nome: produto.nome,
        categoria: produto.categoria,
        fornecedor: fornecedorMov || produto.fornecedor,
        unidadeMedida: produto.unidadeMedida || "unidade",
        quantidade,
        precoCompra: precoUnitario,
        dataEntrada: dataMov,
        validade,
        lote,
        movimentacaoId: movRef.id,
        novaEntrada: true,
        quantidadeAnterior
      });
    } catch (e) {
      console.error("Erro ao registrar entrada:", e);
      mostrarErro("Erro ao registrar entrada.", e);
    }
    return;
  }

  abrirModalConfirmacao(
    `Deseja confirmar saída de ${quantidade} unidade(s) do produto "${produto.nome}"?`,
    async () => {
      try {
        await updateDoc(produtoRef, { quantidade: novaQuantidade });
        await registrarHistorico(produtoEncontrado.id, 'quantidade', produto.quantidade || 0, novaQuantidade);

        const dataTimestamp = Timestamp.fromDate(dataMov);

        const fornecedorSaida =
          (await obterFornecedorDaValidade(produto.nome, validadeStr)) ||
          produto.fornecedor || "";

        await addDoc(collection(db, "empresas", empresaId, "movimentacoes"), {
          produtoId: produtoEncontrado.id,
          nomeProduto: produto.nome,
          nomeBusca: normalizarTexto(produto.nome),
          categoria: produto.categoria,
          fornecedor: fornecedorSaida,
          unidadeMedida: produto.unidadeMedida || "unidade",
          tipo: "saida",
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
        fornecedorOriginalEdicao = null;
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
function renderizarTabela(movimentacoes) {
  const lista = document.getElementById("lista-movimentacoes");
  const filtradas = movimentacoes;

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
        <th>Ações</th>
      </tr>`;

  if (filtradas.length === 0) {
    html += `<tr><td colspan="9" style="text-align:center;">❌ Nenhuma movimentação encontrada.</td></tr>`;
    html += "</table>";
    lista.innerHTML = html;
    return;
  }

  filtradas.forEach(m => {
    const dataMov = m.dataMovimentacao?.toDate()?.toLocaleDateString("pt-BR") || "-";
    const classeTipo = m.tipo === "entrada" ? "mov-entrada" : m.tipo === "saida" ? "mov-saida" : "";
    html += `<tr class="${classeTipo}">
      <td>${m.nomeProduto}</td>
      <td>${m.tipo}</td>
      <td>${m.quantidade}</td>
      <td>${m.precoUnitario != null ? formatarPreco(m.precoUnitario) : "-"}</td>
      <td>${formatarPreco(m.custoTotal || 0)}</td>
      <td>${dataMov}</td>
      <td>${m.validade?.toDate()?.toLocaleDateString("pt-BR") || "-"}</td>
      <td>${m.lote || "-"}</td>
      <td><button onclick="editarMovimentacao('${m.id}')">✏️ Editar</button>
        ${m.tipo === 'entrada' ? `<button onclick="editarFinanceiro('${m.id}')">${m.entradaFinanceiraPendente ? '📄 Adicionar dados financeiros' : '✏️ Alterar dados financeiros'}</button>` : ''}
      </td>
    </tr>`;
  });

  html += "</table>";
  lista.innerHTML = html;
}


// ==========================
// 🔥 Editar Movimentação
// ==========================
window.editarMovimentacao = async function (id) {
  const empresaId = await getEmpresaIdDoUsuario();
  const docRef = doc(db, "empresas", empresaId, "movimentacoes", id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    mostrarErro("❌ Movimentação não encontrada.");
    return;
  }

  const m = docSnap.data();

  document.getElementById("nome-produto").value = m.nomeProduto || "";
  document.getElementById("tipo-movimentacao").value = m.tipo || "entrada";
  document.getElementById("quantidade").value = m.quantidade || "";
  document.getElementById("preco-unitario").value = m.precoUnitario || "";
  document.getElementById("data-movimentacao").value =
    m.dataMovimentacao?.toDate()?.toISOString().split("T")[0] || "";
  document.getElementById("validade").value =
    m.validade?.toDate()?.toISOString().split("T")[0] || "";
  document.getElementById("lote").value = m.lote || "";
  document.getElementById("observacoes").value = m.observacao || "";
  const inputFornecedor = document.getElementById("fornecedor-mov");
  if (inputFornecedor) {
    inputFornecedor.value = m.fornecedor || "";
    fornecedorOriginalEdicao = m.fornecedor || "";
  }

  atualizarCamposPorTipo();

  const btn = document.querySelector("#form-movimentacao button[type='submit']");
  btn.textContent = "💾 Salvar Alterações";

  const form = document.getElementById("form-movimentacao");
  if (listenerFormulario) {
    form.removeEventListener("submit", listenerFormulario);
  }

  listenerFormulario = async function (e) {
    e.preventDefault();

    const nomeProduto = document.getElementById("nome-produto").value.trim();
    const tipo = document.getElementById("tipo-movimentacao").value;
    const quantidade = parseFloat(document.getElementById("quantidade").value);
    const precoUnitario =
      parseFloat(document.getElementById("preco-unitario").value) || 0;
    const dataMov = parseDataLocal(
      document.getElementById("data-movimentacao").value
    );
    const observacoes = document.getElementById("observacoes").value.trim();
    const validadeStr = document.getElementById("validade").value;
    const validade = validadeStr ? parseDataLocal(validadeStr) : new Date(NaN);
    const lote = document.getElementById("lote").value.trim();
    let fornecedor;
    if (tipo === "entrada") {
      fornecedor = document.getElementById("fornecedor-mov").value.trim();
      if (window.adicionarFornecedor) window.adicionarFornecedor(fornecedor);
    } else {
      fornecedor =
        (await obterFornecedorDaValidade(nomeProduto, validadeStr)) ||
        (produtosCache.find(p => normalizarTexto(p.nome) === normalizarTexto(nomeProduto))?.fornecedor || "");
    }

    const atualizados = {
      nomeProduto,
      nomeBusca: normalizarTexto(nomeProduto),
      tipo,
      quantidade,
      precoUnitario,
      custoTotal: quantidade * precoUnitario,
      dataMovimentacao: Timestamp.fromDate(dataMov),
      observacao: observacoes,
      validade: isNaN(validade.getTime()) ? null : Timestamp.fromDate(validade),
      lote,
      fornecedor
    };

    await updateDoc(docRef, atualizados);

    mostrarMensagem("✅ Movimentação atualizada com sucesso!");
    form.reset();
    fornecedorOriginalEdicao = null;
    btn.textContent = "Salvar Movimentação";
    carregarMovimentacoes();
    form.removeEventListener("submit", listenerFormulario);
    listenerFormulario = null;
  };

  form.addEventListener("submit", listenerFormulario);
};

// Adicionar/alterar dados financeiros de uma movimentação de entrada
window.editarFinanceiro = async function (id) {
  const empresaId = await getEmpresaIdDoUsuario();
  const movRef = doc(db, "empresas", empresaId, "movimentacoes", id);
  const movSnap = await getDoc(movRef);
  if (!movSnap.exists()) return;

  const m = movSnap.data();
  const prodRef = doc(db, "empresas", empresaId, "produtos", m.produtoId);
  const prodSnap = await getDoc(prodRef);
  const prod = prodSnap.data() || {};

  abrirModalEntrada({
    id: m.produtoId,
    nome: m.nomeProduto,
    categoria: m.categoria || prod.categoria,
    fornecedor: m.fornecedor || prod.fornecedor,
    unidadeMedida: m.unidadeMedida || prod.unidadeMedida || 'unidade',
    quantidade: m.quantidade,
    precoCompra: m.precoUnitario,
    dataEntrada: m.dataMovimentacao?.toDate() || new Date(),
    validade: m.validade?.toDate() || null,
    lote: m.lote || '',
    movimentacaoId: id,
    compraId: m.compraId || ''
  });
};
