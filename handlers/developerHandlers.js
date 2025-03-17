const { Markup } = require('telegraf');
const Task = require('../models/task');
const TechnicalTask = require('../models/technicalTask');
const { formatTask } = require('../utils/taskUtils');
const { isDeveloper } = require('../utils/helpers');

// Просмотр новых задач
async function listTasks(ctx) {
  try {
    if (!isDeveloper(ctx.from.username)) {
      return ctx.reply('❌ У вас нет доступа к этой команде.');
    }

    const tasks = await Task.find({ status: 'new' }).sort({ _id: -1 });

    if (tasks.length === 0) {
      await ctx.reply('Нет новых задач.');
      return;
    }

    for (const task of tasks) {
      const buttons = [
        [
          Markup.button.callback('✅ Взять в работу', `take_task:${task._id}`),
          Markup.button.callback('📋 История', `task_history:${task._id}`)
        ]
      ];

      await ctx.reply(formatTask(task), Markup.inlineKeyboard(buttons));
    }
  } catch (error) {
    console.error('Error in listTasks:', error);
    await ctx.reply('❌ Произошла ошибка при получении списка задач.');
  }
}

// Создание ТЗ
async function createTZ(ctx, taskId) {
  try {
    if (!isDeveloper(ctx.from.username)) {
      return ctx.reply('❌ У вас нет доступа к этой команде.');
    }

    const task = await Task.findById(taskId);
    if (!task) {
      await ctx.reply('❌ Задача не найдена.');
      return;
    }

    // Проверяем, нет ли уже ТЗ для этой задачи
    const existingTZ = await TechnicalTask.findOne({ taskId: task._id });
    if (existingTZ) {
      await ctx.reply('❌ Для этой задачи уже создано ТЗ.');
      return;
    }

    ctx.session = {
      step: 'waiting_for_tz_description',
      taskId: taskId,
      originalTask: task
    };

    await ctx.reply(
      '📝 Введите описание технического задания:\n\n' +
      'Исходная задача:\n' +
      `${task.description}\n\n` +
      'Используйте /cancel для отмены'
    );
  } catch (error) {
    console.error('Error in createTZ:', error);
    await ctx.reply('❌ Произошла ошибка при создании ТЗ.');
  }
}

// Просмотр задач в процессе
async function listInProgressTasks(ctx) {
  try {
    if (!isDeveloper(ctx.from.username)) {
      return ctx.reply('❌ У вас нет доступа к этой команде.');
    }

    const tasks = await Task.find({
      status: 'in_progress',
      developer: ctx.from.username
    }).sort({ _id: -1 });

    if (tasks.length === 0) {
      await ctx.reply('У вас нет задач в работе.');
      return;
    }

    for (const task of tasks) {
      const tz = await TechnicalTask.findOne({ taskId: task._id });
      const buttons = [
        [
          Markup.button.callback('✅ Завершить', `complete_task:${task._id}`),
          Markup.button.callback('📋 История', `task_history:${task._id}`)
        ]
      ];

      let message = formatTask(task);
      if (tz) {
        message += `\n\n📄 ТЗ: ${tz.description}\n💰 Оплата: ${tz.payment} тг.`;
      }

      await ctx.reply(message, Markup.inlineKeyboard(buttons));
    }
  } catch (error) {
    console.error('Error in listInProgressTasks:', error);
    await ctx.reply('❌ Произошла ошибка при получении списка задач в работе.');
  }
}

// Просмотр завершенных задач
async function listCompletedTasks(ctx) {
  try {
    if (!isDeveloper(ctx.from.username)) {
      return ctx.reply('❌ У вас нет доступа к этой команде.');
    }

    const tasks = await Task.find({
      status: 'completed',
      developer: ctx.from.username
    }).sort({ _id: -1 });

    if (tasks.length === 0) {
      await ctx.reply('У вас нет завершенных задач.');
      return;
    }

    for (const task of tasks) {
      const tz = await TechnicalTask.findOne({ taskId: task._id });
      const buttons = [
        [Markup.button.callback('📋 История', `task_history:${task._id}`)]
      ];

      let message = formatTask(task);
      if (tz) {
        message += `\n\n📄 ТЗ: ${tz.description}\n💰 Оплата: ${tz.payment} тг.`;
      }

      await ctx.reply(message, Markup.inlineKeyboard(buttons));
    }
  } catch (error) {
    console.error('Error in listCompletedTasks:', error);
    await ctx.reply('❌ Произошла ошибка при получении списка завершенных задач.');
  }
}

// Обработка текстовых сообщений для разработчика
async function processDevText(ctx) {
  try {
    if (!ctx.session || !ctx.session.step) {
      return;
    }

    // Создание ТЗ - описание
    if (ctx.session.step === 'waiting_for_tz_description') {
      const description = ctx.message.text.trim();

      if (description.toLowerCase() === '/cancel') {
        ctx.session = {};
        await ctx.reply('Создание ТЗ отменено.');
        return;
      }

      if (description.length < 10) {
        return ctx.reply(
          '❌ Описание ТЗ должно содержать минимум 10 символов.\n' +
          'Попробуйте еще раз или используйте /cancel для отмены:'
        );
      }

      ctx.session.tzDescription = description;
      ctx.session.step = 'waiting_for_tz_payment';

      await ctx.reply(
        '💰 Введите сумму оплаты в тенге:\n' +
        'Используйте только цифры, например: 15000'
      );
      return;
    }

    // Создание ТЗ - сумма оплаты
    if (ctx.session.step === 'waiting_for_tz_payment') {
      const payment = parseInt(ctx.message.text.trim());

      if (isNaN(payment) || payment <= 0) {
        return ctx.reply(
          '❌ Пожалуйста, введите корректную сумму (только цифры).\n' +
          'Например: 15000'
        );
      }

      try {
        const task = await Task.findById(ctx.session.taskId);
        if (!task) {
          throw new Error('Task not found');
        }

        const tz = new TechnicalTask({
          taskId: ctx.session.taskId,
          description: ctx.session.tzDescription,
          payment: payment,
          status: 'new',
          developer: ctx.from.username,
          history: [{
            action: 'created',
            timestamp: new Date(),
            user: ctx.from.username
          }]
        });

        await tz.save();

        // Обновляем статус основной задачи
        task.status = 'in_progress';
        task.developer = ctx.from.username;
        task.history.push({
          action: 'technical_task_created',
          timestamp: new Date(),
          user: ctx.from.username
        });
        await task.save();

        ctx.session = {};
        await ctx.reply('✅ ТЗ успешно создано и задача взята в работу!');
      } catch (error) {
        console.error('Error saving TZ:', error);
        await ctx.reply('❌ Произошла ошибка при сохранении ТЗ.');
        ctx.session = {};
      }
      return;
    }
  } catch (error) {
    console.error('Error in processDevText:', error);
    await ctx.reply('❌ Произошла ошибка при обработке сообщения.');
    ctx.session = {};
  }
}

module.exports = {
  listTasks,
  createTZ,
  listInProgressTasks,
  listCompletedTasks,
  processDevText
};
