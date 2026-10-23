'use client'

import { useRouter } from 'next/navigation'
import { FormularioDeRecebimentos } from './formulario'

// Depois de ativar, a página do servidor mostra o estado novo (e o aviso do topo some).
export function AtivacaoDoPainel({
  barbeariaId,
  emailInicial,
}: {
  barbeariaId: string
  emailInicial: string
}) {
  const router = useRouter()
  return (
    <FormularioDeRecebimentos
      barbeariaId={barbeariaId}
      emailInicial={emailInicial}
      aoAtivar={() => router.refresh()}
    />
  )
}
