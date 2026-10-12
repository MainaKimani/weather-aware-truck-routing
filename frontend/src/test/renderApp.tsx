import { render } from '@testing-library/react'

import App from '../App'
import { freshClient } from './render'

/** The whole app at `path`, on an in-memory router, with a fresh query cache. */
export function renderApp(path = '/', client = freshClient()) {
  return { client, ...render(<App queryClient={client} initialPath={path} />) }
}
