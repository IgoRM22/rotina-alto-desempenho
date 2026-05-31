import React, { useState, useEffect } from 'react'
import { RiAddLine, RiDeleteBinLine, RiPencilLine, RiUserHeartLine } from '@remixicon/react'
import {
  listenInspirations,
  addInspiration,
  updateInspiration,
  deleteInspiration,
} from '../services/firestore'
import Modal from '../components/Modal'
import Toast from '../components/Toast'

export default function Home() {
  const [inspirations, setInspirations] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({ name: '', role: '', quote: '', imageUrl: '' })

  useEffect(() => {
    const unsub = listenInspirations(setInspirations)
    return unsub
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', role: '', quote: '', imageUrl: '' })
    setShowModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({ name: item.name, role: item.role || '', quote: item.quote || '', imageUrl: item.imageUrl || '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    try {
      if (editing) {
        await updateInspiration(editing.id, form)
        showToast('Atualizado!')
      } else {
        await addInspiration({ ...form, order: Date.now() })
        showToast('Adicionado!')
      }
      setShowModal(false)
    } catch (e) {
      showToast('Erro ao salvar.', 'error')
    }
  }

  const handleDelete = async (id) => {
    await deleteInspiration(id)
    showToast('Removido.')
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-kicker">Inspirações & Referências</span>
        <h1 className="page-title">Pessoas que<br /><em style={{ fontStyle: 'italic', color: 'var(--text2)' }}>me inspiram</em></h1>
      </div>

      <div className="inspiration-grid">
        {inspirations.map(item => (
          <div key={item.id} className="inspiration-card">
            <div className="card-actions">
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(item)} aria-label="Editar"><RiPencilLine size={14} /></button>
              <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(item.id)} aria-label="Apagar"><RiDeleteBinLine size={14} /></button>
            </div>
            <div className="inspiration-header">
              {item.imageUrl && (
                <div className="inspiration-avatar">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
              )}
              <div className="inspiration-meta">
                <p className="inspiration-name">{item.name}</p>
                <p className="inspiration-role">{item.role}</p>
              </div>
            </div>
            <blockquote className="inspiration-quote">"{item.quote}"</blockquote>
          </div>
        ))}
        {inspirations.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state-icon"><RiUserHeartLine size={32} /></div>
            Nenhuma pessoa adicionada ainda.
          </div>
        )}
        <button className="add-inspiration-btn" onClick={openAdd}>
          <RiAddLine size={18} /> Adicionar pessoa
        </button>
      </div>

      {showModal && (
        <Modal
          title={editing ? 'Editar inspiração' : 'Nova inspiração'}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        >
          <div className="field">
            <label>Nome</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Guilherme Benchimol" />
          </div>
          <div className="field">
            <label>Papel / Empresa</label>
            <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Ex: Fundador da XP" />
          </div>
          <div className="field">
            <label>URL da foto (opcional)</label>
            <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://...jpg" />
          </div>
          {form.imageUrl && (
            <div style={{ marginBottom: 14 }}>
              <img
                src={form.imageUrl}
                alt="preview"
                style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border2)' }}
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            </div>
          )}
          <div className="field">
            <label>Frase</label>
            <textarea rows={3} value={form.quote} onChange={e => setForm(f => ({ ...f, quote: e.target.value }))} placeholder="Frase inspiradora..." />
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
