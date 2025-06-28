// modais.js

// ✅ Funções genéricas para qualquer modal

export function abrirModal(idModal) {
  const modal = document.getElementById(idModal);
  const fundo = document.getElementById(`fundo-${idModal}`);

  if (!modal || !fundo) {
    console.error(`❌ Modal ou fundo não encontrados no DOM para o ID: ${idModal}`);
    return;
  }

  modal.style.display = 'block';
  fundo.style.display = 'block';
}

export function fecharModal(idModal) {
  document.getElementById(idModal).style.display = 'none';
  document.getElementById(`fundo-${idModal}`).style.display = 'none';
}


// ✅ Modal: Produto Já Existe

export function abrirModalProdutoExiste() {
  abrirModal('modal-produto-existe');
}

export function fecharModalProdutoExiste() {
  fecharModal('modal-produto-existe');
}


// ✅ Modal de Confirmação

let acaoConfirmada = null;

export function abrirModalConfirmacao(texto, acao) {
  const textoEl = document.getElementById("texto-confirmacao");
  if (textoEl) {
    textoEl.textContent = texto;
  } else {
    console.warn("⚠️ Elemento #texto-confirmacao não encontrado.");
  }

  abrirModal('modal-confirmacao');
  acaoConfirmada = acao;
}

export function cancelarConfirmacao() {
  fecharModal('modal-confirmacao');
  acaoConfirmada = null;
}

export function confirmarAcao() {
  console.log("✅ Botão 'Sim' clicado. Executando ação confirmada...");
  if (typeof acaoConfirmada === "function") {
    acaoConfirmada();
  } else {
    console.warn("⚠️ Nenhuma ação foi definida para o botão 'Sim'.");
  }
  cancelarConfirmacao();
}


// ✅ Atalho: Ir para Movimentações

export function irParaMovimentacoes() {
  window.location.href = "movimentacoes.html";
}

// ✅ Conectar botões ao carregar DOM
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("modal-confirmacao");
  const fundo = document.getElementById("fundo-modal-confirmacao");
  const btnCancelar = document.getElementById("btn-cancelar-confirmacao");
  const btnConfirmar = document.getElementById("btn-confirmar-acao");

  if (!modal || !fundo || !btnCancelar || !btnConfirmar) {
    // Apenas se realmente precisa do modal nessa página
    if (window.location.pathname.includes("produtos")) {
      console.warn("⚠️ Elementos do modal de confirmação não encontrados no DOM.");
    }
    return;
  }

  btnCancelar.addEventListener("click", cancelarConfirmacao);
  btnConfirmar.addEventListener("click", confirmarAcao);
});

window.fecharModalProdutoExiste = fecharModalProdutoExiste;
window.cancelarConfirmacao = cancelarConfirmacao;
window.confirmarAcao = confirmarAcao;
