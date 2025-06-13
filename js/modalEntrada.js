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

/**
 * 🔥 Abrir o Modal de Entrada
 */
export async function abrirModalEntrada(produto) {
  console.log("🧪 produto recebido no modal:", produto);
  console.log("🧪 typeof dataEntrada:", typeof produto.dataEntrada);
  console.log("🧪 dataEntrada bruta:", produto.dataEntrada);

  produtoCadastroAtual = produto;

  // Carrega IDs de compra pendentes para autocompletar
  try {
    const lista = document.getElementById("lista-compra-id");
    if (lista) {
      lista.innerHTML = "";
      const pendentesSnap = await getDocs(
        query(collection(db, "financeiro"), where("status", "==", "pendente"))
      );
      const ids = new Set();
      pendentesSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (
          Array.isArray(d.parcelas) &&
          d.parcelas.some(p => p.status === "pendente") &&
          d.compraId
        ) {
          ids.add(d.compraId);
        }
      });
      lista.innerHTML = Array.from(ids)
        .map(id => `<option value="${id}"></option>`)
        .join("\n");
    }
  } catch (erro) {
    console.error("Erro ao carregar IDs de compra pendentes:", erro);
  }
  document.getElementById("nome-produto-modal").textContent =
    `Produto: ${produto.nome}`;
  document.getElementById("entrada-forma-pagamento").value = "pix";
  document.getElementById("entrada-observacoes").value = "";
  const dataEntrada = new Date(produtoCadastroAtual.dataEntrada);
  document.getElementById("entrada-primeiro-vencimento").value = dataEntrada.toISOString().split("T")[0];
  document.getElementById("modal-entrada").style.display = "block";
  document.getElementById("fundo-modal").style.display = "block";

  atualizarParcelasPreview(); // Gera preview com base no produto atual
}

/**
 * 🔥 Fechar o Modal de Entrada
 */
export function fecharModalEntrada() {
  document.getElementById("modal-entrada").style.display = "none";
  document.getElementById("fundo-modal").style.display = "none";
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
      const novasParcelas = parcelas.map((p, idx) => ({ ...p, numero: parcelasExistentes.length + idx + 1 }));

      await updateDoc(finRef, {
        valorTotal: (finData.valorTotal || 0) + custoTotal,
        compraId,
        identificadorPagamento,
        parcelas: [...parcelasExistentes, ...novasParcelas]
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

