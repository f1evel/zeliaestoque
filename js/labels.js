/**
 * labels.js - geração simples de etiquetas para produtos.
 *
 * Dependências em tempo de execução (via CDN):
 * - jsPDF
 * - JsBarcode
 * - qrcode
 */

import JsBarcode from 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.esm.min.js';
import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js';
import QRCode from 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.esm.js';

/**
 * Gera um PDF com uma etiqueta simples contendo nome, lote, validade,
 * localização e códigos de barras/QR quando fornecidos.
 */
export async function imprimirEtiquetaProduto(prod) {
  const doc = new jsPDF();
  const x = 10;
  let y = 10;
  doc.setFontSize(12);
  doc.text(prod.nome || '', x, y);
  y += 6;
  if (prod.lote) { doc.text(`Lote: ${prod.lote}`, x, y); y += 6; }
  if (prod.validade) { doc.text(`Val.: ${prod.validade}`, x, y); y += 6; }
  if (prod.localizacao) { doc.text(`Loc.: ${prod.localizacao}`, x, y); y += 6; }

  if (prod.barcode) {
    const bcCanvas = document.createElement('canvas');
    JsBarcode(bcCanvas, prod.barcode, { format: 'CODE128', width: 1, height: 40 });
    const img = bcCanvas.toDataURL('image/png');
    doc.addImage(img, 'PNG', x, y, 80, 20);
    y += 25;
  }

  if (prod.qrcode) {
    const qrData = await QRCode.toDataURL(prod.qrcode);
    doc.addImage(qrData, 'PNG', x, y, 25, 25);
    y += 30;
  }

  doc.save('etiqueta.pdf');
}
