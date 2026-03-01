export default function ConfiguracionPage() {
  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Configuración</h1>
      <p className="text-[var(--muted)] mt-1">Datos de empresa, tasas cambiarias, colores y formatos.</p>
      <div className="mt-6 p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        Módulo en construcción. Aquí se configurará: información de empresa, tasas USD/EUR, fondos para presupuestos/facturas, formato de factura, campos obligatorios, colores primario/secundario/alternativo, logo y símbolo de moneda.
      </div>
    </div>
  );
}
