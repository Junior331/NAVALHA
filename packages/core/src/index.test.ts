import { describe, expect, it } from 'vitest'
import { VERSAO_CORE } from './index'

describe('@navalha/core', () => {
  it('exporta a versão do pacote', () => {
    expect(VERSAO_CORE).toBe('0.0.0')
  })
})
