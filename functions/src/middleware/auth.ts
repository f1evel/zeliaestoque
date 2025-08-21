import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, erro: { codigo: 'unauthenticated', mensagem: 'Token ausente' } });
  }

  const token = header.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, erro: { codigo: 'unauthenticated', mensagem: 'Token inválido' } });
  }
}
