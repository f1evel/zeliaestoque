// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');
import { authMiddleware } from '../middleware/auth';
import { parseNfe } from './parse';
import * as admin from 'firebase-admin';
import { createHash, randomUUID } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Busboy = require('@fastify/busboy');
import * as functions from 'firebase-functions';

const app = express();
const allowedOrigins = (process.env.APP_ORIGIN || 'http://localhost:5000').split(',');
const NFE_PROVIDER = process.env.NFE_PROVIDER || null;
const NFE_API_KEY = process.env.NFE_API_KEY || undefined;
const NFE_PFX_BASE64 = process.env.NFE_PFX_BASE64 || undefined;
const NFE_PFX_PASSWORD = process.env.NFE_PFX_PASSWORD || undefined;

app.use((req: any, res: any, next: any) => {
  const origin = req.headers.origin as string | undefined;
  if (!origin || !allowedOrigins.includes(origin)) {
    return res
      .status(403)
      .json({ ok: false, erro: { codigo: 'origem_nao_autorizada', mensagem: 'Origem não permitida' } });
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }
  return next();
});

app.use((req: any, _res: any, next: any) => {
  (req as any).requestId = randomUUID();
  functions.logger.info('Request', { requestId: (req as any).requestId, path: req.path });
  next();
});

app.post('/nfe/importarPorChave', authMiddleware, express.json(), async (req: any, res: any) => {
  const chave = (req.body?.chave ?? '') as string;
  if (!/^\d{44}$/.test(chave)) {
    return res.status(400).json({ ok: false, erro: { codigo: 'chave_invalida', mensagem: 'Chave inválida' } });
  }

  const xml = '<NFe>dummy</NFe>';
  const hashXml = createHash('sha256').update(xml).digest('hex');
  const filePath = `nfe/xml/${chave}.xml`;
  const bucket = admin.storage().bucket();
  const docRef = admin.firestore().collection('nfe_importacoes').doc(chave);
  const snap = await docRef.get();
  if (snap.exists && snap.data()?.hashXml === hashXml) {
    const data = snap.data()!;
    return res.json({ ok: true, importacao: { chave, resumo: data.resumo, itens: data.itens } });
  }

  await bucket.file(filePath).save(xml, { contentType: 'application/xml' });
  const resumo = { emit: {}, dest: {}, ide: {}, total: {} };
  const itens: any[] = [];
  const provider = process.env.NFE_PROVIDER || null;
  await docRef.set(
    {
      status: 'concluido',
      provider,
      resumo,
      itens,
      xmlStoragePath: filePath,
      hashXml,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return res.json({ ok: true, importacao: { chave, resumo, itens } });
});

app.post('/nfe/uploadXml', authMiddleware, (req: any, res: any) => {
  const bb = Busboy({ headers: req.headers });
  let xml = '';
  bb.on('file', (_name: any, file: any) => {
    file.setEncoding('utf8');
    file.on('data', (data: any) => (xml += data));
  });
  bb.on('close', async () => {
    if (!xml) {
      res.status(400).json({ ok: false, erro: { codigo: 'xml_invalido', mensagem: 'XML ausente' } });
      return;
    }
    const { chave, resumo, itens } = parseNfe(xml);
    if (!/^\d{44}$/.test(chave)) {
      res.status(400).json({ ok: false, erro: { codigo: 'chave_invalida', mensagem: 'Chave inválida' } });
      return;
    }
    const hashXml = createHash('sha256').update(xml).digest('hex');
    const filePath = `nfe/xml/${chave}.xml`;
    const bucket = admin.storage().bucket();
    const docRef = admin.firestore().collection('nfe_importacoes').doc(chave);
    const snap = await docRef.get();
    if (snap.exists && snap.data()?.hashXml === hashXml) {
      const data = snap.data()!;
      res.json({ ok: true, importacao: { chave, resumo: data.resumo, itens: data.itens } });
      return;
    }
    await bucket.file(filePath).save(xml, { contentType: 'application/xml' });
    const provider = process.env.NFE_PROVIDER || null;
    await docRef.set(
      {
        status: 'concluido',
        provider,
        resumo,
        itens,
        xmlStoragePath: filePath,
        hashXml,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    res.json({ ok: true, importacao: { chave, resumo, itens } });
  });
  bb.on('error', (err: any) => {
    functions.logger.error('Upload XML error', { err, requestId: (req as any).requestId });
    res.status(500).json({ ok: false, erro: { codigo: 'erro_processar', mensagem: 'Erro ao processar XML' } });
  });
  req.pipe(bb);
});

export default app;
