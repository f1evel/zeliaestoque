const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.salvarCSV = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const { nomeArquivo, conteudo } = req.body || {};

  if (!nomeArquivo || typeof conteudo !== 'string') {
    return res.status(400).send('Par\u00e2metros inv\u00e1lidos');
  }

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(`relatorios/${nomeArquivo}`);
    await file.save(conteudo, {
      contentType: 'text/csv'
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro ao salvar CSV:', err);
    return res.status(500).send('Erro ao salvar CSV');
  }
});
