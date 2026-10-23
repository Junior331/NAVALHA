// Marca do Navalha: três lâminas no laranja da marca, com 100%, 50% e 20% de opacidade.
// Mesmo desenho do favicon (app/icon.svg) e dos ícones do app (apps/mobile/assets).
export function Logo({ tamanho = 32, titulo }: { tamanho?: number; titulo?: string }) {
  return (
    <svg
      viewBox="0 0 32 22"
      width={tamanho}
      height={(tamanho * 22) / 32}
      fill="#F27508"
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      <rect width="22.7" height="6" y="-3" rx="1.6" transform="translate(1.97 2.4) rotate(50.4)" />
      <rect
        width="15.9"
        height="6"
        y="-3"
        rx="1.6"
        fillOpacity=".5"
        transform="translate(12.54 2.4) rotate(50.4)"
      />
      <rect
        width="8.8"
        height="6"
        y="-3"
        rx="1.6"
        fillOpacity=".2"
        transform="translate(23.04 2.4) rotate(50.4)"
      />
    </svg>
  )
}
