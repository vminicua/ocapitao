import {
  type PropsWithChildren,
  useState,
} from 'react'

import { TouchKeyboardContext, initialState, type KeyboardOptions, type KeyboardState } from './TouchKeyboardStore'

export function TouchKeyboardProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<KeyboardState>(initialState)

  const replace = (value: string) => {
    setState((current) => {
      current.onChange(value)
      return { ...current, value }
    })
  }

  const append = (character: string) => {
    setState((current) => {
      const value = `${current.value}${character}`
      current.onChange(value)
      return { ...current, value }
    })
  }

  const backspace = () => {
    setState((current) => {
      const value = current.value.slice(0, -1)
      current.onChange(value)
      return { ...current, value }
    })
  }

  const clear = () => replace('')
  const close = () => setState(initialState)
  const confirm = () => close()

  const openKeyboard = (options: KeyboardOptions) => {
    setState({
      ...options,
      open: true,
    })
  }

  return (
    <TouchKeyboardContext.Provider
      value={{
        state,
        append,
        backspace,
        clear,
        close,
        confirm,
        openKeyboard,
        replace,
      }}
    >
      {children}
    </TouchKeyboardContext.Provider>
  )
}
