import { initializeApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyDkij_OrbJCltBrwSnhcXuj-T_HEfbJumA",
  authDomain: "fiambreria-stock-629ab.firebaseapp.com",
  projectId: "fiambreria-stock-629ab",
  storageBucket: "fiambreria-stock-629ab.firebasestorage.app",
  messagingSenderId: "403236523565",
  appId: "1:403236523565:web:9995e030ea8ec3395732a4"
}

const app = initializeApp(firebaseConfig)

// Persistencia offline: permite seguir viendo (y en algunos casos
// cargar) datos aunque se corte internet, y sincroniza al volver la
// conexión. Se habilita en varias pestañas a la vez.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
})
export const auth = getAuth(app)
