'use client'

import { useState } from 'react'
import { Botao, Cartao } from '@/componentes/ui'
import c from '../conta.module.css'

// Divulgar (docs/Navalha — Fluxo do dono até o cliente agendar §Fluxo do dono): o link da página
// pública e o QR Code para o balcão ou o espelho. Com o app instalado, o link abre o app.
export function Divulgar({ link, qrCode, slug }: { link: string; qrCode: string; slug: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <Cartao>
      <div className={c.cartaoTitulo}>
        <div>
          <h2>Divulgar a barbearia</h2>
          <p>Mande o link no WhatsApp e no Instagram, ou imprima o QR Code para o balcão.</p>
        </div>
      </div>
      <div className={c.divulgar}>
        {/* eslint-disable-next-line @next/next/no-img-element -- QR Code gerado no servidor, em data URL */}
        <img src={qrCode} alt={`QR Code da página ${link}`} width={160} height={160} />
        <div className={c.formulario}>
          <p className="mono" style={{ wordBreak: 'break-all' }}>
            {link}
          </p>
          <div className={c.acoes} style={{ justifyContent: 'flex-start' }}>
            <Botao
              variante="secundario"
              onClick={async () => {
                await navigator.clipboard.writeText(link)
                setCopiado(true)
              }}
            >
              {copiado ? 'Link copiado ✓' : 'Copiar link'}
            </Botao>
            <a className={c.botaoLink} href={qrCode} download={`qr-code-${slug}.png`}>
              Baixar QR Code
            </a>
          </div>
        </div>
      </div>
    </Cartao>
  )
}
