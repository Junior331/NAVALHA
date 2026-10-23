import { criarFuncoes, inngest } from '@navalha/servidor/inngest'
import { serve } from 'inngest/next'
import { contexto } from '@/server/contexto'

// Endpoint que o Inngest chama para rodar as funções agendadas (docs/roadmap.md, fase 4).
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: Object.values(criarFuncoes(contexto)),
})
