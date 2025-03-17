const { Markup } = require('telegraf');
const Task = require('../models/task');
const TechnicalTask = require('../models/technicalTask');
const { isWorker } = require('../utils/helpers');

// Форматирование статуса
function formatStatus(status) {
  const statusMap = {
    'new': '🆕 Новое',
    'in_progress': '🚧 В работе',
    'completed': '✅ Завершено',
    'declined': '❌ Отклонено'
  };
  return statusMap[status] || status;
}

// Форматирование ТЗ для вывода
function formatTZ(tz, task) {
  const formattedDate = new Date(tz.createdAt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
╭─────────────────────────
│ 📄 <b>ТЗ #${tz._id.toString().slice(-6)}</b>
├─────────────────────────
│ 📝 <b>Задача:</b>
│ ${task.description}
│
│ 📋 <b>Техническое задание:</b>
│ ${tz.description}
│
│ 💰 <b>Оплата:</b> ${tz.payment} тг.
│ 👨‍💻 <b>Разработчик:</b> ${tz.developer}
${tz.worker ? `│ 👷 <b>Исполнитель:</b> ${tz.worker}\n` : ''}│ 📊 <b>Статус:</b> ${formatStatus(tz.status)}
│ 📅 <b>Создано:</b> ${formattedDate}
╰─────────────────────────`;
}

// Показать меню исполнителя
async function showWorkerMenu(ctx) {
  const buttons = [
    [
      Markup.button.callback('📂 Доступные ТЗ', 'worker_available_tz')
    ],
    [
      Markup.button.callback('❌ Отказаться от работы', 'worker_decline'),
      Markup.button.callback('✔ Завершить работу', 'worker_complete')
    ]
  ];

  await ctx.reply('Выберите действие:', Markup.inlineKeyboard(buttons));
}

// Просмотр доступных ТЗ
async function listAvailableTZ(ctx) {
  try {
    if (!isWorker(ctx.from.username)) {
      await ctx.reply('❌ У вас нет доступа к этой функции.');
      return;
    }

    const technicalTasks = await TechnicalTask.find({
      $or: [
        { status: 'new', worker: { $exists: false } },
        { status: 'new', worker: null }
      ]
    }).sort({ _id: -1 });

    if (technicalTasks.length === 0) {
      await ctx.reply(
        '📭 На данный момент нет доступных ТЗ.\n' +
        'Попробуйте проверить позже.',
        Markup.inlineKeyboard([[
          Markup.button.callback('🔄 Обновить', 'worker_available_tz')
        ]])
      );
      return;
    }

    await ctx.reply(`📬 Найдено ТЗ: ${technicalTasks.length}`);

    for (const tz of technicalTasks) {
      const task = await Task.findById(tz.taskId);
      if (!task) continue;

      const buttons = [
        [
          Markup.button.callback('✅ Взять в работу', `take_tz:${tz._id}`),
          Markup.button.callback('📋 История', `tz_history:${tz._id}`)
        ]
      ];

      await ctx.reply(formatTZ(tz, task), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
      });
    }
  } catch (error) {
    console.error('Error in listAvailableTZ:', error);
    await ctx.reply(
      '❌ Произошла ошибка при получении списка ТЗ.\n' +
      'Попробуйте позже или обратитесь к администратору.'
    );
  }
}

// Отказ от работы
async function declineWork(ctx) {
  try {
    if (!isWorker(ctx.from.username)) {
      await ctx.reply('❌ У вас нет доступа к этой функции.');
      return;
    }

    const username = ctx.from.username;
    console.log(`Searching tasks for worker: ${username}`);

    const activeTasks = await TechnicalTask.find({
      worker: username,
      status: 'in_progress'
    });

    console.log(`Found ${activeTasks.length} active tasks`);

    if (activeTasks.length === 0) {
      await ctx.reply(
        '📭 У вас нет активных задач для отказа.\n' +
        'Вы можете взять новые задачи в работу.',
        Markup.inlineKeyboard([[
          Markup.button.callback('📂 Показать доступные ТЗ', 'worker_available_tz')
        ]])
      );
      return;
    }

    await ctx.reply(`🚧 Ваши активные задачи (${activeTasks.length}):`);

    for (const tz of activeTasks) {
      const task = await Task.findById(tz.taskId);
      if (!task) {
        console.log(`Task not found for TZ: ${tz._id}`);
        continue;
      }

      const buttons = [
        [Markup.button.callback('❌ Отказаться', `decline_tz:${tz._id}`)]
      ];

      await ctx.reply(formatTZ(tz, task), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
      });
    }
  } catch (error) {
    console.error('Error in declineWork:', error);
    await ctx.reply(
      '❌ Произошла ошибка при получении списка задач.\n' +
      'Попробуйте позже или обратитесь к администратору.'
    );
  }
}

// Завершение работы
async function completeWork(ctx) {
  try {
    if (!isWorker(ctx.from.username)) {
      await ctx.reply('❌ У вас нет доступа к этой функции.');
      return;
    }

    const username = ctx.from.username;
    console.log(`Searching tasks for worker: ${username}`);

    const activeTasks = await TechnicalTask.find({
      worker: username,
      status: 'in_progress'
    });

    console.log(`Found ${activeTasks.length} active tasks`);

    if (activeTasks.length === 0) {
      await ctx.reply(
        '📭 У вас нет активных задач для завершения.\n' +
        'Вы можете взять новые задачи в работу.',
        Markup.inlineKeyboard([[
          Markup.button.callback('📂 Показать доступные ТЗ', 'worker_available_tz')
        ]])
      );
      return;
    }

    await ctx.reply(`🚧 Ваши активные задачи (${activeTasks.length}):`);

    for (const tz of activeTasks) {
      const task = await Task.findById(tz.taskId);
      if (!task) {
        console.log(`Task not found for TZ: ${tz._id}`);
        continue;
      }

      const buttons = [
        [Markup.button.callback('✅ Завершить', `complete_tz:${tz._id}`)]
      ];

      await ctx.reply(formatTZ(tz, task), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
      });
    }
  } catch (error) {
    console.error('Error in completeWork:', error);
    await ctx.reply(
      '❌ Произошла ошибка при получении списка задач.\n' +
      'Попробуйте позже или обратитесь к администратору.'
    );
  }
}

// Обработка действий с ТЗ
async function handleTZAction(ctx, action, tzId) {
  try {
    if (!isWorker(ctx.from.username)) {
      await ctx.reply('❌ У вас нет доступа к этой функции.');
      return;
    }

    console.log(`Processing ${action} action for TZ ${tzId} by worker ${ctx.from.username}`);

    const tz = await TechnicalTask.findById(tzId);
    if (!tz) {
      console.log(`TZ ${tzId} not found`);
      await ctx.reply('❌ ТЗ не найдено.');
      return;
    }

    const task = await Task.findById(tz.taskId);
    if (!task) {
      console.log(`Task ${tz.taskId} not found for TZ ${tzId}`);
      await ctx.reply('❌ Связанная задача не найдена.');
      return;
    }

    console.log(`Current TZ status: ${tz.status}, worker: ${tz.worker}`);

    switch (action) {
      case 'take':
        if (tz.status !== 'new' || tz.worker) {
          console.log(`Cannot take TZ: status=${tz.status}, worker=${tz.worker}`);
          await ctx.reply(
            '❌ Это ТЗ уже не доступно.\n' +
            'Возможно, его взял другой исполнитель.'
          );
          return;
        }

        // Обновляем ТЗ
        const tzUpdate = {
          status: 'in_progress',
          worker: ctx.from.username,
          $push: {
            history: {
              action: 'taken',
              timestamp: new Date(),
              user: ctx.from.username
            }
          }
        };

        // Обновляем задачу
        const taskUpdate = {
          $push: {
            history: {
              action: 'worker_assigned',
              timestamp: new Date(),
              user: ctx.from.username
            }
          }
        };

        await Promise.all([
          TechnicalTask.findByIdAndUpdate(tzId, tzUpdate),
          Task.findByIdAndUpdate(tz.taskId, taskUpdate)
        ]);

        console.log(`TZ ${tzId} taken by worker ${ctx.from.username}`);
        await ctx.reply(
          '✅ Вы успешно взяли ТЗ в работу!\n\n' +
          'Теперь вы можете:\n' +
          '• Завершить задачу после выполнения\n' +
          '• Отказаться от задачи, если не можете её выполнить',
          Markup.inlineKeyboard([
            [Markup.button.callback('✅ Завершить', `complete_tz:${tzId}`)],
            [Markup.button.callback('❌ Отказаться', `decline_tz:${tzId}`)]
          ])
        );
        break;

      case 'decline':
        if (tz.worker !== ctx.from.username || tz.status !== 'in_progress') {
          console.log(`Cannot decline TZ: status=${tz.status}, worker=${tz.worker}`);
          await ctx.reply('❌ Вы не можете отказаться от этого ТЗ.');
          return;
        }

        // Обновляем ТЗ
        const tzDeclineUpdate = {
          status: 'new',
          worker: null,
          $push: {
            history: {
              action: 'declined',
              timestamp: new Date(),
              user: ctx.from.username
            }
          }
        };

        // Обновляем задачу
        const taskDeclineUpdate = {
          $push: {
            history: {
              action: 'worker_declined',
              timestamp: new Date(),
              user: ctx.from.username
            }
          }
        };

        await Promise.all([
          TechnicalTask.findByIdAndUpdate(tzId, tzDeclineUpdate),
          Task.findByIdAndUpdate(tz.taskId, taskDeclineUpdate)
        ]);

        console.log(`TZ ${tzId} declined by worker ${ctx.from.username}`);
        await ctx.reply(
          '✅ Вы успешно отказались от ТЗ.\n' +
          'Теперь это ТЗ снова доступно для других исполнителей.',
          Markup.inlineKeyboard([[
            Markup.button.callback('📂 Показать доступные ТЗ', 'worker_available_tz')
          ]])
        );
        break;

      case 'complete':
        if (tz.worker !== ctx.from.username || tz.status !== 'in_progress') {
          console.log(`Cannot complete TZ: status=${tz.status}, worker=${tz.worker}`);
          await ctx.reply('❌ Вы не можете завершить это ТЗ.');
          return;
        }

        // Обновляем ТЗ
        const tzCompleteUpdate = {
          status: 'completed',
          $push: {
            history: {
              action: 'completed',
              timestamp: new Date(),
              user: ctx.from.username
            }
          }
        };

        // Обновляем задачу
        const taskCompleteUpdate = {
          status: 'completed',
          $push: {
            history: {
              action: 'completed_by_worker',
              timestamp: new Date(),
              user: ctx.from.username
            }
          }
        };

        await Promise.all([
          TechnicalTask.findByIdAndUpdate(tzId, tzCompleteUpdate),
          Task.findByIdAndUpdate(tz.taskId, taskCompleteUpdate)
        ]);

        console.log(`TZ ${tzId} completed by worker ${ctx.from.username}`);
        await ctx.reply(
          '🎉 Поздравляем! ТЗ успешно завершено!\n\n' +
          'Вы можете взять в работу новые задачи.',
          Markup.inlineKeyboard([[
            Markup.button.callback('📂 Показать доступные ТЗ', 'worker_available_tz')
          ]])
        );
        break;

      default:
        console.log(`Unknown action: ${action}`);
        await ctx.reply('❌ Неизвестное действие.');
    }
  } catch (error) {
    console.error(`Error in handleTZAction (${action}):`, error);
    await ctx.reply(
      '❌ Произошла ошибка при обработке действия.\n' +
      'Попробуйте позже или обратитесь к администратору.'
    );
  }
}

module.exports = {
  listAvailableTZ,
  declineWork,
  completeWork,
  handleTZAction,
  showWorkerMenu
};
