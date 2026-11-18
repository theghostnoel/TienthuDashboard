import express from 'express';
import {
  forwardToAppsScriptWebhook,
  getReadOnlySheetBaselineState,
  readGoogleSheetReferenceData,
} from './googleSheets.ts';

const ALLOWED_WEBHOOK_ACTIONS = new Set([
  'ping',
  'appendTransaction',
  'upsertCatalogPart',
  'updateThamSo',
  'syncAll',
]);

export function createApiApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const handleGetReference = async (req: express.Request, res: express.Response) => {
    try {
      const customId =
        typeof req.query.spreadsheetId === 'string'
          ? req.query.spreadsheetId
          : undefined;
      const ref = await readGoogleSheetReferenceData(customId);
      res.setHeader('Cache-Control', 'no-store');
      res.json(ref);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể đọc dữ liệu từ Google Sheets.';
      res.status(502).json({ error: msg });
    }
  };

  app.get('/api/sheets/reference', handleGetReference);

  const handleGetBaselineState = async (req: express.Request, res: express.Response) => {
    try {
      const customId =
        typeof req.query.spreadsheetId === 'string'
          ? req.query.spreadsheetId
          : undefined;
      const state = await getReadOnlySheetBaselineState(customId);
      res.setHeader('Cache-Control', 'no-store');
      res.json(state);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể tải dữ liệu tồn kho.';
      res.status(502).json({ error: msg });
    }
  };

  app.get('/api/inventory/state', handleGetBaselineState);
  app.get('/api/sheets/state', handleGetBaselineState);

  app.post('/api/sheets/webhook', async (req: express.Request, res: express.Response) => {
    try {
      const body = req.body as {
        webhookUrl?: string;
        payload?: Record<string, unknown>;
      };
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Thiếu dữ liệu đồng bộ.' });
        return;
      }
      const action = String(body.payload?.action ?? '');
      if (!ALLOWED_WEBHOOK_ACTIONS.has(action)) {
        res.status(400).json({ error: 'Hành động đồng bộ không hợp lệ.' });
        return;
      }
      const result = await forwardToAppsScriptWebhook(
        String(body.webhookUrl ?? ''),
        body.payload ?? {}
      );
      res.setHeader('Cache-Control', 'no-store');
      res.json(result);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể gửi dữ liệu tới Google Apps Script.';
      const status = msg.includes('không hợp lệ')
        ? 400
        : msg.includes('HTTP 403')
        ? 403
        : msg.includes('HTTP 404')
        ? 404
        : 502;
      res.status(status).json({ error: msg });
    }
  });

  return app;
}

