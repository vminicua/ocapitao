import { BrandMark } from './BrandMark'

export interface SplashScreenProps {
  cloudStatus?: 'connecting' | 'connected' | 'offline'
}

export function SplashScreen({ cloudStatus }: SplashScreenProps) {
  const statusLabel =
    cloudStatus === 'connected'
      ? 'Cloud ligada.'
      : cloudStatus === 'connecting'
        ? 'A ligar à cloud…'
        : 'Modo local ativo.'

  return (
    <div className="splash-screen" role="status" aria-live="polite">
      <div className="splash-screen__orb" />
      <div className="splash-screen__center">
        <BrandMark />
        <p>Sincronização inteligente, operação local e experiência premium a arrancar.</p>
        <p className="splash-screen__cloud-status">{statusLabel}</p>
      </div>
    </div>
  )
}
