import React, { useState, useRef, useEffect } from 'react'
import {
  exportAll,
  importAll,
  listenTodoCategories,
  saveTodoCategories,
  listenScheduleCategories,
  saveScheduleCategories,
  listenGoalCategories,
  saveGoalCategories,
  replaceScheduleCategoryInItems,
  listenAccessControl,
  updateAllowedEmails,
} from '../services/firestore'
import { useAuth } from '../context/AuthContext'
import Toast from '../components/Toast'

export default function Settings() {
  const { user, logout } = useAuth()
  const [toast, setToast] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()
  const schedColorRefs = useRef({})
  const newSchedColorRef = useRef()
  const [categories, setCategories] = useState([])
  const [newCat, setNewCat] = useState('')
  const [scheduleCategories, setScheduleCategories] = useState([])
  const [newSchedCatValue, setNewSchedCatValue] = useState('')
  const [newSchedCatColor, setNewSchedCatColor] = useState('#E06445')
  const [goalCategories, setGoalCategories] = useState([])
  const [newGoalCat, setNewGoalCat] = useState('')
  const [accessControl, setAccessControl] = useState(null)
  const [newAllowedEmail, setNewAllowedEmail] = useState('')

  useEffect(() => {
    const u1 = listenTodoCategories(setCategories)
    const u2 = listenScheduleCategories(setScheduleCategories)
    const u3 = listenGoalCategories(setGoalCategories)
    const u4 = listenAccessControl(setAccessControl)
    return () => { u1(); u2(); u3(); u4() }
  }, [])

  const addCategory = async () => {
    const v = newCat.trim().toLowerCase()
    if (!v || categories.includes(v)) return
    await saveTodoCategories([...categories, v])
    setNewCat('')
  }

  const removeCategory = async (cat) => {
    const ok = window.confirm(`Apagar a categoria "${cat}"? Essa alteracao sera salva no banco de dados.`)
    if (!ok) return
    await saveTodoCategories(categories.filter(c => c !== cat))
    showToast('Categoria removida do banco de dados.')
  }

  const addSchedCategory = async () => {
    const v = newSchedCatValue.trim().toLowerCase()
    if (!v || scheduleCategories.some(c => c.value === v)) return
    await saveScheduleCategories([...scheduleCategories, { value: v, color: newSchedCatColor }])
    setNewSchedCatValue('')
    setNewSchedCatColor('#E06445')
  }

  const removeSchedCategory = async (val) => {
    if (scheduleCategories.length <= 1) {
      showToast('Mantenha pelo menos 1 categoria no cronograma.', 'error')
      return
    }

    const remaining = scheduleCategories.filter(c => c.value !== val)
    const fallback = remaining[0]?.value || 'projeto'
    const ok = window.confirm(
      `Apagar a categoria "${val}"?\n\nIsso remove a categoria do banco de dados e move itens existentes para "${fallback}".`,
    )
    if (!ok) return

    const movedCount = await replaceScheduleCategoryInItems(val, fallback)
    await saveScheduleCategories(remaining)
    showToast(
      movedCount > 0
        ? `Categoria removida. ${movedCount} item(ns) foram movidos para "${fallback}".`
        : 'Categoria removida do banco de dados.',
    )
  }

  const updateSchedCategoryColor = async (val, color) => {
    await saveScheduleCategories(
      scheduleCategories.map((cat) => (cat.value === val ? { ...cat, color } : cat)),
    )
  }

  const normalizeSchedColor = (color) => {
    const safe = String(color || '').trim()
    if (/^#[0-9a-fA-F]{6}$/.test(safe)) return safe.toUpperCase()
    return '#E06445'
  }

  const openSchedColorPicker = (value) => {
    schedColorRefs.current[value]?.click()
  }

  const openNewSchedColorPicker = () => {
    newSchedColorRef.current?.click()
  }

  const addGoalCategory = async () => {
    const v = newGoalCat.trim().toLowerCase()
    if (!v || goalCategories.includes(v)) return
    await saveGoalCategories([...goalCategories, v])
    setNewGoalCat('')
  }

  const removeGoalCategory = async (cat) => {
    const ok = window.confirm(`Apagar a categoria "${cat}"? Essa alteracao sera salva no banco de dados.`)
    if (!ok) return
    await saveGoalCategories(goalCategories.filter(c => c !== cat))
    showToast('Categoria removida do banco de dados.')
  }

  const handleLogout = async () => {
    const ok = window.confirm('Deseja sair da conta agora?')
    if (!ok) return
    await logout()
  }

  const isAdmin = accessControl?.adminEmail && accessControl.adminEmail === user?.email?.toLowerCase()

  const addAllowedEmail = async () => {
    const email = newAllowedEmail.trim().toLowerCase()
    if (!email || accessControl?.allowedEmails?.includes(email)) return
    try {
      await updateAllowedEmails([...(accessControl?.allowedEmails ?? []), email])
      setNewAllowedEmail('')
      showToast('E-mail adicionado com sucesso.')
    } catch {
      showToast('Erro ao salvar. Verifique se você é o administrador.', 'error')
    }
  }

  const removeAllowedEmail = async (email) => {
    const ok = window.confirm(`Remover acesso de "${email}"?`)
    if (!ok) return
    try {
      await updateAllowedEmails((accessControl?.allowedEmails ?? []).filter(e => e !== email))
      showToast('Acesso removido.')
    } catch {
      showToast('Erro ao remover. Verifique se você é o administrador.', 'error')
    }
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleExport = async () => {
    try {
      const data = await exportAll()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rotina-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Backup exportado com sucesso!')
    } catch (e) {
      showToast('Erro ao exportar: ' + e.message, 'error')
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const proceed = window.confirm(
      'Importar backup pode sobrescrever dados existentes. Deseja continuar?',
    )
    if (!proceed) {
      e.target.value = ''
      return
    }

    setImporting(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      await importAll(json)
      showToast('Dados importados com sucesso!')
    } catch (e) {
      showToast('Erro ao importar: verifique o arquivo JSON. ' + e.message, 'error')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-kicker">Configurações</span>
        <h1 className="page-title">Configurações</h1>
      </div>

      {/* Account */}
      <div className="settings-section">
        <h2 className="settings-section-title">Conta</h2>
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Usuário autenticado</h4>
            <p>{user?.email}</p>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>UID</h4>
            <p style={{ fontFamily: 'monospace', fontSize: 12 }}>{user?.uid}</p>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Encerrar sessão</h4>
            <p>Você precisará fazer login novamente.</p>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout}>Sair</button>
        </div>
      </div>

      {/* Access Control */}
      {accessControl && (
        <div className="settings-section">
          <h2 className="settings-section-title">Controle de Acesso</h2>
          {!accessControl.exists && (
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>
              Documento de controle não encontrado em <code>system/accessControl</code>.
            </p>
          )}
          {accessControl.exists && (
            <>
              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>Administrador</h4>
                  <p style={{ fontFamily: 'monospace', fontSize: 12 }}>{accessControl.adminEmail || '—'}</p>
                </div>
              </div>
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                <div className="settings-row-info">
                  <h4>E-mails com acesso</h4>
                  <p style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {isAdmin ? 'Apenas o administrador pode adicionar ou remover.' : 'Visível apenas para leitura.'}
                  </p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(accessControl.allowedEmails ?? []).map(email => (
                    <div key={email} className="cat-tag">
                      <span style={{ fontSize: 12 }}>{email}</span>
                      {isAdmin && (
                        <button className="cat-tag-remove" onClick={() => removeAllowedEmail(email)}>×</button>
                      )}
                    </div>
                  ))}
                  {accessControl.allowedEmails?.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhum e-mail autorizado.</p>
                  )}
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <input
                      className="cat-input"
                      type="email"
                      value={newAllowedEmail}
                      onChange={e => setNewAllowedEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addAllowedEmail()}
                      placeholder="novo@email.com"
                    />
                    <button className="btn btn-primary" onClick={addAllowedEmail}>Adicionar</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Backup */}
      <div className="settings-section">
        <h2 className="settings-section-title">Backup & Restauração</h2>

        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Exportar tudo</h4>
            <p>Baixa um arquivo JSON com todas as suas inspirações, tarefas, metas e cronograma.</p>
          </div>
          <button className="btn btn-primary" onClick={handleExport}>
            ↓ Exportar JSON
          </button>
        </div>

        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Importar backup</h4>
            <p>Faz upload de um JSON exportado anteriormente. Dados existentes com mesmo ID serão sobrescritos.</p>
          </div>
          {/* marker for categories section injection */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
            <button
              className="btn btn-ghost"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? 'Importando...' : '↑ Importar JSON'}
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="settings-section">
        <h2 className="settings-section-title">Categorias de Tarefas</h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
          Categorias usadas nas tarefas. Edite à vontade — as mudanças refletem em tempo real.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {categories.map(cat => (
            <div key={cat} className="cat-tag">
              <span>{cat}</span>
              <button className="cat-tag-remove" onClick={() => removeCategory(cat)}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="cat-input"
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            placeholder="Nova categoria..."
          />
          <button className="btn btn-primary" onClick={addCategory}>Adicionar</button>
        </div>
      </div>

      {/* Schedule Categories */}
      <div className="settings-section">
        <h2 className="settings-section-title">Categorias do Cronograma</h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
          Categorias usadas nos eventos do cronograma. Clique no nome da categoria para trocar a cor.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {scheduleCategories.map(cat => (
            <div key={cat.value} className="cat-tag">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => openSchedColorPicker(cat.value)}
                title={`Alterar cor de ${cat.value}`}
                style={{
                  padding: '0',
                  fontSize: 13,
                  color: normalizeSchedColor(cat.color),
                  border: 'none',
                  background: 'transparent',
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                }}
              >
                {cat.value}
              </button>
              <input
                ref={(el) => {
                  if (el) schedColorRefs.current[cat.value] = el
                  else delete schedColorRefs.current[cat.value]
                }}
                type="color"
                value={normalizeSchedColor(cat.color)}
                onChange={(e) => updateSchedCategoryColor(cat.value, e.target.value)}
                title={`Cor de ${cat.value}`}
                style={{ display: 'none' }}
              />
              <button className="cat-tag-remove" onClick={() => removeSchedCategory(cat.value)}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="cat-input"
            value={newSchedCatValue}
            onChange={e => setNewSchedCatValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSchedCategory()}
            placeholder="nova categoria (ex: treino)"
            style={{ flex: '1 1 160px' }}
          />
          <input
            ref={newSchedColorRef}
            type="color"
            value={normalizeSchedColor(newSchedCatColor)}
            onChange={e => setNewSchedCatColor(e.target.value)}
            title="Cor da nova categoria"
            style={{ display: 'none' }}
          />
          <button
            className="btn btn-ghost"
            type="button"
            onClick={openNewSchedColorPicker}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}
            title="Cor da nova categoria"
          >
            <span style={{
              display: 'inline-block',
              width: 20,
              height: 20,
              borderRadius: 4,
              background: normalizeSchedColor(newSchedCatColor),
              border: '1px solid rgba(128,128,128,0.3)',
              flexShrink: 0,
            }} />
          </button>
          <button className="btn btn-primary" onClick={addSchedCategory}>Adicionar</button>
        </div>
      </div>

      {/* Goal Categories */}
      <div className="settings-section">
        <h2 className="settings-section-title">Categorias das Metas</h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
          Categorias usadas nas metas e objetivos.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {goalCategories.map(cat => (
            <div key={cat} className="cat-tag">
              <span>{cat}</span>
              <button className="cat-tag-remove" onClick={() => removeGoalCategory(cat)}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="cat-input"
            value={newGoalCat}
            onChange={e => setNewGoalCat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addGoalCategory()}
            placeholder="Nova categoria..."
          />
          <button className="btn btn-primary" onClick={addGoalCategory}>Adicionar</button>
        </div>
      </div>

      {/* PWA */}
      <div className="settings-section">
        <h2 className="settings-section-title">App</h2>
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Instalar como app</h4>
            <p>No mobile: toque em "Adicionar à tela inicial". No desktop: clique no ícone de instalar na barra de endereço.</p>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Versão</h4>
            <p>1.0.0 — Rotina</p>
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
