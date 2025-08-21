import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import nfeApp from './nfe';

admin.initializeApp();

export const salvarCSV = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const { nomeArquivo, conteudo } = (req.body || {}) as { nomeArquivo?: string; conteudo?: string };

  if (!nomeArquivo || typeof conteudo !== 'string') {
    res.status(400).send('Parâmetros inválidos');
    return;
  }

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(`relatorios/${nomeArquivo}`);
    await file.save(conteudo, {
      contentType: 'text/csv',
    });
    res.status(200).json({ success: true });
    return;
  } catch (err) {
    functions.logger.error('Erro ao salvar CSV', { err });
    res.status(500).send('Erro ao salvar CSV');
    return;
  }
});

export const nfe = functions.https.onRequest(nfeApp);
