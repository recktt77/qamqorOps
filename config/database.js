const mongoose = require('mongoose');
const { MONGO_URI } = require('./env');

const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('📦 MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

module.exports = connectDB; 