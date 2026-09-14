import { Router, Request, Response } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = Router();

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const file = req.file;
    const ext = file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabaseAdmin.storage.from('images').upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (error) throw error;

    const { data: urlData } = supabaseAdmin.storage.from('images').getPublicUrl(fileName);
    res.json({ url: urlData.publicUrl, path: fileName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
