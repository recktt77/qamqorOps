const { Telegraf, Markup } = require('telegraf');
const { BOT_TOKEN } = require('./config/env');
const sessionMiddleware = require('./middlewares/sessionMiddleware');
const { isDeveloper, isWorker } = require('./utils/helpers');

// Import keyboards
const clientMenu = require('./keyboards/clientMenu');
const developerMenu = require('./keyboards/developerMenu');
const workersMenu = require('./keyboards/workersMenu');

// Import handlers
const {
  createTask,
  editTask,
  deleteTaskCommand,
  viewProgress,
  processText
} = require('./handlers/clientHandlers');
const {
  listTasks,
  createTZ,
  listInProgressTasks,
  listCompletedTasks,
  processDevText
} = require('./handlers/developerHandlers');
const {
  listAvailableTZ,
  declineWork,
  completeWork,
  handleTZAction
} = require('./handlers/workerHandlers');
const { handleClientCallbacks, handleTaskHistory, handleTZHistory } = require('./handlers/callbackHandlers');

const bot = new Telegraf(BOT_TOKEN);

// Middleware
bot.use(sessionMiddleware);

// Middleware для логирования
bot.use(async (ctx, next) => {
  const username = ctx.from?.username;
  console.log(`User ${username} (isDeveloper: ${isDeveloper(username)}, isWorker: ${isWorker(username)}) made request`);
  await next();
});

// Установка команд бота для menu bar
bot.telegram.setMyCommands([
  { command: 'start', description: 'Запустить бота' },
  { command: 'menu', description: 'Показать меню' },
  { command: 'help', description: 'Показать помощь' },
  { command: 'cancel', description: 'Отменить текущее действие' }
]);

// Helper function to show appropriate menu
const fs = require('fs');


async function showMenu(ctx) {
  const username = ctx.from.username;
  const imagePath = './images/qamqor.png'; // Путь к изображению
  let buttons = [];

  console.log(`Showing menu for user ${username}`);
  console.log(`isDeveloper: ${isDeveloper(username)}`);
  console.log(`isWorker: ${isWorker(username)}`);

  if (isDeveloper(username)) {
    buttons = [
      [
        Markup.button.callback('📋 Список задач', 'dev_list_tasks'),
        Markup.button.callback('📄 Создать ТЗ', 'dev_create_tz')
      ],
      [
        Markup.button.callback('🚧 Задачи в процессе', 'dev_in_progress'),
        Markup.button.callback('✅ Закрытые задачи', 'dev_completed')
      ]
    ];
    await ctx.replyWithPhoto(
      { source: fs.createReadStream(imagePath) },
      {
        caption: `<b>Меню разработчика</b>\n\nВыберите нужное действие:`,
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup // Здесь исправлено!
      }
    );
  } else if (isWorker(username)) {
    buttons = [
      [
        Markup.button.callback('📂 Доступные ТЗ', 'worker_available_tz')
      ],
      [
        Markup.button.callback('❌ Отказаться от работы', 'worker_decline'),
        Markup.button.callback('✔ Завершить работу', 'worker_complete')
      ]
    ];
    await ctx.replyWithPhoto(
      { source: fs.createReadStream(imagePath) },
      {
        caption: `<b>Меню исполнителя</b>\n\nВыберите нужное действие:`,
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup // Исправлено!
      }
    );
  } else {
    buttons = [
      [
        Markup.button.callback('📝 Заказать задачу', 'client_create_task'),
        Markup.button.callback('✏ Редактировать задачу', 'client_edit_task')
      ],
      [
        Markup.button.callback('🗑 Удалить задачу', 'client_delete_task'),
        Markup.button.callback('🔗 Смотреть процесс', 'client_view_progress')
      ]
    ];
    await ctx.replyWithPhoto(
      { source: fs.createReadStream(imagePath) },
      {
        caption: `<b>Меню клиента</b>\n\nВыберите нужное действие:`,
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup // Исправлено!
      }
    );
  }
}



// Start command
bot.start(async (ctx) => {
  try {
    const username = ctx.from.username;
    console.log(`Start command from user ${username}`);
    let message = 'Добро пожаловать! ';

    if (isDeveloper(username)) {
      message += 'Вы авторизованы как разработчик.';
      console.log(`${username} authorized as developer`);
    } else if (isWorker(username)) {
      message += 'Вы авторизованы как исполнитель.';
      console.log(`${username} authorized as worker`);
    } else {
      message += 'Используйте меню для создания задачи.';
      console.log(`${username} authorized as client`);
    }

    await ctx.reply(message);
    await showMenu(ctx);
  } catch (error) {
    console.error('Error in start command:', error);
    await ctx.reply('❌ Произошла ошибка при запуске бота.');
  }
});

// Menu command
bot.command('menu', showMenu);

// Help command
bot.command('help', async (ctx) => {
  const username = ctx.from.username;
  let helpText = '📌 Доступные команды:\n\n';

  if (isDeveloper(username)) {
    helpText += '👨‍💻 Команды разработчика:\n';
    helpText += '• Список задач - просмотр новых задач\n';
    helpText += '• Создать ТЗ - создание технического задания\n';
    helpText += '• Задачи в процессе - просмотр активных задач\n';
    helpText += '• Закрытые задачи - просмотр завершенных задач\n';
  } else if (isWorker(username)) {
    helpText += '👷 Команды исполнителя:\n';
    helpText += '• Доступные ТЗ - просмотр доступных заданий\n';
    helpText += '• Отказаться от работы - отказ от текущего задания\n';
    helpText += '• Завершить работу - завершение текущего задания\n';
  } else {
    helpText += '👤 Команды клиента:\n';
    helpText += '• Заказать задачу - создание новой задачи\n';
    helpText += '• Редактировать задачу - изменение существующей задачи\n';
    helpText += '• Удалить задачу - удаление задачи\n';
    helpText += '• Смотреть процесс - просмотр статуса задач\n';
  }

  helpText += '\n🔄 Основные команды:\n';
  helpText += '/start - начать работу с ботом\n';
  helpText += '/menu - показать меню\n';
  helpText += '/help - показать эту справку\n';
  helpText += '/cancel - отменить текущее действие';

  await ctx.reply(helpText);
});

// Handle callback queries
bot.on('callback_query', async (ctx) => {
  const action = ctx.callbackQuery.data;
  const username = ctx.from.username;

  try {
    // Отвечаем на callback query, чтобы убрать "часики" у кнопки
    await ctx.answerCbQuery().catch(console.error);

    // Обработка истории
    if (action.startsWith('task_history:')) {
      const taskId = action.split(':')[1];
      await handleTaskHistory(ctx, taskId);
      return;
    }

    if (action.startsWith('tz_history:')) {
      const tzId = action.split(':')[1];
      await handleTZHistory(ctx, tzId);
      return;
    }

    if (action === 'back_to_menu') {
      await showMenu(ctx);
      return;
    }

    // Client actions
    if (action === 'client_create_task') {
      ctx.session = {};
      await createTask(ctx);
    } else if (action === 'client_edit_task') {
      await editTask(ctx);
    } else if (action === 'client_delete_task') {
      await deleteTaskCommand(ctx);
    } else if (action === 'client_view_progress') {
      await viewProgress(ctx);
    }

    // Developer actions
    else if (isDeveloper(username)) {
      if (action === 'dev_list_tasks') {
        await listTasks(ctx);
      } else if (action === 'dev_create_tz') {
        // Показываем список доступных задач для создания ТЗ
        const Task = require('./models/task');
        const tasks = await Task.find({ status: 'new' }).sort({ _id: -1 });

        if (tasks.length === 0) {
          await ctx.reply('Нет доступных задач для создания ТЗ.');
          return;
        }

        const buttons = tasks.map(task => {
          const shortDesc = task.description.substring(0, 30) + (task.description.length > 30 ? '...' : '');
          return [Markup.button.callback(`📝 ${shortDesc}`, `create_tz:${task._id}`)];
        });

        await ctx.reply(
          'Выберите задачу для создания ТЗ:',
          Markup.inlineKeyboard([
            ...buttons,
            [Markup.button.callback('❌ Отмена', 'cancel_tz')]
          ])
        );
      } else if (action === 'dev_in_progress') {
        await listInProgressTasks(ctx);
      } else if (action === 'dev_completed') {
        await listCompletedTasks(ctx);
      } else if (action.startsWith('create_tz:')) {
        const taskId = action.split(':')[1];
        ctx.session = {
          step: 'waiting_for_tz_description',
          taskId: taskId
        };
        const task = await require('./models/task').findById(taskId);
        await ctx.reply(
          '📝 Введите описание технического задания:\n\n' +
          'Исходная задача:\n' +
          `${task.description}\n\n` +
          'Используйте /cancel для отмены'
        );
      } else if (action.startsWith('take_task:')) {
        const taskId = action.split(':')[1];
        ctx.session = {
          step: 'waiting_for_tz_description',
          taskId: taskId
        };
        const task = await require('./models/task').findById(taskId);
        await ctx.reply(
          '📝 Введите описание технического задания:\n\n' +
          'Исходная задача:\n' +
          `${task.description}\n\n` +
          'Используйте /cancel для отмены'
        );
      }
    }

    // Worker actions
    else if (isWorker(username)) {
      if (action === 'worker_available_tz') {
        await listAvailableTZ(ctx);
      } else if (action === 'worker_decline') {
        await declineWork(ctx);
      } else if (action === 'worker_complete') {
        await completeWork(ctx);
      } else if (action.startsWith('take_tz:')) {
        const tzId = action.split(':')[1];
        await handleTZAction(ctx, 'take', tzId);
      } else if (action.startsWith('decline_tz:')) {
        const tzId = action.split(':')[1];
        await handleTZAction(ctx, 'decline', tzId);
      } else if (action.startsWith('complete_tz:')) {
        const tzId = action.split(':')[1];
        await handleTZAction(ctx, 'complete', tzId);
      }
    }

    // Other callbacks
    else {
      await handleClientCallbacks(ctx);
    }
  } catch (error) {
    console.error('Error handling callback:', error);
    await ctx.reply('❌ Произошла ошибка при обработке действия.');
  }
});

// Cancel command
bot.command('cancel', async (ctx) => {
  ctx.session = {};
  await ctx.reply('Действие отменено.');
  await showMenu(ctx);
});

// Process text messages
bot.on('text', async (ctx, next) => {
  try {
    const username = ctx.from.username;

    if (isDeveloper(username) && ctx.session?.step?.startsWith('waiting_for_tz')) {
      await processDevText(ctx);
    } else if (ctx.session && ctx.session.step) {
      await processText(ctx, next);
    } else {
      await next();
    }
  } catch (error) {
    console.error('Error processing text:', error);
    await ctx.reply('❌ Произошла ошибка при обработке сообщения.');
  }
});

// Handle contact sharing
bot.on('contact', async (ctx, next) => {
  if (ctx.session && ctx.session.step === 'waiting_for_contact') {
    await processText(ctx, next);
  } else {
    await next();
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  showMenu(ctx);
});

module.exports = bot;
