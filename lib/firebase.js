import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBlCgineDDuo39E7smylHGwNk1Ueya_Xwc",
  authDomain: "dynamicxibocomponent.firebaseapp.com",
  projectId: "dynamicxibocomponent",
  storageBucket: "dynamicxibocomponent.firebasestorage.app",
  messagingSenderId: "518716648234",
  appId: "1:518716648234:web:fc1c8f248bfff9bd858c53",
  measurementId: "G-H351ZCGSGH"
};

// Prevent re-initialization in development hot-reloading
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export { db };