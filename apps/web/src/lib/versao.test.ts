import { describe, expect, it } from 'vitest'
import { versaoCore } from './versao'

describe('web', () => {
  it('importa o @navalha/core', () => {
    expect(versaoCore()).toBe('0.0.0')
  })
})
