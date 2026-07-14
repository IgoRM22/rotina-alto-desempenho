import React, { useEffect, useState } from 'react'
import { RiAddLine, RiCheckLine, RiCloseLine, RiDeleteBinLine, RiPencilLine } from '@remixicon/react'
import { listenMealTables, addMealTable, updateMealTable, deleteMealTable } from '../../services/firestore'
import Toast from '../../components/Toast'

const EMPTY_TABLE_FORM = { time: '', title: '' }
const EMPTY_ITEM_FORM = { quantity: '', name: '', grams: '', type: '' }

const TYPE_OPTIONS = [
  { value: 'proteina', label: 'Proteína', color: '#E06445' },
  { value: 'carboidrato', label: 'Carboidrato', color: '#C49A3A' },
  { value: 'gordura', label: 'Gordura', color: '#8B7EC4' },
  { value: 'fruta', label: 'Fruta', color: '#C4607A' },
  { value: 'vegetal', label: 'Vegetal', color: '#5BA689' },
  { value: 'laticinio', label: 'Laticínio', color: '#4B8FD4' },
  { value: 'bebida', label: 'Bebida', color: '#7A7570' },
  { value: 'outros', label: 'Outros', color: '#7A7570' },
]

const getTypeInfo = (value) => TYPE_OPTIONS.find((entry) => entry.value === value)

const SEED_TABLES = [
  {
    time: '00:00',
    title: 'DISTRIBUIR DURANTE O DIA',
    items: [
      { quantity: '11 Xícaras de chá de 200,00', name: 'ÁGUA', grams: '2.200,00ml', type: 'bebida' },
    ],
  },
  {
    time: '06:00',
    title: 'PRÉ TREINO',
    items: [
      { quantity: '1 Unidade média de 70,00', name: 'BANANA (OU OUTRA FRUTA DA SUA PREFERÊNCIA)', grams: '70,00g', type: 'fruta' },
      { quantity: '1 Xícara de cafézinho de 75,00', name: 'CAFÉ COADO/SOLÚVEL (SEM AÇÚCAR)', grams: '75,00ml', type: 'bebida' },
    ],
  },
  {
    time: '07:00',
    title: 'CAFÉ DA MANHÃ',
    items: [
      { quantity: '1 Unidade de 50,00', name: 'PÃO FRANCÊS | 2FT PÃO DE FORMA INTEGRAL | 1 CS (30G) TAPIOCA | 5CS (100G) CUSCUZ', grams: '50,00g', type: 'carboidrato' },
      { quantity: '1 Unidade média de 50,00', name: 'OVO MEXIDO | 1FT (30G) QUEIJO | 1 CS (30G) CREME DE RICOTA LIGHT', grams: '50,00g', type: 'proteina' },
      { quantity: '1 Caneca de 100,00', name: 'LEITE DESN/SEMI', grams: '100,00ml', type: 'laticinio' },
      { quantity: '1 Xícara de cafézinho de 75,00', name: 'CAFÉ COADO/SOLÚVEL (SEM AÇÚCAR)', grams: '75,00ml', type: 'bebida' },
    ],
  },
  {
    time: '10:00',
    title: 'LANCHE DA MANHÃ',
    items: [
      { quantity: '1 Unidade de 120,00', name: 'MAÇÃ (OU OUTRA FRUTA DA SUA PREFERÊNCIA)', grams: '120,00g', type: 'fruta' },
    ],
  },
  {
    time: '12:00',
    title: 'ALMOÇO',
    items: [
      { quantity: '1 Colher de chá de 5,00', name: 'PARA SALADA: AZEITE + TEMPEROS A GOSTO + POUCO SAL', grams: '5,00ml', type: 'gordura' },
      { quantity: '3 Folhas de 15,00', name: 'SALADA: ALFACE; RÚCULA; AGRIÃO; COUVE; ESPINAFRE (PREFIRA VERDES ESCUROS)', grams: '45,00g', type: 'vegetal' },
      { quantity: '½ Unidade pequena de 70,00', name: 'TOMATE OU PEPINO OU CENOURA', grams: '35,00g', type: 'vegetal' },
      { quantity: '1 Colher de mesa de 50,00', name: 'ABORBINHA; BETERRABA; CHUCHU; BRÓCOLIS; COUVE-FLOR', grams: '50,00g', type: 'vegetal' },
      { quantity: '9 Colheres de sopa de 20,00', name: 'ARROZ | 400G BATATA | 400G MANDIOQUINHA | 100G MACARRÃO', grams: '180,00g', type: 'carboidrato' },
      { quantity: '10 Colheres de sopa de 20,00', name: 'FEIJÃO CARIOCA/PRETO', grams: '200,00g', type: 'carboidrato' },
      { quantity: '1 Porção de 100,00', name: 'FRANGO; CARNE VERM MAGRA (1X/SEM); PEIXE (1X/SEM); OVO (2 UNIDADES)', grams: '100,00g', type: 'proteina' },
      { quantity: '1 Unidade de 120,00', name: 'FRUTA CÍTRICA: LARANJA PERA/LIMA; TANGERINA;KIWI', grams: '120,00g', type: 'fruta' },
    ],
  },
  {
    time: '16:00',
    title: 'LANCHE DA TARDE 1',
    items: [
      { quantity: '1 Unidade de 100,00', name: 'IOGURTE NATURAL | LEITE SEMI/DESN', grams: '100,00ml', type: 'laticinio' },
      { quantity: '1 Unidade média de 70,00', name: 'BANANA (OU OUTRA FRUTA DA SUA PREFERÊNCIA)', grams: '70,00g', type: 'fruta' },
      { quantity: '1 Medidor do produto de 30,00', name: 'WHEY PROTEIN + 3G CREATINA', grams: '30,00g', type: 'proteina' },
    ],
  },
  {
    time: '19:00',
    title: 'JANTAR',
    items: [
      { quantity: '1 Colher de chá de 5,00', name: 'PARA SALADA: AZEITE + TEMPEROS A GOSTO + POUCO SAL', grams: '5,00ml', type: 'gordura' },
      { quantity: '3 Folhas de 15,00', name: 'SALADA: ALFACE; RÚCULA; AGRIÃO; COUVE; ESPINAFRE (PREFIRA VERDES ESCUROS)', grams: '45,00g', type: 'vegetal' },
      { quantity: '½ Unidade pequena de 70,00', name: 'CRU: TOMATE OU PEPINO OU CENOURA', grams: '35,00g', type: 'vegetal' },
      { quantity: '1 Colher de mesa de 50,00', name: 'ABORBINHA; BETERRABA; CHUCHU; BRÓCOLIS; COUVE-FLOR (CRU OU À VAPOR OU REFOGADO)', grams: '50,00g', type: 'vegetal' },
      { quantity: '10 Colheres de sopa de 20,00', name: 'ARROZ | 400G BATATA | 400G MANDIOQUINHA | 100G MACARRÃO', grams: '200,00g', type: 'carboidrato' },
      { quantity: '1 Porção de 100,00', name: 'FRANGO; CARNE VERM MAGRA (1X/SEM); PEIXE (1X/SEM); OVO (2 UNIDADES)', grams: '100,00g', type: 'proteina' },
    ],
  },
  {
    time: '21:00',
    title: 'CEIA 1',
    items: [
      { quantity: '1 Xícara de chá de 200,00', name: 'CHÁ CAMOMILA, CAPIM CIDREIRA, HORTELÃ E ERVA DOCE (DR OETKER)', grams: '200,00ml', type: 'bebida' },
    ],
  },
]

const makeItemId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// "|" no texto marca opções alternativas (substituições) para o mesmo item.
const NameCell = ({ name }) => {
  const options = String(name || '').split('|').map((part) => part.trim()).filter(Boolean)
  if (options.length <= 1) return <>{name}</>

  return (
    <div className="meal-item-options">
      {options.map((option, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="meal-item-or">ou</span>}
          <div className="meal-item-option">{option}</div>
        </React.Fragment>
      ))}
    </div>
  )
}

export default function Alimentacao() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [toast, setToast] = useState(null)

  const [addingTable, setAddingTable] = useState(false)
  const [tableForm, setTableForm] = useState(EMPTY_TABLE_FORM)

  const [editingTableId, setEditingTableId] = useState(null)
  const [editingTableForm, setEditingTableForm] = useState(EMPTY_TABLE_FORM)

  const [addingItemTableId, setAddingItemTableId] = useState(null)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM)

  useEffect(() => {
    const unsub = listenMealTables((data) => { setTables(data); setLoading(false) })
    return unsub
  }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      for (let i = 0; i < SEED_TABLES.length; i++) {
        const table = SEED_TABLES[i]
        await addMealTable({
          time: table.time,
          title: table.title,
          items: table.items.map((item) => ({ id: makeItemId(), ...item })),
          order: i,
        })
      }
      showToast('Plano alimentar carregado!')
    } catch {
      showToast('Erro ao carregar plano.', 'error')
    } finally {
      setSeeding(false)
    }
  }

  const handleAddTable = async () => {
    const title = tableForm.title.trim()
    if (!title) { setAddingTable(false); return }
    await addMealTable({ time: tableForm.time.trim(), title, items: [] })
    setTableForm(EMPTY_TABLE_FORM)
    setAddingTable(false)
    showToast('Tabela criada!')
  }

  const startEditTable = (table) => {
    setEditingTableId(table.id)
    setEditingTableForm({ time: table.time || '', title: table.title || '' })
  }

  const saveEditTable = async () => {
    const title = editingTableForm.title.trim()
    if (title) await updateMealTable(editingTableId, { time: editingTableForm.time.trim(), title })
    setEditingTableId(null)
  }

  const handleDeleteTable = async (table) => {
    const proceed = window.confirm(`Excluir a tabela "${table.title}"? Todos os itens dela serão apagados.`)
    if (!proceed) return
    await deleteMealTable(table.id)
    showToast('Tabela removida.')
  }

  const startAddItem = (tableId) => {
    setAddingItemTableId(tableId)
    setItemForm(EMPTY_ITEM_FORM)
  }

  const handleAddItem = async (table) => {
    const name = itemForm.name.trim()
    if (!name) { setAddingItemTableId(null); return }
    const newItem = { id: makeItemId(), quantity: itemForm.quantity.trim(), name, grams: itemForm.grams.trim(), type: itemForm.type }
    await updateMealTable(table.id, { items: [...(table.items || []), newItem] })
    setAddingItemTableId(null)
    setItemForm(EMPTY_ITEM_FORM)
  }

  const handleDeleteItem = async (table, itemId) => {
    await updateMealTable(table.id, { items: (table.items || []).filter((item) => item.id !== itemId) })
  }

  return (
    <>
      <div className="hoje-section-head">
        <h2 className="hoje-section-title">Alimentação</h2>
        {!addingTable && (
          <button className="btn btn-ghost btn-sm" onClick={() => setAddingTable(true)}>
            <RiAddLine size={14} aria-hidden="true" /> Nova tabela
          </button>
        )}
      </div>

      {addingTable && (
        <div className="meal-add-table-row">
          <input
            value={tableForm.time}
            onChange={(e) => setTableForm((prev) => ({ ...prev, time: e.target.value }))}
            placeholder="Horário (ex: 12:00)"
            style={{ maxWidth: 140 }}
          />
          <input
            autoFocus
            value={tableForm.title}
            onChange={(e) => setTableForm((prev) => ({ ...prev, title: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTable()}
            placeholder="Nome da tabela (ex: Almoço)"
          />
          <button className="btn btn-primary btn-sm btn-icon" onClick={handleAddTable} aria-label="Salvar"><RiCheckLine size={14} /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setAddingTable(false); setTableForm(EMPTY_TABLE_FORM) }} aria-label="Cancelar"><RiCloseLine size={14} /></button>
        </div>
      )}

      {!loading && tables.length === 0 && !addingTable && (
        <div className="empty-state">
          Nenhuma tabela de alimentação ainda.
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSeed} disabled={seeding}>
              {seeding ? 'Carregando...' : 'Carregar plano da consulta (11/07/2026)'}
            </button>
          </div>
        </div>
      )}

      {tables.map((table) => (
        <div key={table.id} className="meal-table-card">
          <div className="meal-table-header">
            {editingTableId === table.id ? (
              <>
                <input
                  className="inline-edit-input"
                  value={editingTableForm.time}
                  onChange={(e) => setEditingTableForm((prev) => ({ ...prev, time: e.target.value }))}
                  placeholder="Horário"
                  style={{ maxWidth: 90 }}
                />
                <input
                  className="inline-edit-input"
                  autoFocus
                  value={editingTableForm.title}
                  onChange={(e) => setEditingTableForm((prev) => ({ ...prev, title: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && saveEditTable()}
                  placeholder="Nome da tabela"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary btn-sm btn-icon" onClick={saveEditTable} aria-label="Salvar"><RiCheckLine size={13} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditingTableId(null)} aria-label="Cancelar"><RiCloseLine size={13} /></button>
              </>
            ) : (
              <>
                {table.time && <span className="meal-table-time">{table.time}</span>}
                <span className="meal-table-title">{table.title}</span>
                <div className="meal-table-actions">
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => startEditTable(table)} aria-label="Editar tabela"><RiPencilLine size={13} /></button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteTable(table)} aria-label="Excluir tabela"><RiDeleteBinLine size={13} /></button>
                </div>
              </>
            )}
          </div>

          <table className="meal-table">
            <thead>
              <tr>
                <th>Quantidade</th>
                <th>Nome / Descrição</th>
                <th>Tipo</th>
                <th className="meal-col-grams">Gramas</th>
                <th className="meal-col-actions" />
              </tr>
            </thead>
            <tbody>
              {(table.items || []).map((item) => {
                const typeInfo = getTypeInfo(item.type)
                return (
                  <tr key={item.id} className="meal-item-row">
                    <td>{item.quantity}</td>
                    <td className="meal-col-name"><NameCell name={item.name} /></td>
                    <td>
                      {typeInfo && (
                        <span className="pill" style={{ color: typeInfo.color, background: `${typeInfo.color}22`, border: `1px solid ${typeInfo.color}55` }}>
                          {typeInfo.label}
                        </span>
                      )}
                    </td>
                    <td className="meal-col-grams">{item.grams}</td>
                    <td className="meal-col-actions">
                      <button className="btn btn-danger btn-sm btn-icon meal-item-delete" onClick={() => handleDeleteItem(table, item.id)} aria-label="Excluir item">
                        <RiDeleteBinLine size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}

              {(table.items || []).length === 0 && addingItemTableId !== table.id && (
                <tr>
                  <td colSpan={5} className="empty-state" style={{ padding: '14px 0' }}>Nenhum item nesta tabela.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="meal-table-footer">
            {addingItemTableId === table.id ? (
              <div className="meal-add-item-row">
                <input
                  autoFocus
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  placeholder="Quantidade (ex: 1 unidade de 50,00)"
                />
                <input
                  value={itemForm.name}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem(table)}
                  placeholder="Nome / descrição"
                />
                <select
                  value={itemForm.type}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, type: e.target.value }))}
                  style={{ maxWidth: 150 }}
                >
                  <option value="">Tipo...</option>
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <input
                  value={itemForm.grams}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, grams: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem(table)}
                  placeholder="Gramas (ex: 50,00g)"
                  style={{ maxWidth: 130 }}
                />
                <button className="btn btn-primary btn-sm btn-icon" onClick={() => handleAddItem(table)} aria-label="Salvar"><RiCheckLine size={14} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setAddingItemTableId(null)} aria-label="Cancelar"><RiCloseLine size={14} /></button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => startAddItem(table.id)}>
                <RiAddLine size={14} aria-hidden="true" /> Adicionar item
              </button>
            )}
          </div>
        </div>
      ))}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )
}
