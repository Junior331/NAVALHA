import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState, Platform } from 'react-native'
import type { Database } from '@navalha/db/tipos'

// Sessão do Supabase Auth guardada no aparelho (AsyncStorage; no navegador, localStorage).

export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:55321',
  supabaseChave: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  simularPix: process.env.EXPO_PUBLIC_SIMULAR_PIX === '1',
}

export const supabase = createClient<Database>(config.supabaseUrl, config.supabaseChave, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// No celular, renova o token só com o app em primeiro plano.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') void supabase.auth.startAutoRefresh()
    else void supabase.auth.stopAutoRefresh()
  })
}
