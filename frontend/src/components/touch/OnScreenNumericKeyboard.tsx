import { useTouchKeyboard } from './useTouchKeyboard'

const rows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['0', '00', '.'],
]

export function OnScreenNumericKeyboard() {
  const { append, backspace, clear, confirm } = useTouchKeyboard()

  return (
    <div className="keyboard-grid numeric-grid">
      {rows.map((row) => (
        <div key={row.join('-')} className="keyboard-row">
          {row.map((key) => (
            <button key={key} type="button" className="keyboard-key" onClick={() => append(key)}>
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className="keyboard-row keyboard-row-actions">
        <button type="button" className="keyboard-key keyboard-key-muted" onClick={backspace}>
          Apagar
        </button>
        <button type="button" className="keyboard-key keyboard-key-muted" onClick={clear}>
          Limpar
        </button>
        <button type="button" className="keyboard-key keyboard-key-primary" onClick={confirm}>
          Confirmar
        </button>
      </div>
    </div>
  )
}
