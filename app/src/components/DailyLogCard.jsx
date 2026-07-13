import React, { useEffect, useState } from 'react'
import { listenDailyLog, saveDailyLog } from '../services/firestore'
import { todayKey } from '../utils/date'

const SCALE = [1, 2, 3, 4, 5]

export default function DailyLogCard() {
  const dateKey = todayKey()
  const [log, setLog] = useState(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    const unsub = listenDailyLog(dateKey, (data) => {
      setLog(data)
      setNote(data?.note || '')
    })
    return unsub
  }, [dateKey])

  const setField = (field, value) => {
    saveDailyLog(dateKey, { [field]: value })
  }

  const saveNote = () => {
    if (note !== (log?.note || '')) saveDailyLog(dateKey, { note })
  }

  return (
    <div className="daily-log-card">
      <div className="daily-log-row">
        <span className="daily-log-label">Sono</span>
        <div className="daily-log-scale">
          {SCALE.map(v => (
            <button
              key={v}
              type="button"
              className={`daily-log-dot ${log?.sleepQuality === v ? 'active' : ''}`}
              onClick={() => setField('sleepQuality', v)}
              aria-label={`Sono ${v}/5`}
            >{v}</button>
          ))}
        </div>
      </div>
      <div className="daily-log-row" style={{ marginBottom: 16 }}>
        <span className="daily-log-label">Energia</span>
        <div className="daily-log-scale">
          {SCALE.map(v => (
            <button
              key={v}
              type="button"
              className={`daily-log-dot ${log?.energy === v ? 'active' : ''}`}
              onClick={() => setField('energy', v)}
              aria-label={`Energia ${v}/5`}
            >{v}</button>
          ))}
        </div>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Nota do dia (opcional)</label>
        <textarea
          rows={2}
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={saveNote}
          placeholder="Como foi o dia?"
        />
      </div>
    </div>
  )
}
