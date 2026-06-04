import React, { useState, useEffect } from 'react'
import {
  RiAddLine,
  RiDeleteBinLine,
  RiPencilLine,
  RiWallet3Line,
  RiShieldLine,
  RiFlagLine,
  RiArrowUpDownLine,
} from '@remixicon/react'
import { useAuth } from '../context/AuthContext'
import {
  listenFinancesData,
  updateFinancesData,
  addBank, updateBank, removeBank,
  addIncome, updateIncome, removeIncome,
  addFixedExpense, updateFixedExpense, removeFixedExpense,
  addGoal, updateGoal, removeGoal,
} from '../services/finances'
import Modal from '../components/Modal'
import Toast from '../components/Toast'

const fmtCurrency = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(n || 0)

const fmtCurrencyInt = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0)

const fmtDate = (iso) => {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}


export default function Finances() {
  const { user } = useAuth()
  const [data, setData] = useState({
    emergencyFund: 0,
    banks: [],
    incomes: [],
    fixedExpenses: [],
    goals: [],
  })
  const [showModal, setShowModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({})
  const [editIndex, setEditIndex] = useState(null)

  useEffect(() => {
    if (user?.uid) {
      const unsub = listenFinancesData(user.uid, setData)
      return unsub
    }
  }, [user?.uid])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const openAdd = (type) => {
    setEditIndex(null)
    setForm({})
    setShowModal(type)
  }

  const openEdit = (type, idx) => {
    setEditIndex(idx)
    const item = data[type === 'bank' ? 'banks' : type === 'income' ? 'incomes' : type === 'expense' ? 'fixedExpenses' : 'goals'][idx]
    if (type === 'bank') setForm({ bankName: item.name, bankBalance: item.balance })
    else if (type === 'income') setForm({ incomeDesc: item.description, incomeGross: item.gross, incomeDeductions: item.deductions })
    else if (type === 'expense') setForm({ expenseDesc: item.description, expenseAmount: item.amount, expenseBank: item.bank })
    else if (type === 'goal') setForm({ goalTitle: item.title, goalAmount: item.targetAmount, goalCurrent: item.currentAmount, goalDate: item.targetDate })
    setShowModal(type)
  }

  const handleSaveEmergencyFund = async () => {
    await updateFinancesData(user.uid, {
      emergencyFund: parseFloat(form.emergencyFund) || 0,
      emergencyFundUpdatedAt: new Date().toISOString(),
    })
    showToast('Fundo de emergência atualizado!')
    setShowModal(null)
  }

  const handleSaveBank = async () => {
    const payload = { name: form.bankName, balance: parseFloat(form.bankBalance) || 0 }
    if (editIndex !== null) {
      await updateBank(user.uid, editIndex, payload)
      showToast('Banco atualizado!')
    } else {
      await addBank(user.uid, payload)
      showToast('Banco adicionado!')
    }
    setShowModal(null)
    setEditIndex(null)
  }

  const handleSaveIncome = async () => {
    const gross = parseFloat(form.incomeGross) || 0
    const deductions = parseFloat(form.incomeDeductions) || 0
    const payload = { description: form.incomeDesc, gross, deductions, net: gross - deductions }
    if (editIndex !== null) {
      await updateIncome(user.uid, editIndex, payload)
      showToast('Renda atualizada!')
    } else {
      await addIncome(user.uid, payload)
      showToast('Renda adicionada!')
    }
    setShowModal(null)
    setEditIndex(null)
  }

  const handleSaveExpense = async () => {
    const payload = {
      description: form.expenseDesc,
      amount: parseFloat(form.expenseAmount) || 0,
      bank: form.expenseBank || '',
    }
    if (editIndex !== null) {
      await updateFixedExpense(user.uid, editIndex, payload)
      showToast('Despesa atualizada!')
    } else {
      await addFixedExpense(user.uid, payload)
      showToast('Despesa adicionada!')
    }
    setShowModal(null)
    setEditIndex(null)
  }

  const handleSaveGoal = async () => {
    const payload = {
      title: form.goalTitle,
      targetAmount: parseFloat(form.goalAmount) || 0,
      currentAmount: parseFloat(form.goalCurrent) || 0,
      targetDate: form.goalDate,
    }
    if (editIndex !== null) {
      await updateGoal(user.uid, editIndex, payload)
      showToast('Meta atualizada!')
    } else {
      await addGoal(user.uid, payload)
      showToast('Meta adicionada!')
    }
    setShowModal(null)
    setEditIndex(null)
  }

  const totalBanks = (data.banks || []).reduce((sum, b) => sum + (b.balance || 0), 0)
  const totalIncome = (data.incomes || []).reduce((sum, i) => sum + (i.net || 0), 0)
  const totalExpenses = (data.fixedExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0)
  const monthlyBalance = totalIncome - totalExpenses

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-kicker">Gestão Financeira</span>
        <h1 className="page-title">Finanças</h1>
      </div>

      {/* KPI Grid */}
      <div className="finance-overview">
        <div className="finance-kpi-card">
          <div className="finance-kpi-icon"><RiWallet3Line size={20} /></div>
          <div className="finance-kpi-content">
            <p className="finance-kpi-label">Patrimônio em Bancos</p>
            <p className="finance-kpi-value">{fmtCurrency(totalBanks)}</p>
            <p className="finance-kpi-sub">Somatória dos bancos</p>
          </div>
        </div>

        <div className={`finance-kpi-card ${data.emergencyFund >= totalExpenses ? 'finance-kpi-positive' : 'finance-kpi-negative'}`}>
          <div className="finance-kpi-icon"><RiShieldLine size={20} /></div>
          <div className="finance-kpi-content">
            <p className="finance-kpi-label">Fundo de Emergência</p>
            <p className="finance-kpi-value" style={{ color: data.emergencyFund >= totalExpenses ? 'var(--sage)' : 'var(--coral)' }}>
              {fmtCurrency(data.emergencyFund)}
            </p>
            {data.emergencyFundUpdatedAt && (
              <p className="finance-kpi-meta">atualizado {fmtDate(data.emergencyFundUpdatedAt)}</p>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ emergencyFund: data.emergencyFund || 0 }); setShowModal('emergency') }}>
              <RiPencilLine size={12} /> atualizar
            </button>
          </div>
        </div>

        <div className={`finance-kpi-card ${monthlyBalance >= 0 ? 'finance-kpi-positive' : 'finance-kpi-negative'}`}>
          <div className="finance-kpi-icon"><RiArrowUpDownLine size={20} /></div>
          <div className="finance-kpi-content">
            <p className="finance-kpi-label">Saldo Mensal</p>
            <p className="finance-kpi-value" style={{ color: monthlyBalance >= 0 ? 'var(--sage)' : 'var(--coral)' }}>
              {fmtCurrency(monthlyBalance)}
            </p>
            <p className="finance-kpi-sub">Renda líquida − despesas fixas</p>
          </div>
        </div>
      </div>

      {/* Income Section */}
      <div className="finance-section">
        <div className="finance-section-header">
          <div>
            <h2 className="finance-section-title">Renda (mensal)</h2>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => openAdd('income')}>
            <RiAddLine size={13} /> Adicionar
          </button>
        </div>

        {(data.incomes || []).length > 0 ? (
          <div className="finance-table">
            <div className="finance-table-header finance-table-header--income">
              <span>Renda</span>
              <span>Bruto</span>
              <span>Descontos</span>
              <span>Líquido</span>
              <span></span>
            </div>
            {data.incomes.map((income, idx) => (
              <div key={idx} className="finance-table-row finance-table-row--income">
                <span className="finance-table-cell-main">
                  {income.description}
                  {income.updatedAt && <small className="finance-table-meta">{fmtDate(income.updatedAt)}</small>}
                </span>
                <span className="finance-table-cell" data-label="Bruto">{fmtCurrency(income.gross)}</span>
                <span className="finance-table-cell" data-label="Desc">{fmtCurrency(income.deductions)}</span>
                <span className="finance-table-cell finance-table-cell-highlight" data-label="Líquido">{fmtCurrency(income.net)}</span>
                <div className="finance-table-actions">
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit('income', idx)} aria-label="Editar">
                    <RiPencilLine size={13} />
                  </button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => { removeIncome(user.uid, idx); showToast('Removido.') }} aria-label="Remover">
                    <RiDeleteBinLine size={13} />
                  </button>
                </div>
              </div>
            ))}
            <div className="finance-table-footer finance-table-footer--income">
              <span>Total líquido</span>
              <span></span>
              <span></span>
              <span className="finance-footer-value finance-footer-value--income">{fmtCurrency(totalIncome)}</span>
              <span></span>
            </div>
          </div>
        ) : (
          <p className="finance-empty">Nenhuma renda registrada.</p>
        )}
      </div>

      {/* Banks Section */}
      <div className="finance-section">
        <div className="finance-section-header">
          <div>
            <h2 className="finance-section-title">Bancos (saldo atual)</h2>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => openAdd('bank')}>
            <RiAddLine size={13} /> Adicionar
          </button>
        </div>

        {(data.banks || []).length > 0 ? (
          <div className="finance-table">
            <div className="finance-table-header finance-table-header--banks">
              <span>Banco</span>
              <span>Saldo Atual</span>
              <span></span>
            </div>
            {data.banks.map((bank, idx) => (
              <div key={idx} className="finance-table-row finance-table-row--banks">
                <span className="finance-table-cell-main">
                  {bank.name}
                  {bank.updatedAt && <small className="finance-table-meta">{fmtDate(bank.updatedAt)}</small>}
                </span>
                <span className="finance-table-cell finance-table-cell-highlight" data-label="Saldo">{fmtCurrency(bank.balance)}</span>
                <div className="finance-table-actions">
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit('bank', idx)} aria-label="Editar">
                    <RiPencilLine size={13} />
                  </button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => { removeBank(user.uid, idx); showToast('Removido.') }} aria-label="Remover">
                    <RiDeleteBinLine size={13} />
                  </button>
                </div>
              </div>
            ))}
            <div className="finance-table-footer finance-table-footer--banks">
              <span>Total</span>
              <span className="finance-footer-value">{fmtCurrency(totalBanks)}</span>
              <span></span>
            </div>
          </div>
        ) : (
          <p className="finance-empty">Nenhum banco registrado.</p>
        )}
      </div>

      {/* Fixed Expenses */}
      <div className="finance-section">
        <div className="finance-section-header">
          <div>
            <h2 className="finance-section-title">Despesas (mensal)</h2>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => openAdd('expense')}>
            <RiAddLine size={13} /> Adicionar
          </button>
        </div>

        {(data.fixedExpenses || []).length > 0 ? (
          <div className="finance-table">
            <div className="finance-table-header finance-table-header--expense">
              <span>Despesa</span>
              <span>Valor</span>
              <span>Banco</span>
              <span></span>
            </div>
            {data.fixedExpenses.map((exp, idx) => (
              <div key={idx} className="finance-table-row finance-table-row--expense">
                <span className="finance-table-cell-main">
                  {exp.description}
                  {exp.updatedAt && <small className="finance-table-meta">{fmtDate(exp.updatedAt)}</small>}
                </span>
                <span className="finance-table-cell" data-label="Valor">{fmtCurrency(exp.amount)}</span>
                <span className="finance-table-cell" data-label="Banco">{exp.bank}</span>
                <div className="finance-table-actions">
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit('expense', idx)} aria-label="Editar">
                    <RiPencilLine size={13} />
                  </button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => { removeFixedExpense(user.uid, idx); showToast('Removido.') }} aria-label="Remover">
                    <RiDeleteBinLine size={13} />
                  </button>
                </div>
              </div>
            ))}
            <div className="finance-table-footer finance-table-footer--expense">
              <span>Total mensal</span>
              <span className="finance-footer-value finance-footer-value--expense">{fmtCurrency(totalExpenses)}</span>
              <span></span>
              <span></span>
            </div>
          </div>
        ) : (
          <p className="finance-empty">Nenhuma despesa registrada.</p>
        )}
      </div>

      {/* Emergency Fund Details */}
      <div className="finance-section">
        <h2 className="finance-section-title" style={{ marginBottom: 20 }}>Reserva de Emergência</h2>
        <div className="finance-stats-grid">
          <div className="finance-stat-card">
            <span className="finance-stat-label">Total Acumulado</span>
            <span className="finance-stat-value">{fmtCurrency(data.emergencyFund)}</span>
            {totalExpenses > 0 && (
              <span className="finance-stat-sub">seus gastos: {fmtCurrency(totalExpenses)}/mês</span>
            )}
          </div>
          {[
            { label: '3 Meses', months: 3 },
            { label: '6 Meses', months: 6 },
            { label: '1 Ano', months: 12 },
          ].map(({ label, months }) => {
            const allowance = Math.round((data.emergencyFund || 0) / months)
            const diff = Math.round(allowance - totalExpenses)
            const pct = totalExpenses > 0 ? (diff / totalExpenses) * 100 : null
            const positive = diff >= 0
            return (
              <div key={months} className="finance-stat-card">
                <span className="finance-stat-label">{label}</span>
                <span className="finance-stat-value">
                  {fmtCurrencyInt(allowance)}
                  <small className="finance-stat-per-month">/mês</small>
                </span>
                {pct !== null && (
                  <span className="finance-stat-diff" style={{ color: positive ? 'var(--sage)' : 'var(--coral)' }}>
                    {positive ? '+' : ''}{fmtCurrencyInt(diff)} ({positive ? '+' : ''}{pct.toFixed(0)}%)
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Financial Goals */}
      <div className="finance-section">
        <div className="finance-section-header">
          <h2 className="finance-section-title">Metas Financeiras</h2>
          <button className="btn btn-primary btn-sm" onClick={() => openAdd('goal')}>
            <RiAddLine size={13} /> Meta
          </button>
        </div>

        {(data.goals || []).length > 0 ? (
          <div className="finance-goals-list">
            {data.goals.map((goal, idx) => {
              const progress = (goal.currentAmount / goal.targetAmount) * 100
              const daysLeft = goal.targetDate
                ? Math.ceil((new Date(goal.targetDate) - new Date()) / 86400000)
                : null
              return (
                <div key={idx} className={`finance-goal-card${progress >= 100 ? ' finance-goal-card--complete' : ''}`}>
                  <div className="finance-goal-header">
                    <div>
                      <p className="finance-goal-title">{goal.title}</p>
                      <p className="finance-goal-date">
                        até {goal.targetDate}
                        {goal.updatedAt && <span className="finance-table-meta" style={{ marginLeft: 8 }}>{fmtDate(goal.updatedAt)}</span>}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      {daysLeft !== null && (
                        <p className={`finance-goal-days${daysLeft < 0 ? ' finance-goal-days--overdue' : daysLeft <= 30 ? ' finance-goal-days--urgent' : ''}`}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d atrasado` : `${daysLeft}d restantes`}
                        </p>
                      )}
                      <div className="finance-table-actions">
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit('goal', idx)} aria-label="Editar">
                          <RiPencilLine size={13} />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => { removeGoal(user.uid, idx); showToast('Removido.') }} aria-label="Remover">
                          <RiDeleteBinLine size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="finance-goal-amounts">
                    <span className="finance-goal-current">{fmtCurrency(goal.currentAmount)}</span>
                    <span className="finance-goal-target">{fmtCurrency(goal.targetAmount)}</span>
                  </div>
                  <div className="finance-goal-bar">
                    <div className="finance-goal-bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                  <p className="finance-goal-pct">{progress.toFixed(0)}% completo</p>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="finance-empty">Nenhuma meta definida.</p>
        )}
      </div>

      {/* Modals */}
      {showModal === 'emergency' && (
        <Modal title="Atualizar Fundo de Emergência" onClose={() => setShowModal(null)} onSave={handleSaveEmergencyFund}>
          <div className="field">
            <label>Total do Fundo</label>
            <input type="number" value={form.emergencyFund || ''} onChange={e => setForm(f => ({ ...f, emergencyFund: e.target.value }))} placeholder="0" />
          </div>
        </Modal>
      )}

      {showModal === 'bank' && (
        <Modal title={editIndex !== null ? 'Editar Banco' : 'Novo Banco'} onClose={() => { setShowModal(null); setEditIndex(null) }} onSave={handleSaveBank}>
          <div className="field">
            <label>Nome do Banco</label>
            <input value={form.bankName || ''} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="Ex: Nubank" />
          </div>
          <div className="field">
            <label>Saldo Atual</label>
            <input type="number" value={form.bankBalance || ''} onChange={e => setForm(f => ({ ...f, bankBalance: e.target.value }))} placeholder="0" />
          </div>
        </Modal>
      )}

      {showModal === 'income' && (
        <Modal title={editIndex !== null ? 'Editar Renda' : 'Nova Renda'} onClose={() => { setShowModal(null); setEditIndex(null) }} onSave={handleSaveIncome}>
          <div className="field">
            <label>Descrição</label>
            <input value={form.incomeDesc || ''} onChange={e => setForm(f => ({ ...f, incomeDesc: e.target.value }))} placeholder="Ex: Salário" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Renda Bruta</label>
              <input type="number" value={form.incomeGross || ''} onChange={e => setForm(f => ({ ...f, incomeGross: e.target.value }))} placeholder="0" />
            </div>
            <div className="field">
              <label>Descontos</label>
              <input type="number" value={form.incomeDeductions || ''} onChange={e => setForm(f => ({ ...f, incomeDeductions: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div className="field">
            <label>Líquido (calculado automaticamente)</label>
            <input type="number" value={(parseFloat(form.incomeGross || 0) - parseFloat(form.incomeDeductions || 0)).toFixed(2)} disabled style={{ background: 'var(--s2)', color: 'var(--text3)' }} />
          </div>
        </Modal>
      )}

      {showModal === 'expense' && (
        <Modal title={editIndex !== null ? 'Editar Despesa' : 'Nova Despesa'} onClose={() => { setShowModal(null); setEditIndex(null) }} onSave={handleSaveExpense}>
          <div className="field">
            <label>Descrição</label>
            <input value={form.expenseDesc || ''} onChange={e => setForm(f => ({ ...f, expenseDesc: e.target.value }))} placeholder="Ex: Netflix" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Valor Mensal</label>
              <input type="number" value={form.expenseAmount || ''} onChange={e => setForm(f => ({ ...f, expenseAmount: e.target.value }))} placeholder="0" />
            </div>
            <div className="field">
              <label>Banco</label>
              <input value={form.expenseBank || ''} onChange={e => setForm(f => ({ ...f, expenseBank: e.target.value }))} placeholder="Ex: Nubank" />
            </div>
          </div>
        </Modal>
      )}

      {showModal === 'goal' && (
        <Modal title={editIndex !== null ? 'Editar Meta' : 'Nova Meta Financeira'} onClose={() => { setShowModal(null); setEditIndex(null) }} onSave={handleSaveGoal}>
          <div className="field">
            <label>Título da Meta</label>
            <input value={form.goalTitle || ''} onChange={e => setForm(f => ({ ...f, goalTitle: e.target.value }))} placeholder="Ex: Atingir R$ 100k investidos" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Valor Alvo</label>
              <input type="number" value={form.goalAmount || ''} onChange={e => setForm(f => ({ ...f, goalAmount: e.target.value }))} placeholder="0" />
            </div>
            <div className="field">
              <label>Valor Atual</label>
              <input type="number" value={form.goalCurrent || ''} onChange={e => setForm(f => ({ ...f, goalCurrent: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div className="field">
            <label>Data Alvo</label>
            <input type="date" value={form.goalDate || ''} onChange={e => setForm(f => ({ ...f, goalDate: e.target.value }))} />
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
