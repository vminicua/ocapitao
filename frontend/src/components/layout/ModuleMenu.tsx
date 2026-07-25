import type { ModuleId } from '../../types/models'

interface ModuleMenuProps {
  onSelect: (moduleId: ModuleId) => void
  visibleModules?: Array<Exclude<ModuleId, 'menu'>>
}

const moduleCards: Array<{
  id: Exclude<ModuleId, 'menu'>
  title: string
  iconSrc: string
  tone: string
}> = [
  {
    id: 'barbershop',
    title: 'Barbershop',
    iconSrc: '/branding/icons/barber-pole-svgrepo-com.svg',
    tone: 'tone-lime',
  },
  {
    id: 'bar',
    title: 'Bar',
    iconSrc: '/branding/icons/beer-svgrepo-com.svg',
    tone: 'tone-mint',
  },
  {
    id: 'carwash',
    title: 'Carwash',
    iconSrc: '/branding/icons/car-wash-svgrepo-com.svg',
    tone: 'tone-aqua',
  },
  {
    id: 'caixa',
    title: 'Finanças',
    iconSrc: '/branding/icons/master-card-svgrepo-com.svg',
    tone: 'tone-peach',
  },
  {
    id: 'stock',
    title: 'Stock',
    iconSrc: '/branding/icons/stock-movement-svgrepo-com.svg',
    tone: 'tone-lilac',
  },
  {
    id: 'customers',
    title: 'Clientes',
    iconSrc: '/branding/icons/customers-svgrepo-com.svg',
    tone: 'tone-gold',
  },
  {
    id: 'reports',
    title: 'Relatórios',
    iconSrc: '/branding/icons/report-svgrepo-com.svg',
    tone: 'tone-sky',
  },
  {
    id: 'settings',
    title: 'Configurações',
    iconSrc: '/branding/icons/settings-svgrepo-com.svg',
    tone: 'tone-rose',
  },
]

export function ModuleMenu({ onSelect, visibleModules }: ModuleMenuProps) {
  const filteredModules = visibleModules?.length
    ? moduleCards.filter((item) => visibleModules.includes(item.id))
    : moduleCards

  return (
    <section className="module-menu">
      <div className="module-menu__grid">
        {filteredModules.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`module-card module-card--tile ${item.tone}`}
            onClick={() => onSelect(item.id)}
          >
            <div className="module-card__icon">
              <img src={item.iconSrc} alt="" className="module-card__icon-image" draggable="false" aria-hidden="true" />
            </div>
            <div className="module-card__copy">
              <strong>{item.title}</strong>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
