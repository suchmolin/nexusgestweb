/**
 * Imprime un PDF sin abrir una ventana ni pestaña con el visor.
 * Sigue apareciendo el diálogo del sistema para confirmar (los navegadores no permiten
 * imprimir en silencio a la impresora predeterminada desde una web por seguridad).
 */
export function printPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
  let printed = false;
  const cleanup = () => {
    URL.revokeObjectURL(url);
    iframe.remove();
  };
  const runPrint = () => {
    if (printed) return;
    printed = true;
    try {
      const w = iframe.contentWindow;
      if (w) {
        w.focus();
        w.print();
      }
    } finally {
      setTimeout(cleanup, 2500);
    }
  };

  iframe.onload = () => {
    setTimeout(runPrint, 300);
  };
  iframe.src = url;
  document.body.appendChild(iframe);

  setTimeout(() => {
    if (!printed) runPrint();
  }, 3000);
}
