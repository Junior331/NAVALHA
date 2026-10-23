import { Redirect, useLocalSearchParams } from 'expo-router'

// Link universal da tela de acompanhar da web: abre o mesmo agendamento no app.
export default function LinkDoAgendamento() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <Redirect href={`/agendamento/${id}`} />
}
