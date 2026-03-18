import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppRouter from './route/Router';
import { keycloak, initOptions } from './config/keycloak';

async function bootstrap() {
  try {
    await keycloak.init(initOptions);

    createRoot(document.getElementById('root') as HTMLElement).render(
      <StrictMode>
        <AppRouter />
      </StrictMode>,
    );
  } catch (error) {
    console.error('Keycloak init failed', error);
  }
}

bootstrap();
