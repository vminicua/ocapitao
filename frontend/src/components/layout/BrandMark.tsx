import { useState } from 'react'

const BRAND_LOGO_SRC = '/branding/ocapitao-logo.png'

interface BrandMarkProps {
  compact?: boolean
  iconOnly?: boolean
}

export function BrandMark({ compact = false, iconOnly = false }: BrandMarkProps) {
  const [logoMissing, setLogoMissing] = useState(false)

  return (
    <div className={`brand-mark ${compact ? 'is-compact' : ''} ${iconOnly ? 'is-icon-only' : ''}`}>
      <div className={`brand-mark__seal ${logoMissing ? '' : 'has-logo'}`}>
        {logoMissing ? (
          <span>C</span>
        ) : (
          <img
            src={BRAND_LOGO_SRC}
            alt="O Capitão"
            className="brand-mark__logo"
            onError={() => setLogoMissing(true)}
          />
        )}
      </div>
      <div className="brand-mark__copy">
        <strong>O Capitão</strong>
        <small>Barbershop Desktop</small>
      </div>
    </div>
  )
}
