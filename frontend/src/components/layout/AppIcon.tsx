interface AppIconProps {
  name:
    | 'menu'
    | 'dashboard'
    | 'barbershop'
    | 'bar'
    | 'carwash'
    | 'caixa'
    | 'stock'
    | 'reports'
    | 'settings'
    | 'logout'
    | 'switch'
    | 'back'
    | 'cloud'
    | 'user'
    | 'pin'
  className?: string
}

const paths: Record<AppIconProps['name'], string> = {
  menu: 'M4 8h16M4 12h16M4 16h16',
  dashboard:
    'M5 5h6v6H5zM13 5h6v10h-6zM5 13h6v6H5zM13 17h6v2h-6z',
  barbershop:
    'M9 4l6 6-5 5-3-3-3 3 6 5 9-9-6-7-4 0z',
  bar:
    'M7 4h10l-1 5a5 5 0 01-4 4v5h3v2H9v-2h3v-5a5 5 0 01-4-4L7 4z',
  carwash:
    'M6 14a4 4 0 014-4h4a4 4 0 014 4v2H6v-2zm2-6l2-3h4l2 3M8 18h0M16 18h0',
  caixa:
    'M5 7h14v10H5zM8 10h8M8 13h5M7 5h10v2H7z',
  stock:
    'M12 4l8 4-8 4-8-4 8-4zm-8 6l8 4 8-4M4 14l8 4 8-4',
  reports:
    'M6 18V6h12v12M9 14h2M9 11h6M9 8h6',
  settings:
    'M12 8a4 4 0 100 8 4 4 0 000-8zm8 4l-2 1 .2 2.2-2 1.2-1.5-1.7-2 .8-.3 2.2h-2.4l-.3-2.2-2-.8-1.5 1.7-2-1.2.2-2.2-2-1 2-1-.2-2.2 2-1.2 1.5 1.7 2-.8.3-2.2h2.4l.3 2.2 2 .8 1.5-1.7 2 1.2-.2 2.2 2 1z',
  logout: 'M10 6V4H5v16h5v-2M14 8l4 4-4 4M9 12h9',
  switch: 'M7 7h10l-2-2M17 17H7l2 2M17 7l-2-2M7 17l2 2',
  back: 'M15 6l-6 6 6 6M9 12h10',
  cloud:
    'M8 18h8a4 4 0 001-7.9A5.5 5.5 0 006.2 9.5 3.5 3.5 0 008 18z',
  user:
    'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0',
  pin:
    'M9 11V8a3 3 0 116 0v3M8 11h8v9H8zM12 14v2',
}

export function AppIcon({ name, className }: AppIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d={paths[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
