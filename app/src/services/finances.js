import { db } from '../firebase'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'

const now = () => new Date().toISOString()

export const listenFinancesData = (uid, callback) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  return onSnapshot(docRef, snap => {
    callback(snap.exists() ? snap.data() : {
      emergencyFund: 0,
      banks: [],
      incomes: [],
      fixedExpenses: [],
      goals: [],
    })
  })
}

export const updateFinancesData = async (uid, data) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  await setDoc(docRef, data, { merge: true })
}

export const addBank = async (uid, bank) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  const snap = await getDoc(docRef)
  const current = snap.exists() ? snap.data() : { banks: [] }
  const banks = current.banks || []
  await setDoc(docRef, { banks: [...banks, { ...bank, updatedAt: now() }] }, { merge: true })
}

export const updateBank = async (uid, index, bank) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  const snap = await getDoc(docRef)
  const current = snap.exists() ? snap.data() : { banks: [] }
  const banks = [...(current.banks || [])]
  banks[index] = { ...bank, updatedAt: now() }
  await setDoc(docRef, { banks }, { merge: true })
}

export const removeBank = async (uid, index) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  const snap = await getDoc(docRef)
  const current = snap.exists() ? snap.data() : { banks: [] }
  const banks = [...(current.banks || [])]
  banks.splice(index, 1)
  await setDoc(docRef, { banks }, { merge: true })
}

export const addIncome = async (uid, income) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  const snap = await getDoc(docRef)
  const current = snap.exists() ? snap.data() : { incomes: [] }
  const incomes = current.incomes || []
  await setDoc(docRef, { incomes: [...incomes, { ...income, updatedAt: now() }] }, { merge: true })
}

export const updateIncome = async (uid, index, income) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  const snap = await getDoc(docRef)
  const current = snap.exists() ? snap.data() : { incomes: [] }
  const incomes = [...(current.incomes || [])]
  incomes[index] = { ...income, updatedAt: now() }
  await setDoc(docRef, { incomes }, { merge: true })
}

export const removeIncome = async (uid, index) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  const snap = await getDoc(docRef)
  const current = snap.exists() ? snap.data() : { incomes: [] }
  const incomes = [...(current.incomes || [])]
  incomes.splice(index, 1)
  await setDoc(docRef, { incomes }, { merge: true })
}

export const addFixedExpense = async (uid, expense) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  const snap = await getDoc(docRef)
  const current = snap.exists() ? snap.data() : { fixedExpenses: [] }
  const expenses = current.fixedExpenses || []
  await setDoc(docRef, { fixedExpenses: [...expenses, { ...expense, updatedAt: now() }] }, { merge: true })
}

export const updateFixedExpense = async (uid, index, expense) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  const snap = await getDoc(docRef)
  const current = snap.exists() ? snap.data() : { fixedExpenses: [] }
  const expenses = [...(current.fixedExpenses || [])]
  expenses[index] = { ...expense, updatedAt: now() }
  await setDoc(docRef, { fixedExpenses: expenses }, { merge: true })
}

export const removeFixedExpense = async (uid, index) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  const snap = await getDoc(docRef)
  const current = snap.exists() ? snap.data() : { fixedExpenses: [] }
  const expenses = [...(current.fixedExpenses || [])]
  expenses.splice(index, 1)
  await setDoc(docRef, { fixedExpenses: expenses }, { merge: true })
}

export const addGoal = async (uid, goal) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  const snap = await getDoc(docRef)
  const current = snap.exists() ? snap.data() : { goals: [] }
  const goals = current.goals || []
  await setDoc(docRef, { goals: [...goals, { ...goal, updatedAt: now() }] }, { merge: true })
}

export const updateGoal = async (uid, index, goal) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  const snap = await getDoc(docRef)
  const current = snap.exists() ? snap.data() : { goals: [] }
  const goals = [...(current.goals || [])]
  goals[index] = { ...goal, updatedAt: now() }
  await setDoc(docRef, { goals }, { merge: true })
}

export const removeGoal = async (uid, index) => {
  const docRef = doc(db, 'users', uid, 'finances', 'main')
  const snap = await getDoc(docRef)
  const current = snap.exists() ? snap.data() : { goals: [] }
  const goals = [...(current.goals || [])]
  goals.splice(index, 1)
  await setDoc(docRef, { goals }, { merge: true })
}
