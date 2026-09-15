import React, { useState } from 'react'
import Tabs from '../components/Tabs'
import Finances from './Finances'
import Alimentacao from './planejar/Alimentacao'

// Dinheiro e comida são as duas rotinas materiais mais chatas de manter em
// dia — juntas na mesma aba (com um seletor por dentro) em vez de espalhadas
// entre "Finanças" no topo e "Alimentação" escondida dentro do Planejar.
export default function VidaPratica() {
  const [subview, setSubview] = useState('financeiro')

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-kicker">Dinheiro & Alimentação</span>
        <h1 className="page-title">Vida Prática</h1>
      </div>

      <Tabs
        variant="segmented"
        items={[{ key: 'financeiro', label: 'Financeiro' }, { key: 'alimentacao', label: 'Alimentação' }]}
        active={subview}
        onChange={setSubview}
      />

      <div style={{ marginTop: 20 }}>
        {subview === 'financeiro' ? <Finances /> : <Alimentacao />}
      </div>
    </div>
  )
}
