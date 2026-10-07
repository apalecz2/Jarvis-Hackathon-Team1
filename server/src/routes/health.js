const { Router } = require('express');
const { query } = require('../db/pool');

const router = Router();

router.get('/', (req, res) => res.json({ status: 'ok' }));

router.get('/db', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

module.exports = router;
