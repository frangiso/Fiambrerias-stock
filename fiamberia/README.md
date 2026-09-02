# 🥩 Fiambería — Sistema de Stock y Ventas

Sistema de punto de venta y control de stock para fiambrería/almacén.
Construido con React + Vite + Firebase + Vercel.

## Funcionalidades

- **Panel de Ventas** — búsqueda por nombre/código, soporte por kg y por unidad, carrito, descuentos, medios de pago (efectivo/tarjeta/transferencia/fiado), impresión automática de ticket con leyenda "documento no válido como factura"
- **Cuenta corriente / Fiado** — página de Clientes con saldo, registro de pagos y ventas a cuenta
- **Stock** — alertas de stock bajo/sin stock, alertas de productos vencidos/por vencer, carga de mercadería, registro de mermas (rotura, vencimiento, robo, etc.) con motivo
- **Productos** — ABM completo con categorías, precios, stock mínimo, fecha de vencimiento, actualización masiva de precios, exportación a CSV
- **Caja** — ingresos/egresos por medio de pago, arqueo de caja al cierre (conteo de efectivo vs. sistema, diferencia)
- **Reportes** — más vendidos, historial de movimientos, totales por período, anulación de ventas con motivo (queda registrado, no se borra), exportación a CSV
- **Usuarios y roles** — `admin` y `cajero`; operaciones sensibles (anular ventas, borrar productos/rubros, actualización masiva de precios, gestión de usuarios) reservadas a admin
- **Persistencia offline** — Firestore cachea localmente, la app sigue funcionando (lectura y cola de escritura) si se corta internet

---

## Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/fiamberia-stock.git
cd fiamberia-stock
npm install
```

### 2. Crear proyecto Firebase
1. Ir a [console.firebase.google.com](https://console.firebase.google.com)
2. Crear nuevo proyecto
3. Activar **Firestore Database** (modo producción)
4. Activar **Authentication** → método Email/contraseña (o el que prefieras)
5. Ir a Configuración del proyecto → Agregar app web
6. Copiar las credenciales

### 3. Configurar Firebase
Editar `src/firebase/config.js` con tus credenciales (`firebaseConfig`).

### 4. Reglas de Firestore
El archivo [`firestore.rules`](./firestore.rules) de este repo ya tiene las reglas listas para copiar y pegar en Firebase Console → Firestore → Reglas (o desplegar con `firebase deploy --only firestore:rules` si usás Firebase CLI).

Resumen de qué protegen:
- Cada usuario solo puede crear su propio documento en `usuarios` y siempre arranca como `cajero`. Nadie puede auto-ascenderse a `admin` — eso lo hace otro admin desde la pantalla de Usuarios.
- `ventas`, `movimientos` y `caja` son de **solo alta** (nunca se editan ni se borran), excepto la anulación de una venta (marca `anulada: true` + motivo), que está reservada a admin. Así se mantiene la auditoría completa.
- Borrar productos, rubros, recetas o compras está reservado a admin.

> ⚠️ Importante: como nadie puede auto-ascenderse a admin, el **primer admin hay que crearlo a mano** la primera vez: iniciá sesión una vez en la app (esto crea tu documento en `usuarios` como `cajero`), y después en Firebase Console → Firestore → colección `usuarios` → tu documento, cambiá el campo `rol` a `"admin"` manualmente. De ahí en adelante, ese admin puede ascender a los demás desde la pantalla de Usuarios.

### 5. Correr en desarrollo
```bash
npm run dev
```

### 6. Deploy en Vercel
1. Subir el repo a GitHub
2. Importar en [vercel.com](https://vercel.com)
3. Deploy automático ✅

---

## Estructura del proyecto

```
src/
├── firebase/
│   ├── config.js           # Credenciales Firebase + persistencia offline
│   ├── db.js                # Lecturas cacheadas + anularVenta()
│   └── cache.js             # Caché en memoria con TTL por colección
├── context/
│   ├── AppContext.jsx       # Auth + rol del usuario (admin/cajero)
│   └── CajaContext.jsx      # Estado de caja abierta/cerrada
├── pages/
│   ├── Ventas.jsx           # Panel de ventas / POS
│   ├── Caja.jsx             # Apertura, movimientos, arqueo y cierre de caja
│   ├── Compras.jsx          # Registro de compras a proveedores
│   ├── Stock.jsx            # Control de stock, vencimientos y mermas
│   ├── Productos.jsx        # ABM de productos
│   ├── Rubros.jsx           # Categorías de productos
│   ├── Recetas.jsx          # Combos / productos elaborados
│   ├── Clientes.jsx         # Cuenta corriente / fiado
│   ├── Usuarios.jsx         # Gestión de roles (solo admin)
│   └── Reportes.jsx         # Reportes, anulación de ventas y exportación CSV
├── App.jsx                  # Routing + navegación
└── App.css / index.css      # Estilos globales
firestore.rules              # Reglas de seguridad de Firestore
```

## Colecciones en Firestore

| Colección | Descripción |
|---|---|
| `productos` | Artículos con nombre, código, precio, stock, unidad, fecha de vencimiento |
| `rubros` | Categorías de productos |
| `recetas` | Combos / productos elaborados a partir de otros productos |
| `ventas` | Registro de cada venta: items, total, descuento, medio de pago, y `anulada`/`motivoAnulacion` si fue anulada |
| `movimientos` | Cada movimiento de stock: venta, carga, merma o anulación |
| `caja` | Ingresos, egresos, aperturas y cierres (con arqueo) |
| `compras` | Compras a proveedores |
| `clientes` | Cuenta corriente / fiado, con saldo |
| `usuarios` | Rol de cada usuario logueado (`admin` o `cajero`) |

## Anulación de ventas (no borrado)

Las ventas nunca se eliminan. Un admin puede **anular** una venta desde Reportes, indicando un motivo obligatorio. Esto:
- Marca la venta original como `anulada: true` (queda visible, tachada, con el motivo y quién la anuló)
- Repone el stock de los productos vendidos (incluyendo ingredientes de recetas/combos)
- Revierte el ingreso de caja correspondiente (o el saldo de cuenta corriente si era una venta fiada)

Todo esto queda registrado como documentos nuevos — no se edita ni se borra ningún movimiento anterior.
