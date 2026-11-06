import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '../app/routes';

/** アプリの画面を、指定した URL の履歴で表示する（最後が今の画面） */
export function renderApp(...paths: string[]) {
  const router = createMemoryRouter(routes, {
    initialEntries: paths,
    initialIndex: paths.length - 1,
  });
  const user = userEvent.setup();
  render(<RouterProvider router={router} />);
  return { router, user, path: () => router.state.location.pathname };
}
