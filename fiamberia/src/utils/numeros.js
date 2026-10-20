// Redondea cantidades de stock para evitar el error clásico de
// coma flotante de JS (ej: 0.1 + 0.2 === 0.30000000000000004).
// Firestore 'increment()' suma/resta sobre el float ya guardado, así
// que estos errores de redondeo se van acumulando venta tras venta.
// Solo afecta lo que se muestra (a 2 decimales), evita que se vean
// numeros como "270.1400000000001".
export function redondearStock(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}
