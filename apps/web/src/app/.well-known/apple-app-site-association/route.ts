// Universal Links do iOS: com o app instalado, navalha.app/<slug> e os convites abrem no app
// (docs/Navalha — Fluxo do dono até o cliente agendar). IOS_APP_ID = "<Team ID>.app.navalha".
export function GET() {
  const appId = process.env.IOS_APP_ID
  if (!appId) return new Response(null, { status: 404 })
  return Response.json({
    applinks: {
      details: [
        {
          appIDs: [appId],
          components: [
            { '/': '/painel*', exclude: true },
            { '/': '/api/*', exclude: true },
            { '/': '/convite/*' },
            { '/': '/*' },
          ],
        },
      ],
    },
  })
}
