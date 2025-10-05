import ee from '@google/earthengine';

let initialized: Promise<void> | null = null;

export function authenticate() {
  if (initialized) {
    return initialized;
  }

  initialized = new Promise((resolve, reject) => {
    const privateKey = process.env.EE_PRIVATE_KEY;
    const clientEmail = process.env.EE_CLIENT_EMAIL;

    const onAuthSuccess = () => ee.initialize(null, null, resolve, reject);

    // Manipulador de erros personalizado para fornecer feedback mais claro
    const onAuthFailure = (err: any) => {
      const originalError = err?.message || String(err) || 'Unknown authentication error.';
      if (typeof originalError === 'string' && originalError.includes('DECODER routines::unsupported')) {
        const customError = new Error(
          'Falha ao decodificar a chave privada (EE_PRIVATE_KEY). Verifique o formato no seu ficheiro .env.local. ' +
          'Deve ser uma ÚNICA linha com os caracteres de nova linha escapados como \\n. ' +
          'Exemplo: EE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\
MIIC...\
-----END PRIVATE KEY-----\
"'
        );
        reject(customError);
      } else {
        reject(new Error(originalError));
      }
    };

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('Authenticating using GOOGLE_APPLICATION_CREDENTIALS');
      ee.data.authenticateViaPrivateKey(
        require(process.env.GOOGLE_APPLICATION_CREDENTIALS),
        onAuthSuccess,
        onAuthFailure
      );
    } else if (privateKey && clientEmail) {
      console.log('Authenticating using EE_PRIVATE_KEY and EE_CLIENT_EMAIL');
      const credentials = {
        private_key: privateKey.replace(/\\n/g, '\n'),
        client_email: clientEmail
      };
      ee.data.authenticateViaPrivateKey(
        credentials,
        onAuthSuccess,
        onAuthFailure
      );
    } else {
      reject(new Error('A autenticação do Earth Engine falhou. As credenciais do lado do servidor (EE_PRIVATE_KEY e EE_CLIENT_EMAIL) não estão configuradas no ficheiro .env.local.'));
    }
  });

  return initialized;
}
