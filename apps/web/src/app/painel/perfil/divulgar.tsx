'use client'

import { Copy, Download } from 'lucide-react'
import { useState } from 'react'
import { Botao, Cartao } from '@/componentes/ui'
import p from './perfil.module.css'

// Divulgar (docs/Navalha — Fluxo do dono até o cliente agendar §Fluxo do dono): o link da página
// pública e o QR Code para o balcão ou o espelho. Com o app instalado, o link abre o app.
export function Divulgar({ link, qrCode, slug }: { link: string; qrCode: string; slug: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <Cartao className={p.cartao}>
      <div>
        <h2 className={p.titulo}>Divulgar a barbearia</h2>
        <p className={p.ajuda}>Mande o link no WhatsApp e no Instagram ou imprima o QR Code.</p>
      </div>
      <div className={p.divulgar}>
        {/* eslint-disable-next-line @next/next/no-img-element -- QR Code gerado no servidor, em data URL */}
        <img src={qrCode} alt={`QR Code da página ${link}`} width={96} height={96} />
        <div className={p.divulgarAcoes}>
          <p className="mono">{link}</p>
          <Botao
            variante="secundario"
            onClick={async () => {
              await navigator.clipboard.writeText(link)
              setCopiado(true)
            }}
          >
            <Copy size={16} strokeWidth={1.75} aria-hidden />
            {copiado ? 'Link copiado' : 'Copiar link'}
          </Botao>
          <a className={p.botaoLink} href={qrCode} download={`qr-code-${slug}.png`}>
            <Download size={16} strokeWidth={1.75} aria-hidden />
            Baixar QR Code
          </a>
        </div>
      </div>
    </Cartao>
  )
}
