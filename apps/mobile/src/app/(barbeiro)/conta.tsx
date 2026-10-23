import { router } from 'expo-router'
import { useState } from 'react'
import {
  Botao,
  Campo,
  Cartao,
  Carregando,
  Mensagem,
  Subtitulo,
  Tela,
  Texto,
  Titulo,
} from '../../componentes/ui'
import { minutosEmTexto } from '../../lib/formato'
import { useSessao } from '../../lib/sessao'
import { supabase } from '../../lib/supabase'
import { useCarregar } from '../../lib/useCarregar'

// Figma Barbeiro 05 (perfil profissional), 05b (meus serviços) e 08 (configurações).
export default function Conta() {
  const { perfil, sair } = useSessao()
  const membro = perfil?.membro
  const [nome, setNome] = useState<string | null>(null)
  const [bio, setBio] = useState<string | null>(null)
  const [estado, setEstado] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)
  const [salvando, setSalvando] = useState(false)

  const { dados, carregando } = useCarregar(async () => {
    const [profissional, servicos] = await Promise.all([
      supabase
        .from('perfis_profissionais')
        .select('nome_exibicao, bio')
        .eq('membro_id', membro?.id ?? '')
        .maybeSingle(),
      supabase
        .from('servico_barbeiro')
        .select('servicos(nome, duracao_min, ativo)')
        .eq('membro_id', membro?.id ?? ''),
    ])
    return {
      nome: profissional.data?.nome_exibicao ?? perfil?.nome ?? '',
      bio: profissional.data?.bio ?? '',
      servicos: (servicos.data ?? []).flatMap((s) =>
        s.servicos && s.servicos.ativo ? [s.servicos] : [],
      ),
    }
  }, [membro?.id])

  if (carregando || !dados || !membro) {
    return (
      <Tela rolar={false}>
        <Carregando />
      </Tela>
    )
  }

  async function salvar() {
    if (!membro || !dados) return
    setSalvando(true)
    setEstado(null)
    const { error } = await supabase.from('perfis_profissionais').upsert({
      membro_id: membro.id,
      barbearia_id: membro.barbeariaId,
      nome_exibicao: (nome ?? dados.nome).trim(),
      bio: (bio ?? dados.bio).trim() || null,
    })
    setSalvando(false)
    setEstado(
      error
        ? { tipo: 'erro', texto: 'Não foi possível salvar o perfil.' }
        : { tipo: 'sucesso', texto: 'Perfil salvo. É assim que os clientes veem você.' },
    )
  }

  return (
    <Tela>
      <Titulo>Perfil profissional</Titulo>
      <Texto suave>
        {membro.papel === 'dono' ? 'Dono' : 'Barbeiro'} na {membro.barbeariaNome}
      </Texto>
      <Campo rotulo="Nome de exibição" value={nome ?? dados.nome} onChangeText={setNome} />
      <Campo
        rotulo="Sobre você"
        value={bio ?? dados.bio}
        onChangeText={setBio}
        multiline
        maxLength={240}
        ajuda="Especialidades, estilo, tempo de profissão."
      />
      {estado ? <Mensagem tipo={estado.tipo}>{estado.texto}</Mensagem> : null}
      <Botao
        onPress={salvar}
        carregando={salvando}
        desativado={(nome ?? dados.nome).trim().length < 2}
      >
        Salvar perfil
      </Botao>

      <Subtitulo>Meus serviços</Subtitulo>
      {dados.servicos.length ? (
        dados.servicos.map((s) => (
          <Cartao key={s.nome}>
            <Texto forte>{s.nome}</Texto>
            <Texto suave>{minutosEmTexto(s.duracao_min)}</Texto>
          </Cartao>
        ))
      ) : (
        <Texto suave>O dono da barbearia define quais serviços você faz.</Texto>
      )}

      <Subtitulo>Conta</Subtitulo>
      <Botao variante="secundario" onPress={() => router.push('/notificacoes')}>
        Notificações
      </Botao>
      <Botao
        variante="fantasma"
        onPress={async () => {
          await sair()
          router.replace('/entrar')
        }}
      >
        Sair
      </Botao>
    </Tela>
  )
}
