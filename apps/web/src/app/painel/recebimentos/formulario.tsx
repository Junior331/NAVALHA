'use client'

import { useState, type FormEvent } from 'react'
import { Botao, Campo, Mensagem } from '@/componentes/ui'
import { api, ErroDaApi } from '@/lib/supabase'
import { centavosDe } from '@/lib/mascaras'
import c from '../conta.module.css'

// Ativar recebimentos (ajustes-taxas §Subconta): os dados do titular criam a conta de pagamentos
// da barbearia no Asaas, com o Escrow que segura o dinheiro até o atendimento. Usado no
// onboarding e no painel.

const soDigitos = (texto: string) => texto.replace(/\D/g, '')

export function FormularioDeRecebimentos({
  barbeariaId,
  emailInicial = '',
  aoAtivar,
}: {
  barbeariaId: string
  emailInicial?: string
  aoAtivar: (situacao: 'aprovada' | 'em_analise') => void
}) {
  const [nome, setNome] = useState('')
  const [documento, setDocumento] = useState('')
  const [email, setEmail] = useState(emailInicial)
  const [celular, setCelular] = useState('')
  const [faturamento, setFaturamento] = useState('')
  const [cep, setCep] = useState('')
  const [rua, setRua] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [chavePix, setChavePix] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [tentou, setTentou] = useState(false)

  const doc = soDigitos(documento)
  const erros = {
    nome: nome.trim().length < 2 ? 'Informe o nome do titular' : null,
    documento: doc.length === 11 || doc.length === 14 ? null : 'CPF com 11 ou CNPJ com 14 números',
    email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? null : 'E-mail inválido',
    celular: [10, 11].includes(soDigitos(celular).length) ? null : 'Celular com DDD',
    faturamento: centavosDe(faturamento) > 0 ? null : 'Informe uma estimativa',
    cep: soDigitos(cep).length === 8 ? null : 'CEP com 8 números',
    rua: rua.trim().length >= 2 ? null : 'Informe a rua',
    numero: numero.trim() ? null : 'Informe o número',
    bairro: bairro.trim().length >= 2 ? null : 'Informe o bairro',
    chavePix: chavePix.trim().length >= 5 ? null : 'Informe a chave Pix',
  }
  const mostrar = (campo: keyof typeof erros) => (tentou ? erros[campo] : null)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setTentou(true)
    if (Object.values(erros).some(Boolean)) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await api<{ situacao: 'aprovada' | 'em_analise' }>(
        `/api/barbearias/${barbeariaId}/recebimentos`,
        {
          corpo: {
            titular: {
              nome: nome.trim(),
              email: email.trim(),
              cpfCnpj: doc,
              celular: soDigitos(celular),
              faturamentoMensalCentavos: centavosDe(faturamento),
              endereco: {
                logradouro: rua.trim(),
                numero: numero.trim(),
                bairro: bairro.trim(),
                cep: soDigitos(cep),
              },
            },
            chavePix: chavePix.trim(),
          },
        },
      )
      aoAtivar(r.situacao)
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível ativar agora. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className={c.formulario} onSubmit={enviar} noValidate>
      <fieldset className={c.grupo}>
        <legend>Titular da conta</legend>
        <div className={c.linha}>
          <Campo
            rotulo="Nome completo ou razão social"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            erro={mostrar('nome')}
          />
          <Campo
            rotulo="CPF ou CNPJ"
            mascara="cpfCnpj"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            erro={mostrar('documento')}
          />
        </div>
        <div className={c.linha}>
          <Campo
            rotulo="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            erro={mostrar('email')}
          />
          <Campo
            rotulo="Celular"
            mascara="celular"
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
            autoComplete="tel"
            erro={mostrar('celular')}
          />
        </div>
        <Campo
          rotulo="Faturamento mensal estimado (R$)"
          mascara="reais"
          prefixo="R$"
          value={faturamento}
          onChange={(e) => setFaturamento(e.target.value)}
          ajuda="O Asaas pede essa estimativa na análise da conta."
          erro={mostrar('faturamento')}
        />
      </fieldset>

      <fieldset className={c.grupo}>
        <legend>Endereço</legend>
        <div className={c.linha}>
          <Campo
            rotulo="CEP"
            mascara="cep"
            value={cep}
            onChange={(e) => setCep(e.target.value)}
            autoComplete="postal-code"
            erro={mostrar('cep')}
          />
          <Campo
            rotulo="Bairro"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
            erro={mostrar('bairro')}
          />
        </div>
        <div className={c.linha}>
          <Campo
            rotulo="Rua"
            value={rua}
            onChange={(e) => setRua(e.target.value)}
            autoComplete="address-line1"
            erro={mostrar('rua')}
          />
          <Campo
            rotulo="Número"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            erro={mostrar('numero')}
          />
        </div>
      </fieldset>

      <fieldset className={c.grupo}>
        <legend>Saques</legend>
        <Campo
          rotulo="Chave Pix da barbearia"
          value={chavePix}
          onChange={(e) => setChavePix(e.target.value)}
          ajuda="Os saques do Financeiro caem nessa chave. CPF, CNPJ, e-mail, celular ou chave aleatória."
          erro={mostrar('chavePix')}
        />
      </fieldset>

      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      <div className={c.acoes}>
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Ativando…' : 'Ativar recebimentos'}
        </Botao>
      </div>
    </form>
  )
}
