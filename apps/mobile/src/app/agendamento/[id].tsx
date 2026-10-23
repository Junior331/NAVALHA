import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import {
  Botao,
  Campo,
  Cartao,
  Carregando,
  Etiqueta,
  Linha,
  Mensagem,
  Opcao,
  Subtitulo,
  Tela,
  Texto,
  Titulo,
} from '../../componentes/ui'
import { api, mensagemDe } from '../../lib/api'
import { dataLonga, hora, reais } from '../../lib/formato'
import { pixGuardado } from '../../lib/pix'
import { config } from '../../lib/supabase'
import { STATUS, type PreviaCancelamento, type Situacao } from '../../lib/tipos'
import { useCores } from '../../tema'

// Figma Cliente 11 (Pix), 12 (sucesso, com a variação Reservado do cartão), 14 (detalhe),
// 15 (cancelar com a política da barbearia) e 16 (avaliar).
export default function Agendamento() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const c = useCores()
  const [situacao, setSituacao] = useState<Situacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [acao, setAcao] = useState<'nenhuma' | 'cancelar' | 'avaliar'>('nenhuma')
  const [previa, setPrevia] = useState<PreviaCancelamento | null>(null)
  const [escolhaPix, setEscolhaPix] = useState<'credito' | 'reembolso'>('credito')
  const [nota, setNota] = useState(5)
  const [comentario, setComentario] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
  const pix = pixGuardado(id)

  // Enquanto o Pix não cai, consulta a cada 3s; depois para.
  useEffect(() => {
    let ativo = true
    const verificar = async () => {
      try {
        const r = await api<Situacao>(`/api/agendamentos/${id}`)
        if (!ativo) return
        setSituacao(r)
        if (r.tipo !== 'reserva') clearInterval(intervalo)
      } catch (e) {
        if (ativo) setErro(mensagemDe(e))
        clearInterval(intervalo)
      }
    }
    const intervalo = setInterval(verificar, 3000)
    void verificar()
    return () => {
      ativo = false
      clearInterval(intervalo)
    }
  }, [id, versao])

  async function executar(fn: () => Promise<void>) {
    setOcupado(true)
    setErro(null)
    try {
      await fn()
    } catch (e) {
      setErro(mensagemDe(e))
    } finally {
      setOcupado(false)
    }
  }

  if (!situacao) {
    return (
      <Tela rolar={false}>{erro ? <Mensagem tipo="erro">{erro}</Mensagem> : <Carregando />}</Tela>
    )
  }

  if (situacao.tipo === 'expirado') {
    return (
      <Tela>
        <Titulo>O Pix expirou</Titulo>
        <Texto>O horário foi liberado e nada foi cobrado. Você pode agendar de novo.</Texto>
      </Tela>
    )
  }

  if (situacao.tipo === 'reserva') {
    return (
      <Tela>
        <Titulo>Pague com Pix para confirmar</Titulo>
        <Texto suave>O horário fica reservado até {hora(situacao.reservadoAte)}.</Texto>
        {pix ? (
          <Cartao estilo={{ alignItems: 'center' }}>
            <Image
              source={{ uri: `data:image/png;base64,${pix.qrCodeBase64}` }}
              style={{ width: 220, height: 220, backgroundColor: '#fff' }}
              accessibilityLabel="QR Code do Pix"
            />
            <Text style={{ color: c.texto, fontSize: 24, fontWeight: '700' }}>
              {reais(pix.valorPagoCentavos)}
            </Text>
            <Texto pequeno suave>
              O código vale até {hora(pix.qrCodeExpiraEm)}.
            </Texto>
            <Botao
              variante="secundario"
              onPress={async () => {
                await Clipboard.setStringAsync(pix.copiaECola)
                setCopiado(true)
              }}
            >
              {copiado ? 'Código copiado ✓' : 'Copiar código Pix'}
            </Botao>
          </Cartao>
        ) : (
          <Mensagem tipo="info">Pague o Pix copiado no app do seu banco.</Mensagem>
        )}
        <Texto suave>Aguardando o pagamento… esta tela atualiza sozinha.</Texto>
        {config.simularPix ? (
          <Botao
            variante="secundario"
            carregando={ocupado}
            onPress={() =>
              executar(async () => {
                await api(`/api/dev/pix/${id}`, { metodo: 'POST', corpo: {} })
                setVersao((v) => v + 1)
              })
            }
          >
            Simular pagamento do Pix (teste)
          </Botao>
        ) : null}
        {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      </Tela>
    )
  }

  const s = situacao
  const status = STATUS[s.status]
  const ativo = s.status === 'confirmado' || s.status === 'reservado'
  const cartao = `Cartão final ${s.cartaoFinal ?? '····'}`
  const pagamento =
    s.valorPagoCentavos === 0
      ? 'Sem cobrança'
      : s.meio === 'pix'
        ? `Pix de ${reais(s.valorPagoCentavos)} pago`
        : s.status === 'reservado' && s.preAutorizarEm && s.cobrancaEm
          ? `${cartao}: validado em ${dataLonga(s.preAutorizarEm)} e cobrado em ${dataLonga(s.cobrancaEm)}`
          : s.cobrancaEm
            ? `${cartao} garantido · cobrança em ${dataLonga(s.cobrancaEm)}, ${hora(s.cobrancaEm)}`
            : cartao

  return (
    <Tela>
      <Etiqueta tom={status.tom}>{status.rotulo}</Etiqueta>
      <Titulo>
        {dataLonga(s.inicio)}, {hora(s.inicio)}
      </Titulo>
      <Cartao>
        <Linha rotulo="Código" valor={s.codigo} />
        <Linha rotulo="Serviços" valor={s.servicos.join(' + ')} />
        <Linha rotulo="Profissional" valor={s.barbeiro} />
        <Linha rotulo="Pagamento" valor={pagamento} />
      </Cartao>
      {s.status === 'reservado' ? (
        <Mensagem tipo="info">
          Nada foi cobrado ainda. Se a validação do cartão falhar, avisamos e você tem 12 horas para
          trocar o cartão ou pagar com Pix.
        </Mensagem>
      ) : null}
      {s.status === 'liberado' ? (
        <Mensagem tipo="info">
          O cartão não foi validado e o pagamento não foi regularizado a tempo: o horário foi
          liberado e ninguém pagou nada.
        </Mensagem>
      ) : null}
      {s.regularizarAte ? (
        <Mensagem tipo="erro">
          Não conseguimos validar o seu cartão. Regularize até {hora(s.regularizarAte)} de{' '}
          {dataLonga(s.regularizarAte)}, falando com a barbearia ou agendando com Pix.
        </Mensagem>
      ) : null}
      {ativo ? (
        <Texto suave>
          Cancelamento grátis até {dataLonga(s.prazoGratisAte)}, {hora(s.prazoGratisAte)}.
        </Texto>
      ) : null}
      {aviso ? <Mensagem tipo="sucesso">{aviso}</Mensagem> : null}

      {ativo && acao === 'nenhuma' ? (
        <Botao
          variante="perigo"
          onPress={() =>
            executar(async () => {
              setPrevia(await api<PreviaCancelamento>(`/api/agendamentos/${id}/cancelamento`))
              setAcao('cancelar')
            })
          }
          carregando={ocupado}
        >
          Cancelar agendamento
        </Botao>
      ) : null}

      {acao === 'cancelar' && previa ? (
        <Cartao>
          <Subtitulo>Cancelar agendamento</Subtitulo>
          {previa.opcoes.length > 1 ? (
            <>
              <Texto>Como você quer o seu dinheiro de volta?</Texto>
              {previa.opcoes.map((o) => (
                <Opcao
                  key={o.escolhaPix}
                  tipo="radio"
                  titulo={
                    o.escolhaPix === 'credito'
                      ? `Crédito de ${reais(o.creditoAoCliente)} na barbearia`
                      : `Reembolso de ${reais(o.devolvidoAoCliente)} no Pix`
                  }
                  detalhe={
                    o.escolhaPix === 'credito'
                      ? '100% do valor para usar no próximo horário'
                      : 'Desconta o custo da transferência do Pix'
                  }
                  marcado={escolhaPix === o.escolhaPix}
                  onPress={() => setEscolhaPix(o.escolhaPix ?? 'credito')}
                />
              ))}
            </>
          ) : (
            <Texto>
              {(previa.opcoes[0]?.devolvidoAoCliente ?? 0) > 0
                ? `Você recebe ${reais(previa.opcoes[0]?.devolvidoAoCliente ?? 0)} de volta.`
                : previa.evento === 'cancelado_fora_do_prazo'
                  ? 'Fora do prazo grátis: o valor retido fica com a barbearia, conforme a política.'
                  : 'Nada foi cobrado: não há valor a devolver.'}
            </Texto>
          )}
          <Botao
            variante="perigo"
            carregando={ocupado}
            onPress={() =>
              executar(async () => {
                await api(`/api/agendamentos/${id}/cancelamento`, {
                  corpo: previa.opcoes.length > 1 ? { escolhaPix } : {},
                })
                setAcao('nenhuma')
                setAviso('Agendamento cancelado. A barbearia foi avisada.')
                setVersao((v) => v + 1)
              })
            }
          >
            Confirmar cancelamento
          </Botao>
          <Botao variante="fantasma" onPress={() => setAcao('nenhuma')}>
            Manter o horário
          </Botao>
        </Cartao>
      ) : null}

      {s.status === 'concluido' && acao === 'nenhuma' && !aviso ? (
        <Botao onPress={() => setAcao('avaliar')}>Avaliar o atendimento</Botao>
      ) : null}
      {acao === 'avaliar' ? (
        <Cartao>
          <Subtitulo>Como foi o atendimento?</Subtitulo>
          <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                accessibilityRole="radio"
                accessibilityLabel={`${n} estrela${n > 1 ? 's' : ''}`}
                accessibilityState={{ checked: nota === n }}
                onPress={() => setNota(n)}
                style={{ padding: 6 }}
              >
                <Text style={{ fontSize: 28, color: n <= nota ? c.marca : c.bordaForte }}>★</Text>
              </Pressable>
            ))}
          </View>
          <Campo
            rotulo="Comentário (opcional)"
            value={comentario}
            onChangeText={setComentario}
            multiline
            maxLength={500}
          />
          <Botao
            carregando={ocupado}
            onPress={() =>
              executar(async () => {
                await api(`/api/agendamentos/${id}/avaliacao`, {
                  corpo: { nota, ...(comentario.trim() ? { comentario: comentario.trim() } : {}) },
                })
                setAcao('nenhuma')
                setAviso('Obrigado pela avaliação!')
              })
            }
          >
            Enviar avaliação
          </Botao>
        </Cartao>
      ) : null}
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
    </Tela>
  )
}
