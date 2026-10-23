
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "agendamento_servicos": {
                  Row: {
                    "agendamento_id": string,"duracao_min": number,"nome": string,"preco_centavos": number,"servico_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agendamento_id": string,"duracao_min": number,"nome": string,"preco_centavos": number,"servico_id": string
                  }
                  Update: {
                    "agendamento_id"?: string,"duracao_min"?: number,"nome"?: string,"preco_centavos"?: number,"servico_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agendamento_servicos_agendamento_id_fkey"
      columns: ["agendamento_id"]
isOneToOne: false
      referencedRelation: "agendamentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agendamento_servicos_servico_id_fkey"
      columns: ["servico_id"]
isOneToOne: false
      referencedRelation: "servicos"
      referencedColumns: ["id"]
    }
                  ]
                },"agendamentos": {
                  Row: {
                    "barbearia_id": string,"barbeiro_id": string,"cancelado_em": string | null,"cliente_id": string,"codigo": string,"concluido_em": string | null,"criado_em": string,"desconto_centavos": number,"fim": string,"id": string,"iniciado_em": string | null,"inicio": string,"motivo_cancelamento": string | null,"observacoes": string | null,"origem": Database["public"]['Enums']["origem_agendamento"],"pago_no_balcao": boolean,"plano": Database["public"]['Enums']["plano"],"prazo_gratis_ate": string,"promocao_id": string | null,"retencao_pct": number,"status": Database["public"]['Enums']["status_agendamento"],"tolerancia_ate": string,"usou_premio_fidelidade": boolean,"valor_bruto_centavos": number,"valor_pago_centavos": number,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "barbearia_id": string,"barbeiro_id": string,"cancelado_em"?: string | null,"cliente_id": string,"codigo"?: string,"concluido_em"?: string | null,"criado_em"?: string,"desconto_centavos"?: number,"fim": string,"id"?: string,"iniciado_em"?: string | null,"inicio": string,"motivo_cancelamento"?: string | null,"observacoes"?: string | null,"origem"?: Database["public"]['Enums']["origem_agendamento"],"pago_no_balcao"?: boolean,"plano": Database["public"]['Enums']["plano"],"prazo_gratis_ate": string,"promocao_id"?: string | null,"retencao_pct": number,"status": Database["public"]['Enums']["status_agendamento"],"tolerancia_ate": string,"usou_premio_fidelidade"?: boolean,"valor_bruto_centavos"?: number,"valor_pago_centavos": number,"versao"?: number
                  }
                  Update: {
                    "barbearia_id"?: string,"barbeiro_id"?: string,"cancelado_em"?: string | null,"cliente_id"?: string,"codigo"?: string,"concluido_em"?: string | null,"criado_em"?: string,"desconto_centavos"?: number,"fim"?: string,"id"?: string,"iniciado_em"?: string | null,"inicio"?: string,"motivo_cancelamento"?: string | null,"observacoes"?: string | null,"origem"?: Database["public"]['Enums']["origem_agendamento"],"pago_no_balcao"?: boolean,"plano"?: Database["public"]['Enums']["plano"],"prazo_gratis_ate"?: string,"promocao_id"?: string | null,"retencao_pct"?: number,"status"?: Database["public"]['Enums']["status_agendamento"],"tolerancia_ate"?: string,"usou_premio_fidelidade"?: boolean,"valor_bruto_centavos"?: number,"valor_pago_centavos"?: number,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "agendamentos_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agendamentos_barbeiro_id_barbearia_id_fkey"
      columns: ["barbeiro_id","barbearia_id"]
isOneToOne: false
      referencedRelation: "membros"
      referencedColumns: ["id","barbearia_id"]
    },{
      foreignKeyName: "agendamentos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agendamentos_promocao_fk"
      columns: ["promocao_id"]
isOneToOne: false
      referencedRelation: "promocoes"
      referencedColumns: ["id"]
    }
                  ]
                },"assinaturas": {
                  Row: {
                    "asaas_assinatura_id": string | null,"atualizada_em": string,"barbearia_id": string,"ciclo": Database["public"]['Enums']["ciclo_assinatura"] | null,"plano": Database["public"]['Enums']["plano"],"status": Database["public"]['Enums']["status_assinatura"],"trial_ate": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "asaas_assinatura_id"?: string | null,"atualizada_em"?: string,"barbearia_id": string,"ciclo"?: Database["public"]['Enums']["ciclo_assinatura"] | null,"plano"?: Database["public"]['Enums']["plano"],"status"?: Database["public"]['Enums']["status_assinatura"],"trial_ate"?: string | null
                  }
                  Update: {
                    "asaas_assinatura_id"?: string | null,"atualizada_em"?: string,"barbearia_id"?: string,"ciclo"?: Database["public"]['Enums']["ciclo_assinatura"] | null,"plano"?: Database["public"]['Enums']["plano"],"status"?: Database["public"]['Enums']["status_assinatura"],"trial_ate"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "assinaturas_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: true
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    }
                  ]
                },"avaliacoes": {
                  Row: {
                    "agendamento_id": string,"barbearia_id": string,"cliente_id": string,"comentario": string | null,"criada_em": string,"id": string,"membro_id": string,"nota": number
                  }
                  ComputedFields: never
                  Insert: {
                    "agendamento_id": string,"barbearia_id": string,"cliente_id": string,"comentario"?: string | null,"criada_em"?: string,"id"?: string,"membro_id": string,"nota": number
                  }
                  Update: {
                    "agendamento_id"?: string,"barbearia_id"?: string,"cliente_id"?: string,"comentario"?: string | null,"criada_em"?: string,"id"?: string,"membro_id"?: string,"nota"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "avaliacoes_agendamento_id_fkey"
      columns: ["agendamento_id"]
isOneToOne: true
      referencedRelation: "agendamentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "avaliacoes_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "avaliacoes_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "avaliacoes_membro_id_fkey"
      columns: ["membro_id"]
isOneToOne: false
      referencedRelation: "membros"
      referencedColumns: ["id"]
    }
                  ]
                },"barbearias": {
                  Row: {
                    "aceitar_agendamentos_online": boolean,"aparecer_nas_buscas": boolean,"bairro": string | null,"capa_url": string | null,"cidade": string | null,"criada_em": string,"descricao": string | null,"endereco": string | null,"fuso": string,"id": string,"instagram": string | null,"logo_url": string | null,"nome": string,"recebimentos_ativos_em": string | null,"slug": string,"telefone": string | null,"uf": string | null,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aceitar_agendamentos_online"?: boolean,"aparecer_nas_buscas"?: boolean,"bairro"?: string | null,"capa_url"?: string | null,"cidade"?: string | null,"criada_em"?: string,"descricao"?: string | null,"endereco"?: string | null,"fuso"?: string,"id"?: string,"instagram"?: string | null,"logo_url"?: string | null,"nome": string,"recebimentos_ativos_em"?: string | null,"slug": string,"telefone"?: string | null,"uf"?: string | null,"whatsapp"?: string | null
                  }
                  Update: {
                    "aceitar_agendamentos_online"?: boolean,"aparecer_nas_buscas"?: boolean,"bairro"?: string | null,"capa_url"?: string | null,"cidade"?: string | null,"criada_em"?: string,"descricao"?: string | null,"endereco"?: string | null,"fuso"?: string,"id"?: string,"instagram"?: string | null,"logo_url"?: string | null,"nome"?: string,"recebimentos_ativos_em"?: string | null,"slug"?: string,"telefone"?: string | null,"uf"?: string | null,"whatsapp"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"bloqueios": {
                  Row: {
                    "barbearia_id": string,"criado_em": string,"fim": string,"id": string,"inicio": string,"membro_id": string | null,"motivo": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "barbearia_id": string,"criado_em"?: string,"fim": string,"id"?: string,"inicio": string,"membro_id"?: string | null,"motivo"?: string | null
                  }
                  Update: {
                    "barbearia_id"?: string,"criado_em"?: string,"fim"?: string,"id"?: string,"inicio"?: string,"membro_id"?: string | null,"motivo"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bloqueios_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bloqueios_membro_id_fkey"
      columns: ["membro_id"]
isOneToOne: false
      referencedRelation: "membros"
      referencedColumns: ["id"]
    }
                  ]
                },"clientes": {
                  Row: {
                    "celular": string | null,"criado_em": string,"email": string | null,"id": string,"nome": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "celular"?: string | null,"criado_em"?: string,"email"?: string | null,"id"?: string,"nome": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "celular"?: string | null,"criado_em"?: string,"email"?: string | null,"id"?: string,"nome"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"clientes_gateway": {
                  Row: {
                    "barbearia_id": string,"cliente_id": string,"criado_em": string,"gateway_cliente_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barbearia_id": string,"cliente_id": string,"criado_em"?: string,"gateway_cliente_id": string
                  }
                  Update: {
                    "barbearia_id"?: string,"cliente_id"?: string,"criado_em"?: string,"gateway_cliente_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clientes_gateway_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clientes_gateway_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"convites": {
                  Row: {
                    "barbearia_id": string,"contato": string | null,"criado_em": string,"criado_por": string | null,"expira_em": string,"id": string,"nome": string,"papel": Database["public"]['Enums']["papel_membro"],"servico_ids": (string)[],"token_hash": string,"usado_em": string | null,"usado_por": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "barbearia_id": string,"contato"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"expira_em": string,"id"?: string,"nome": string,"papel"?: Database["public"]['Enums']["papel_membro"],"servico_ids"?: (string)[],"token_hash": string,"usado_em"?: string | null,"usado_por"?: string | null
                  }
                  Update: {
                    "barbearia_id"?: string,"contato"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"expira_em"?: string,"id"?: string,"nome"?: string,"papel"?: Database["public"]['Enums']["papel_membro"],"servico_ids"?: (string)[],"token_hash"?: string,"usado_em"?: string | null,"usado_por"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "convites_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    }
                  ]
                },"creditos_cliente": {
                  Row: {
                    "barbearia_id": string,"cliente_id": string,"criado_em": string,"id": string,"origem_agendamento_id": string,"usado_em_agendamento_id": string | null,"valor_centavos": number
                  }
                  ComputedFields: never
                  Insert: {
                    "barbearia_id": string,"cliente_id": string,"criado_em"?: string,"id"?: string,"origem_agendamento_id": string,"usado_em_agendamento_id"?: string | null,"valor_centavos": number
                  }
                  Update: {
                    "barbearia_id"?: string,"cliente_id"?: string,"criado_em"?: string,"id"?: string,"origem_agendamento_id"?: string,"usado_em_agendamento_id"?: string | null,"valor_centavos"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "creditos_cliente_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creditos_cliente_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creditos_cliente_origem_agendamento_id_fkey"
      columns: ["origem_agendamento_id"]
isOneToOne: true
      referencedRelation: "agendamentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creditos_cliente_usado_em_agendamento_id_fkey"
      columns: ["usado_em_agendamento_id"]
isOneToOne: false
      referencedRelation: "agendamentos"
      referencedColumns: ["id"]
    }
                  ]
                },"cupom_usos": {
                  Row: {
                    "agendamento_id": string,"cliente_id": string,"criado_em": string,"promocao_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agendamento_id": string,"cliente_id": string,"criado_em"?: string,"promocao_id": string
                  }
                  Update: {
                    "agendamento_id"?: string,"cliente_id"?: string,"criado_em"?: string,"promocao_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cupom_usos_agendamento_id_fkey"
      columns: ["agendamento_id"]
isOneToOne: true
      referencedRelation: "agendamentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cupom_usos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cupom_usos_promocao_id_fkey"
      columns: ["promocao_id"]
isOneToOne: false
      referencedRelation: "promocoes"
      referencedColumns: ["id"]
    }
                  ]
                },"dispositivos_push": {
                  Row: {
                    "criado_em": string,"expo_token": string,"plataforma": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"expo_token": string,"plataforma": string,"usuario_id": string
                  }
                  Update: {
                    "criado_em"?: string,"expo_token"?: string,"plataforma"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"favoritos": {
                  Row: {
                    "barbearia_id": string,"cliente_id": string,"criado_em": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barbearia_id": string,"cliente_id": string,"criado_em"?: string
                  }
                  Update: {
                    "barbearia_id"?: string,"cliente_id"?: string,"criado_em"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favoritos_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favoritos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"fidelidade_config": {
                  Row: {
                    "ativa": boolean,"barbearia_id": string,"cortes_necessarios": number,"servico_gratis_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ativa"?: boolean,"barbearia_id": string,"cortes_necessarios"?: number,"servico_gratis_id"?: string | null
                  }
                  Update: {
                    "ativa"?: boolean,"barbearia_id"?: string,"cortes_necessarios"?: number,"servico_gratis_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fidelidade_config_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: true
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fidelidade_config_servico_gratis_id_fkey"
      columns: ["servico_gratis_id"]
isOneToOne: false
      referencedRelation: "servicos"
      referencedColumns: ["id"]
    }
                  ]
                },"fidelidade_progresso": {
                  Row: {
                    "barbearia_id": string,"cliente_id": string,"cortes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "barbearia_id": string,"cliente_id": string,"cortes"?: number
                  }
                  Update: {
                    "barbearia_id"?: string,"cliente_id"?: string,"cortes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "fidelidade_progresso_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fidelidade_progresso_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"horarios_atendimento": {
                  Row: {
                    "barbearia_id": string,"dia_semana": number,"fim": string,"inicio": string,"membro_id": string,"pausa_fim": string | null,"pausa_inicio": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "barbearia_id": string,"dia_semana": number,"fim": string,"inicio": string,"membro_id": string,"pausa_fim"?: string | null,"pausa_inicio"?: string | null
                  }
                  Update: {
                    "barbearia_id"?: string,"dia_semana"?: number,"fim"?: string,"inicio"?: string,"membro_id"?: string,"pausa_fim"?: string | null,"pausa_inicio"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "horarios_atendimento_membro_id_barbearia_id_fkey"
      columns: ["membro_id","barbearia_id"]
isOneToOne: false
      referencedRelation: "membros"
      referencedColumns: ["id","barbearia_id"]
    }
                  ]
                },"horarios_barbearia": {
                  Row: {
                    "abre": string,"barbearia_id": string,"dia_semana": number,"fecha": string
                  }
                  ComputedFields: never
                  Insert: {
                    "abre": string,"barbearia_id": string,"dia_semana": number,"fecha": string
                  }
                  Update: {
                    "abre"?: string,"barbearia_id"?: string,"dia_semana"?: number,"fecha"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "horarios_barbearia_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    }
                  ]
                },"lancamentos": {
                  Row: {
                    "agendamento_id": string | null,"barbearia_centavos": number,"barbearia_id": string,"cliente_centavos": number,"credito_cliente_centavos": number,"criado_em": string,"evento_final": Database["public"]['Enums']["evento_final"] | null,"id": string,"navalha_centavos": number,"quem_paga_gateway": Database["public"]['Enums']["pagador_gateway"],"taxa_gateway_centavos": number,"tipo": Database["public"]['Enums']["tipo_lancamento"],"valor_pago_centavos": number
                  }
                  ComputedFields: never
                  Insert: {
                    "agendamento_id"?: string | null,"barbearia_centavos"?: number,"barbearia_id": string,"cliente_centavos"?: number,"credito_cliente_centavos"?: number,"criado_em"?: string,"evento_final"?: Database["public"]['Enums']["evento_final"] | null,"id"?: string,"navalha_centavos"?: number,"quem_paga_gateway"?: Database["public"]['Enums']["pagador_gateway"],"taxa_gateway_centavos"?: number,"tipo": Database["public"]['Enums']["tipo_lancamento"],"valor_pago_centavos"?: number
                  }
                  Update: {
                    "agendamento_id"?: string | null,"barbearia_centavos"?: number,"barbearia_id"?: string,"cliente_centavos"?: number,"credito_cliente_centavos"?: number,"criado_em"?: string,"evento_final"?: Database["public"]['Enums']["evento_final"] | null,"id"?: string,"navalha_centavos"?: number,"quem_paga_gateway"?: Database["public"]['Enums']["pagador_gateway"],"taxa_gateway_centavos"?: number,"tipo"?: Database["public"]['Enums']["tipo_lancamento"],"valor_pago_centavos"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "lancamentos_agendamento_id_fkey"
      columns: ["agendamento_id"]
isOneToOne: false
      referencedRelation: "agendamentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lancamentos_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    }
                  ]
                },"lotes_semanais": {
                  Row: {
                    "asaas_transferencia_id": string | null,"barbearia_id": string,"criado_em": string,"id": string,"semana": string,"status": Database["public"]['Enums']["status_transferencia"],"valor_centavos": number
                  }
                  ComputedFields: never
                  Insert: {
                    "asaas_transferencia_id"?: string | null,"barbearia_id": string,"criado_em"?: string,"id"?: string,"semana": string,"status"?: Database["public"]['Enums']["status_transferencia"],"valor_centavos": number
                  }
                  Update: {
                    "asaas_transferencia_id"?: string | null,"barbearia_id"?: string,"criado_em"?: string,"id"?: string,"semana"?: string,"status"?: Database["public"]['Enums']["status_transferencia"],"valor_centavos"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "lotes_semanais_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    }
                  ]
                },"membros": {
                  Row: {
                    "ativo": boolean,"barbearia_id": string,"criado_em": string,"id": string,"papel": Database["public"]['Enums']["papel_membro"],"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"barbearia_id": string,"criado_em"?: string,"id"?: string,"papel": Database["public"]['Enums']["papel_membro"],"usuario_id": string
                  }
                  Update: {
                    "ativo"?: boolean,"barbearia_id"?: string,"criado_em"?: string,"id"?: string,"papel"?: Database["public"]['Enums']["papel_membro"],"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "membros_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    }
                  ]
                },"notificacoes": {
                  Row: {
                    "corpo": string,"criada_em": string,"dados": NonNullable<Json>,"id": string,"lida_em": string | null,"tipo": string,"titulo": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "corpo": string,"criada_em"?: string,"dados"?: NonNullable<Json>,"id"?: string,"lida_em"?: string | null,"tipo"?: string,"titulo": string,"usuario_id": string
                  }
                  Update: {
                    "corpo"?: string,"criada_em"?: string,"dados"?: NonNullable<Json>,"id"?: string,"lida_em"?: string | null,"tipo"?: string,"titulo"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pagamentos": {
                  Row: {
                    "agendamento_id": string,"asaas_cobranca_id": string | null,"atualizado_em": string,"barbearia_id": string,"capturar_em": string | null,"cartao_final": string | null,"cartao_token": string | null,"criado_em": string,"falhou_em": string | null,"id": string,"ip_remoto": unknown,"meio": Database["public"]['Enums']["meio_pagamento"],"motivo_recusa": string | null,"pre_autorizar_em": string | null,"regularizar_ate": string | null,"status": Database["public"]['Enums']["status_pagamento"],"taxa_gateway_centavos": number,"valor_centavos": number,"valor_estornado_centavos": number
                  }
                  ComputedFields: never
                  Insert: {
                    "agendamento_id": string,"asaas_cobranca_id"?: string | null,"atualizado_em"?: string,"barbearia_id": string,"capturar_em"?: string | null,"cartao_final"?: string | null,"cartao_token"?: string | null,"criado_em"?: string,"falhou_em"?: string | null,"id"?: string,"ip_remoto"?: unknown,"meio": Database["public"]['Enums']["meio_pagamento"],"motivo_recusa"?: string | null,"pre_autorizar_em"?: string | null,"regularizar_ate"?: string | null,"status": Database["public"]['Enums']["status_pagamento"],"taxa_gateway_centavos"?: number,"valor_centavos": number,"valor_estornado_centavos"?: number
                  }
                  Update: {
                    "agendamento_id"?: string,"asaas_cobranca_id"?: string | null,"atualizado_em"?: string,"barbearia_id"?: string,"capturar_em"?: string | null,"cartao_final"?: string | null,"cartao_token"?: string | null,"criado_em"?: string,"falhou_em"?: string | null,"id"?: string,"ip_remoto"?: unknown,"meio"?: Database["public"]['Enums']["meio_pagamento"],"motivo_recusa"?: string | null,"pre_autorizar_em"?: string | null,"regularizar_ate"?: string | null,"status"?: Database["public"]['Enums']["status_pagamento"],"taxa_gateway_centavos"?: number,"valor_centavos"?: number,"valor_estornado_centavos"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pagamentos_agendamento_id_fkey"
      columns: ["agendamento_id"]
isOneToOne: true
      referencedRelation: "agendamentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagamentos_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    }
                  ]
                },"perfis": {
                  Row: {
                    "atualizado_em": string,"avatar_url": string | null,"celular": string | null,"nome": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"avatar_url"?: string | null,"celular"?: string | null,"nome": string,"usuario_id": string
                  }
                  Update: {
                    "atualizado_em"?: string,"avatar_url"?: string | null,"celular"?: string | null,"nome"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"perfis_profissionais": {
                  Row: {
                    "avatar_url": string | null,"barbearia_id": string,"bio": string | null,"especialidades": (string)[],"membro_id": string,"nome_exibicao": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"barbearia_id": string,"bio"?: string | null,"especialidades"?: (string)[],"membro_id": string,"nome_exibicao": string
                  }
                  Update: {
                    "avatar_url"?: string | null,"barbearia_id"?: string,"bio"?: string | null,"especialidades"?: (string)[],"membro_id"?: string,"nome_exibicao"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "perfis_profissionais_membro_id_barbearia_id_fkey"
      columns: ["membro_id","barbearia_id"]
isOneToOne: false
      referencedRelation: "membros"
      referencedColumns: ["id","barbearia_id"]
    }
                  ]
                },"politicas_cancelamento": {
                  Row: {
                    "barbearia_id": string,"prazo_gratis_horas": number,"retencao_pct": number,"tolerancia_min": number
                  }
                  ComputedFields: never
                  Insert: {
                    "barbearia_id": string,"prazo_gratis_horas"?: number,"retencao_pct"?: number,"tolerancia_min"?: number
                  }
                  Update: {
                    "barbearia_id"?: string,"prazo_gratis_horas"?: number,"retencao_pct"?: number,"tolerancia_min"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "politicas_cancelamento_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: true
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    }
                  ]
                },"promocoes": {
                  Row: {
                    "ativa": boolean,"barbearia_id": string,"codigo": string | null,"criada_em": string,"desconto_tipo": Database["public"]['Enums']["tipo_desconto"],"desconto_valor": number,"descricao": string | null,"dias_semana": (number)[] | null,"fim": string,"id": string,"inicio": string,"limite_usos": number | null,"nome": string,"servico_ids": (string)[] | null,"tipo": Database["public"]['Enums']["tipo_promocao"],"um_uso_por_cliente": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "ativa"?: boolean,"barbearia_id": string,"codigo"?: string | null,"criada_em"?: string,"desconto_tipo": Database["public"]['Enums']["tipo_desconto"],"desconto_valor": number,"descricao"?: string | null,"dias_semana"?: (number)[] | null,"fim": string,"id"?: string,"inicio": string,"limite_usos"?: number | null,"nome": string,"servico_ids"?: (string)[] | null,"tipo": Database["public"]['Enums']["tipo_promocao"],"um_uso_por_cliente"?: boolean
                  }
                  Update: {
                    "ativa"?: boolean,"barbearia_id"?: string,"codigo"?: string | null,"criada_em"?: string,"desconto_tipo"?: Database["public"]['Enums']["tipo_desconto"],"desconto_valor"?: number,"descricao"?: string | null,"dias_semana"?: (number)[] | null,"fim"?: string,"id"?: string,"inicio"?: string,"limite_usos"?: number | null,"nome"?: string,"servico_ids"?: (string)[] | null,"tipo"?: Database["public"]['Enums']["tipo_promocao"],"um_uso_por_cliente"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "promocoes_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    }
                  ]
                },"reservas_horario": {
                  Row: {
                    "barbearia_id": string,"barbeiro_id": string,"cliente_id": string,"criada_em": string,"dados": NonNullable<Json>,"expira_em": string,"fim": string,"id": string,"inicio": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barbearia_id": string,"barbeiro_id": string,"cliente_id": string,"criada_em"?: string,"dados"?: NonNullable<Json>,"expira_em": string,"fim": string,"id"?: string,"inicio": string
                  }
                  Update: {
                    "barbearia_id"?: string,"barbeiro_id"?: string,"cliente_id"?: string,"criada_em"?: string,"dados"?: NonNullable<Json>,"expira_em"?: string,"fim"?: string,"id"?: string,"inicio"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reservas_horario_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservas_horario_barbeiro_id_barbearia_id_fkey"
      columns: ["barbeiro_id","barbearia_id"]
isOneToOne: false
      referencedRelation: "membros"
      referencedColumns: ["id","barbearia_id"]
    },{
      foreignKeyName: "reservas_horario_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"saques": {
                  Row: {
                    "asaas_transferencia_id": string | null,"barbearia_id": string,"criado_em": string,"id": string,"solicitado_por": string | null,"status": Database["public"]['Enums']["status_transferencia"],"valor_centavos": number
                  }
                  ComputedFields: never
                  Insert: {
                    "asaas_transferencia_id"?: string | null,"barbearia_id": string,"criado_em"?: string,"id"?: string,"solicitado_por"?: string | null,"status"?: Database["public"]['Enums']["status_transferencia"],"valor_centavos": number
                  }
                  Update: {
                    "asaas_transferencia_id"?: string | null,"barbearia_id"?: string,"criado_em"?: string,"id"?: string,"solicitado_por"?: string | null,"status"?: Database["public"]['Enums']["status_transferencia"],"valor_centavos"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "saques_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    }
                  ]
                },"servico_barbeiro": {
                  Row: {
                    "barbearia_id": string,"membro_id": string,"servico_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barbearia_id": string,"membro_id": string,"servico_id": string
                  }
                  Update: {
                    "barbearia_id"?: string,"membro_id"?: string,"servico_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "servico_barbeiro_membro_id_barbearia_id_fkey"
      columns: ["membro_id","barbearia_id"]
isOneToOne: false
      referencedRelation: "membros"
      referencedColumns: ["id","barbearia_id"]
    },{
      foreignKeyName: "servico_barbeiro_servico_id_barbearia_id_fkey"
      columns: ["servico_id","barbearia_id"]
isOneToOne: false
      referencedRelation: "servicos"
      referencedColumns: ["id","barbearia_id"]
    }
                  ]
                },"servicos": {
                  Row: {
                    "ativo": boolean,"barbearia_id": string,"categoria": string | null,"criado_em": string,"desconto_tipo": Database["public"]['Enums']["tipo_desconto"] | null,"desconto_valor": number | null,"descricao": string | null,"duracao_min": number,"id": string,"nome": string,"ordem": number,"preco_centavos": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"barbearia_id": string,"categoria"?: string | null,"criado_em"?: string,"desconto_tipo"?: Database["public"]['Enums']["tipo_desconto"] | null,"desconto_valor"?: number | null,"descricao"?: string | null,"duracao_min": number,"id"?: string,"nome": string,"ordem"?: number,"preco_centavos": number
                  }
                  Update: {
                    "ativo"?: boolean,"barbearia_id"?: string,"categoria"?: string | null,"criado_em"?: string,"desconto_tipo"?: Database["public"]['Enums']["tipo_desconto"] | null,"desconto_valor"?: number | null,"descricao"?: string | null,"duracao_min"?: number,"id"?: string,"nome"?: string,"ordem"?: number,"preco_centavos"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "servicos_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    }
                  ]
                },"subcontas_asaas": {
                  Row: {
                    "asaas_conta_id": string,"barbearia_id": string,"chave_api_secret_id": string,"criada_em": string,"escrow_habilitado": boolean,"status_kyc": string,"wallet_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asaas_conta_id": string,"barbearia_id": string,"chave_api_secret_id": string,"criada_em"?: string,"escrow_habilitado"?: boolean,"status_kyc"?: string,"wallet_id": string
                  }
                  Update: {
                    "asaas_conta_id"?: string,"barbearia_id"?: string,"chave_api_secret_id"?: string,"criada_em"?: string,"escrow_habilitado"?: boolean,"status_kyc"?: string,"wallet_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subcontas_asaas_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: true
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    }
                  ]
                },"taxas_a_transferir": {
                  Row: {
                    "agendamento_id": string,"barbearia_id": string,"criado_em": string,"id": string,"lote_id": string | null,"valor_centavos": number
                  }
                  ComputedFields: never
                  Insert: {
                    "agendamento_id": string,"barbearia_id": string,"criado_em"?: string,"id"?: string,"lote_id"?: string | null,"valor_centavos": number
                  }
                  Update: {
                    "agendamento_id"?: string,"barbearia_id"?: string,"criado_em"?: string,"id"?: string,"lote_id"?: string | null,"valor_centavos"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "taxas_a_transferir_agendamento_id_fkey"
      columns: ["agendamento_id"]
isOneToOne: true
      referencedRelation: "agendamentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "taxas_a_transferir_barbearia_id_fkey"
      columns: ["barbearia_id"]
isOneToOne: false
      referencedRelation: "barbearias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "taxas_a_transferir_lote_id_fkey"
      columns: ["lote_id"]
isOneToOne: false
      referencedRelation: "lotes_semanais"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_eventos": {
                  Row: {
                    "id": string,"origem": string,"payload": NonNullable<Json>,"processado_em": string | null,"recebido_em": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"origem"?: string,"payload": NonNullable<Json>,"processado_em"?: string | null,"recebido_em"?: string,"tipo": string
                  }
                  Update: {
                    "id"?: string,"origem"?: string,"payload"?: NonNullable<Json>,"processado_em"?: string | null,"recebido_em"?: string,"tipo"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "barbearias_do_usuario":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"cliente_do_usuario":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"eh_dono":
{ Args: { "alvo": string }; Returns: boolean
                           },
"membro_do_usuario":
{ Args: { "alvo": string }; Returns: string
                           }
          }
          Enums: {
            "ciclo_assinatura": "mensal"|"anual","evento_final": "concluido"|"cancelado_no_prazo"|"cancelado_fora_do_prazo"|"no_show"|"cancelado_pela_barbearia","meio_pagamento": "pix"|"cartao","origem_agendamento": "app"|"web"|"balcao","pagador_gateway": "barbearia"|"navalha"|"cliente"|"ninguem","papel_membro": "dono"|"barbeiro","plano": "free"|"basic"|"pro","status_agendamento": "reservado"|"confirmado"|"em_atendimento"|"concluido"|"cancelado_no_prazo"|"cancelado_fora_do_prazo"|"cancelado_pela_barbearia"|"no_show"|"liberado","status_assinatura": "trial"|"ativa"|"inadimplente"|"cancelada","status_pagamento": "pix_aguardando"|"pix_pago"|"tokenizado"|"pre_autorizado"|"recusado"|"pre_autorizacao_cancelada"|"capturado"|"estornado_parcial"|"estornado","status_transferencia": "pendente"|"concluida"|"falhou","tipo_desconto": "percentual"|"fixo","tipo_lancamento": "liquidacao"|"saque"|"lote_taxa"|"credito_cliente","tipo_promocao": "cupom"|"automatica"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "ciclo_assinatura": ["mensal", "anual"],"evento_final": ["concluido", "cancelado_no_prazo", "cancelado_fora_do_prazo", "no_show", "cancelado_pela_barbearia"],"meio_pagamento": ["pix", "cartao"],"origem_agendamento": ["app", "web", "balcao"],"pagador_gateway": ["barbearia", "navalha", "cliente", "ninguem"],"papel_membro": ["dono", "barbeiro"],"plano": ["free", "basic", "pro"],"status_agendamento": ["reservado", "confirmado", "em_atendimento", "concluido", "cancelado_no_prazo", "cancelado_fora_do_prazo", "cancelado_pela_barbearia", "no_show", "liberado"],"status_assinatura": ["trial", "ativa", "inadimplente", "cancelada"],"status_pagamento": ["pix_aguardando", "pix_pago", "tokenizado", "pre_autorizado", "recusado", "pre_autorizacao_cancelada", "capturado", "estornado_parcial", "estornado"],"status_transferencia": ["pendente", "concluida", "falhou"],"tipo_desconto": ["percentual", "fixo"],"tipo_lancamento": ["liquidacao", "saque", "lote_taxa", "credito_cliente"],"tipo_promocao": ["cupom", "automatica"]
          }
        }
} as const
