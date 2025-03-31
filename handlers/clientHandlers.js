const { Markup } = require('telegraf');
const Task = require('../models/task');
const clientMenu = require('../keyboards/clientMenu');
const { formatTask, getActiveTasks, updateTask, deleteTask, getClientTasks } = require('../utils/taskUtils');

// Показать меню после действия
async function showMenuAfterAction(ctx) {
  const buttons = [
    [
      Markup.button.callback('📝 Заказать задачу', 'client_create_task'),
      Markup.button.callback('✏ Редактировать задачу', 'client_edit_task')
    ],
    [
      Markup.button.callback('🗑 Удалить задачу', 'client_delete_task'),
      Markup.button.callback('🔗 Смотреть процесс', 'client_view_progress')
    ]
  ];
  if (ctx.callbackQuery) {
    // If coming from a callback query, edit the existing message
    await ctx.editMessageText(newText, Markup.inlineKeyboard(buttons));
  } else {
    // Send a new message and store its ID
    const sentMessage = await ctx.reply(newText, Markup.inlineKeyboard(buttons));
    ctx.session.menuMessageId = sentMessage.message_id;
  }
}

// Создание задачи
async function createTask(ctx) {
  try {
    ctx.session = { step: 'waiting_for_description' };

    if (ctx.callbackQuery) {
      await ctx.editMessageText(
        '📝 Опишите вашу задачу:\n\n' +
        '• Минимум 10 символов\n' +
        '• Опишите задачу подробно\n' +
        '• Используйте /cancel для отмены'
      );
    } else {
      await ctx.reply(
        '📝 Опишите вашу задачу:\n\n' +
        '• Минимум 10 символов\n' +
        '• Опишите задачу подробно\n' +
        '• Используйте /cancel для отмены'
      );
    }

  } catch (error) {
    console.error('Error in createTask:', error);
    await showMenuAfterAction(ctx, '❌ Произошла ошибка. Попробуйте позже.');
    ctx.session = {};
  }
}

// Функция для форматирования описания задачи для кнопки
function formatTaskDescription(description) {
  const shortDesc = description.length > 30 ? description.substring(0, 27) + '...' : description;
  return shortDesc;
}

// Запрос контакта
async function requestContact(ctx) {
  return ctx.reply(
    '📞 Отправьте ваш контакт:\n\n' +
    '• Номер телефона (например: +79991234567)\n' +
    '• Email адрес (например: example@domain.com)\n\n' +
    'Или нажмите кнопку ниже для отправки номера телефона\n' +
    'Используйте /cancel для отмены',
    Markup.keyboard([
      [Markup.button.contactRequest('📞 Поделиться номером телефона')],
      ['❌ Отменить']
    ]).resize()
  );
}

// Редактирование задачи
async function editTask(ctx) {
  try {
    const tasks = await getActiveTasks(ctx.from.id);

    if (tasks.length === 0) {
      await showMenuAfterAction(ctx, 'У вас нет активных задач для редактирования.');
      return;
    }

    const buttons = tasks.map(task => {
      return [Markup.button.callback(
        `📝 ${formatTaskDescription(task.description)}`,
        `edit_task:${task._id}`
      )];
    });

    await ctx.editMessageText(
      'Выберите задачу для редактирования:',
      Markup.inlineKeyboard([
        ...buttons,
        [Markup.button.callback('❌ Отмена', 'cancel_edit')]
      ])
    );
  } catch (error) {
    console.error('Error in editTask:', error);
    await showMenuAfterAction(ctx, '❌ Произошла ошибка. Попробуйте позже.');
  }
}

// Удаление задачи
async function deleteTaskCommand(ctx) {
  try {
    const tasks = await getActiveTasks(ctx.from.id);

    if (tasks.length === 0) {
      await showMenuAfterAction(ctx, 'У вас нет активных задач для удаления.');
      return;
    }

    const buttons = tasks.map(task => {
      return [Markup.button.callback(
        `🗑 ${formatTaskDescription(task.description)}`,
        `delete_task:${task._id}`
      )];
    });

    await ctx.editMessageText(
      '⚠️ Выберите задачу для удаления:',
      Markup.inlineKeyboard([
        ...buttons,
        [Markup.button.callback('❌ Отмена', 'cancel_delete')]
      ])
    );
  } catch (error) {
    console.error('Error in deleteTask:', error);
    await showMenuAfterAction(ctx, '❌ Произошла ошибка. Попробуйте позже.');
  }
}

// Просмотр статуса задач
async function viewProgress(ctx) {
  try {
    const tasks = await getClientTasks(ctx.from.id);

    if (tasks.length === 0) {
      await ctx.reply('У вас пока нет задач.');
      await showMenuAfterAction(ctx);
      return;
    }

    for (const task of tasks) {
      const buttons = [
        [
          Markup.button.callback('📋 История изменений', `task_history:${task._id}`),
          Markup.button.callback('✏️ Редактировать', `edit_task:${task._id}`)
        ]
      ];

      await ctx.reply(
        formatTask(task),
        Markup.inlineKeyboard(buttons)
      );
    }
    await showMenuAfterAction(ctx);
  } catch (error) {
    console.error('Error in viewProgress:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    await showMenuAfterAction(ctx);
  }
}

// Обработка текстовых сообщений
async function processText(ctx, next) {
  try {
    if (!ctx.session || !ctx.session.step) {
      return next();
    }

    // Обработка описания задачи
    if (ctx.session.step === 'waiting_for_description') {
      const description = ctx.message.text.trim();

      if (description.toLowerCase() === '/cancel') {
        ctx.session = {};
        await ctx.reply('Действие отменено.');
        await showMenuAfterAction(ctx);
        return;
      }

      if (description.length < 10) {
        return ctx.reply(
          '❌ Описание должно содержать минимум 10 символов.\n' +
          'Попробуйте еще раз или используйте /cancel для отмены:'
        );
      }

      ctx.session.description = description;
      ctx.session.step = 'waiting_for_contact';
      await requestContact(ctx);
      return;
    }

    // Обработка контакта
    if (ctx.session.step === 'waiting_for_contact') {
      if (ctx.message.text === '❌ Отменить' || ctx.message.text?.toLowerCase() === '/cancel') {
        ctx.session = {};
        await ctx.reply('Действие отменено.', Markup.removeKeyboard());
        await showMenuAfterAction(ctx);
        return;
      }

      let contact;
      // Если пользователь поделился контактом через кнопку
      if (ctx.message.contact) {
        contact = '+' + ctx.message.contact.phone_number.replace(/[^0-9]/g, '');
      } else {
        // Если пользователь ввел контакт текстом
        const text = ctx.message.text.trim();

        // Проверка email
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);

        // Проверка телефона
        const cleanPhone = text.replace(/[^0-9]/g, '');
        const isPhone = cleanPhone.length >= 10 && cleanPhone.length <= 15;

        if (!isEmail && !isPhone) {
          return ctx.reply(
            '❌ Пожалуйста, введите корректный формат:\n\n' +
            '• Email: example@domain.com\n' +
            '• Телефон: +79991234567\n\n' +
            'Или используйте кнопку "Поделиться номером"\n' +
            'Используйте /cancel для отмены'
          );
        }

        contact = isEmail ? text : '+' + cleanPhone;
      }

      ctx.session.contact = contact;
      await saveTask(ctx);
      return;
    }

    // Обработка нового описания при редактировании
    if (ctx.session.step === 'waiting_for_new_description') {
      const newDescription = ctx.message.text.trim();

      if (newDescription.toLowerCase() === '/cancel') {
        ctx.session = {};
        await ctx.reply('Редактирование отменено.');
        await showMenuAfterAction(ctx);
        return;
      }

      if (newDescription.length < 10) {
        return ctx.reply(
          '❌ Описание должно содержать минимум 10 символов.\n' +
          'Попробуйте еще раз или используйте /cancel для отмены:'
        );
      }

      try {
        await updateTask(
          ctx.session.taskId,
          { description: newDescription },
          ctx.from.username || ctx.from.id.toString()
        );

        ctx.session = {};
        await ctx.reply('✅ Задача успешно обновлена!');
        await showMenuAfterAction(ctx);
      } catch (error) {
        console.error('Error updating task:', error);
        await ctx.reply('❌ Не удалось обновить задачу.');
        ctx.session = {};
        await showMenuAfterAction(ctx);
      }
      return;
    }

    return next();
  } catch (error) {
    console.error('Error in processText:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    ctx.session = {};
    await showMenuAfterAction(ctx);
  }
}

// Сохранение задачи
async function saveTask(ctx) {
  try {
    if (!ctx.session.description || !ctx.session.contact) {
      throw new Error('Missing required fields');
    }

    const task = new Task({
      description: ctx.session.description,
      contact: ctx.session.contact,
      clientId: ctx.from.id,
      status: 'new',
      history: [{
        action: 'created',
        timestamp: new Date(),
        user: ctx.from.username || ctx.from.id.toString()
      }]
    });

    await task.save();

    ctx.session = {};
    await ctx.reply(
      '✅ Ваша задача успешно создана!\n\nРазработчики рассмотрят её в ближайшее время.',
      Markup.removeKeyboard()
    );
    await showMenuAfterAction(ctx);
  } catch (error) {
    console.error('Error in saveTask:', error);
    await ctx.reply(
      '❌ Не удалось сохранить задачу.\nПожалуйста, попробуйте позже.',
      Markup.removeKeyboard()
    );
    ctx.session = {};
    await showMenuAfterAction(ctx);
  }
}

module.exports = {
  createTask,
  editTask,
  deleteTaskCommand,
  viewProgress,
  processText
};
