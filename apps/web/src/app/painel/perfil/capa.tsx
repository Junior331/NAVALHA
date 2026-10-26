'use client'

import { File as Arquivo, ImageIcon, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Botao, Mensagem, Modal } from '@/componentes/ui'
import { supabaseNoNavegador } from '@/lib/supabase'
import p from './perfil.module.css'

// Figma Admin 09 · Alterar capa: prévia, arquivo escolhido (nome, tamanho e medidas) e confirmação.
// A imagem sobe para o Storage na confirmação; o perfil só grava a URL ao salvar.

export const TIPOS_DE_IMAGEM = ['image/jpeg', 'image/png', 'image/webp']
export const LIMITE_DA_IMAGEM = 2 * 1024 * 1024

interface Escolhida {
  arquivo: File
  url: string
  largura: number | null
  altura: number | null
}

export function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

/** Sobe a imagem para a pasta da barbearia no Storage e devolve a URL pública. */
export async function enviarImagem(
  barbeariaId: string,
  tipo: 'capa' | 'logo',
  arquivo: File,
): Promise<string> {
  const extensao = arquivo.type.split('/')[1] ?? 'jpg'
  const caminho = `${barbeariaId}/${tipo}-${Date.now()}.${extensao}`
  const armazenamento = supabaseNoNavegador().storage.from('barbearias')
  const { error } = await armazenamento.upload(caminho, arquivo, {
    contentType: arquivo.type,
    upsert: true,
  })
  if (error) throw error
  return armazenamento.getPublicUrl(caminho).data.publicUrl
}

export function AlterarCapa({
  barbeariaId,
  atual,
  aberto,
  aoFechar,
  aoUsar,
}: {
  barbeariaId: string
  atual: string | null
  aberto: boolean
  aoFechar: () => void
  aoUsar: (url: string) => void
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [escolhida, setEscolhida] = useState<Escolhida | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function limpar() {
    if (escolhida) URL.revokeObjectURL(escolhida.url)
    setEscolhida(null)
    setErro(null)
    if (entrada.current) entrada.current.value = ''
  }

  function fechar() {
    limpar()
    aoFechar()
  }

  function escolher(arquivo: File | undefined) {
    if (!arquivo) return
    if (!TIPOS_DE_IMAGEM.includes(arquivo.type)) {
      setErro('Use uma imagem JPG, PNG ou WebP.')
      return
    }
    if (arquivo.size > LIMITE_DA_IMAGEM) {
      setErro(`A imagem tem ${megabytes(arquivo.size)}; o limite é ${megabytes(LIMITE_DA_IMAGEM)}.`)
      return
    }
    if (escolhida) URL.revokeObjectURL(escolhida.url)
    const url = URL.createObjectURL(arquivo)
    setErro(null)
    setEscolhida({ arquivo, url, largura: null, altura: null })
    const imagem = new Image()
    imagem.onload = () =>
      setEscolhida((atual) =>
        atual?.url === url
          ? { ...atual, largura: imagem.naturalWidth, altura: imagem.naturalHeight }
          : atual,
      )
    imagem.src = url
  }

  async function usar() {
    if (!escolhida) return
    setEnviando(true)
    setErro(null)
    try {
      aoUsar(await enviarImagem(barbeariaId, 'capa', escolhida.arquivo))
      limpar()
      aoFechar()
    } catch {
      setErro('Não foi possível enviar a imagem. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  const previa = escolhida?.url ?? atual
  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo="Alterar capa"
      descricao="Aparece no topo da página da barbearia no app"
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar} disabled={enviando}>
            Cancelar
          </Botao>
          <Botao variante="secundario" onClick={usar} disabled={!escolhida || enviando}>
            {enviando ? 'Enviando…' : 'Usar esta capa'}
          </Botao>
        </>
      }
    >
      <button
        type="button"
        className={p.capaGrande}
        style={previa ? { backgroundImage: `url(${previa})` } : undefined}
        onClick={() => entrada.current?.click()}
        aria-label={previa ? 'Escolher outra imagem para a capa' : 'Escolher imagem para a capa'}
      >
        {previa ? null : <ImageIcon size={22} strokeWidth={1.5} aria-hidden />}
      </button>
      <input
        ref={entrada}
        type="file"
        accept={TIPOS_DE_IMAGEM.join(',')}
        className="so-leitor"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => escolher(e.target.files?.[0])}
      />
      {escolhida ? (
        <div className={p.arquivo}>
          <Arquivo size={18} strokeWidth={1.5} aria-hidden />
          <span>
            <strong>{escolhida.arquivo.name}</strong>
            <span>
              {megabytes(escolhida.arquivo.size)}
              {escolhida.largura ? ` · ${escolhida.largura}×${escolhida.altura} px` : ''}
            </span>
          </span>
          <button
            type="button"
            className={p.lixeira}
            onClick={limpar}
            aria-label="Tirar esta imagem"
          >
            <Trash2 size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      ) : (
        <Botao variante="secundario" onClick={() => entrada.current?.click()}>
          <Upload size={16} strokeWidth={1.75} aria-hidden />
          Escolher imagem
        </Botao>
      )}
      <p className={p.ajuda}>
        Recomendado: 1600×600 px, JPG, PNG ou WebP, até {megabytes(LIMITE_DA_IMAGEM)}.
      </p>
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
    </Modal>
  )
}
