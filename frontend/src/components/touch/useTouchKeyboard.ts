import { useContext } from 'react'

import { TouchKeyboardContext } from './TouchKeyboardStore'

export function useTouchKeyboard() {
  const context = useContext(TouchKeyboardContext)
  if (!context) {
    throw new Error('useTouchKeyboard deve ser usado dentro de TouchKeyboardProvider.')
  }
  return context
}
