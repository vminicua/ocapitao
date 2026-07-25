import { OnScreenNumericKeyboard } from './OnScreenNumericKeyboard'
import { useTouchKeyboard } from './useTouchKeyboard'

const rows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ç'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '@', '.', '-'],
  ['á', 'é', 'í', 'ó', 'ú', 'ã', 'õ', '/', ':', ','],
]

export function OnScreenKeyboard() {
  const { state, append, backspace, clear, close, confirm } = useTouchKeyboard()

  if (!state.open) {
    return null
  }

  return (
    <div className="keyboard-overlay" role="presentation" onClick={close}>
      <div className="keyboard-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="keyboard-header">
          <div>
            <p className="eyebrow">Teclado virtual</p>
            <h3>{state.label}</h3>
          </div>
          <button type="button" className="ghost-button" onClick={close}>
            Fechar
          </button>
        </div>

        <div className="keyboard-display">{state.value || 'Escreva aqui...'}</div>

        {state.mode === 'numeric' ? (
          <OnScreenNumericKeyboard />
        ) : (
          <div className="keyboard-grid">
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
              <button type="button" className="keyboard-key keyboard-key-wide" onClick={() => append(' ')}>
                Espaço
              </button>
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
        )}
      </div>
    </div>
  )
}
