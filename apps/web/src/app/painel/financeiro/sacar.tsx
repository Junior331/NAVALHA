'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Botao, Campo, Mensagem, Modal } from '@/componentes/ui'
import { reais } from '@/lib/formato'
import { api, ErroDaApi } from '@/lib/supabase'

// Saque manual do disponível, mínimo de R$ 50 (regras-de-negocio §Decisões), por Pix para a
// chave cadastrada na ativação dos recebimentos.
export function Sacar({
  barbeariaId,
  disponivel,
  minimo,
  liberado,
}: {
  barbeariaId: string
  disponivel: number
  minimo: number
  liberado: boolean
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<number | null>(null)

  const centavos = Math.round(Number(valor.replace(/\./g, '').replace(',', '.')) * 100) || 0
  const motivo =
    centavos === 0
      ? null
      : centavos < minimo
        ? `O saque mínimo é de ${reais(minimo)}`
        : centavos > disponivel
          ? `Você pode sacar até ${reais(disponivel)}`
          : null
  const podeSacar = liberado && disponivel >= minimo

  function fechar() {
    setAberto(false)
    setValor('')
    setErro(null)
    if (feito !== null) router.refresh()
    setFeito(null)
  }

  async function sacar() {
    setEnviando(true)
    setErro(null)
    try {
      await api(`/api/barbearias/${barbeariaId}/saques`, { corpo: { valorCentavos: centavos } })
      setFeito(centavos)
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível sacar agora.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
        <Botao onClick={() => setAberto(true)} disabled={!podeSacar}>
          Sacar
        </Botao>
        {!podeSacar ? (
          <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>
            {liberado
              ? `Saque a partir de ${reais(minimo)} disponíveis`
              : 'Liberado após a análise'}
          </span>
        ) : null}
      </div>
      <Modal
        aberto={aberto}
        aoFechar={fechar}
        titulo={feito !== null ? 'Saque enviado' : 'Sacar'}
        descricao={feito !== null ? undefined : `Disponível: ${reais(disponivel)}`}
        rodape={
          feito !== null ? (
            <Botao onClick={fechar}>Fechar</Botao>
          ) : (
            <>
              <Botao variante="secundario" onClick={fechar}>
                Cancelar
              </Botao>
              <Botao onClick={sacar} disabled={enviando || centavos === 0 || motivo !== null}>
                {enviando ? 'Enviando…' : 'Sacar por Pix'}
              </Botao>
            </>
          )
        }
      >
        {feito !== null ? (
          <Mensagem tipo="sucesso">
            {reais(feito)} a caminho da chave Pix da barbearia. Costuma cair em poucos minutos.
          </Mensagem>
        ) : (
          <>
            <Campo
              rotulo="Valor (R$)"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              erro={motivo}
              ajuda={`Mínimo de ${reais(minimo)}. Cai na chave Pix cadastrada na ativação.`}
              autoFocus
            />
            <Botao
              variante="fantasma"
              onClick={() => setValor((disponivel / 100).toFixed(2).replace('.', ','))}
            >
              Sacar tudo ({reais(disponivel)})
            </Botao>
            {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
          </>
        )}
      </Modal>
    </>
  )
}
