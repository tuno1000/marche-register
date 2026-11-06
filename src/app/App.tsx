import { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './routes';

const router = createHashRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
