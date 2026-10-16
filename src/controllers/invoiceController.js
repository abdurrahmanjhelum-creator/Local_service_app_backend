const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');

const toClient = (doc) => {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    ...o,
    id: o._id?.toString?.() || o.id,
    _id: o._id?.toString?.() || o._id,
    bookingId: o.bookingId?.toString?.() || o.bookingId,
    customerId: o.customerId?.toString?.() || o.customerId,
    providerId: o.providerId?.toString?.() || o.providerId,
  };
};

// POST /api/invoices
const createInvoice = async (req, res) => {
  try {
    const body = req.body || {};
    const bookingId = body.bookingId;
    if (!bookingId) {
      return res.status(400).json({ message: 'bookingId is required' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const uid = req.user._id.toString();
    const isParty =
      booking.customer.toString() === uid || booking.provider.toString() === uid;
    if (!isParty) {
      return res.status(403).json({ message: 'Not authorized for this booking' });
    }

    const existing = await Invoice.findOne({ bookingId });
    if (existing) {
      return res.status(200).json(toClient(existing));
    }

    const amount = Number(body.amount ?? booking.bookedPrice ?? 0);
    const invoice = await Invoice.create({
      invoiceNumber:
        body.invoiceNumber || `INV-${Date.now()}`,
      bookingId,
      customerId: body.customerId || booking.customer,
      customerName: body.customerName || '',
      customerEmail: body.customerEmail || '',
      customerPhone: body.customerPhone || '',
      providerId: body.providerId || booking.provider,
      providerName: body.providerName || '',
      providerEmail: body.providerEmail || '',
      providerPhone: body.providerPhone || '',
      serviceName: body.serviceName || body.serviceCategory || '',
      serviceCategory: body.serviceCategory || '',
      amount,
      currency: body.currency === 'USD' ? 'PKR' : (body.currency || 'PKR'),
      status: body.status || (booking.status === 'completed' ? 'paid' : 'pending'),
      bookingDate: body.bookingDate || '',
      address: body.address || '',
      paymentMethod: body.paymentMethod || 'Cash',
      totalAmount: Number(body.totalAmount ?? amount),
      taxAmount: body.taxAmount,
      discountAmount: body.discountAmount,
      notes: body.notes,
      paidAt: booking.status === 'completed' ? new Date() : undefined,
    });

    res.status(201).json(toClient(invoice));
  } catch (error) {
    if (error.code === 11000) {
      const again = await Invoice.findOne({ bookingId: req.body.bookingId });
      if (again) return res.status(200).json(toClient(again));
    }
    res.status(500).json({ message: error.message });
  }
};

// GET /api/invoices/booking/:bookingId
const getInvoiceByBooking = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ bookingId: req.params.bookingId });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const uid = req.user._id.toString();
    if (
      invoice.customerId.toString() !== uid &&
      invoice.providerId.toString() !== uid
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(toClient(invoice));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/invoices
const getUserInvoices = async (req, res) => {
  try {
    const uid = req.user._id;
    const { status, limit = 20, skip = 0 } = req.query;
    const filter = {
      $or: [{ customerId: uid }, { providerId: uid }],
    };
    if (status) filter.status = status;

    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip, 10))
      .limit(parseInt(limit, 10));

    res.json({
      invoices: invoices.map(toClient),
      total: await Invoice.countDocuments(filter),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createInvoice,
  getInvoiceByBooking,
  getUserInvoices,
};
