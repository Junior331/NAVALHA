'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Botao, BotaoLink, Campo, Mensagem } from '@/componentes/ui'
import { api, ErroDaApi, supabaseNoNavegador } from '@/lib/supabase'
import s from '../acesso.module.css'

// Figma Acessos · Cadastro: 01 Conta → (código do e-mail) → 02 Barbearia → 03 Plano → 04 Pagamento
// → 05 Boas-vindas. A verificação do e-mail por código não está no Figma (docs/execucao.md).
type Passo = 'conta' | 'codigo' | 'barbearia' | 'plano' | 'pagamento' | 'pronto'
const ORDEM: Passo[] = ['conta', 'barbearia', 'plano', 'pagamento']

type Plano = 'free' | 'basic' | 'pro'

// Regras dos planos: regras-de-negocio §Planos e monetização. Todos têm pagamento online
// (conflito 1 do docs/mapa.md §7 resolvido a favor do doc).
const PLANOS: { id: Plano; nome: string; preco: number; resumo: string; itens: string[] }[] = [
  {
    id: 'free',
    nome: 'Free',
    preco: 0,
    resumo: 'Para começar e testar a agenda.',
    itens: [
      '8% por atendimento',
      '1 barbeiro',
      'Pix e cartão no pagamento',
      'Página pública da barbearia',
    ],
  },
  {
    id: 'basic',
    nome: 'Basic',
    preco: 49,
    resumo: 'Para barbearias em crescimento.',
    itens: [
      'Sem taxa por atendimento',
      'Até 5 barbeiros',
      'Pix e cartão no pagamento',
      'Relatórios básicos',
    ],
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 99,
    resumo: 'Para equipes grandes e redes.',
    itens: [
      'Sem taxa por atendimento',
      'Barbeiros ilimitados',
      'Promoções e cupons',
      'Relatórios completos e CSV',
    ],
  },
]

function paraSlug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export default function Pagina() {
  const [passo, setPasso] = useState<Passo>('conta')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [conta, setConta] = useState({ nome: '', email: '', senha: '' })
  const [codigo, setCodigo] = useState('')
  const [barbearia, setBarbearia] = useState({
    nome: '',
    slug: '',
    whatsapp: '',
    endereco: '',
    bairro: '',
    cidade: '',
    uf: '',
  })
  const [slugEditado, setSlugEditado] = useState(false)
  const [plano, setPlano] = useState<Plano>('basic')
  const [ciclo, setCiclo] = useState<'mensal' | 'anual'>('mensal')
  const supabase = supabaseNoNavegador()

  async function criarConta(evento: FormEvent) {
    evento.preventDefault()
    if (conta.senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    setEnviando(true)
    setErro(null)
    const { data, error } = await supabase.auth.signUp({
      email: conta.email,
      password: conta.senha,
      options: { data: { nome: conta.nome } },
    })
    setEnviando(false)
    if (error) {
      return setErro(
        error.code === 'user_already_exists'
          ? 'Já existe uma conta com esse e-mail. Entre com ela.'
          : 'Não foi possível criar a conta. Confira os dados.',
      )
    }
    setPasso(data.session ? 'barbearia' : 'codigo')
  }

  async function confirmarCodigo(evento: FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setErro(null)
    const { error } = await supabase.auth.verifyOtp({
      email: conta.email,
      token: codigo,
      type: 'email',
    })
    setEnviando(false)
    if (error) return setErro('Código inválido ou vencido. Confira os 6 dígitos.')
    setPasso('barbearia')
  }

  async function concluir() {
    setEnviando(true)
    setErro(null)
    try {
      await api('/api/barbearias', {
        corpo: {
          nome: barbearia.nome,
          slug: barbearia.slug,
          nomeDoDono: conta.nome || barbearia.nome,
          plano,
          ...(plano === 'free' ? {} : { ciclo }),
          ...Object.fromEntries(
            Object.entries({
              whatsapp: barbearia.whatsapp,
              telefone: barbearia.whatsapp,
              endereco: barbearia.endereco,
              bairro: barbearia.bairro,
              cidade: barbearia.cidade,
              uf: barbearia.uf.toUpperCase(),
            }).filter(([, valor]) => valor),
          ),
        },
      })
      setPasso('pronto')
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível concluir o cadastro.')
      if (e instanceof ErroDaApi && e.message.includes('link')) setPasso('barbearia')
    } finally {
      setEnviando(false)
    }
  }

  const indice = ORDEM.indexOf(passo === 'codigo' ? 'conta' : passo)

  if (passo === 'pronto') {
    return (
      <div className={s.formulario}>
        <p className="rotulo">Cadastro concluído</p>
        <h1>Conta criada</h1>
        <p className={s.subtitulo}>
          Agora monte a barbearia: convide a equipe, cadastre os serviços com preço e duração e
          informe os horários.
        </p>
        <BotaoLink href="/onboarding" largo>
          Configurar a barbearia
        </BotaoLink>
        <Link href="/painel" className={s.subtitulo} style={{ textAlign: 'center' }}>
          Fazer depois
        </Link>
      </div>
    )
  }

  return (
    <div className={s.formulario}>
      <div className={s.passos} aria-label={`Passo ${indice + 1} de 4`}>
        {ORDEM.map((p, i) => (
          <span
            key={p}
            className={[s.passo, i <= indice && s.passoFeito].filter(Boolean).join(' ')}
          />
        ))}
      </div>

      {passo === 'conta' ? (
        <form onSubmit={criarConta} className={s.linhas} noValidate>
          <div>
            <p className="rotulo">Passo 1 de 4</p>
            <h1>Crie sua conta</h1>
          </div>
          <Campo
            rotulo="Seu nome"
            autoComplete="name"
            value={conta.nome}
            onChange={(e) => setConta({ ...conta, nome: e.target.value })}
          />
          <Campo
            rotulo="E-mail"
            type="email"
            autoComplete="email"
            value={conta.email}
            onChange={(e) => setConta({ ...conta, email: e.target.value })}
          />
          <Campo
            rotulo="Senha"
            type="password"
            autoComplete="new-password"
            ajuda="Mínimo de 8 caracteres."
            value={conta.senha}
            onChange={(e) => setConta({ ...conta, senha: e.target.value })}
          />
          {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
          <Botao
            type="submit"
            largo
            grande
            disabled={enviando || !conta.nome || !conta.email || !conta.senha}
          >
            Continuar
          </Botao>
          <p className={s.subtitulo}>
            Já tem uma conta? <Link href="/entrar">Entrar</Link>
          </p>
        </form>
      ) : null}

      {passo === 'codigo' ? (
        <form onSubmit={confirmarCodigo} className={s.linhas} noValidate>
          <div>
            <h1>Confirme seu e-mail</h1>
            <p className={s.subtitulo}>Enviamos um código de 6 dígitos para {conta.email}.</p>
          </div>
          <Campo
            rotulo="Código"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className={s.codigo}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          />
          {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
          <Botao type="submit" largo grande disabled={enviando || codigo.length !== 6}>
            Confirmar
          </Botao>
        </form>
      ) : null}

      {passo === 'barbearia' ? (
        <form
          className={s.linhas}
          onSubmit={(e) => {
            e.preventDefault()
            setErro(null)
            setPasso('plano')
          }}
          noValidate
        >
          <div>
            <p className="rotulo">Passo 2 de 4</p>
            <h1>Sua barbearia</h1>
          </div>
          <Campo
            rotulo="Nome da barbearia"
            value={barbearia.nome}
            onChange={(e) =>
              setBarbearia({
                ...barbearia,
                nome: e.target.value,
                slug: slugEditado ? barbearia.slug : paraSlug(e.target.value),
              })
            }
          />
          <Campo
            rotulo="Link da sua página"
            ajuda={`navalha.app/${barbearia.slug || 'sua-barbearia'} · gerado a partir do nome; você pode editar.`}
            value={barbearia.slug}
            onChange={(e) => {
              setSlugEditado(true)
              setBarbearia({ ...barbearia, slug: paraSlug(e.target.value) })
            }}
          />
          <Campo
            rotulo="Telefone (WhatsApp)"
            inputMode="tel"
            value={barbearia.whatsapp}
            onChange={(e) => setBarbearia({ ...barbearia, whatsapp: e.target.value })}
          />
          <Campo
            rotulo="Endereço"
            value={barbearia.endereco}
            onChange={(e) => setBarbearia({ ...barbearia, endereco: e.target.value })}
          />
          <div className={s.duasColunas}>
            <Campo
              rotulo="Bairro"
              value={barbearia.bairro}
              onChange={(e) => setBarbearia({ ...barbearia, bairro: e.target.value })}
            />
            <Campo
              rotulo="Cidade"
              value={barbearia.cidade}
              onChange={(e) => setBarbearia({ ...barbearia, cidade: e.target.value })}
            />
          </div>
          <Campo
            rotulo="UF"
            maxLength={2}
            value={barbearia.uf}
            onChange={(e) => setBarbearia({ ...barbearia, uf: e.target.value })}
          />
          {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
          <Botao type="submit" largo grande disabled={!barbearia.nome || barbearia.slug.length < 3}>
            Continuar
          </Botao>
        </form>
      ) : null}

      {passo === 'plano' ? (
        <div className={s.linhas}>
          <div>
            <p className="rotulo">Passo 3 de 4</p>
            <h1>Escolha o plano</h1>
          </div>
          <div className={s.alternador} role="group" aria-label="Ciclo de cobrança">
            <button
              type="button"
              aria-pressed={ciclo === 'mensal'}
              onClick={() => setCiclo('mensal')}
            >
              Mensal
            </button>
            <button
              type="button"
              aria-pressed={ciclo === 'anual'}
              onClick={() => setCiclo('anual')}
            >
              Anual · −20%
            </button>
          </div>
          <div className={s.planos}>
            {PLANOS.map((p) => {
              const preco = ciclo === 'anual' ? Math.round(p.preco * 0.8) : p.preco
              return (
                <button
                  key={p.id}
                  type="button"
                  className={s.plano}
                  aria-pressed={plano === p.id}
                  onClick={() => setPlano(p.id)}
                >
                  <span className={s.planoTopo}>
                    <strong>{p.nome}</strong>
                    <span className={s.planoPreco}>
                      R$ {preco}
                      <small style={{ fontWeight: 400, color: 'var(--texto-suave)' }}>/mês</small>
                    </span>
                  </span>
                  <span className={s.subtitulo}>{p.resumo}</span>
                  <ul className={s.planoItens}>
                    {p.itens.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>
          <p className={s.subtitulo}>
            14 dias grátis nos planos Basic e Pro. Cancele quando quiser.
          </p>
          {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
          <Botao
            largo
            grande
            disabled={enviando}
            onClick={() => (plano === 'free' ? concluir() : setPasso('pagamento'))}
          >
            {plano === 'free' ? (enviando ? 'Criando…' : 'Criar barbearia') : 'Continuar'}
          </Botao>
        </div>
      ) : null}

      {passo === 'pagamento' ? (
        <div className={s.linhas}>
          <div>
            <p className="rotulo">Passo 4 de 4</p>
            <h1>Teste grátis por 14 dias</h1>
          </div>
          <Mensagem tipo="info">
            Plano {PLANOS.find((p) => p.id === plano)?.nome} · {ciclo}: nada é cobrado hoje. O
            cartão da assinatura será pedido antes do fim do teste, quando a cobrança recorrente
            estiver ativa.
          </Mensagem>
          {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
          <Botao largo grande disabled={enviando} onClick={concluir}>
            {enviando ? 'Criando…' : 'Começar o teste grátis'}
          </Botao>
          <Botao variante="fantasma" onClick={() => setPasso('plano')}>
            Voltar
          </Botao>
        </div>
      ) : null}
    </div>
  )
}
