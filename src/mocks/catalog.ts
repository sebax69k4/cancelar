import type { Servicio } from '@/types/domain';

/** Catálogo de servicios (configuración, no contenido). La demo arranca sin clientes, equipos ni órdenes. */
export const MOCK_SERVICES: readonly Servicio[] = [
  { id: 's-diag', nombre: 'Diagnóstico general', descripcion: 'Revisión completa de hardware y software.', precioBase: 15000 },
  { id: 's-limp', nombre: 'Limpieza y cambio de pasta térmica', descripcion: 'Limpieza interna, ventiladores y pasta térmica.', precioBase: 25000 },
  { id: 's-so', nombre: 'Instalación de sistema operativo', descripcion: 'Formateo, instalación y drivers. Incluye respaldo básico.', precioBase: 30000 },
  { id: 's-pant', nombre: 'Cambio de pantalla', descripcion: 'Reemplazo de panel LCD/LED de notebook (repuesto aparte).', precioBase: 35000 },
  { id: 's-placa', nombre: 'Reparación de placa', descripcion: 'Diagnóstico y reparación a nivel componente.', precioBase: 60000 },
  { id: 's-upg', nombre: 'Upgrade RAM / SSD', descripcion: 'Instalación de memoria o disco y migración de datos.', precioBase: 20000 },
  { id: 's-datos', nombre: 'Recuperación de datos', descripcion: 'Recuperación desde discos dañados o borrados.', precioBase: 45000 },
];
