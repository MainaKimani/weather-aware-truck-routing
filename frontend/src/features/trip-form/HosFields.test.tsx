import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { PlanRequest } from '../../api/schema'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { renderWithClient } from '../../test/render'
import { PLANS, apiError, server } from '../../test/server'
import { TripForm } from './TripForm'

const now = () => new Date('2026-10-12T10:20:00Z')

function setup() {
  const bodies: PlanRequest[] = []
  server.use(
    http.post(PLANS, async ({ request }) => {
      bodies.push((await request.json()) as PlanRequest)
      return HttpResponse.json(demoPlan)
    }),
  )
  const user = userEvent.setup()
  renderWithClient(<TripForm now={now} />)
  return { user, bodies }
}

const toggle = () => screen.getByRole('switch', { name: 'Hours of Service' })

async function setClock(user: ReturnType<typeof userEvent.setup>, label: string, text: string) {
  const input = screen.getByLabelText(label)
  await user.clear(input)
  await user.type(input, text)
}

describe('Hours of Service fields', () => {
  it('are off by default: hidden, and only {enabled: false} is sent', async () => {
    const { user, bodies } = setup()

    expect(toggle()).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByLabelText('Drive time available')).not.toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Use the demo trip' }))
    await user.click(screen.getByRole('button', { name: 'Plan trip' }))

    await waitFor(() => {
      expect(bodies).toHaveLength(1)
    })
    expect(bodies[0]?.hos).toEqual({ enabled: false })
  })

  it('send the four clocks in hours when on', async () => {
    const { user, bodies } = setup()
    await user.click(screen.getByRole('button', { name: 'Use the demo trip' }))

    await user.click(toggle())
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    await setClock(user, 'Drive time available', '10:20')
    await setClock(user, 'Cycle time available', '52:30')
    await user.click(screen.getByRole('button', { name: 'Plan trip' }))

    await waitFor(() => {
      expect(bodies).toHaveLength(1)
    })
    expect(bodies[0]?.hos).toEqual({
      enabled: true,
      cycle: '70h_8d',
      drive_left_h: '10.33',
      window_left_h: '14.00',
      until_break_h: '8.00',
      cycle_left_h: '52.50',
    })
  })

  it('stop drive time exceeding the shift window', async () => {
    const { user, bodies } = setup()
    await user.click(screen.getByRole('button', { name: 'Use the demo trip' }))
    await user.click(toggle())

    await setClock(user, 'Shift time available', '9:00')
    await user.click(screen.getByRole('button', { name: 'Plan trip' }))

    expect(
      await screen.findByText("Can't be more than the shift window or cycle time left."),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Drive time available')).toHaveAttribute('aria-invalid', 'true')
    expect(bodies).toEqual([])
  })

  it('cap a 70 h cycle value when switching to 60 h, and say so', async () => {
    const { user } = setup()
    await user.click(toggle())

    await user.selectOptions(screen.getByLabelText('Cycle'), '60 h / 7 days')

    expect(screen.getByLabelText('Cycle time available')).toHaveValue('60:00')
    expect(screen.getByRole('status')).toHaveTextContent('Cycle time capped at 60:00')
    expect(screen.getByText('of 60:00')).toBeInTheDocument()
  })

  it('leave a cycle value that fits the new cycle alone', async () => {
    const { user } = setup()
    await user.click(toggle())
    await setClock(user, 'Cycle time available', '52:30')

    await user.selectOptions(screen.getByLabelText('Cycle'), '60 h / 7 days')

    expect(screen.getByLabelText('Cycle time available')).toHaveValue('52:30')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('show HOS errors from the server on their clocks', async () => {
    server.use(
      http.post(PLANS, () =>
        apiError(400, 'invalid_input', 'Some fields are invalid.', {
          fields: { 'hos.until_break_h': ['Ensure this value is less than or equal to 8.'] },
        }),
      ),
    )
    const user = userEvent.setup()
    renderWithClient(<TripForm now={now} />)
    await user.click(screen.getByRole('button', { name: 'Use the demo trip' }))
    await user.click(toggle())

    await user.click(screen.getByRole('button', { name: 'Plan trip' }))

    expect(
      await screen.findByText('Ensure this value is less than or equal to 8.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Time until break')).toHaveAttribute('aria-invalid', 'true')
  })

  it('explain how stops are calculated', async () => {
    const { user } = setup()
    await user.click(toggle())

    await user.click(screen.getByText('How is this calculated?'))

    expect(screen.getByText(/a 34 h restart/)).toBeVisible()
  })
})
