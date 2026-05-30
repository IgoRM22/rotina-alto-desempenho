import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  addDoc, query, orderBy, onSnapshot, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { OWNER_UID } from '../config'

// Base path: /users/{uid}/{collection}
const base = (col) => collection(db, 'users', OWNER_UID, col)
const userDoc = (col, id) => doc(db, 'users', OWNER_UID, col, id)

// ── Inspirations (people + quotes) ──────────────────────────────────────────
export const listenInspirations = (cb) =>
  onSnapshot(query(base('inspirations'), orderBy('order', 'asc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addInspiration = (data) =>
  addDoc(base('inspirations'), { ...data, createdAt: serverTimestamp(), order: Date.now() })

export const updateInspiration = (id, data) => updateDoc(userDoc('inspirations', id), data)
export const deleteInspiration = (id) => deleteDoc(userDoc('inspirations', id))

// ── Todos ────────────────────────────────────────────────────────────────────
export const listenTodos = (cb) =>
  onSnapshot(query(base('todos'), orderBy('createdAt', 'asc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addTodo = (data) =>
  addDoc(base('todos'), { done: false, ...data, createdAt: serverTimestamp() })

export const updateTodo = (id, data) => updateDoc(userDoc('todos', id), data)
export const deleteTodo = (id) => deleteDoc(userDoc('todos', id))

// ── Goals / Metas ────────────────────────────────────────────────────────────
export const listenGoals = (cb) =>
  onSnapshot(query(base('goals'), orderBy('createdAt', 'asc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addGoal = (data) =>
  addDoc(base('goals'), { done: false, progress: 0, ...data, createdAt: serverTimestamp() })

export const updateGoal = (id, data) => updateDoc(userDoc('goals', id), data)
export const deleteGoal = (id) => deleteDoc(userDoc('goals', id))

// ── Schedule / Cronograma ────────────────────────────────────────────────────
export const listenSchedule = (cb) =>
  onSnapshot(query(base('schedule'), orderBy('time', 'asc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addScheduleItem = (data) =>
  addDoc(base('schedule'), { ...data, createdAt: serverTimestamp() })

export const updateScheduleItem = (id, data) => updateDoc(userDoc('schedule', id), data)
export const deleteScheduleItem = (id) => deleteDoc(userDoc('schedule', id))

// ── Full backup / restore ─────────────────────────────────────────────────────
import { getDocs } from 'firebase/firestore'

export const exportAll = async () => {
  const cols = ['inspirations', 'todos', 'goals', 'schedule']
  const result = {}
  for (const col of cols) {
    const snap = await getDocs(base(col))
    result[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }
  return result
}

export const importAll = async (json) => {
  const cols = ['inspirations', 'todos', 'goals', 'schedule']
  for (const col of cols) {
    if (!json[col]) continue
    for (const item of json[col]) {
      const { id, ...data } = item
      await setDoc(userDoc(col, id), data)
    }
  }
}
