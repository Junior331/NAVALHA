import { describe, expect, it } from 'vitest'
import { cemPorCento } from './versao'

describe('web', () => {
  it('importa o @navalha/core', () => {
    expect(cemPorCento()).toBe(10000)
  })
})
