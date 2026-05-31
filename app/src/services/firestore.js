import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  addDoc, query, orderBy, onSnapshot, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { OWNER_UID } from '../config'

// Base path: /users/{uid}/{collection}
const base = (col) => collection(db, 'users', OWNER_UID, col)
const userDoc = (col, id) => doc(db, 'users', OWNER_UID, col, id)
const accessControlDoc = () => doc(db, 'system', 'accessControl')

export const ACCESS_CONTROL_DOC_PATH = 'system/accessControl'

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

const normalizeEmailList = (list) => {
  if (!Array.isArray(list)) return []

  const unique = new Set()
  list.forEach((entry) => {
    const safe = normalizeEmail(entry)
    if (safe) unique.add(safe)
  })

  return Array.from(unique)
}

export const getAccessControlConfig = async () => {
  const snap = await getDoc(accessControlDoc())
  if (!snap.exists()) return { exists: false, allowedEmails: [] }

  const data = snap.data()
  return {
    exists: true,
    allowedEmails: normalizeEmailList(data?.allowedEmails),
  }
}

export const ensureAccessControlConfig = async (ownerEmail) => {
  const owner = normalizeEmail(ownerEmail)
  const current = await getAccessControlConfig()

  if (!current.exists) {
    const allowedEmails = owner ? [owner] : []
    await setDoc(
      accessControlDoc(),
      {
        allowedEmails,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    return { exists: true, allowedEmails, created: true }
  }

  if (owner && !current.allowedEmails.includes(owner)) {
    const allowedEmails = [...current.allowedEmails, owner]
    await setDoc(
      accessControlDoc(),
      {
        allowedEmails,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    return { exists: true, allowedEmails, created: false }
  }

  return { ...current, created: false }
}

export const isEmailAuthorized = (email, config) => {
  const safeEmail = normalizeEmail(email)
  if (!safeEmail) return false

  const allowedEmails = normalizeEmailList(config?.allowedEmails)
  return allowedEmails.includes(safeEmail)
}

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
  onSnapshot(base('schedule'), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addScheduleItem = (data) =>
  addDoc(base('schedule'), { ...data, createdAt: serverTimestamp() })

export const updateScheduleItem = (id, data) => updateDoc(userDoc('schedule', id), data)
export const deleteScheduleItem = (id) => deleteDoc(userDoc('schedule', id))

export const replaceScheduleCategoryInItems = async (fromCategory, toCategory) => {
  const from = String(fromCategory || '').trim().toLowerCase()
  const to = String(toCategory || '').trim().toLowerCase()

  if (!from || !to || from === to) return 0

  const snap = await getDocs(base('schedule'))
  const targets = snap.docs.filter((entry) => {
    const currentCategory = String(entry.data()?.category || '').trim().toLowerCase()
    return currentCategory === from
  })

  await Promise.all(
    targets.map((entry) =>
      updateDoc(userDoc('schedule', entry.id), {
        category: to,
        updatedAt: serverTimestamp(),
      })),
  )

  return targets.length
}

// ── Important Dates / Calendario ────────────────────────────────────────────
export const listenImportantDates = (cb) =>
  onSnapshot(query(base('importantDates'), orderBy('startDate', 'asc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addImportantDate = (data) =>
  addDoc(base('importantDates'), { ...data, createdAt: serverTimestamp() })

export const updateImportantDate = (id, data) => updateDoc(userDoc('importantDates', id), data)
export const deleteImportantDate = (id) => deleteDoc(userDoc('importantDates', id))

// ── Full backup / restore ─────────────────────────────────────────────────────
import { getDocs } from 'firebase/firestore'

export const exportAll = async () => {
  const cols = ['inspirations', 'todos', 'goals', 'schedule', 'importantDates', 'notebooks', 'notes']
  const result = {}
  for (const col of cols) {
    const snap = await getDocs(base(col))
    result[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }
  return result
}

export const importAll = async (json) => {
  const cols = ['inspirations', 'todos', 'goals', 'schedule', 'importantDates', 'notebooks', 'notes']
  for (const col of cols) {
    if (!json[col]) continue
    for (const item of json[col]) {
      const { id, ...data } = item
      await setDoc(userDoc(col, id), data)
    }
  }
}

// ── Notes / Notebooks ─────────────────────────────────────────────────────────
export const listenNotebooks = (cb) =>
  onSnapshot(query(base('notebooks'), orderBy('createdAt', 'asc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addNotebook = (data) =>
  addDoc(base('notebooks'), { ...data, createdAt: serverTimestamp() })

export const updateNotebook = (id, data) => updateDoc(userDoc('notebooks', id), data)
export const deleteNotebook = (id) => deleteDoc(userDoc('notebooks', id))

export const listenNotes = (cb) =>
  onSnapshot(query(base('notes'), orderBy('createdAt', 'desc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addNote = (data) =>
  addDoc(base('notes'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })

export const updateNote = (id, data) =>
  updateDoc(userDoc('notes', id), { ...data, updatedAt: serverTimestamp() })

export const deleteNote = (id) => deleteDoc(userDoc('notes', id))

// ── Access Control Management ─────────────────────────────────────────────────
export const listenAccessControl = (cb) =>
  onSnapshot(accessControlDoc(), snap => {
    if (!snap.exists()) {
      cb({ exists: false, allowedEmails: [], adminEmail: '' })
      return
    }
    const data = snap.data()
    cb({
      exists: true,
      allowedEmails: normalizeEmailList(data?.allowedEmails),
      adminEmail: normalizeEmail(data?.adminEmail),
    })
  })

export const updateAllowedEmails = (emails) =>
  setDoc(accessControlDoc(), {
    allowedEmails: normalizeEmailList(emails),
    updatedAt: serverTimestamp(),
  }, { merge: true })

// ── Custom Todo Categories ────────────────────────────────────────────────────
const DEFAULT_CATS = ['trabalho', 'projeto', 'pessoal', 'saude', 'familia', 'estudo']

export const listenTodoCategories = (cb) => {
  const ref = userDoc('settings', 'prefs')
  return onSnapshot(ref, snap => {
    const data = snap.data()
    cb(data?.todoCategories ?? DEFAULT_CATS)
  })
}

export const saveTodoCategories = (cats) =>
  setDoc(userDoc('settings', 'prefs'), { todoCategories: cats }, { merge: true })

// ── Schedule Categories ───────────────────────────────────────────────────────
const DEFAULT_SCHEDULE_CATS = [
  { value: 'saude', color: '#5BA689' },
  { value: 'corp', color: '#4B8FD4' },
  { value: 'projeto', color: '#E06445' },
  { value: 'mente', color: '#8B7EC4' },
  { value: 'estudo', color: '#C4607A' },
  { value: 'familia', color: '#C49A3A' },
  { value: 'trem', color: '#7A7570' },
  { value: 'pessoal', color: '#8B7EC4' },
]

const normalizeHexColor = (value, fallback = '#E06445') => {
  if (typeof value !== 'string') return fallback
  const clean = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean.toUpperCase()
  if (/^#[0-9a-fA-F]{3}$/.test(clean)) {
    const [r, g, b] = clean.slice(1)
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return fallback
}

const scheduleColorFallback = (value) => {
  return DEFAULT_SCHEDULE_CATS.find((entry) => entry.value === value)?.color || '#E06445'
}

const normalizeScheduleCategory = (entry) => {
  if (typeof entry === 'string') {
    const value = entry.trim().toLowerCase()
    if (!value) return null
    return { value, color: scheduleColorFallback(value) }
  }

  if (!entry || typeof entry !== 'object') return null

  const value = String(entry.value || '').trim().toLowerCase()
  if (!value) return null

  return {
    value,
    color: normalizeHexColor(entry.color, scheduleColorFallback(value)),
  }
}

const normalizeScheduleCategories = (list) => {
  const input = Array.isArray(list) ? list : []
  const mapped = input.map(normalizeScheduleCategory).filter(Boolean)

  const seen = new Set()
  const deduped = []
  mapped.forEach((entry) => {
    if (seen.has(entry.value)) return
    seen.add(entry.value)
    deduped.push(entry)
  })

  return deduped.length ? deduped : DEFAULT_SCHEDULE_CATS
}

export const listenScheduleCategories = (cb) => {
  const ref = userDoc('settings', 'prefs')
  return onSnapshot(ref, snap => {
    const data = snap.data()
    cb(normalizeScheduleCategories(data?.scheduleCategories))
  })
}

export const saveScheduleCategories = (cats) =>
  setDoc(userDoc('settings', 'prefs'), { scheduleCategories: normalizeScheduleCategories(cats) }, { merge: true })

// ── Goal Categories ───────────────────────────────────────────────────────────
const DEFAULT_GOAL_CATS = ['projeto', 'saude', 'corp', 'estudo', 'familia', 'pessoal']

export const listenGoalCategories = (cb) => {
  const ref = userDoc('settings', 'prefs')
  return onSnapshot(ref, snap => {
    const data = snap.data()
    cb(data?.goalCategories ?? DEFAULT_GOAL_CATS)
  })
}

export const saveGoalCategories = (cats) =>
  setDoc(userDoc('settings', 'prefs'), { goalCategories: cats }, { merge: true })
