import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { Tom } from '../lib/tipos'
import { espaco, raio, useCores } from '../tema'

// Peças de interface do app, com os tokens do painel. Alvos de toque de 44pt ou mais.

export function Tela({
  children,
  rodape,
  rolar = true,
}: {
  children: ReactNode
  rodape?: ReactNode
  rolar?: boolean
}) {
  const c = useCores()
  const corpo = <View style={estilos.corpo}>{children}</View>
  return (
    <SafeAreaView style={[estilos.tela, { backgroundColor: c.fundo }]} edges={['bottom']}>
      {rolar ? (
        <ScrollView contentContainerStyle={estilos.rolagem} keyboardShouldPersistTaps="handled">
          {corpo}
        </ScrollView>
      ) : (
        corpo
      )}
      {rodape ? (
        <View style={[estilos.rodape, { borderTopColor: c.borda, backgroundColor: c.superficie }]}>
          {rodape}
        </View>
      ) : null}
    </SafeAreaView>
  )
}

export function Titulo({ children }: { children: ReactNode }) {
  const c = useCores()
  return (
    <Text accessibilityRole="header" style={[estilos.titulo, { color: c.texto }]}>
      {children}
    </Text>
  )
}

export function Subtitulo({ children }: { children: ReactNode }) {
  const c = useCores()
  return (
    <Text accessibilityRole="header" style={[estilos.subtitulo, { color: c.texto }]}>
      {children}
    </Text>
  )
}

export function Texto({
  children,
  suave,
  pequeno,
  forte,
}: {
  children: ReactNode
  suave?: boolean
  pequeno?: boolean
  forte?: boolean
}) {
  const c = useCores()
  return (
    <Text
      style={{
        color: suave ? c.textoSuave : c.texto,
        fontSize: pequeno ? 13 : 15,
        fontWeight: forte ? '600' : '400',
        lineHeight: pequeno ? 18 : 21,
      }}
    >
      {children}
    </Text>
  )
}

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma'

export function Botao({
  children,
  onPress,
  variante = 'primario',
  desativado,
  carregando,
  rotuloAcessivel,
}: {
  children: string
  onPress: () => void
  variante?: Variante
  desativado?: boolean
  carregando?: boolean
  rotuloAcessivel?: string
}) {
  const c = useCores()
  const fundo = {
    primario: c.primario,
    secundario: c.superficie,
    perigo: c.perigo,
    fantasma: 'transparent',
  }[variante]
  const texto = {
    primario: c.primarioTexto,
    secundario: c.texto,
    perigo: '#ffffff',
    fantasma: c.texto,
  }[variante]
  const inativo = desativado || carregando
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? children}
      accessibilityState={{ disabled: Boolean(inativo), busy: Boolean(carregando) }}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.botao,
        {
          backgroundColor: fundo,
          borderColor: variante === 'secundario' ? c.bordaForte : 'transparent',
          opacity: inativo ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {carregando ? <ActivityIndicator color={texto} /> : null}
      <Text style={[estilos.botaoTexto, { color: texto }]}>{children}</Text>
    </Pressable>
  )
}

export function Campo({
  rotulo,
  erro,
  ajuda,
  ...props
}: TextInputProps & { rotulo: string; erro?: string | null; ajuda?: string }) {
  const c = useCores()
  return (
    <View style={estilos.campo}>
      <Text style={[estilos.rotulo, { color: c.texto }]}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={c.textoSuave}
        style={[
          estilos.entrada,
          {
            color: c.texto,
            backgroundColor: c.superficie,
            borderColor: erro ? c.perigo : c.bordaForte,
          },
        ]}
        {...props}
      />
      {erro ? (
        <Text style={{ color: c.perigo, fontSize: 13 }}>{erro}</Text>
      ) : ajuda ? (
        <Text style={{ color: c.textoSuave, fontSize: 13 }}>{ajuda}</Text>
      ) : null}
    </View>
  )
}

export function Cartao({ children, estilo }: { children: ReactNode; estilo?: ViewStyle }) {
  const c = useCores()
  return (
    <View style={[estilos.cartao, { backgroundColor: c.superficie, borderColor: c.borda }, estilo]}>
      {children}
    </View>
  )
}

export function Etiqueta({ tom = 'neutro', children }: { tom?: Tom; children: string }) {
  const c = useCores()
  const cores = {
    neutro: [c.superficie2, c.texto2],
    sucesso: [c.sucessoSuave, c.sucesso],
    alerta: [c.alertaSuave, c.alerta],
    perigo: [c.perigoSuave, c.perigo],
    info: [c.infoSuave, c.info],
  }[tom]
  return (
    <View style={[estilos.etiqueta, { backgroundColor: cores[0] }]}>
      <Text style={{ color: cores[1], fontSize: 12, fontWeight: '600' }}>{children}</Text>
    </View>
  )
}

export function Mensagem({
  tipo,
  children,
}: {
  tipo: 'erro' | 'sucesso' | 'info'
  children: ReactNode
}) {
  const c = useCores()
  const [fundo, texto] = {
    erro: [c.perigoSuave, c.perigo],
    sucesso: [c.sucessoSuave, c.sucesso],
    info: [c.infoSuave, c.texto],
  }[tipo]
  return (
    <View
      accessibilityRole={tipo === 'erro' ? 'alert' : 'summary'}
      accessibilityLiveRegion="polite"
      style={[estilos.mensagem, { backgroundColor: fundo }]}
    >
      <Text style={{ color: texto, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  )
}

/** Linha marcável (checkbox ou radio), com área de toque grande. */
export function Opcao({
  titulo,
  detalhe,
  direita,
  marcado,
  tipo = 'checkbox',
  onPress,
  desativado,
}: {
  titulo: string
  detalhe?: string
  direita?: string
  marcado: boolean
  tipo?: 'checkbox' | 'radio'
  onPress: () => void
  desativado?: boolean
}) {
  const c = useCores()
  return (
    <Pressable
      accessibilityRole={tipo}
      accessibilityLabel={[titulo, detalhe, direita].filter(Boolean).join(', ')}
      accessibilityState={{ checked: marcado, disabled: Boolean(desativado) }}
      disabled={desativado}
      onPress={onPress}
      style={[
        estilos.opcao,
        {
          backgroundColor: c.superficie,
          borderColor: marcado ? c.primario : c.borda,
          opacity: desativado ? 0.5 : 1,
        },
      ]}
    >
      <View
        style={[
          tipo === 'radio' ? estilos.radio : estilos.caixa,
          {
            borderColor: marcado ? c.primario : c.bordaForte,
            backgroundColor: marcado ? c.primario : 'transparent',
          },
        ]}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.texto, fontSize: 15, fontWeight: '600' }}>{titulo}</Text>
        {detalhe ? <Text style={{ color: c.textoSuave, fontSize: 13 }}>{detalhe}</Text> : null}
      </View>
      {direita ? (
        <Text style={{ color: c.texto, fontSize: 15, fontWeight: '600' }}>{direita}</Text>
      ) : null}
    </Pressable>
  )
}

export function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  const c = useCores()
  return (
    <View style={estilos.linha}>
      <Text style={{ color: c.textoSuave, fontSize: 14 }}>{rotulo}</Text>
      <Text style={{ color: c.texto, fontSize: 14, flexShrink: 1, textAlign: 'right' }}>
        {valor}
      </Text>
    </View>
  )
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  const c = useCores()
  return (
    <View style={estilos.carregando} accessibilityRole="progressbar" accessibilityLabel={texto}>
      <ActivityIndicator color={c.texto} />
      <Text style={{ color: c.textoSuave }}>{texto}</Text>
    </View>
  )
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  const c = useCores()
  return (
    <View style={[estilos.vazio, { borderColor: c.bordaForte }]}>
      <Text style={{ color: c.texto, fontSize: 15, fontWeight: '600', textAlign: 'center' }}>
        {titulo}
      </Text>
      {children}
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  rolagem: { flexGrow: 1 },
  corpo: { padding: espaco.g, gap: espaco.m, maxWidth: 640, width: '100%', alignSelf: 'center' },
  rodape: { padding: espaco.g, borderTopWidth: 1, gap: espaco.p },
  titulo: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3 },
  subtitulo: { fontSize: 18, fontWeight: '600', marginTop: espaco.p },
  botao: {
    minHeight: 48,
    paddingHorizontal: espaco.g,
    borderRadius: raio.p,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: espaco.p,
  },
  botaoTexto: { fontSize: 16, fontWeight: '600' },
  campo: { gap: 6 },
  rotulo: { fontSize: 14, fontWeight: '500' },
  entrada: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: raio.p,
    paddingHorizontal: espaco.m,
    fontSize: 16,
  },
  cartao: { borderWidth: 1, borderRadius: raio.m, padding: espaco.g, gap: espaco.p },
  etiqueta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  mensagem: { padding: espaco.m, borderRadius: raio.p },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    padding: espaco.g,
    borderWidth: 1,
    borderRadius: raio.m,
    minHeight: 56,
  },
  caixa: { width: 20, height: 20, borderRadius: 4, borderWidth: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: espaco.m },
  carregando: { padding: espaco.gg, alignItems: 'center', gap: espaco.p },
  vazio: {
    padding: espaco.gg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: raio.m,
    alignItems: 'center',
    gap: espaco.p,
  },
})
