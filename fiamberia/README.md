# 🥩 Fiambería — Sistema de Stock y Ventas

Sistema de punto de venta y control de stock para fiambrería/almacén.
Construido con React + Vite + Firebase + Vercel.

## Funcionalidades

- **Panel de Ventas** — búsqueda por nombre/código, soporte por kg y por unidad, carrito, descuento automático de stock
- **Stock** — listado con alertas de stock bajo/sin stock, carga de mercadería
- **Productos** — ABM completo con categorías, precios, stock mínimo
- **Reportes** — más vendidos, historial de movimientos, totales por período

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
4. Ir a Configuración del proyecto → Agregar app web
5. Copiar las credenciales

### 3. Configurar Firebase
Editar `src/firebase/config.js` con tus credenciales:

```js
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  ...
}
```

### 4. Reglas de Firestore
En Firebase Console → Firestore → Reglas, pegar:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ Estas reglas son abiertas. Suficiente para uso interno sin login.

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
│   └── config.js          # Credenciales Firebase
├── pages/
│   ├── Ventas.jsx          # Panel de ventas / POS
│   ├── Stock.jsx           # Control de stock
│   ├── Productos.jsx       # ABM de productos
│   └── Reportes.jsx        # Reportes y estadísticas
├── App.jsx                 # Routing + navegación
└── index.css               # Estilos globales
```

## Colecciones en Firestore

| Colección | Descripción |
|---|---|
| `productos` | Artículos con nombre, código, precio, stock, unidad |
| `ventas` | Registro de cada venta con items y total |
| `movimientos` | Cada movimiento de stock (venta o carga) |
