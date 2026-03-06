/**
 * Definición de módulos y secciones (pestañas) para la configuración de roles.
 * Si un módulo tiene sections, en configuración se muestran como sub-opciones;
 * las páginas filtran las pestañas según las claves guardadas.
 */

export const MODULE_LABELS: Record<string, string> = {
  CONFIGURACION: 'Configuración',
  CLIENTES: 'Clientes',
  PRESUPUESTOS: 'Presupuestos',
  FACTURACION: 'Facturación',
  INVENTARIO: 'Inventario',
  ADMINISTRACION: 'Administración',
  LOGS: 'Logs',
  CIERRE_CAJA: 'Cierres de caja',
};

/** Módulos que tienen varias secciones (pestañas). sectionId debe coincidir con el valor de tab o con el segmento de ruta. */
export const MODULE_SECTIONS: Record<
  string,
  { label: string; sections: { id: string; label: string }[] }
> = {
  CONFIGURACION: {
    label: 'Configuración',
    sections: [
      { id: 'empresa', label: 'Empresa' },
      { id: 'presupuestos-facturas', label: 'Presupuestos y facturas' },
      { id: 'moneda-tasa', label: 'Moneda y tasa' },
    ],
  },
  FACTURACION: {
    label: 'Facturación',
    sections: [
      { id: 'new', label: 'Nueva factura' },
      { id: 'from-budget', label: 'Desde presupuesto' },
      { id: 'list', label: 'Consultar facturas' },
    ],
  },
  PRESUPUESTOS: {
    label: 'Presupuestos',
    sections: [
      { id: 'new', label: 'Nuevo presupuesto' },
      { id: 'list', label: 'Lista de presupuestos' },
    ],
  },
  CIERRE_CAJA: {
    label: 'Cierres de caja',
    sections: [
      { id: 'registro', label: 'Registro de cierre de caja' },
      { id: 'resumen', label: 'Resumen y cierre' },
      { id: 'consultar', label: 'Consultar cierres realizados' },
    ],
  },
  INVENTARIO: {
    label: 'Inventario',
    sections: [
      { id: 'consulta', label: 'Consulta' },
      { id: 'ingreso', label: 'Ingreso' },
      { id: 'egreso', label: 'Egreso' },
      { id: 'add', label: 'Agregar producto' },
    ],
  },
};

/** Clave guardada para una sección: MODULO_sectionId */
export function sectionKey(moduleKey: string, sectionId: string): string {
  return `${moduleKey}_${sectionId}`;
}

/** Módulos que no tienen secciones (un solo visual). */
export const SIMPLE_MODULE_KEYS = Object.keys(MODULE_LABELS).filter(
  (k) => !(k in MODULE_SECTIONS)
);

/**
 * Normaliza módulos cargados: si viene "FACTURACION" (legacy) lo expande a todas las secciones.
 */
export function normalizeModulesForDisplay(modules: string[]): string[] {
  const result: string[] = [];
  for (const m of modules) {
    if (m in MODULE_SECTIONS) {
      const sec = MODULE_SECTIONS[m];
      sec.sections.forEach((s) => result.push(sectionKey(m, s.id)));
    } else {
      result.push(m);
    }
  }
  return [...new Set(result)];
}

/**
 * Convierte la lista "para mostrar" (con secciones expandidas) en la lista a guardar.
 * Si todas las secciones de un módulo están marcadas, podríamos guardar el módulo completo
 * por compatibilidad; aquí guardamos siempre granular.
 */
export function modulesToSave(displayModules: string[]): string[] {
  return displayModules;
}

/**
 * Comprueba si el usuario tiene acceso al módulo (al menos una sección o el módulo completo).
 */
export function hasModuleAccess(moduleKey: string, allowedModules: string[]): boolean {
  if (allowedModules.includes(moduleKey)) return true;
  if (!(moduleKey in MODULE_SECTIONS)) return false;
  const sec = MODULE_SECTIONS[moduleKey];
  return sec.sections.some((s) => allowedModules.includes(sectionKey(moduleKey, s.id)));
}

/**
 * Comprueba si el usuario tiene acceso a una sección concreta.
 */
export function hasSectionAccess(
  moduleKey: string,
  sectionId: string,
  allowedModules: string[]
): boolean {
  if (allowedModules.includes(moduleKey)) return true; // módulo completo = todas las secciones
  return allowedModules.includes(sectionKey(moduleKey, sectionId));
}
