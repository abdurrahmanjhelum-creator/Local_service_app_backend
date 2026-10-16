const express = require('express');
const router = express.Router();
const {
  createInvoice,
  getInvoiceByBooking,
  getUserInvoices,
} = require('../controllers/invoiceController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', createInvoice);
router.get('/', getUserInvoices);
router.get('/booking/:bookingId', getInvoiceByBooking);

module.exports = router;
