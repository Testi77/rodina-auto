import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, indexedDBLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCmMAeflMH8EJkom5d4GWssgXA5Gx5qMD4",
  authDomain: "rodina-auto.firebaseapp.com",
  projectId: "rodina-auto",
  storageBucket: "rodina-auto.firebasestorage.app",
  messagingSenderId: "775361716636",
  appId: "1:775361716636:web:298928ec0a0e330a2fe859"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// AUTH HELPERS
export function loginToEmail(login) {
  return `${login.toLowerCase().replace(/\s/g, "")}@rodina.auto`;
}

export async function registerUser(login, password) {
  const email = loginToEmail(login);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return { id: cred.user.uid, login };
}

export async function loginUser(login, password, remember = false) {
  const email = loginToEmail(login);
  await setPersistence(auth, remember ? indexedDBLocalPersistence : browserSessionPersistence);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return { id: cred.user.uid, login };
}

export async function logoutUser() {
  await signOut(auth);
}

// FIRESTORE HELPERS
export async function saveCar(carData) {
  const docRef = await addDoc(collection(db, "cars"), carData);
  return docRef.id;
}

export async function getCars() {
  const q = query(collection(db, "cars"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
}

export async function deleteCar(firestoreId) {
  await deleteDoc(doc(db, "cars", firestoreId));
}

export async function updateCar(firestoreId, carData) {
  await updateDoc(doc(db, "cars", firestoreId), carData);
}

export { onAuthStateChanged };

export async function isAdmin(uid) {
  if (!uid) return false;
  const snapshot = await getDocs(collection(db, "admins"));
  return snapshot.docs.some(doc => doc.data().uid === uid);
}