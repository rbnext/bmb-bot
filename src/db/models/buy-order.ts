import mongoose, { Schema, Document, model } from 'mongoose'

export interface IOrder extends Document {
  listingReferenceId: string
  markerHashName: string
  lowestOrderPrice: number
  createdAt: Date
  updatedAt: Date
}

const BuyOrderSchema = new Schema<IOrder>(
  {
    listingReferenceId: {
      type: String,
      required: true,
    },
    markerHashName: {
      type: String,
      required: true,
      unique: true,
    },
    lowestOrderPrice: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

export const BuyOrderModel = model<IOrder>('BuyOrder', BuyOrderSchema)
