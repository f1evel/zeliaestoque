// modalEntrada.js - Controle do modal de entrada + financeiro

import { db } from "./firebaseConfig.js";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

import { mostrarErro, normalizarTexto } from './utils.js';

let produtoCadastroAtual = null;
let dadosFinanceiroAtual = null;

/**
 * 🔥 Abrir o Modal de Entrada
 */
export async function abrirModalEntrada(produto) {
  console.log("🧪 produto recebido no modal:", produto);
  console.log("🧪 typeof dataEntrada:", typeof produto.dataEntrada);
  console.log("🧪 dataEntrada bruta:", produto.dataEntrada);

  produtoCadastroAtual = produto;

  // Carrega IDs de compras já registradas para autocompletar
  try {
    const lista = document.getElementById("lista-compra-id");
    if (lista) {
      lista.innerHTML = "";
      const comprasSnap = await getDocs(collection(db, "financeiro"));
      const ids = new Set();
      comprasSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.compraId) {
          ids.add(d.compraId);
        }
      });
      lista.innerHTML = Array.from(ids)
        .map(id => `<option value="${id}"></option>`)
        .join("\n");
    }
  } catch (erro) {
    console.error("Erro ao carregar IDs de compra:", erro);
  }
  document.getElementById("nome-produto-modal").textContent =
    `Produto: ${produto.nome}`;
  document.getElementById("entrada-forma-pagamento").value = "pix";
  document.getElementById("entrada-observacoes").value = "";
  const dataEntrada = new Date(produtoCadastroAtual.dataEntrada);
  dataEntrada.setMonth(dataEntrada.getMonth() + 1);
  document.getElementById("entrada-primeiro-vencimento").value = dataEntrada
    .toISOString()
    .split("T")[0];

  if (produto.compraId) {
    document.getElementById("entrada-compra-id").value = produto.compraId;
    await preencherDadosFinanceiro(produto.compraId);
  } else {
    atualizarParcelasPreview();
  }

  document.getElementById("modal-entrada").style.display = "block";
  document.getElementById("fundo-modal").style.display = "block";
}

/**
 * 🔥 Fechar o Modal de Entrada
 */
export function fecharModalEntrada() {
  document.getElementById("modal-entrada").style.display = "none";
  document.getElementById("fundo-modal").style.display = "none";
}

async function preencherDadosFinanceiro(compraId) {
  if (!compraId) return;
  try {
    const q = query(collection(db, "financeiro"), where("compraId", "==", compraId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      dadosFinanceiroAtual = snap.docs[0].data();
      document.getElementById("entrada-forma-pagamento").value = dadosFinanceiroAtual.formaPagamento || "pix";
      document.getElementById("entrada-identificador-pagamento").value = dadosFinanceiroAtual.identificadorPagamento || "";
      document.getElementById("entrada-observacoes").value = dadosFinanceiroAtual.observacoes || "";
      const parcelas = Array.isArray(dadosFinanceiroAtual.parcelas) ? dadosFinanceiroAtual.parcelas : [];
      document.getElementById("entrada-numero-parcelas").value = parcelas.length || 1;
      if (parcelas.length > 0) {
        document.getElementById("entrada-primeiro-vencimento").value = parcelas[0].vencimento;
        exibirParcelas(parcelas);
      } else {
        atualizarParcelasPreview();
      }
    }
  } catch (e) {
    console.error("Erro ao carregar dados financeiros:", e);
  }
}

function exibirParcelas(parcelas) {
  if (!Array.isArray(parcelas) || parcelas.length === 0) {
    atualizarParcelasPreview();
    return;
  }

  let html = `<table style="width:100%; border-collapse: collapse;">
                <tr style="background:#f0f0f0;">
                  <th>Parcela</th><th>Valor (R$)</th><th>Data de Vencimento</th>
                </tr>`;

  parcelas.forEach((p, index) => {
    html += `<tr>
      <td style="text-align:center;">${p.numero}</td>
      <td style="text-align:center;">${(p.valor || 0).toFixed(2)}</td>
      <td style="text-align:center;"><input type="date" id="parcela-venc-${index}" value="${p.vencimento}" /></td>
    </tr>`;
  });

  html += "</table>";
  document.getElementById("parcelas-container").innerHTML = html;
}

/**
 * 🔧 Geração automática de compraId
 */
window.gerarNovoCompraId = function () {
  const agora = new Date();
  const dataStr = agora.toISOString().split("T")[0].replace(/-/g, "");
  const aleatorio = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  const id = `compra_${dataStr}_${aleatorio}`;
  const input = document.getElementById("entrada-compra-id");
  if (input) input.value = id;
};

/**
 * ✅ Função confirmada para botão
 */

window.confirmarEntradaEstoque = async function () {
  try {
    const formaPagamento = document.getElementById("entrada-forma-pagamento").value;
    const observacoes = document.getElementById("entrada-observacoes").value.trim() || "";
    const compraId = document.getElementById("entrada-compra-id")?.value?.trim() || "";
    const identificadorPagamento = document.getElementById("entrada-identificador-pagamento")?.value?.trim() || "";
    const numParcelas = parseInt(document.getElementById("entrada-numero-parcelas")?.value || "1");

    const dataMov = new Date(produtoCadastroAtual.dataEntrada); // ✅ Aqui está a correção!

    if (!compraId) {
      alert("❌ Você precisa informar um identificador da compra (compraId).");
      return;
    }

    const produtoRef = doc(db, "produtos", produtoCadastroAtual.id);
    const produtoSnap = await getDoc(produtoRef);

    if (!produtoSnap.exists()) {
      throw new Error("Produto não encontrado no banco.");
    }

    const produto = produtoSnap.data();
    const quantidade = produtoCadastroAtual.quantidade || 0;
    const precoUnitario = produtoCadastroAtual.precoCompra || 0;
    const validadeEntrada = produtoCadastroAtual.validade ? new Date(produtoCadastroAtual.validade) : null;
    const lote = produtoCadastroAtual.lote || "";
    const custoTotal = quantidade * precoUnitario;
    const dataTimestamp = Timestamp.fromDate(dataMov);

    const parcelas = [];
    for (let i = 0; i < numParcelas; i++) {
      const input = document.getElementById(`parcela-venc-${i}`);
      if (input) {
        parcelas.push({
          numero: i + 1,
          valor: Math.round((custoTotal / numParcelas) * 100) / 100,
          vencimento: input.value,
          status: "pendente"
        });
      }
    }


    // 🔸 Atualiza o estoque
    const novaQuantidade = (produto.quantidade || 0) + quantidade;
    await updateDoc(produtoRef, { quantidade: novaQuantidade });

    // 🔸 Registra a movimentação
    await addDoc(collection(db, "movimentacoes"), {
      produtoId: produtoCadastroAtual.id,
      nomeProduto: produto.nome,
      nomeBusca: normalizarTexto(produto.nome),
      categoria: produto.categoria,
      fornecedor: produto.fornecedor,
      unidadeMedida: produto.unidadeMedida || "-",
      tipo: "entrada",
      quantidade,
      precoUnitario,
      custoTotal,
      dataMovimentacao: dataTimestamp,
      observacao: observacoes,
      validade: validadeEntrada ? Timestamp.fromDate(validadeEntrada) : null,
      lote,
      parcelas: parcelas,
      usuario: "admin@zelia.com"
    });
    
    // 🔸 Registra ou atualiza o financeiro
    const finQuery = query(collection(db, "financeiro"), where("compraId", "==", compraId));
    const finSnap = await getDocs(finQuery);

    if (!finSnap.empty) {
      const existing = finSnap.docs[0];
      const finRef = doc(db, "financeiro", existing.id);
      const finData = existing.data();
      const parcelasExistentes = Array.isArray(finData.parcelas) ? finData.parcelas : [];

      const novoValorTotal = (finData.valorTotal || 0) + custoTotal;
      const numParcelasTotais = parcelasExistentes.length || parcelas.length;
      const novoValorParcela = Math.round((novoValorTotal / numParcelasTotais) * 100) / 100;
      const parcelasAtualizadas = parcelasExistentes.map((p, idx) => ({
        ...p,
        numero: idx + 1,
        valor: novoValorParcela
      }));

      await updateDoc(finRef, {
        valorTotal: novoValorTotal,
        compraId,
        identificadorPagamento,
        parcelas: parcelasAtualizadas
      });
    } else {
      await addDoc(collection(db, "financeiro"), {
        tipo: "pagar",
        fornecedorOuCliente: produto.fornecedor || "Fornecedor não informado",
        descricao: `Compra de ${quantidade} ${produto.unidadeMedida || "unidade(s)"} de ${produto.nome}`,
        categoria: "compra",
        formaPagamento,
        valorTotal: custoTotal,
        dataLancamento: dataTimestamp,
        dataVencimento: null,
        dataPagamento: null,
        status: "pendente",
        observacoes,
        usuario: "admin@zelia.com",
        compraId,
        identificadorPagamento,
        parcelas
      });
    }

    alert("✅ Entrada no estoque registrada e financeiro atualizado com sucesso!");
    fecharModalEntrada();
    window.location.reload();

  } catch (err) {
    console.error("❌ Erro ao registrar entrada:", err?.message || err);
    alert(`❌ Erro real:\n\n${err?.message || err}`);
  }
};


//Gerar parcelas//

function gerarParcelasAutomaticamente(valorTotal, numParcelas, dataInicial) {
  const parcelas = [];
  const valorParcela = Math.round((valorTotal / numParcelas) * 100) / 100; // Arredondamento com 2 casas

  const dataBase = new Date(dataInicial);
  for (let i = 0; i < numParcelas; i++) {
    const vencimento = new Date(dataBase);
    vencimento.setMonth(dataBase.getMonth() + i);

    parcelas.push({
      numero: i + 1,
      valor: valorParcela,
      vencimento: vencimento.toISOString().split("T")[0],
      status: "pendente"
    });
  }

  return parcelas;
}

function atualizarParcelasPreview() {
  const quantidade = produtoCadastroAtual?.quantidade || 0;
  const precoUnitario = produtoCadastroAtual?.precoCompra || 0;
  const valorTotal = quantidade * precoUnitario;

  const numParcelas = parseInt(document.getElementById("entrada-numero-parcelas").value || "1");
  const dataInicial = document.getElementById("entrada-primeiro-vencimento").value;

  if (!valorTotal || !numParcelas || !dataInicial) {
    document.getElementById("parcelas-container").innerHTML = "<p>⚠️ Preencha quantidade, preço e data para gerar parcelas.</p>";
    return;
  }

  const parcelas = gerarParcelasAutomaticamente(valorTotal, numParcelas, dataInicial);

  let html = `<table style="width:100%; border-collapse: collapse;">
                <tr style="background:#f0f0f0;">
                  <th>Parcela</th><th>Valor (R$)</th><th>Data de Vencimento</th>
                </tr>`;

  parcelas.forEach((p, index) => {
    html += `<tr>
      <td style="text-align:center;">${p.numero}</td>
      <td style="text-align:center;">${p.valor.toFixed(2)}</td>
      <td style="text-align:center;">
        <input type="date" id="parcela-venc-${index}" value="${p.vencimento}" />
      </td>
    </tr>`;
  });

  html += "</table>";
  document.getElementById("parcelas-container").innerHTML = html;
}

document.getElementById("entrada-numero-parcelas").addEventListener("input", atualizarParcelasPreview);
document.getElementById("entrada-primeiro-vencimento").addEventListener("change", atualizarParcelasPreview);
document.getElementById("entrada-compra-id").addEventListener("change", (e) => {
  preencherDadosFinanceiro(e.target.value.trim());
});

// Tornar funções acessíveis globalmente para os botões do modal
window.fecharModalEntrada = fecharModalEntrada;

