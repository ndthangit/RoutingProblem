import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppRouter from './route/Router';
import { keycloak, initOptions } from './config/keycloak';
import { ReactKeycloakProvider } from '@react-keycloak/web/lib/provider';

async function bootstrap() {
  try {
    await keycloak.init(initOptions);

    createRoot(document.getElementById('root') as HTMLElement).render(
      <StrictMode>
        <ReactKeycloakProvider
          authClient={keycloak}
          initOptions={initOptions}
          onTokens={(tokens) => {
            if (tokens?.token) {
              localStorage.setItem('access_token', tokens.token);
            } else {
              localStorage.removeItem('access_token');
            }
          }}
        >
          <AppRouter />
        </ReactKeycloakProvider>
      </StrictMode>,
    );
  } catch (error) {
    console.error('Keycloak init failed', error);
  }
}

bootstrap();
