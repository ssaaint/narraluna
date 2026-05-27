import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDgTXN3uWZTGM27u2N9f1anpTwXsxfCaWk",
  authDomain: "narraluna-6abac.firebaseapp.com",
  projectId: "narraluna-6abac",
  storageBucket: "narraluna-6abac.firebasestorage.app",
  messagingSenderId: "253888489907",
  appId: "1:253888489907:web:69dd3a7f4e75f7061dc3c6"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
