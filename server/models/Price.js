import mongoose from 'mongoose';

const PriceHistorySchema = new mongoose.Schema(
  {
    timestamp: { type: Number, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const PriceSchema = new mongoose.Schema(
  {
    coinId: { type: String, required: true, unique: true, index: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, default: null },
    price: { type: Number, required: true },
    change24h: { type: Number, default: 0 },
    volatility7d: { type: Number, default: null },
    marketCap: { type: Number, default: null },
    totalVolume: { type: Number, default: null },
    source: { type: String, default: 'Unknown' },
    cached: { type: Boolean, default: false },
    history: {
      type: [PriceHistorySchema],
      default: [],
    },
    lastUpdated: { type: Date, default: () => new Date(), index: true },
  },
  {
    timestamps: true,
  }
);

PriceSchema.index({ updatedAt: -1 });

const Price = mongoose.models.Price || mongoose.model('Price', PriceSchema);

export default Price;
