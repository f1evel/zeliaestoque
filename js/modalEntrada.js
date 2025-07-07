// modalEntrada.js - Controle do modal de entrada + financeiro

import { db, getEmpresaIdDoUsuario } from "./firebaseConfig.js";
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

import { mostrarErro, normalizarTexto, parseDataLocal, formatarCompraIdBR, formatarPreco } from './utils.js';
import { registrarHistorico } from './historico.js';

let produtoCadastroAtual = null;
let dadosFinanceiroAtual = null;
let handlerTecladoEntrada = null;

// Calcula a média de preços das entradas anteriores de um produto
async function calcularPrecoMedioEntradas(produtoId) {
  try {
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(
      collection(db, 'empresas', empresaId, 'movimentacoes'),
      where('produtoId', '==', produtoId),
      where('tipo', '==', 'entrada')
    );
    const snap = await getDocs(q);
    let soma = 0;
    let count = 0;
    snap.forEach(docSnap => {
      const d = docSnap.data();
      if (typeof d.precoUnitario === 'number') {
        soma += d.precoUnitario;
        count++;
      }
    });
    if (count === 0) return null;
    return soma / count;
  } catch (e) {
    console.error('Erro ao calcular preço médio:', e);
    return null;
  }
}

/**
 * 🔥 Abrir o Modal de Entrada
 */
export async function abrirModalEntrada(produto) {
  // console.log("🧪 produto recebido no modal:", produto);
  // console.log("🧪 typeof dataEntrada:", typeof produto.dataEntrada);
  // console.log("🧪 dataEntrada bruta:", produto.dataEntrada);

  produtoCadastroAtual = produto;

  // Carrega IDs de compras já registradas para autocompletar
  try {
    const lista = document.getElementById("lista-compra-id");
    if (lista) {
      lista.innerHTML = "";
      const empresaId = await getEmpresaIdDoUsuario();
      const comprasSnap = await getDocs(collection(db, "empresas", empresaId, "financeiro"));
      const ids = new Set();
      comprasSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.compraId) {
          ids.add(d.compraId);
        }
      });
      lista.innerHTML = Array.from(ids)
        .map(id => `<option value="${id}">${formatarCompraIdBR(id)}</option>`)
        .join("\n");
    }
  } catch (erro) {
    console.error("Erro ao carregar IDs de compra:", erro);
  }
  const nomeModal = document.getElementById("nome-produto-modal");
  if (nomeModal) {
    const forn = produto.fornecedor ? ` — Fornecedor: ${produto.fornecedor}` : "";
    nomeModal.textContent = `Produto: ${produto.nome}${forn}`;
  }
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

  const btnConfirmar = document.getElementById("btn-entrada-confirmar");
  const btnCancelar = document.getElementById("btn-entrada-cancelar");
  if (btnConfirmar) btnConfirmar.focus();

  const modal = document.getElementById("modal-entrada");
  handlerTecladoEntrada = function (e) {
    if (e.key === "Tab") {
      e.preventDefault();
      if (document.activeElement === btnConfirmar) {
        btnCancelar?.focus();
      } else {
        btnConfirmar?.focus();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (document.activeElement === btnConfirmar) {
        window.confirmarEntradaEstoque();
      } else if (document.activeElement === btnCancelar) {
        fecharModalEntrada();
      }
    }
  };

  modal.addEventListener("keydown", handlerTecladoEntrada);
}

/**
 * 🔥 Fechar o Modal de Entrada
 */
export function fecharModalEntrada() {
  document.getElementById("modal-entrada").style.display = "none";
  document.getElementById("fundo-modal").style.display = "none";
  const modal = document.getElementById("modal-entrada");
  if (handlerTecladoEntrada) {
    modal.removeEventListener("keydown", handlerTecladoEntrada);
    handlerTecladoEntrada = null;
  }
}

async function preencherDadosFinanceiro(compraId) {
  if (!compraId) return;
  try {
    const empresaId = await getEmpresaIdDoUsuario();
    const q = query(collection(db, "empresas", empresaId, "financeiro"), where("compraId", "==", compraId));
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
      <td style="text-align:center;">${formatarPreco(p.valor || 0)}</td>
      <td style="text-align:center;"><input type="date" id="parcela-venc-${index}" value="${p.vencimento}" /></td>
    </tr>`;
  });

  html += "</table>";
  document.getElementById("parcelas-container").innerHTML = html;
}

/**
 * 🔧 Geração automática de compraId
 */
window.gerarNovoCompraId = async function () {
  try {
    const hoje = new Date();
    const dataISO = hoje.toISOString().split("T")[0];
    const empresaId = await getEmpresaIdDoUsuario();
    const snap = await getDocs(collection(db, "empresas", empresaId, "financeiro"));
    let maior = 0;
    snap.forEach(docSnap => {
      const cid = docSnap.data().compraId || "";
      const m = cid.match(/compra_(\d{4})-?(\d{2})-?(\d{2})_(\d+)/);
      if (!m) return;
      const data = `${m[1]}-${m[2]}-${m[3]}`;
      if (data === dataISO) {
        maior = Math.max(maior, parseInt(m[4], 10));
      }
    });
    const novoNumero = maior + 1;
    const id = `compra_${dataISO}_${novoNumero}`;
    const input = document.getElementById("entrada-compra-id");
    if (input) input.value = id;
  } catch (e) {
    console.error("Erro ao gerar compraId:", e);
  }
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


    if (!compraId) {
      alert("❌ Você precisa informar um identificador da compra (compraId).");
      return;
    }

    const empresaId = await getEmpresaIdDoUsuario();

    // Verifica se o compraId já existe no financeiro antes de qualquer escrita
    const verificaQuery = query(
      collection(db, "empresas", empresaId, "financeiro"),
      where("compraId", "==", compraId)
    );
    const verificaSnap = await getDocs(verificaQuery);
    if (!verificaSnap.empty) {
      const continuar = confirm(
        "⚠️ Uma compra com esse ID já existe. Deseja adicionar este novo produto a essa compra?"
      );
      if (!continuar) {
        return;
      }
    }

    const produtoRef = doc(db, "empresas", empresaId, "produtos", produtoCadastroAtual.id);
    const produtoSnap = await getDoc(produtoRef);

    if (!produtoSnap.exists()) {
      throw new Error("Produto não encontrado no banco.");
    }

    const produto = produtoSnap.data();
    const quantidade = produtoCadastroAtual.quantidade || 0;
    const precoUnitario = produtoCadastroAtual.precoCompra || 0;

    // verifica se o preço informado está muito acima da média de entradas
    const media = await calcularPrecoMedioEntradas(produtoCadastroAtual.id);
    if (media && precoUnitario > media * 5) {
      const continuar = confirm(
        `⚠️ O preço informado (${formatarPreco(precoUnitario)}) ` +
        `está acima da média anterior de ${formatarPreco(media)}. ` +
        'Deseja continuar mesmo assim?'
      );
      if (!continuar) {
        return;
      }
    }
    const validadeEntrada = produtoCadastroAtual.validade ? new Date(produtoCadastroAtual.validade) : null;
    const lote = produtoCadastroAtual.lote || "";
    const custoTotal = quantidade * precoUnitario;
    const dataTimestamp = Timestamp.now();

    const valoresParcelas = dividirValorEmParcelas(custoTotal, numParcelas);
    const parcelas = [];
    for (let i = 0; i < numParcelas; i++) {
      const input = document.getElementById(`parcela-venc-${i}`);
      if (input) {
        parcelas.push({
          numero: i + 1,
          valor: valoresParcelas[i],
          vencimento: input.value,
          status: "pendente"
        });
      }
    }


    // 🔸 Atualiza o estoque
    const novaQuantidade = (produto.quantidade || 0) + quantidade;
    await updateDoc(produtoRef, {
      quantidade: novaQuantidade,
      dataEntrada: dataTimestamp
    });
    await registrarHistorico(produtoCadastroAtual.id, 'quantidade', produto.quantidade || 0, novaQuantidade);

    // 🔸 Registra a movimentação
    await addDoc(collection(db, "empresas", empresaId, "movimentacoes"), {
      produtoId: produtoCadastroAtual.id,
      nomeProduto: produto.nome,
      nomeBusca: normalizarTexto(produto.nome),
      categoria: produto.categoria,
      fornecedor: produtoCadastroAtual.fornecedor || produto.fornecedor,
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
      compraId,
      usuario: "admin@zelia.com"
    });
    
    // 🔸 Registra ou atualiza o financeiro
    const finQuery = query(collection(db, "empresas", empresaId, "financeiro"), where("compraId", "==", compraId));
    const finSnap = await getDocs(finQuery);

    if (!finSnap.empty) {
      const existing = finSnap.docs[0];
      const finRef = doc(db, "empresas", empresaId, "financeiro", existing.id);
      const finData = existing.data();
      const parcelasExistentes = Array.isArray(finData.parcelas) ? finData.parcelas : [];

      const novoValorTotal = (finData.valorTotal || 0) + custoTotal;
      const numParcelasTotais = parcelasExistentes.length || parcelas.length;
      const novosValores = dividirValorEmParcelas(novoValorTotal, numParcelasTotais);
      const parcelasAtualizadas = parcelasExistentes.map((p, idx) => ({
        ...p,
        numero: idx + 1,
        valor: novosValores[idx]
      }));

      await updateDoc(finRef, {
        valorTotal: novoValorTotal,
        compraId,
        identificadorPagamento,
        parcelas: parcelasAtualizadas
      });
    } else {
      await addDoc(collection(db, "empresas", empresaId, "financeiro"), {
        tipo: "pagar",
        fornecedorOuCliente: produtoCadastroAtual.fornecedor || "Fornecedor não informado",
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
    if (window.adicionarFornecedor) {
      window.adicionarFornecedor(produtoCadastroAtual.fornecedor || produto.fornecedor);
    }
    if (window.carregarMovimentacoes) {
      window.carregarMovimentacoes();
    }
    fecharModalEntrada();

  } catch (err) {
    console.error("❌ Erro ao registrar entrada:", err?.message || err);
    alert(`❌ Erro real:\n\n${err?.message || err}`);
  }
};


//Gerar parcelas//

// Calcula os valores das parcelas garantindo que a soma seja exatamente igual ao total
function dividirValorEmParcelas(valorTotal, numParcelas) {
  const totalCentavos = Math.round(valorTotal * 100);
  const valorBase = Math.floor(totalCentavos / numParcelas);
  const valores = new Array(numParcelas).fill(valorBase);
  const resto = totalCentavos - valorBase * numParcelas;
  valores[numParcelas - 1] += resto;
  return valores.map(v => parseFloat((v / 100).toFixed(2)));
}

function gerarParcelasAutomaticamente(valorTotal, numParcelas, dataInicial) {
  const parcelas = [];
  const valores = dividirValorEmParcelas(valorTotal, numParcelas);

  const dataBase = parseDataLocal(dataInicial);
  for (let i = 0; i < numParcelas; i++) {
    const vencimento = new Date(dataBase);
    vencimento.setMonth(dataBase.getMonth() + i);

    parcelas.push({
      numero: i + 1,
      valor: valores[i],
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
      <td style="text-align:center;">${formatarPreco(p.valor)}</td>
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

