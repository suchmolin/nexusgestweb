export default function UsuariosPage() {
  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Gestión de usuarios</h1>
      <p className="text-[var(--muted)] mt-1">Solo Super Admin: crear usuarios admin por empresa y activar/desactivar módulos.</p>
      <div className="mt-6 p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        Módulo en construcción. Crear empresas y usuarios admin, asignar módulos y permisos por perfil.
      </div>
    </div>
  );
}
