/**
 * scanner.js - Utilitário simples para leitura de códigos de barras e QR codes.
 *
 * Usa a API BarcodeDetector quando disponível e faz fallback para ZXing
 * carregado via CDN. Retorna uma Promise que resolve com o valor lido
 * ou rejeita em caso de erro/fechamento.
 */

export async function abrirScanner () {
  return new Promise(async (resolve, reject) => {
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

    const video = document.createElement('video');
    video.style.maxWidth = '90%';
    video.style.maxHeight = '90%';
    video.setAttribute('playsinline', true);
    overlay.appendChild(video);
    document.body.appendChild(overlay);

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
      cleanup();
      resolve(code);
    };

    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'code_93', 'upc_a', 'upc_e', 'itf', 'codabar', 'data_matrix'] });
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

    overlay.addEventListener('click', () => {
      cleanup();
      reject(new Error('cancelled'));
    });
  });
}
