import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCEBaj98-yD7LK1fNGUqGOAvgjDxTwqfRs",
  authDomain: "vidapessoal-ebf84.firebaseapp.com",
  projectId: "vidapessoal-ebf84",
  storageBucket: "vidapessoal-ebf84.firebasestorage.app",
  messagingSenderId: "169315733008",
  appId: "1:169315733008:web:421d6e9fdf78f39dac4495",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })
