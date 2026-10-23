// App Links do Android: o mesmo endereço abre o app quando ele está instalado.
// ANDROID_SHA256 = impressões digitais SHA-256 do certificado de assinatura, separadas por vírgula.
export function GET() {
  const impressoes = (process.env.ANDROID_SHA256 ?? '')
    .split(',')
    .map((valor) => valor.trim())
    .filter(Boolean)
  if (impressoes.length === 0) return new Response(null, { status: 404 })
  return Response.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'app.navalha',
        sha256_cert_fingerprints: impressoes,
      },
    },
  ])
}
