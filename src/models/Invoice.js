const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerName: { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    providerName: { type: String, default: '' },
    providerEmail: { type: String, default: '' },
    providerPhone: { type: String, default: '' },
    serviceName: { type: String, default: '' },
    serviceCategory: { type: String, default: '' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'PKR' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
    },
    bookingDate: { type: String, default: '' },
    address: { type: String, default: '' },
    paymentMethod: { type: String, default: 'Cash' },
    taxAmount: { type: Number },
    discountAmount: { type: Number },
    totalAmount: { type: Number },
    notes: { type: String },
    transactionId: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
