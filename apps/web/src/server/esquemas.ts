import { z } from 'zod'

// Entrada das rotas da API. Ids com z.guid(): o seed usa UUIDs fixos fora da variante RFC.
const id = z.guid()
const digitos = (min: number, max = min) => z.string().regex(new RegExp(`^\\d{${min},${max}}$`))

export const esquemaAgendamento = z.object({
  barbeariaId: id,
  servicoIds: z.array(id).min(1).max(10),
  barbeiroId: z.union([id, z.literal('qualquer')]),
  inicio: z.iso.datetime(),
  meio: z.enum(['pix', 'cartao']),
  cupom: z.string().trim().min(1).max(40).optional(),
  usarPremio: z.boolean().optional(),
  origem: z.enum(['app', 'web']).default('app'),
  cartao: z
    .object({
      numero: digitos(13, 19),
      nomeImpresso: z.string().trim().min(2).max(60),
      validade: z.string().regex(/^\d{2}\/\d{2}$/),
      cvv: digitos(3, 4),
    })
    .optional(),
  titular: z
    .object({
      nome: z.string().trim().min(2).max(100),
      email: z.email(),
      cpfCnpj: z.string().regex(/^(\d{11}|\d{14})$/),
      cep: digitos(8),
      numeroEndereco: z.string().trim().min(1).max(10),
      celular: digitos(10, 11),
    })
    .optional(),
})

export const esquemaPreco = z.object({
  barbeariaId: id,
  servicoIds: z.array(id).min(1).max(10),
  inicio: z.iso.datetime(),
  cupom: z.string().trim().min(1).max(40).optional(),
  usarPremio: z.boolean().optional(),
})

export const esquemaCancelamento = z.object({
  escolhaPix: z.enum(['credito', 'reembolso']).optional(),
  motivo: z.string().trim().max(200).optional(),
})

export const esquemaCliente = z.object({
  nome: z.string().trim().min(2).max(100),
  celular: digitos(10, 11).optional(),
  email: z.email().optional(),
})

export const esquemaBarbearia = z.object({
  nome: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(3).max(60),
  nomeDoDono: z.string().trim().min(2).max(100),
  telefone: z.string().trim().max(20).optional(),
  whatsapp: z.string().trim().max(20).optional(),
  endereco: z.string().trim().max(120).optional(),
  bairro: z.string().trim().max(60).optional(),
  cidade: z.string().trim().max(60).optional(),
  uf: z.string().trim().length(2).optional(),
  plano: z.enum(['free', 'basic', 'pro']),
  ciclo: z.enum(['mensal', 'anual']).optional(),
})

export const esquemaConvite = z.object({
  barbeariaId: id,
  nome: z.string().trim().min(2).max(100),
  contato: z.string().trim().max(120).optional(),
  servicoIds: z.array(id).max(30).default([]),
})

export const esquemaDispositivo = z.object({
  expoToken: z.string().min(10).max(200),
  plataforma: z.enum(['ios', 'android']),
})

export const esquemaRemarcacao = z.object({
  inicio: z.iso.datetime(),
  barbeiroId: id.optional(),
})

export const esquemaBalcao = z.object({
  barbeariaId: id,
  cliente: z.union([
    z.object({ id }),
    z.object({
      nome: z.string().trim().min(2).max(100),
      celular: digitos(10, 11).optional(),
      email: z.email().optional(),
    }),
  ]),
  servicoIds: z.array(id).min(1).max(10),
  barbeiroId: id,
  inicio: z.iso.datetime(),
  observacoes: z.string().trim().max(300).optional(),
})

export const esquemaAtivacao = z.object({
  titular: z.object({
    nome: z.string().trim().min(2).max(100),
    email: z.email(),
    cpfCnpj: z.string().regex(/^(\d{11}|\d{14})$/),
    celular: digitos(10, 11),
    faturamentoMensalCentavos: z.number().int().positive().max(10_000_000_000),
    endereco: z.object({
      logradouro: z.string().trim().min(2).max(120),
      numero: z.string().trim().min(1).max(10),
      bairro: z.string().trim().min(2).max(60),
      cep: digitos(8),
    }),
  }),
  chavePix: z.string().trim().min(5).max(77),
})

export const esquemaSaque = z.object({
  valorCentavos: z.number().int().positive(),
})

export const esquemaAgendamentosOnline = z.object({ aceitar: z.boolean() })
