import type { Metadata } from 'next'
import { DM_Mono, Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--fonte-inter',
  subsets: ['latin'],
})

// Horários, valores e eixos: mono com zero cortado, como no Figma.
const dmMono = DM_Mono({
  variable: '--fonte-dm-mono',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
})

export const metadata: Metadata = {
  title: 'Navalha',
  description: 'Agendamento e pagamento para barbearias',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${dmMono.variable}`}>
      {/* Extensões do navegador mexem no body antes da hidratação. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
