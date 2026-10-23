import { Suspense } from 'react'
import { FormularioDeEntrada } from './formulario'

export const metadata = { title: 'Entrar · Navalha' }

// Figma Acessos · Login 01.
export default function Pagina() {
  return (
    <Suspense>
      <FormularioDeEntrada />
    </Suspense>
  )
}
