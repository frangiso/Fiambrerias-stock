import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
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
export const db = getFirestore(app)
export const auth = getAuth(app)
