import mongoose from 'mongoose';

const InvestmentPlanSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    coinId: { type: String, required: true, lowercase: true, trim: true, index: true },
    status: {
      type: String,
      enum: ['PLANNED', 'OPEN'],
      default: 'PLANNED',
      index: true,
    },
    entryPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 0, min: 0 },
    capitalUsd: { type: Number, default: 0, min: 0 },
    targetPrice: { type: Number, default: null, min: 0 },
    stopLossPrice: { type: Number, default: null, min: 0 },
    note: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true }
);

InvestmentPlanSchema.index({ sessionId: 1, coinId: 1, status: 1 });

const InvestmentPlan =
  mongoose.models.InvestmentPlan || mongoose.model('InvestmentPlan', InvestmentPlanSchema);

export default InvestmentPlan;
