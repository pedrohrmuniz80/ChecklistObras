import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// COLE AQUI AS SUAS CHAVES QUE O FIREBASE GEROU!
const firebaseConfig = {
  apiKey: "AIzaSyCpHs7rK8IaU6bLOu9U5atqLe_Zk-PNkkE",

  authDomain: "check-list-obras.firebaseapp.com",

  projectId: "check-list-obras",

  storageBucket: "check-list-obras.firebasestorage.app",

  messagingSenderId: "154186862082",

  appId: "1:154186862082:web:8b12debd3789521894611b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
