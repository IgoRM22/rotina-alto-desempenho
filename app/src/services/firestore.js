import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  addDoc, query, orderBy, limit, where, documentId, onSnapshot, serverTimestamp
} from 'firebase/firestore'
import { db, auth } from '../firebase'

// Each user's data lives under /users/{their own uid}/
const currentUid = () => {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')
  return uid
}
const base = (col) => collection(db, 'users', currentUid(), col)
const userDoc = (col, id) => doc(db, 'users', currentUid(), col, id)
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

// ── Folders (GTD organization for todos; unfiled = "Parking Lot") ───────────
export const listenFolders = (cb) =>
  onSnapshot(query(base('folders'), orderBy('order', 'asc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addFolder = (data) =>
  addDoc(base('folders'), { ...data, createdAt: serverTimestamp(), order: Date.now() })

export const updateFolder = (id, data) => updateDoc(userDoc('folders', id), data)

export const unfileTodosInFolder = async (folderId) => {
  const snap = await getDocs(base('todos'))
  const targets = snap.docs.filter((entry) => entry.data()?.folderId === folderId)
  await Promise.all(targets.map((entry) => updateDoc(userDoc('todos', entry.id), { folderId: null })))
  return targets.length
}

export const deleteFolder = async (id) => {
  await unfileTodosInFolder(id)
  await deleteDoc(userDoc('folders', id))
}

// ── Habits (definitions) ─────────────────────────────────────────────────────
export const listenHabits = (cb) =>
  onSnapshot(query(base('habits'), orderBy('order', 'asc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addHabit = (data) =>
  addDoc(base('habits'), { active: true, ...data, createdAt: serverTimestamp(), order: Date.now() })

export const updateHabit = (id, data) => updateDoc(userDoc('habits', id), data)
export const deleteHabit = (id) => deleteDoc(userDoc('habits', id))

// ── Habit logs (1 doc per day, map of habitId -> checked) ───────────────────
export const listenHabitLogs = (cb, days = 60) =>
  onSnapshot(query(base('habitLogs'), orderBy('date', 'desc'), limit(days)), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const setHabitChecked = (dateKey, habitId, checked) =>
  setDoc(
    userDoc('habitLogs', dateKey),
    { date: dateKey, checked: { [habitId]: checked }, updatedAt: serverTimestamp() },
    { merge: true },
  )

// ── Daily log (sleep/energy/note, 1 doc per day) ─────────────────────────────
export const listenDailyLog = (dateKey, cb) =>
  onSnapshot(userDoc('dailyLogs', dateKey), snap => cb(snap.exists() ? snap.data() : null))

export const saveDailyLog = (dateKey, data) =>
  setDoc(userDoc('dailyLogs', dateKey), { date: dateKey, ...data, updatedAt: serverTimestamp() }, { merge: true })

export const saveDailyAnnotations = (dateKey, annotations) =>
  setDoc(userDoc('dailyLogs', dateKey), { date: dateKey, annotations, updatedAt: serverTimestamp() }, { merge: true })

export const listenDailyLogsForDates = (dateKeys, cb) => {
  if (!dateKeys.length) { cb([]); return () => {} }
  return onSnapshot(query(base('dailyLogs'), where(documentId(), 'in', dateKeys)), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}

// ── Week focus (editable in Revisão, shown in Hoje during that week) ────────
export const listenWeekFocus = (weekKey, cb) =>
  onSnapshot(userDoc('weekFocus', weekKey), snap => cb(snap.exists() ? snap.data() : null))

export const saveWeekFocus = (weekKey, items) =>
  setDoc(userDoc('weekFocus', weekKey), { items, updatedAt: serverTimestamp() }, { merge: true })

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

// ── Meal Plan / Alimentação (1 doc per meal-time table, items embedded) ─────
export const listenMealTables = (cb) =>
  onSnapshot(query(base('mealTables'), orderBy('order', 'asc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addMealTable = (data) =>
  addDoc(base('mealTables'), { time: '', title: '', items: [], ...data, createdAt: serverTimestamp(), order: Date.now() })

export const updateMealTable = (id, data) => updateDoc(userDoc('mealTables', id), data)
export const deleteMealTable = (id) => deleteDoc(userDoc('mealTables', id))

// ── Full backup / restore ─────────────────────────────────────────────────────
import { getDocs } from 'firebase/firestore'

const BACKUP_COLLECTIONS = ['inspirations', 'todos', 'goals', 'schedule', 'importantDates', 'notebooks', 'notes', 'habits', 'habitLogs', 'dailyLogs', 'weekFocus', 'folders', 'mealTables']

export const exportAll = async () => {
  const result = {}
  for (const col of BACKUP_COLLECTIONS) {
    const snap = await getDocs(base(col))
    result[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }
  return result
}

export const importAll = async (json) => {
  for (const col of BACKUP_COLLECTIONS) {
    if (!json[col]) continue
    for (const item of json[col]) {
      const { id, ...data } = item
      await setDoc(userDoc(col, id), data)
    }
  }
}

// ── One-shot reads for the weekly-archive background hook (no listener needed) ──
export const getHabitsOnce = async () => {
  const snap = await getDocs(query(base('habits'), orderBy('order', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getHabitLogsOnce = async (dateKeys) => {
  if (!dateKeys.length) return []
  const snap = await getDocs(query(base('habitLogs'), where(documentId(), 'in', dateKeys)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getDailyLogsForDates = async (dateKeys) => {
  if (!dateKeys.length) return []
  const snap = await getDocs(query(base('dailyLogs'), where(documentId(), 'in', dateKeys)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── Weekly archive state (last week already saved to Notes) ─────────────────
export const getLastArchivedWeek = async () => {
  const snap = await getDoc(userDoc('settings', 'prefs'))
  return snap.data()?.lastArchivedWeekKey || null
}

export const setLastArchivedWeek = (weekKey) =>
  setDoc(userDoc('settings', 'prefs'), { lastArchivedWeekKey: weekKey }, { merge: true })

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

// ── First-login initialization ────────────────────────────────────────────────
export const ensureUserDefaults = async (uid) => {
  const prefsRef = doc(db, 'users', uid, 'settings', 'prefs')
  const snap = await getDoc(prefsRef)
  if (!snap.exists()) {
    await setDoc(prefsRef, {
      todoCategories: DEFAULT_CATS,
      scheduleCategories: DEFAULT_SCHEDULE_CATS,
      goalCategories: DEFAULT_GOAL_CATS,
    })
  }
}
