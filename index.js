const bot = require('./bot');
const connectDB = require('./config/database');

// Connect to database
connectDB().then(() => {
  // Launch bot after successful database connection
  return bot.launch();
}).then(() => {
  console.log('🚀 Бот запущен!');
}).catch((error) => {
  console.error('❌ Error starting the bot:', error);
  process.exit(1);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
