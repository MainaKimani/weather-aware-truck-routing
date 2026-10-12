/** The app's pages (RFC §10.5). */
import type { RouteObject } from 'react-router'

import { AccountPage } from '../features/account/AccountPage'
import { AuthPage } from '../features/account/AuthPage'
import { PlannerHome } from '../features/planner/PlannerHome'
import { NotFound } from '../features/shell/NotFound'
import { RequireAccount } from '../features/shell/RequireAccount'
import { TripPage } from '../features/trip/TripPage'
import { TripsPage } from '../features/trips/TripsPage'
import { PageLayout, PlannerLayout, Root } from './layouts'

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      {
        element: <PlannerLayout />,
        children: [
          { index: true, element: <PlannerHome /> },
          { path: 'trips/:tripId', element: <TripPage /> },
        ],
      },
      {
        element: <PageLayout />,
        children: [
          { path: 'login', element: <AuthPage mode="login" /> },
          { path: 'signup', element: <AuthPage mode="signup" /> },
          {
            path: 'trips',
            element: (
              <RequireAccount>
                <TripsPage />
              </RequireAccount>
            ),
          },
          {
            path: 'account',
            element: (
              <RequireAccount>
                <AccountPage />
              </RequireAccount>
            ),
          },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]
