import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBuEPr4Cjs99ID6brby7oslpDA6kcN_1Zs",
  authDomain: "najdaai.firebaseapp.com",
  projectId: "najdaai",
  storageBucket: "najdaai.firebasestorage.app",
  messagingSenderId: "317212390540",
  appId: "1:317212390540:web:336b45e8a27122a27077a9",
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

export { auth };