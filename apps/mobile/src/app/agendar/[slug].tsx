import { avulsoRepetido, comboMaisBarato, partesLocais } from '@navalha/core'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  Botao,
  Campo,
  Cartao,
  Carregando,
  Linha,
  Mensagem,
  Opcao,
  Subtitulo,
  Tela,
  Texto,
  Titulo,
} from '../../componentes/ui'
import { api, ErroDaApi, mensagemDe } from '../../lib/api'
import { dataLonga, hora, minutosEmTexto, reais, soDigitos } from '../../lib/formato'
import { guardarPix } from '../../lib/pix'
import { useSessao } from '../../lib/sessao'
import type { PaginaDaBarbearia, SaidaAgendamento, ValorComDesconto } from '../../lib/tipos'
import { useCarregar } from '../../lib/useCarregar'
import { useCores } from '../../tema'

// Figma Cliente 07–10 no app: serviços → profissional → data e hora → revisar e pagar.
// Cartão sem parcelamento (CLAUDE.md); nada é cobrado antes do fim do prazo grátis.

type Passo = 'servicos' | 'barbeiro' | 'horario' | 'pagamento'
const DIAS_A_FRENTE = 14

function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, (d ?? 1) + dias)).toISOString().slice(0, 10)
}

export default function Agendar() {
  const { slug, servicos: iniciais } = useLocalSearchParams<{ slug: string; servicos?: string }>()
  const { perfil } = useSessao()
  const c = useCores()
  const { dados: pagina, carregando } = useCarregar(
    () => api<PaginaDaBarbearia>(`/api/vitrine/${slug}`),
    [slug],
  )
  const idsIniciais = (iniciais ?? '').split(',').filter(Boolean)
  const [passo, setPasso] = useState<Passo>(idsIniciais.length ? 'barbeiro' : 'servicos')
  const [servicoIds, setServicoIds] = useState<string[]>(idsIniciais)
  const [barbeiroId, setBarbeiroId] = useState('qualquer')
  const [dias, setDias] = useState<Record<string, string[]> | null>(null)
  const [data, setData] = useState<string | null>(null)
  const [inicio, setInicio] = useState<string | null>(null)
  const [preco, setPreco] = useState<ValorComDesconto | null>(null)
  const [cupom, setCupom] = useState('')
  const [cupomAplicado, setCupomAplicado] = useState<string | null>(null)
  const [meio, setMeio] = useState<'pix' | 'cartao'>('pix')
  const [cartao, setCartao] = useState({
    numero: '',
    nome: '',
    validade: '',
    cvv: '',
    cpf: '',
    cep: '',
    numeroEndereco: '',
  })
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  if (carregando || !pagina) {
    return (
      <Tela rolar={false}>
        <Carregando />
      </Tela>
    )
  }

  const { fuso, politica } = pagina
  const hoje = partesLocais(new Date(), fuso).data
  const selecionados = pagina.servicos.filter((s) => servicoIds.includes(s.id))
  const aptos = pagina.barbeiros.filter((b) =>
    selecionados.every((s) => s.barbeiroIds.includes(b.id)),
  )
  const repetido = avulsoRepetido(selecionados)
  const combo = comboMaisBarato(selecionados, pagina.servicos)
  const duracao = selecionados.reduce((t, s) => t + s.duracaoMin, 0)
  const total = selecionados.reduce((t, s) => t + s.precoCentavos, 0)
  const cobrancaEm = inicio
    ? new Date(new Date(inicio).getTime() - politica.prazoGratisHoras * 3_600_000)
    : null

  async function carregarDias(quem: string) {
    setDias(null)
    setData(null)
    setInicio(null)
    const datas = Array.from({ length: DIAS_A_FRENTE }, (_, i) => somarDias(hoje, i))
    const lista = await Promise.all(
      datas.map(async (dia): Promise<[string, string[]]> => {
        const consulta = `data=${dia}&servicos=${servicoIds.join(',')}${quem === 'qualquer' ? '' : `&barbeiro=${quem}`}`
        try {
          const r = await api<{ barbeiros: { inicios: string[] }[] }>(
            `/api/barbearias/${pagina?.id}/disponibilidade?${consulta}`,
          )
          return [dia, [...new Set(r.barbeiros.flatMap((b) => b.inicios))].sort()]
        } catch {
          return [dia, []]
        }
      }),
    )
    const mapa = Object.fromEntries(lista)
    setDias(mapa)
    setData(datas.find((d) => (mapa[d]?.length ?? 0) > 0) ?? datas[0] ?? null)
  }

  async function calcular(codigo: string | null) {
    setPreco(
      await api<ValorComDesconto>('/api/agendamentos/preco', {
        corpo: {
          barbeariaId: pagina?.id,
          servicoIds,
          inicio,
          ...(codigo ? { cupom: codigo } : {}),
        },
      }),
    )
  }

  async function irParaPagamento() {
    setErro(null)
    if (!perfil?.cliente) {
      setErro('Complete seu cadastro no Perfil antes de agendar.')
      return
    }
    try {
      await calcular(null)
      setPasso('pagamento')
    } catch (e) {
      setErro(mensagemDe(e))
    }
  }

  async function pagar() {
    setOcupado(true)
    setErro(null)
    try {
      const saida = await api<SaidaAgendamento>('/api/agendamentos', {
        corpo: {
          barbeariaId: pagina?.id,
          servicoIds,
          barbeiroId,
          inicio,
          meio,
          origem: 'app',
          ...(cupomAplicado ? { cupom: cupomAplicado } : {}),
          ...(meio === 'cartao'
            ? {
                cartao: {
                  numero: soDigitos(cartao.numero),
                  nomeImpresso: cartao.nome.trim(),
                  validade: cartao.validade,
                  cvv: cartao.cvv,
                },
                titular: {
                  nome: perfil?.cliente?.nome,
                  email: perfil?.cliente?.email ?? perfil?.email,
                  cpfCnpj: soDigitos(cartao.cpf),
                  cep: soDigitos(cartao.cep),
                  numeroEndereco: cartao.numeroEndereco.trim(),
                  celular: soDigitos(perfil?.cliente?.celular ?? ''),
                },
              }
            : {}),
        },
      })
      if (saida.tipo === 'pix') {
        guardarPix(saida.reservaId, saida)
        router.replace(`/agendamento/${saida.reservaId}`)
      } else {
        router.replace(`/agendamento/${saida.agendamentoId}`)
      }
    } catch (e) {
      if (e instanceof ErroDaApi && e.codigo === 'horario_indisponivel') {
        setErro(`${e.message}. Escolha outro horário.`)
        setPasso('horario')
        void carregarDias(barbeiroId)
      } else {
        setErro(mensagemDe(e))
      }
    } finally {
      setOcupado(false)
    }
  }

  const resumo = (
    <Cartao>
      <Texto forte>{selecionados.map((s) => s.nome).join(' + ') || 'Escolha os serviços'}</Texto>
      <Texto suave>
        {minutosEmTexto(duracao)} · {reais(total)}
        {inicio ? ` · ${dataLonga(inicio, fuso)}, ${hora(inicio, fuso)}` : ''}
      </Texto>
    </Cartao>
  )

  return (
    <Tela>
      <Stack.Screen options={{ title: pagina.nome }} />
      {passo === 'servicos' ? (
        <>
          <Titulo>Escolha os serviços</Titulo>
          {pagina.servicos.map((s) => (
            <Opcao
              key={s.id}
              titulo={s.nome}
              detalhe={minutosEmTexto(s.duracaoMin)}
              direita={reais(s.precoCentavos)}
              marcado={servicoIds.includes(s.id)}
              onPress={() =>
                setServicoIds(
                  servicoIds.includes(s.id)
                    ? servicoIds.filter((x) => x !== s.id)
                    : [...servicoIds, s.id],
                )
              }
            />
          ))}
          {repetido ? (
            <Mensagem tipo="info">
              {repetido.combo.nome} já inclui {repetido.avulso.nome}. Tire o avulso para continuar.
            </Mensagem>
          ) : combo ? (
            <Mensagem tipo="info">
              Troque pelo combo {combo.combo.nome} e economize {reais(combo.economiaCentavos)}.
            </Mensagem>
          ) : null}
          {combo ? (
            <Botao variante="secundario" onPress={() => setServicoIds([combo.combo.id])}>
              Trocar pelo combo
            </Botao>
          ) : null}
          {selecionados.length > 0 && aptos.length === 0 ? (
            <Mensagem tipo="erro">
              Nenhum profissional faz essa combinação. Tire algum serviço.
            </Mensagem>
          ) : null}
          <Botao
            onPress={() => setPasso('barbeiro')}
            desativado={!selecionados.length || !aptos.length || Boolean(repetido)}
          >
            Continuar
          </Botao>
        </>
      ) : null}

      {passo === 'barbeiro' ? (
        <>
          <Titulo>Com quem?</Titulo>
          {resumo}
          <Opcao
            tipo="radio"
            titulo="Primeiro profissional livre"
            detalhe="Mostra todos os horários da barbearia"
            marcado={barbeiroId === 'qualquer'}
            onPress={() => setBarbeiroId('qualquer')}
          />
          {aptos.map((b) => (
            <Opcao
              key={b.id}
              tipo="radio"
              titulo={b.nome}
              detalhe={
                b.nota !== null
                  ? `★ ${b.nota.toLocaleString('pt-BR')} · ${b.avaliacoes} avaliações`
                  : 'Novo na equipe'
              }
              marcado={barbeiroId === b.id}
              onPress={() => setBarbeiroId(b.id)}
            />
          ))}
          <Botao
            onPress={() => {
              setPasso('horario')
              void carregarDias(barbeiroId)
            }}
          >
            Ver horários
          </Botao>
          <Botao variante="fantasma" onPress={() => setPasso('servicos')}>
            Voltar
          </Botao>
        </>
      ) : null}

      {passo === 'horario' ? (
        <>
          <Titulo>Dia e horário</Titulo>
          {resumo}
          {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
          {dias === null ? (
            <Carregando texto="Buscando horários livres…" />
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {Object.keys(dias).map((dia) => {
                  const livre = (dias[dia]?.length ?? 0) > 0
                  const escolhido = data === dia
                  const meioDia = new Date(`${dia}T15:00:00Z`)
                  return (
                    <Pressable
                      key={dia}
                      accessibilityRole="button"
                      accessibilityState={{ selected: escolhido }}
                      accessibilityLabel={`${dataLonga(meioDia, 'UTC')}${livre ? '' : ', sem horários'}`}
                      onPress={() => {
                        setData(dia)
                        setInicio(null)
                      }}
                      style={[
                        estilos.dia,
                        {
                          backgroundColor: escolhido ? c.primario : c.superficie,
                          borderColor: escolhido ? c.primario : c.bordaForte,
                          borderStyle: livre ? 'solid' : 'dashed',
                        },
                      ]}
                    >
                      <Text
                        style={{ color: escolhido ? c.primarioTexto : c.textoSuave, fontSize: 12 }}
                      >
                        {dia === hoje
                          ? 'Hoje'
                          : meioDia.toLocaleDateString('pt-BR', {
                              weekday: 'short',
                              timeZone: 'UTC',
                            })}
                      </Text>
                      <Text
                        style={{
                          color: escolhido ? c.primarioTexto : c.texto,
                          fontSize: 18,
                          fontWeight: '700',
                        }}
                      >
                        {dia.slice(8, 10)}
                      </Text>
                      <View
                        style={[
                          estilos.ponto,
                          { backgroundColor: livre ? c.sucesso : 'transparent' },
                        ]}
                      />
                    </Pressable>
                  )
                })}
              </ScrollView>
              {data && (dias[data]?.length ?? 0) === 0 ? (
                <Mensagem tipo="info">Sem horários livres nesse dia. Escolha outro dia.</Mensagem>
              ) : null}
              <View style={estilos.horarios}>
                {(data ? (dias[data] ?? []) : []).map((h) => {
                  const escolhido = inicio === h
                  return (
                    <Pressable
                      key={h}
                      accessibilityRole="button"
                      accessibilityState={{ selected: escolhido }}
                      onPress={() => setInicio(h)}
                      style={[
                        estilos.horario,
                        {
                          backgroundColor: escolhido ? c.primario : c.superficie,
                          borderColor: escolhido ? c.primario : c.bordaForte,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: escolhido ? c.primarioTexto : c.texto,
                          fontWeight: escolhido ? '700' : '400',
                        }}
                      >
                        {hora(h, fuso)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </>
          )}
          <Botao onPress={irParaPagamento} desativado={!inicio}>
            Continuar
          </Botao>
          <Botao variante="fantasma" onPress={() => setPasso('barbeiro')}>
            Voltar
          </Botao>
        </>
      ) : null}

      {passo === 'pagamento' && inicio ? (
        <>
          <Titulo>Revisar e pagar</Titulo>
          <Cartao>
            <Linha rotulo="Serviços" valor={selecionados.map((s) => s.nome).join(' + ')} />
            <Linha rotulo="Quando" valor={`${dataLonga(inicio, fuso)}, ${hora(inicio, fuso)}`} />
            <Linha rotulo="Onde" valor={pagina.nome} />
            {preco && preco.desconto > 0 ? (
              <Linha rotulo="Desconto" valor={`− ${reais(preco.desconto)}`} />
            ) : null}
            {preco ? <Linha rotulo="Total" valor={reais(preco.valorPago)} /> : null}
          </Cartao>
          {cupomAplicado ? (
            <Mensagem tipo="sucesso">Cupom {cupomAplicado} aplicado.</Mensagem>
          ) : (
            <>
              <Campo
                rotulo="Cupom (opcional)"
                value={cupom}
                onChangeText={(t) => setCupom(t.toUpperCase())}
                autoCapitalize="characters"
              />
              <Botao
                variante="secundario"
                desativado={!cupom.trim()}
                onPress={async () => {
                  setErro(null)
                  try {
                    await calcular(cupom.trim())
                    setCupomAplicado(cupom.trim())
                  } catch (e) {
                    setErro(mensagemDe(e))
                  }
                }}
              >
                Aplicar cupom
              </Botao>
            </>
          )}
          <Mensagem tipo="info">
            Cancelamento grátis até {politica.prazoGratisHoras}h antes
            {cobrancaEm ? ` (${hora(cobrancaEm, fuso)} de ${dataLonga(cobrancaEm, fuso)})` : ''}.
            Depois disso, ou se você não vier, {politica.retencaoPct}% fica com a barbearia. Atraso
            tolerado: {politica.toleranciaMin} minutos.
          </Mensagem>
          {preco && preco.valorPago > 0 ? (
            <>
              <Subtitulo>Como você quer pagar?</Subtitulo>
              <Opcao
                tipo="radio"
                titulo="Pix"
                detalhe="Paga agora e o horário fica confirmado na hora"
                marcado={meio === 'pix'}
                onPress={() => setMeio('pix')}
              />
              <Opcao
                tipo="radio"
                titulo="Cartão de crédito"
                detalhe="Nada é cobrado agora · à vista, sem parcelamento"
                marcado={meio === 'cartao'}
                onPress={() => setMeio('cartao')}
              />
            </>
          ) : null}
          {meio === 'cartao' && preco && preco.valorPago > 0 ? (
            <>
              <Campo
                rotulo="Número do cartão"
                keyboardType="number-pad"
                value={cartao.numero}
                onChangeText={(t) => setCartao({ ...cartao, numero: t })}
              />
              <Campo
                rotulo="Nome impresso no cartão"
                value={cartao.nome}
                onChangeText={(t) => setCartao({ ...cartao, nome: t })}
                autoCapitalize="characters"
              />
              <Campo
                rotulo="Validade (MM/AA)"
                value={cartao.validade}
                onChangeText={(t) => setCartao({ ...cartao, validade: t })}
              />
              <Campo
                rotulo="CVV"
                keyboardType="number-pad"
                value={cartao.cvv}
                onChangeText={(t) => setCartao({ ...cartao, cvv: t })}
                secureTextEntry
              />
              <Campo
                rotulo="CPF do titular"
                keyboardType="number-pad"
                value={cartao.cpf}
                onChangeText={(t) => setCartao({ ...cartao, cpf: t })}
              />
              <Campo
                rotulo="CEP do titular"
                keyboardType="number-pad"
                value={cartao.cep}
                onChangeText={(t) => setCartao({ ...cartao, cep: t })}
              />
              <Campo
                rotulo="Número do endereço"
                value={cartao.numeroEndereco}
                onChangeText={(t) => setCartao({ ...cartao, numeroEndereco: t })}
              />
              {cobrancaEm ? (
                <Texto pequeno suave>
                  O cartão é validado até 72h antes e cobrado só em {dataLonga(cobrancaEm, fuso)},{' '}
                  {hora(cobrancaEm, fuso)}.
                </Texto>
              ) : null}
            </>
          ) : null}
          {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
          <Botao onPress={pagar} carregando={ocupado} desativado={!preco}>
            {!preco
              ? 'Calculando…'
              : preco.valorPago === 0
                ? 'Confirmar agendamento'
                : meio === 'pix'
                  ? `Pagar ${reais(preco.valorPago)} com Pix`
                  : 'Reservar com cartão'}
          </Botao>
          <Botao variante="fantasma" onPress={() => setPasso('horario')}>
            Voltar
          </Botao>
        </>
      ) : null}
      {passo !== 'horario' && erro && passo !== 'pagamento' ? (
        <Mensagem tipo="erro">{erro}</Mensagem>
      ) : null}
    </Tela>
  )
}

const estilos = StyleSheet.create({
  dia: {
    width: 64,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    gap: 2,
  },
  ponto: { width: 6, height: 6, borderRadius: 3 },
  horarios: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  horario: {
    minWidth: 76,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
