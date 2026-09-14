import { Router, Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../config/supabase';
import { isValidMarket } from '../utils/market';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { market } = req.query;
    let query = supabase.from('categories').select('*');
    if (market && isValidMarket(market as string)) {
      query = query.eq('market', market);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('categories').insert(req.body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('categories').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { error } = await supabase.from('categories').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
