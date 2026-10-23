// O QR Code do Pix só vem na resposta do checkout (o servidor não guarda a imagem): fica na
// memória do app enquanto ele estiver aberto, para a tela de acompanhar mostrar.

export interface PixDoCheckout {
  copiaECola: string
  qrCodeBase64: string
  qrCodeExpiraEm: string
  reservadoAte: string
  valorPagoCentavos: number
}

const guardados = new Map<string, PixDoCheckout>()

export function guardarPix(reservaId: string, pix: PixDoCheckout): void {
  guardados.set(reservaId, pix)
}

export function pixGuardado(reservaId: string): PixDoCheckout | null {
  return guardados.get(reservaId) ?? null
}
