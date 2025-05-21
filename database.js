import dotenv from "dotenv";
dotenv.config();
import mongoose from 'mongoose'

const connectDB = async()=>{
    try {
        await mongoose.connect(process.env.MONGO_URL
        )
        console.log("MongoDB connected ✅");
        
    } catch (error) {
        console.log(error);        
        console.log('MongoDB connection error ❌\n',error);
        
    }
}

export default connectDB;