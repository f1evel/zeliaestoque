// utils.js — Funções utilitárias para o sistema Zélia

import { db, getEmpresaIdDoUsuario } from "./firebaseConfig.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ==========================
// 🔠 Texto
// ==========================

// 👉 Remove acentos, espaços extras e deixa tudo minúsculo
export function normalizarTexto(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// 👉 Distância de Levenshtein simples
export function distanciaLevenshtein(a = "", b = "") {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + custo
      );
    }
  }
  return dp[m][n];
}

// ==========================
// 🔔 Mensagens
// ==========================

// 👉 Mostrar mensagem de sucesso flutuante
export function mostrarMensagem(texto) {
  let msg = document.getElementById("mensagem-sucesso");
  if (!msg) {
    msg = document.createElement("div");
    msg.id = "mensagem-sucesso";
    Object.assign(msg.style, {
      background: "#d4edda",
      color: "#155724",
      padding: "10px",
      marginBottom: "16px",
      border: "1px solid #c3e6cb",
      borderRadius: "6px",
      fontSize: "14px",
      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
      transition: "opacity 0.3s ease",
      position: "fixed",
      top: "20px",
      right: "20px",
      zIndex: "9999"
    });
    document.body.appendChild(msg);
  }
  msg.textContent = texto;
  msg.style.opacity = "1";
  setTimeout(() => {
    msg.style.opacity = "0";
    setTimeout(() => msg.remove(), 500);
  }, 3000);
}

// 👉 Mostrar erro com alerta e log no console
export function mostrarErro(mensagem = "❌ Ocorreu um erro.", erro = null) {
  alert(mensagem);
  if (erro) console.error("🚫 ERRO:", mensagem, erro);
}

// ==========================
// ⏳ Spinner
// ==========================

// 👉 Mostrar spinner
export function mostrarSpinner() {
  const spinner = document.getElementById('spinner');
  if (spinner) spinner.style.display = 'flex';
}

// 👉 Esconder spinner
export function esconderSpinner() {
  const spinner = document.getElementById('spinner');
  if (spinner) spinner.style.display = 'none';
}

// 🔥 Execução com Spinner e Tratamento de Erros Pro Max
export async function executarComSpinner(func, mensagemErro = "❌ Ocorreu um erro. Verifique e tente novamente.") {
  try {
    mostrarSpinner();
    await func();
  } catch (error) {
    console.error("❌ Erro:", error);
    mostrarErro(mensagemErro, error);
  } finally {
    esconderSpinner();
  }
}

// ==========================
// 📆 Datas
// ==========================

// 👉 Converter string yyyy-mm-dd para Date no horário local
export function parseDataLocal(str) {
  if (!str) return new Date(NaN);
  const [ano, mes, dia] = str.split("-").map(Number);
  if (!ano || !mes || !dia) return new Date(NaN);
  // Ajuste para UTC-3
  return new Date(Date.UTC(ano, mes - 1, dia, 3));
}

// 👉 Converter string DD/MM/AAAA para Date no horário local
export function parseDataBR(str) {
  if (!str) return new Date(NaN);
  const [dia, mes, ano] = str.split("/").map(Number);
  if (!dia || !mes || !ano) return new Date(NaN);
  // Ajuste para UTC-3
  return new Date(Date.UTC(ano, mes - 1, dia, 3));
}

// 👉 Formatar string de data yyyy-mm-dd para DD/MM/AAAA
export function formatarDataISOParaBR(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

// 👉 Formatar string de data yyyy-mm-dd para DD-MM-AAAA
export function formatarDataISOParaBRHifen(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}-${mes}-${ano}`;
}

// 👉 Calcular dias restantes para vencimento
export function calcularDiasParaVencimento(validade) {
  try {
    let dataVal = null;
    if (validade?.toDate) {
      dataVal = validade.toDate();
    } else if (validade instanceof Date) {
      dataVal = validade;
    } else if (typeof validade === "string" && validade) {
      dataVal = new Date(validade);
    }
    if (!dataVal || isNaN(dataVal.getTime())) return Infinity;

    const hoje = new Date();
    const diffMs = dataVal - hoje;
    const diffDias = diffMs / (1000 * 60 * 60 * 24);
    return Math.floor(diffDias);
  } catch {
    return Infinity;
  }
}

// 👉 Formatar compraId em formato curto (ex: "#1 (30/06/2025)")
export function formatarCompraIdCurto(id) {
  if (!id || typeof id !== 'string') return id;
  const m = id.match(/compra_(\d{4})-?(\d{2})-?(\d{2})_(\d+)/);
  if (!m) return id;
  const [, ano, mes, dia, numeroRaw] = m;
  const numero = String(Number(numeroRaw));
  return `#${numero} (${dia}/${mes}/${ano})`;
}

// 👉 Formatar compraId em formato longo (ex: "Compra 1 - 30/06/2025")
export function formatarCompraIdBR(id) {
  if (!id || typeof id !== 'string') return id;
  const m = id.match(/compra_(\d{4})-?(\d{2})-?(\d{2})_(\d+)/);
  if (!m) return id;
  const [, ano, mes, dia, numeroRaw] = m;
  const numero = String(Number(numeroRaw));
  return `Compra ${numero} - ${dia}/${mes}/${ano}`;
}

// 👉 Formatar valores monetários no padrão brasileiro (R$ 12,34)
export function formatarPreco(valor) {
  const num = Number(valor) || 0;
  return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

// 👉 Formatar datas em DD/MM/AAAA
export function formatarDataBrasileira(data) {
  const d = data?.toDate ? data.toDate() : new Date(data);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('pt-BR');
}

// ==========================
// 🔄 Reconciliar compra
// ==========================
export async function reconciliarCompra(compraId) {
  if (!compraId) return null;
  const empresaId = await getEmpresaIdDoUsuario();

  // a) Movimentações de entrada da compra
  const movQuery = query(
    collection(db, 'empresas', empresaId, 'movimentacoes'),
    where('compraId', '==', compraId),
    where('tipo', '==', 'entrada')
  );
  const movSnap = await getDocs(movQuery);
  let totalAtual = 0;
  movSnap.forEach(d => {
    totalAtual += Number(d.data().custoTotal) || 0;
  });

  // c) Documento financeiro
  const finQuery = query(
    collection(db, 'empresas', empresaId, 'financeiro'),
    where('compraId', '==', compraId)
  );
  const finSnap = await getDocs(finQuery);
  if (finSnap.empty) return { totalAtual, mensagem: 'Financeiro não encontrado' };
  const finDoc = finSnap.docs[0];
  const finData = finDoc.data();

  // d) Recalcular parcelas
  const parcelas = Array.isArray(finData.parcelas) ? finData.parcelas.map(p => ({ ...p })) : [];
  const totalPago = parcelas
    .filter(p => p.status === 'pago')
    .reduce((s, p) => s + (Number(p.valor) || 0), 0);

  let restante = Math.max(totalAtual - totalPago, 0);
  const pendentes = parcelas.filter(p => p.status !== 'pago');

  if (pendentes.length === 0 && restante > 0) {
    console.warn('⚠️ total atual excede parcelas pagas');
  } else if (pendentes.length > 0) {
    const valorCada = restante / pendentes.length;
    parcelas.forEach(p => {
      if (p.status !== 'pago') p.valor = valorCada;
    });
  }

  const finRef = doc(db, 'empresas', empresaId, 'financeiro', finDoc.id);
  await updateDoc(finRef, { valorTotal: totalAtual, parcelas });

  const resumo = {
    totalAnterior: finData.valorTotal || 0,
    totalAtual,
    totalPago,
    restante
  };
  console.log('🔄 Reconciliar compra', compraId, resumo);
  return resumo;
}

// Disponibiliza globalmente para chamadas manuais em páginas sem módulo
window.reconciliarCompra = reconciliarCompra;
