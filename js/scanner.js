/**
 * scanner.js - Utilitário para leitura de códigos de barras e QR Codes.
 *
 * Abre a câmera do dispositivo usando a API BarcodeDetector quando
 * disponível, fazendo fallback para a biblioteca ZXing. O resultado lido
 * é retornado em uma Promise e pode opcionalmente preencher um campo
 * informado por id.
 */

export async function abrirScanner (idCampoDestino) {
  return new Promise(async (resolve, reject) => {
    // ---------- Overlay ----------
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.8)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    const container = document.createElement('div');
    container.style.position = 'relative';

    const video = document.createElement('video');
    video.style.maxWidth = '90vw';
    video.style.maxHeight = '90vh';
    video.setAttribute('playsinline', true);
    video.addEventListener('click', e => e.stopPropagation());
    container.appendChild(video);

    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancelar';
    btnCancel.style.position = 'absolute';
    btnCancel.style.top = '10px';
    btnCancel.style.right = '10px';
    container.appendChild(btnCancel);

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // ---------- Acesso à câmera ----------
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      video.muted = true;
      await video.play();
    } catch (err) {
      cleanup();
      reject(err);
      return;
    }

    function cleanup () {
      if (stream) stream.getTracks().forEach(t => t.stop());
      overlay.remove();
    }

    const handleResult = code => {
      if (idCampoDestino) {
        const input = document.getElementById(idCampoDestino);
        if (input) input.value = code;
      }
      cleanup();
      resolve(code);
    };

    const supportedFormats = ['ean_13', 'code_128', 'qr_code'];

    // ---------- Detecção ----------
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: supportedFormats });
      const scan = async () => {
        try {
          const results = await detector.detect(video);
          if (results && results[0]) {
            handleResult(results[0].rawValue);
            return;
          }
        } catch (e) {
          console.error('BarcodeDetector error', e);
        }
        requestAnimationFrame(scan);
      };
      scan();
    } else {
      const { BrowserMultiFormatReader } = await import('https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/esm/index.min.js');
      const codeReader = new BrowserMultiFormatReader();
      codeReader.decodeFromVideoDevice(null, video, (result, err) => {
        if (result) {
          handleResult(result.getText());
        }
      });
    }

    // ---------- Fechamento ----------
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        cleanup();
        reject(new Error('cancelled'));
      }
    });
    btnCancel.addEventListener('click', e => {
      e.stopPropagation();
      cleanup();
      reject(new Error('cancelled'));
    });
  });
}

// Torna a função acessível globalmente para chamadas inline
window.abrirScanner = abrirScanner;

