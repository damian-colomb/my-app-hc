import React, { Suspense, lazy } from 'react';

// Lazy loading del componente pesado
const PartesQuirurgicos = lazy(() => import('../pages/Modulos/PartesQuirurgicos'));

// Componente de loading
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
    <div className="ml-4 text-lg text-gray-600">Cargando módulo quirúrgico...</div>
  </div>
);

// Wrapper con Suspense
export default function LazyPartesQuirurgicos(props) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PartesQuirurgicos {...props} />
    </Suspense>
  );
}
