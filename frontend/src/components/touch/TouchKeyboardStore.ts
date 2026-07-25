import { createContext } from 'react'

export type KeyboardMode = 'text' | 'numeric'

export interface KeyboardOptions {
  label: string
  mode: KeyboardMode
  value: string
  onChange: (value: string) => void
}

export interface KeyboardState extends KeyboardOptions {
  open: boolean
}

export interface TouchKeyboardContextValue {
  state: KeyboardState
  append: (character: string) => void
  backspace: () => void
  clear: () => void
  close: () => void
  confirm: () => void
  openKeyboard: (options: KeyboardOptions) => void
  replace: (value: string) => void
}

export const initialState: KeyboardState = {
  open: false,
  label: '',
  mode: 'text',
  value: '',
  onChange: () => undefined,
}

export const TouchKeyboardContext = createContext<TouchKeyboardContextValue | null>(null)
