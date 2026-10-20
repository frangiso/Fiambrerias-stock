// Redondea cantidades de stock para evitar el error clásico de
// coma flotante de JS (ej: 0.1 + 0.2 === 0.30000000000000004).
// Firestore 'increment()' suma/resta sobre el float ya guardado, así
// que estos errores de redondeo se van acumulando venta tras venta.
// No afecta la precisión real (sigue siendo exacto a 3 decimales),
// solo evita que se muestren numeros como "270.1400000000001".
export function redondearStock(n) {
  return Math.round((Number(n) || 0) * 1000) / 1000
}
