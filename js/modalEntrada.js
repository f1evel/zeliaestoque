// modalEntrada.js - Controle do modal de entrada + financeiro

import { db, getEmpresaIdDoUsuario } from "./firebaseConfig.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  Timestamp,
  deleteField
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

import { mostrarErro, normalizarTexto, parseDataLocal, formatarCompraIdBR, formatarPreco, formatarDataBrasileira, reconciliarCompra } from './utils.js';
import { registrarHistorico } from './historico.js';
import { abrirModalConfirmacao } from './modais.js';

let produtoCadastroAtual = null;
let dadosFinanceiroAtual = null;
let handlerTecladoEntrada = null;
let unsubTotalCompra = null;

function bloquearCamposProgramacao(bloquear) {
  const ids = ["entrada-forma-pagamento", "entrada-numero-parcelas", "entrada-primeiro-vencimento"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = bloquear;
  });
  document.querySelectorAll('#parcelas-container input[type="date"]').forEach(inp => {
    inp.disabled = bloquear;
  });
}

function mostrarBadgeProgramacao(existe) {
  const badge = document.getElementById('badge-programacao');
  const container = document.getElementById('alterar-programacao-container');
  const check = document.getElementById('alterar-programacao-checkbox');
  if (badge) badge.style.display = existe ? 'block' : 'none';
  if (container) container.style.display = existe ? 'block' : 'none';
  if (check) check.checked = false;
  bloquearCamposProgramacao(existe);
}

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

  // Preencher campos financeiros já cadastrados, se existirem
  document.getElementById("entrada-forma-pagamento").value = produto.formaPagamento || "pix";
  document.getElementById("entrada-identificador-pagamento").value = produto.identificadorPagamento || "";
  document.getElementById("entrada-observacoes").value = produto.observacoes || "";

  const numParcelasEl = document.getElementById("entrada-numero-parcelas");
  const primeiroVencEl = document.getElementById("entrada-primeiro-vencimento");

  if (produto.parcelas && produto.parcelas.length > 0) {
    dadosFinanceiroAtual = {
      formaPagamento: produto.formaPagamento || "pix",
      identificadorPagamento: produto.identificadorPagamento || "",
      observacoes: produto.observacoes || "",
      parcelas: produto.parcelas
    };
    if (numParcelasEl) numParcelasEl.value = produto.parcelas.length;
    if (primeiroVencEl) primeiroVencEl.value = produto.parcelas[0].vencimento;
    exibirParcelas(produto.parcelas);
    mostrarBadgeProgramacao(true);
  } else {
    dadosFinanceiroAtual = null;
    const dataEntrada = new Date(produtoCadastroAtual.dataEntrada);
    dataEntrada.setMonth(dataEntrada.getMonth() + 1);
    if (primeiroVencEl) primeiroVencEl.value = dataEntrada.toISOString().split("T")[0];
    if (numParcelasEl) numParcelasEl.value = 1;
    atualizarParcelasPreview();
    mostrarBadgeProgramacao(false);
  }

  if (produto.compraId) {
    document.getElementById("entrada-compra-id").value = produto.compraId;
    if (!produto.parcelas) {
      await preencherDadosFinanceiro(produto.compraId);
    }
    await atualizarTotalProvisorio(produto.compraId);
  } else {
    const cidExistente = document
      .getElementById("entrada-compra-id")
      ?.value?.trim();
    if (cidExistente) {
      await preencherDadosFinanceiro(cidExistente);
      await atualizarTotalProvisorio(cidExistente);
    } else {
      await atualizarTotalProvisorio('');
      mostrarBadgeProgramacao(false);
    }
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
  if (unsubTotalCompra) {
    unsubTotalCompra();
    unsubTotalCompra = null;
  }
}

window.cancelarEntradaFinanceira = function () {
  if (!produtoCadastroAtual?.novoCadastro && !produtoCadastroAtual?.novaEntrada) {
    fecharModalEntrada();
    return;
  }

  const mensagem = produtoCadastroAtual?.novoCadastro
    ? "⚠️ As informações financeiras não serão registradas.\nDeseja manter o produto no estoque mesmo assim?\nVocê poderá adicionar os dados financeiros depois."
    : "❗ Nenhuma informação financeira foi registrada. Deseja manter o produto no estoque e adicionar os dados financeiros depois? Ou deseja apagar essa movimentação?";

  const textoManter = produtoCadastroAtual?.novoCadastro
    ? "✅ Sim, manter o produto (adicionarei depois)"
    : "Manter entrada";

  const textoApagar = produtoCadastroAtual?.novoCadastro
    ? "❌ Não, apagar produto"
    : "Apagar movimentação";

  abrirModalConfirmacao(
    mensagem,
    async () => {
      try {
        const empresaId = await getEmpresaIdDoUsuario();
        if (produtoCadastroAtual?.novoCadastro) {
          const ref = doc(db, "empresas", empresaId, "produtos", produtoCadastroAtual.id);
          await updateDoc(ref, { entradaFinanceiraPendente: true });
          if (window.carregarProdutos) window.carregarProdutos();
          alert("Produto mantido sem financeiro.");
        } else {
          const movRef = doc(db, "empresas", empresaId, "movimentacoes", produtoCadastroAtual.movimentacaoId);
          await updateDoc(movRef, { entradaFinanceiraPendente: true });
          if (window.carregarMovimentacoes) window.carregarMovimentacoes();
          alert("Entrada mantida sem financeiro.");
        }
        fecharModalEntrada();
      } catch (e) {
        console.error("Erro ao marcar pendência financeira:", e);
      }
    },
    async () => {
      try {
        const empresaId = await getEmpresaIdDoUsuario();
        if (produtoCadastroAtual?.novoCadastro) {
          await deleteDoc(doc(db, "empresas", empresaId, "produtos", produtoCadastroAtual.id));
          if (window.carregarProdutos) window.carregarProdutos();
          alert("Produto removido.");
        } else {
          await deleteDoc(doc(db, "empresas", empresaId, "movimentacoes", produtoCadastroAtual.movimentacaoId));
          const prodRef = doc(db, "empresas", empresaId, "produtos", produtoCadastroAtual.id);
          const novaQtd = produtoCadastroAtual.quantidadeAnterior || 0;
          await updateDoc(prodRef, { quantidade: novaQtd });
          await registrarHistorico(
            produtoCadastroAtual.id,
            'quantidade',
            novaQtd + (produtoCadastroAtual.quantidade || 0),
            novaQtd
          );
          if (produtoCadastroAtual.compraId) {
            await reconciliarCompra(produtoCadastroAtual.compraId);
          }
          if (window.carregarMovimentacoes) window.carregarMovimentacoes();
          alert("Movimentação removida.");
        }
        fecharModalEntrada();
      } catch (e) {
        console.error("Erro ao remover registro:", e);
      }
    },
    textoManter,
    textoApagar
  );
};

async function preencherDadosFinanceiro(compraId) {
  // Garante que o produto atual saiba qual compraId está sendo usado
  if (produtoCadastroAtual) {
    produtoCadastroAtual.compraId = compraId || undefined;
  }
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
      mostrarBadgeProgramacao(true);
    } else {
      dadosFinanceiroAtual = null;
      atualizarParcelasPreview();
      mostrarBadgeProgramacao(false);
    }
  } catch (e) {
    console.error("Erro ao carregar dados financeiros:", e);
  }
}

async function atualizarTotalProvisorio(compraId) {
  if (unsubTotalCompra) {
    unsubTotalCompra();
    unsubTotalCompra = null;
  }

  const card = document.getElementById('total-compra-card');
  if (!compraId) {
    if (card) card.style.display = 'none';
    return;
  }

  try {
    const empresaId = await getEmpresaIdDoUsuario();
    const movQuery = query(
      collection(db, 'empresas', empresaId, 'movimentacoes'),
      where('compraId', '==', compraId),
      where('tipo', '==', 'entrada')
    );
    unsubTotalCompra = onSnapshot(movQuery, snap => {
      let total = 0;
      snap.forEach(docSnap => {
        if (produtoCadastroAtual?.movimentacaoId && docSnap.id === produtoCadastroAtual.movimentacaoId) return;
        const d = docSnap.data();
        const custo = typeof d.custoTotal === 'number'
          ? d.custoTotal
          : (d.quantidade || 0) * (d.precoUnitario || 0);
        total += custo;
      });
      const qtd = produtoCadastroAtual?.quantidade || 0;
      const preco = produtoCadastroAtual?.precoCompra || 0;
      total += qtd * preco;
      const valorEl = document.getElementById('total-compra-valor');
      if (card && valorEl) {
        valorEl.textContent = formatarPreco(total);
        card.style.display = 'flex';
      }
    });
  } catch (e) {
    console.error('Erro ao calcular total provisório:', e);
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
    // Atualiza o objeto atual com o novo compraId gerado
    if (produtoCadastroAtual) {
      produtoCadastroAtual.compraId = id;
    }

  } catch (e) {
    console.error("Erro ao gerar compraId:", e);
  }
};

/**
 * ✅ Função confirmada para botão
 */

window.confirmarEntradaEstoque = async function () {
  try {
    const compraIdAntigo = produtoCadastroAtual.compraId;
    const formaPagamento = document.getElementById("entrada-forma-pagamento").value;
    const observacoes = document.getElementById("entrada-observacoes").value.trim() || "";
    const compraId = document.getElementById("entrada-compra-id")?.value?.trim() || "";
    const identificadorPagamento = document.getElementById("entrada-identificador-pagamento")?.value?.trim() || "";
    let numParcelas = parseInt(document.getElementById("entrada-numero-parcelas")?.value || "1");


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

    let finDocExistente = null;
    let parcelasAlteradas = false;
    let novoNumParcelas = numParcelas;
    let novoPrimeiroVenc = document.getElementById("entrada-primeiro-vencimento").value;
    let novaForma = formaPagamento;
    const alterarProgramacao = document.getElementById('alterar-programacao-checkbox')?.checked;

    if (!verificaSnap.empty) {
      finDocExistente = verificaSnap.docs[0];
      const finAntigo = finDocExistente.data();
      if (!alterarProgramacao) {
        const parcelasExistentes = Array.isArray(finAntigo.parcelas) ? finAntigo.parcelas : [];
        numParcelas = parcelasExistentes.length || 1;
        novoNumParcelas = numParcelas;
        novaForma = finAntigo.formaPagamento || formaPagamento;
        novoPrimeiroVenc = parcelasExistentes[0]?.vencimento || novoPrimeiroVenc;
      } else {
        const aplicar = confirm("Aplicar as novas datas/forma de pagamento para toda a compra?\nCancelar cria novo compraId.");
        if (!aplicar) {
          await gerarNovoCompraId();
          alert('Novo compraId gerado. Confirme novamente.');
          return;
        }
        parcelasAlteradas = true;
        novoNumParcelas = numParcelas;
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
    const dataTimestamp = Timestamp.fromDate(produtoCadastroAtual.dataEntrada || new Date());

    const valoresParcelas = dividirValorEmParcelas(custoTotal, numParcelas);
    const parcelas = [];
    if (finDocExistente && !parcelasAlteradas) {
      const parcelasExistentes = Array.isArray(finDocExistente.data().parcelas)
        ? finDocExistente.data().parcelas
        : [];
      for (let i = 0; i < numParcelas; i++) {
        const vencimento = parcelasExistentes[i]?.vencimento || document.getElementById(`parcela-venc-${i}`)?.value;
        parcelas.push({
          numero: i + 1,
          valor: valoresParcelas[i],
          vencimento,
          status: "pendente"
        });
      }
    } else {
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
    }

    if (produtoCadastroAtual.movimentacaoId) {
      await updateDoc(produtoRef, {
        dataEntrada: dataTimestamp,
        precoCompra: produtoCadastroAtual.precoCompra
      });

      const movRef = doc(db, "empresas", empresaId, "movimentacoes", produtoCadastroAtual.movimentacaoId);
      await updateDoc(movRef, {
        precoUnitario,
        custoTotal,
        parcelas,
        compraId,
        entradaFinanceiraPendente: deleteField()
      });
    } else {
      // 🔸 Atualiza o estoque
      const novaQuantidade = (produto.quantidade || 0) + quantidade;
      await updateDoc(produtoRef, {
        quantidade: novaQuantidade,
        dataEntrada: dataTimestamp,
        precoCompra: produtoCadastroAtual.precoCompra,
        entradaFinanceiraPendente: deleteField()
      });
      await registrarHistorico(
        produtoCadastroAtual.id,
        'quantidade',
        produto.quantidade || 0,
        novaQuantidade
      );
      if (window.carregarProdutos) {
        window.carregarProdutos();
      }

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
    }
    
    // 🔸 Registra ou atualiza o financeiro
    const finQuery = query(collection(db, "empresas", empresaId, "financeiro"), where("compraId", "==", compraId));
    const finSnap = await getDocs(finQuery);

    const financeiroJaRegistrado = !!produtoCadastroAtual.compraId;

    if (!finSnap.empty) {
      const existing = finDocExistente || finSnap.docs[0];
      const finRef = doc(db, "empresas", empresaId, "financeiro", existing.id);
      const finData = existing.data();
      const parcelasExistentes = Array.isArray(finData.parcelas) ? finData.parcelas : [];

      const novoValorTotal = financeiroJaRegistrado ? (finData.valorTotal || 0) : (finData.valorTotal || 0) + custoTotal;

      let parcelasAtualizadas = [];
      if (parcelasAlteradas) {
        parcelasAtualizadas = gerarParcelasAutomaticamente(novoValorTotal, novoNumParcelas, novoPrimeiroVenc);
      } else {
        const numParcelasTotais = parcelasExistentes.length || parcelas.length;
        const novosValores = dividirValorEmParcelas(novoValorTotal, numParcelasTotais);
        parcelasExistentes.forEach((p, idx) => {
          parcelasAtualizadas[idx] = { ...p, numero: idx + 1, valor: novosValores[idx] };
        });
        for (let i = parcelasExistentes.length; i < numParcelasTotais; i++) {
          parcelasAtualizadas[i] = {
            numero: i + 1,
            valor: novosValores[i],
            vencimento: parcelas[i]?.vencimento || novoPrimeiroVenc,
            status: "pendente"
          };
        }
      }

      await updateDoc(finRef, {
        valorTotal: novoValorTotal,
        compraId,
        identificadorPagamento,
        formaPagamento: novaForma,
        parcelas: parcelasAtualizadas,
        "entrada-numero-parcelas": novoNumParcelas,
        "entrada-primeiro-vencimento": novoPrimeiroVenc
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
        parcelas,
        "entrada-numero-parcelas": numParcelas,
        "entrada-primeiro-vencimento": parcelas[0]?.vencimento || null
      });
    }

    await reconciliarCompra(compraId);
    if (compraIdAntigo && compraIdAntigo !== compraId) {
      await reconciliarCompra(compraIdAntigo);
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
  const alterar = document.getElementById('alterar-programacao-checkbox')?.checked;
  if (dadosFinanceiroAtual && !alterar) return;
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
document.getElementById("entrada-compra-id").addEventListener("change", async (e) => {
  const cid = e.target.value.trim();
  await preencherDadosFinanceiro(cid);
  await atualizarTotalProvisorio(cid);
});

const alterarCheckbox = document.getElementById('alterar-programacao-checkbox');
if (alterarCheckbox) {
  alterarCheckbox.addEventListener('change', async () => {
    const alterar = alterarCheckbox.checked;
    bloquearCamposProgramacao(!alterar);
    const cid = document.getElementById('entrada-compra-id').value.trim();
    if (!alterar && cid) {
      await preencherDadosFinanceiro(cid);
    } else {
      atualizarParcelasPreview();
    }
  });
}

// Tornar funções acessíveis globalmente para os botões do modal
window.fecharModalEntrada = fecharModalEntrada;

