import mongoose from 'mongoose';

const PredictionSchema = new mongoose.Schema(
  {
    coinId: { type: String, required: true, index: true },
    coinSymbol: { type: String, required: true },
    marketPrice: { type: Number, required: true },
    action: { type: String, enum: ['BUY', 'HOLD', 'SELL'], required: true },
    confidence: { type: Number, required: true },
    reason: { type: String, required: true },
    change24h: { type: Number, required: true },
    averagePrice: { type: Number, required: true },
    volatility: { type: Number, required: true },
    periodDays: { type: Number, default: 7 },
    sourceType: { type: String, enum: ['raw', 'rollup'], default: 'raw', index: true },
    bucketStart: { type: Date },
    geminiResponse: { type: mongoose.Schema.Types.Mixed },
    alertDispatched: { type: Boolean, default: false },
    dispatchedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

PredictionSchema.index({ coinId: 1, createdAt: -1 });
PredictionSchema.index({ bucketStart: 1 }, { partialFilterExpression: { sourceType: 'rollup' } });

const Prediction =
  mongoose.models.Prediction || mongoose.model('Prediction', PredictionSchema);

export default Prediction;
