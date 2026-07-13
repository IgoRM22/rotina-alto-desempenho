import React, { useState, useEffect } from 'react'
import {
  RiAddLine,
  RiBookOpenLine,
  RiDeleteBinLine,
  RiStickyNoteLine,
} from '@remixicon/react'
import {
  listenNotebooks, addNotebook, updateNotebook, deleteNotebook,
  listenNotes, addNote, updateNote, deleteNote,
} from '../services/firestore'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import Tabs from '../components/Tabs'
import InspirationsPanel from '../components/InspirationsPanel'

const IMPORTANCE = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
]

const NB_COLORS = ['#E06445', '#4B8FD4', '#5BA689', '#8B7EC4', '#C49A3A', '#C4607A', '#7A7570']
const EMPTY_NB = { name: '', emoji: '📓', color: NB_COLORS[0] }
const EMPTY_NOTE = { title: '', content: '', importance: 'media', notebookId: null }

export default function Notes() {
  const [section, setSection] = useState('notas')
  const [notebooks, setNotebooks] = useState([])
  const [notes, setNotes] = useState([])
  const [activeNb, setActiveNb] = useState(null)
  const [showNbModal, setShowNbModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [editingNb, setEditingNb] = useState(null)
  const [editingNote, setEditingNote] = useState(null)
  const [nbForm, setNbForm] = useState(EMPTY_NB)
  const [noteForm, setNoteForm] = useState(EMPTY_NOTE)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const u1 = listenNotebooks(setNotebooks)
    const u2 = listenNotes(setNotes)
    return () => { u1(); u2() }
  }, [])

  const visibleNotes = notes
    .filter(n => activeNb ? n.notebookId === activeNb : true)
    .sort((a, b) => {
      const order = { alta: 0, media: 1, baixa: 2 }
      const diff = (order[a.importance] ?? 1) - (order[b.importance] ?? 1)
      if (diff !== 0) return diff
      return (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0)
    })

  const openAddNb = () => { setEditingNb(null); setNbForm(EMPTY_NB); setShowNbModal(true) }
  const openEditNb = (nb) => { setEditingNb(nb); setNbForm({ name: nb.name, emoji: nb.emoji || '📓', color: nb.color || NB_COLORS[0] }); setShowNbModal(true) }

  const handleSaveNb = async () => {
    if (!nbForm.name.trim()) return
    try {
      if (editingNb) { await updateNotebook(editingNb.id, nbForm); showToast('Caderno atualizado!') }
      else { await addNotebook(nbForm); showToast('Caderno criado!') }
      setShowNbModal(false)
    } catch { showToast('Erro ao salvar.', 'error') }
  }

  const handleDeleteNb = async (nb) => {
    await deleteNotebook(nb.id)
    await Promise.all(notes.filter(n => n.notebookId === nb.id).map(n => deleteNote(n.id)))
    if (activeNb === nb.id) setActiveNb(null)
    setShowNbModal(false)
    showToast('Caderno removido.')
  }

  const openAddNote = () => {
    setEditingNote(null)
    setNoteForm({ ...EMPTY_NOTE, notebookId: activeNb })
    setShowNoteModal(true)
  }

  const openEditNote = (note) => {
    setEditingNote(note)
    setNoteForm({ title: note.title || '', content: note.content || '', importance: note.importance || 'media', notebookId: note.notebookId || null })
    setShowNoteModal(true)
  }

  const handleSaveNote = async () => {
    if (!noteForm.title.trim()) return
    try {
      if (editingNote) { await updateNote(editingNote.id, noteForm); showToast('Nota atualizada!') }
      else { await addNote(noteForm); showToast('Nota criada!') }
      setShowNoteModal(false)
    } catch { showToast('Erro ao salvar.', 'error') }
  }

  const handleDeleteNote = async (id) => { await deleteNote(id); showToast('Nota removida.') }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fmtDate = (ts) => {
    if (!ts?.seconds) return ''
    return new Date(ts.seconds * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="page-kicker">Anotações Pessoais</span>
          <h1 className="page-title">Notas</h1>
        </div>
        {section === 'notas' && (
          <button className="btn btn-primary" onClick={openAddNote}>
            <RiAddLine size={15} /> Nova nota
          </button>
        )}
      </div>

      <Tabs
        items={[{ key: 'notas', label: 'Notas' }, { key: 'inspiracoes', label: 'Inspirações' }]}
        active={section}
        onChange={setSection}
      />

      {section === 'inspiracoes' ? (
        <InspirationsPanel />
      ) : (
      <>
      {/* Notebooks bar */}
      <div className="notebooks-bar">
        <button
          className={`notebook-tab ${activeNb === null ? 'active' : ''}`}
          onClick={() => setActiveNb(null)}
        >
          <RiBookOpenLine size={13} /> Todas <span className="nb-count">{notes.length}</span>
        </button>
        {notebooks.map(nb => (
          <button
            key={nb.id}
            className={`notebook-tab ${activeNb === nb.id ? 'active' : ''}`}
            style={activeNb === nb.id ? { '--nb-color': nb.color } : {}}
            onClick={() => setActiveNb(nb.id)}
            onContextMenu={e => { e.preventDefault(); openEditNb(nb) }}
          >
            {nb.emoji} {nb.name}
            <span className="nb-count">{notes.filter(n => n.notebookId === nb.id).length}</span>
          </button>
        ))}
        <button className="notebook-tab-add" onClick={openAddNb}>
          <RiAddLine size={13} /> Caderno
        </button>
      </div>

      {/* Notes grid */}
      {visibleNotes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><RiStickyNoteLine size={32} /></div>
          Nenhuma nota. Clique em "+ Nova nota" para começar.
        </div>
      ) : (
        <div className="notes-grid">
          {visibleNotes.map(note => {
            const nb = notebooks.find(n => n.id === note.notebookId)
            return (
              <div
                key={note.id}
                className="note-card"
                style={{ '--nb-accent': nb?.color || 'var(--border2)' }}
                onClick={() => openEditNote(note)}
              >
                <div className="note-card-accent" />
                <div className="note-card-body">
                  <div className="note-card-top">
                    <span className={`note-imp note-imp-${note.importance || 'media'}`}>
                      {IMPORTANCE.find(i => i.value === note.importance)?.label || 'Média'}
                    </span>
                    {nb && <span className="note-nb-badge">{nb.emoji} {nb.name}</span>}
                  </div>
                  <h3 className="note-title">{note.title}</h3>
                  {note.content && (
                    <p className="note-preview">{note.content.slice(0, 130)}{note.content.length > 130 ? '…' : ''}</p>
                  )}
                  <div className="note-footer">
                    <span className="note-date">{fmtDate(note.updatedAt || note.createdAt)}</span>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      onClick={e => { e.stopPropagation(); handleDeleteNote(note.id) }}
                      aria-label="Apagar nota"
                    >
                      <RiDeleteBinLine size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Notebook modal */}
      {showNbModal && (
        <Modal
          title={editingNb ? 'Editar caderno' : 'Novo caderno'}
          onClose={() => setShowNbModal(false)}
          onSave={handleSaveNb}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 12 }}>
            <div className="field">
              <label>Emoji</label>
              <input value={nbForm.emoji} onChange={e => setNbForm(f => ({ ...f, emoji: e.target.value }))} style={{ textAlign: 'center', fontSize: 20 }} maxLength={2} />
            </div>
            <div className="field">
              <label>Nome</label>
              <input value={nbForm.name} onChange={e => setNbForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Estratégia" />
            </div>
          </div>
          <div className="field">
            <label>Cor</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {NB_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: nbForm.color === c ? '3px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }}
                  onClick={() => setNbForm(f => ({ ...f, color: c }))}
                />
              ))}
            </div>
          </div>
          {editingNb && (
            <button
              className="btn btn-danger"
              style={{ marginTop: 12, width: '100%' }}
              onClick={() => handleDeleteNb(editingNb)}
            >
              <RiDeleteBinLine size={14} /> Excluir caderno e suas notas
            </button>
          )}
        </Modal>
      )}

      {/* Note modal */}
      {showNoteModal && (
        <Modal
          title={editingNote ? 'Editar nota' : 'Nova nota'}
          onClose={() => setShowNoteModal(false)}
          onSave={handleSaveNote}
          wide
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Importância</label>
              <select value={noteForm.importance} onChange={e => setNoteForm(f => ({ ...f, importance: e.target.value }))}>
                {IMPORTANCE.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Caderno</label>
              <select value={noteForm.notebookId || ''} onChange={e => setNoteForm(f => ({ ...f, notebookId: e.target.value || null }))}>
                <option value="">Sem caderno</option>
                {notebooks.map(nb => <option key={nb.id} value={nb.id}>{nb.emoji} {nb.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Título</label>
            <input value={noteForm.title} onChange={e => setNoteForm(f => ({ ...f, title: e.target.value }))} placeholder="Título da nota..." />
          </div>
          <div className="field">
            <label>Conteúdo</label>
            <textarea
              rows={12}
              value={noteForm.content}
              onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Escreva aqui..."
              style={{ fontFamily: 'var(--ff-s)', fontSize: 16, lineHeight: 1.7, minHeight: '45vh' }}
            />
          </div>
        </Modal>
      )}
      </>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
