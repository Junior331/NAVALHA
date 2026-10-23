import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { AndroidImportance } from 'expo-notifications'
import { Platform } from 'react-native'
import { api } from './api'

// Push no aparelho (canal principal do MVP; e-mail é o fallback, roadmap §WhatsApp). O token do
// Expo vai para /api/dispositivos. Sem projeto EAS (desenvolvimento local) não há token: segue sem.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

export async function registrarParaPush(): Promise<
  'registrado' | 'sem_permissao' | 'indisponivel'
> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'indisponivel'
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('padrao', {
      name: 'Agendamentos',
      importance: AndroidImportance.DEFAULT,
    })
  }
  const atual = await Notifications.getPermissionsAsync()
  const permissao = atual.granted ? atual : await Notifications.requestPermissionsAsync()
  if (!permissao.granted) return 'sem_permissao'

  const projetoId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId
  if (!projetoId) return 'indisponivel'
  const { data: expoToken } = await Notifications.getExpoPushTokenAsync({ projectId: projetoId })
  await api('/api/dispositivos', {
    corpo: { expoToken, plataforma: Platform.OS === 'ios' ? 'ios' : 'android' },
  })
  return 'registrado'
}
