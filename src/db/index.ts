import mongoose from 'mongoose'

export const connectToDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI as string,
      {
        dbName: 'csfloat',
        bufferCommands: false,
      } as mongoose.ConnectOptions
    )
  } catch (error) {
    process.exit(1)
  }
}
