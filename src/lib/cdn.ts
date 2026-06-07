// Helper para cargar scripts dinámicos en el navegador bajo demanda

export function loadScript(src: string, globalName?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return resolve(null);
    }

    if (globalName && (window as any)[globalName]) {
      return resolve((window as any)[globalName]);
    }

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      const handleLoad = () => {
        resolve(globalName ? (window as any)[globalName] : true);
      };
      existing.addEventListener('load', handleLoad);
      existing.addEventListener('error', (err) => reject(err));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      resolve(globalName ? (window as any)[globalName] : true);
    };
    script.onerror = (err) => {
      reject(err);
    };
    document.head.appendChild(script);
  });
}

export async function loadJsPDF(): Promise<any> {
  // jsPDF UMD se registra en window.jspdf
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf');
  return (window as any).jspdf;
}

export async function loadJsPDFAutoTable(): Promise<any> {
  // Primero aseguramos la carga de jsPDF
  const jspdfModule = await loadJsPDF();
  // El plugin autotable se registra a sí mismo en jsPDF
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  return jspdfModule;
}

export async function loadSheetJS(): Promise<any> {
  return loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');
}
