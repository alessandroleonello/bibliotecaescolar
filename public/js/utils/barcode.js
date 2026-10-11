/**
 * Barcode and QR Code generation for copies and library cards
 */

// Dynamically load external scripts if needed
export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha ao carregar script ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Render Barcode using JsBarcode CDN or fallback SVG
 */
export async function renderBarcode(canvasOrSvg, code, options = {}) {
  try {
    if (!window.JsBarcode) {
      await loadScript('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js');
    }
    window.JsBarcode(canvasOrSvg, code, {
      format: 'CODE128',
      lineColor: '#000000',
      width: options.width || 1.8,
      height: options.height || 45,
      displayValue: options.displayValue !== false,
      fontSize: 12,
      font: 'JetBrains Mono',
      margin: 4,
      ...options
    });
  } catch (err) {
    console.warn('JsBarcode fallback:', err);
    if (canvasOrSvg && canvasOrSvg.getContext) {
      const ctx = canvasOrSvg.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.font = '14px monospace';
      ctx.fillText(`||| ${code} |||`, 10, 30);
    }
  }
}

/**
 * Render QR Code using QRCode CDN
 */
export async function renderQRCode(containerEl, text, size = 160) {
  try {
    if (!window.QRCode) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
    }
    containerEl.innerHTML = '';
    new window.QRCode(containerEl, {
      text: text,
      width: size,
      height: size,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.M
    });
  } catch (err) {
    console.warn('QRCode fallback:', err);
    containerEl.innerHTML = `<div style="padding:1rem;border:1px dashed #cbd5e1;font-size:0.8rem;text-align:center;">QR Code: ${text}</div>`;
  }
}

/**
 * Print label sheet dialog
 */
export function printElement(elementHtml, title = 'Impressão de Etiquetas') {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita popups para imprimir as etiquetas.');
    return;
  }
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page {
          size: A4;
          margin: 10mm;
        }
        body {
          font-family: 'Plus Jakarta Sans', Arial, sans-serif;
          margin: 0;
          padding: 0;
          color: #000;
        }
        .labels-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6mm;
        }
        .label-card {
          border: 1px dashed #94a3b8;
          border-radius: 4px;
          padding: 4mm;
          text-align: center;
          page-break-inside: avoid;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #fff;
        }
        .label-school {
          font-size: 8pt;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 2mm;
        }
        .label-title {
          font-size: 9pt;
          font-weight: 600;
          max-height: 2.4em;
          overflow: hidden;
          margin-bottom: 2mm;
        }
        .label-code {
          font-family: monospace;
          font-size: 9pt;
          font-weight: bold;
          margin-top: 2mm;
        }
        @media print {
          .no-print { display: none; }
          .label-card { border: 1px solid #000; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="padding: 10px; background: #e2e8f0; text-align: center; margin-bottom: 10px;">
        <button onclick="window.print()" style="padding: 8px 16px; font-weight: bold; cursor: pointer;">Imprimir Etiquetas</button>
      </div>
      <div class="labels-grid">
        ${elementHtml}
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
}
