import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportMapping } from './import-mapping'
import { MAPPING_STORAGE_KEY } from '@/lib/mapping/storage'

afterEach(() => {
  cleanup()
})

const validJson = JSON.stringify({
  version: 1,
  words: { '$test1': 'minecraft:stone' },
})

describe('ImportMapping', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves a valid pasted mapping and calls onImport', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn()
    render(<ImportMapping onImport={onImport} />)

    await user.click(screen.getByRole('textbox'))
    await user.paste(validJson)
    await user.click(screen.getByRole('button', { name: /import/i }))

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith({
        version: 1,
        words: { '$test1': 'minecraft:stone' },
      })
    })
    expect(localStorage.getItem(MAPPING_STORAGE_KEY)).not.toBeNull()
  })

  it('shows a specific validation error and does not touch localStorage on invalid shape', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn()
    render(<ImportMapping onImport={onImport} />)

    await user.click(screen.getByRole('textbox'))
    await user.paste(JSON.stringify({ words: {} }))
    await user.click(screen.getByRole('button', { name: /import/i }))

    expect(await screen.findByText(/version/i)).toBeInTheDocument()
    expect(onImport).not.toHaveBeenCalled()
    expect(localStorage.getItem(MAPPING_STORAGE_KEY)).toBeNull()
  })

  it('shows an error for unparsable JSON and does not touch localStorage', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn()
    render(<ImportMapping onImport={onImport} />)

    await user.click(screen.getByRole('textbox'))
    await user.paste('{ not json')
    await user.click(screen.getByRole('button', { name: /import/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/json/i)
    expect(onImport).not.toHaveBeenCalled()
    expect(localStorage.getItem(MAPPING_STORAGE_KEY)).toBeNull()
  })

  it('saves a valid mapping selected as a file and calls onImport', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn()
    render(<ImportMapping onImport={onImport} />)

    const file = new File([validJson], 'mapping.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText(/mapping json file/i), file)

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith({
        version: 1,
        words: { '$test1': 'minecraft:stone' },
      })
    })
    expect(localStorage.getItem(MAPPING_STORAGE_KEY)).not.toBeNull()
  })

  it('shows a specific validation error for an invalid mapping file and does not touch localStorage', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn()
    render(<ImportMapping onImport={onImport} />)

    const file = new File([JSON.stringify({ words: {} })], 'mapping.json', {
      type: 'application/json',
    })
    await user.upload(screen.getByLabelText(/mapping json file/i), file)

    expect(await screen.findByText(/version/i)).toBeInTheDocument()
    expect(onImport).not.toHaveBeenCalled()
    expect(localStorage.getItem(MAPPING_STORAGE_KEY)).toBeNull()
  })
})
