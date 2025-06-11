// utils.js — Funções utilitárias para o sistema Zélia

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
