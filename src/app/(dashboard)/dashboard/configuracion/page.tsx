'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ConfiguracionIndexPage() {
  const router = useRouter();
  useEffect(() => {
    // Default entry; layout redirects to an allowed tab if the user lacks Empresa access.
    router.replace('/dashboard/configuracion/empresa');
  }, [router]);
  return null;
}
