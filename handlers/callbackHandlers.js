const { Markup } = require('telegraf');
const { formatTask, updateTask, deleteTask, formatTaskHistory } = require('../utils/taskUtils');
const Task = require('../models/task');
const clientMenu = require('../keyboards/clientMenu');
const TechnicalTask = require('../models/technicalTask');

// Форматирование даты
function formatDate(date) {
    return new Date(date).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Форматирование действия
function formatAction(action) {
    const actionMap = {
        'created': 'создана',
        'technical_task_created': 'создано ТЗ',
        'taken': 'взята в работу',
        'declined': 'отклонена',
        'completed': 'завершена',
        'edited': 'отредактирована'
    };
    return actionMap[action] || action;
}

// Обработка callback-кнопок для клиентских функций
async function handleClientCallbacks(ctx) {
    try {
        if (!ctx.callbackQuery) {
            console.error('No callback query found');
            return;
        }

        const callbackData = ctx.callbackQuery.data;
        const userId = ctx.from.id;

        // Отмена действий
        if (callbackData === 'cancel_edit' || callbackData === 'cancel_delete') {
            await ctx.answerCbQuery('Действие отменено');
            await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
            await showMenu(ctx);
            return;
        }

        // Редактирование задачи
        if (callbackData.startsWith('edit_task:')) {
            const taskId = callbackData.split(':')[1];
            const task = await Task.findById(taskId);

            if (!task) {
                await ctx.answerCbQuery('❌ Задача не найдена');
                await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
                return;
            }

            // Проверяем, принадлежит ли задача пользователю
            if (task.clientId !== userId) {
                await ctx.answerCbQuery('❌ У вас нет прав на редактирование этой задачи');
                await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
                return;
            }

            // Проверяем статус задачи
            if (task.status === 'completed' || task.status === 'deleted') {
                await ctx.answerCbQuery('❌ Нельзя редактировать завершенную или удаленную задачу');
                await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
                return;
            }

            ctx.session = {
                step: 'waiting_for_new_description',
                taskId: taskId
            };

            await ctx.answerCbQuery();
            await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
            await ctx.reply(
                '📝 Введите новое описание задачи:\n\n' +
                'Текущее описание:\n' +
                task.description + '\n\n' +
                'Используйте /cancel для отмены',
                Markup.removeKeyboard()
            );
            return;
        }

        // Удаление задачи
        if (callbackData.startsWith('delete_task:')) {
            const taskId = callbackData.split(':')[1];
            const task = await Task.findById(taskId);

            if (!task) {
                await ctx.answerCbQuery('❌ Задача не найдена');
                await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
                return;
            }

            // Проверяем, принадлежит ли задача пользователю
            if (task.clientId !== userId) {
                await ctx.answerCbQuery('❌ У вас нет прав на удаление этой задачи');
                await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
                return;
            }

            // Проверяем статус задачи
            if (task.status === 'deleted') {
                await ctx.answerCbQuery('❌ Задача уже удалена');
                await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
                return;
            }

            await deleteTask(taskId, ctx.from.username || ctx.from.id.toString());

            await ctx.answerCbQuery('✅ Задача удалена');
            await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
            await ctx.reply('Задача успешно удалена.', clientMenu);
            return;
        }

        // Просмотр истории задачи
        if (callbackData.startsWith('task_history:')) {
            const taskId = callbackData.split(':')[1];
            await handleTaskHistory(ctx, taskId);
        } else if (callbackData.startsWith('tz_history:')) {
            const tzId = callbackData.split(':')[1];
            await handleTZHistory(ctx, tzId);
        } else if (callbackData === 'back_to_menu') {
            await ctx.reply('Выберите действие:', Markup.inlineKeyboard([
                [
                    Markup.button.callback('📝 Заказать задачу', 'client_create_task'),
                    Markup.button.callback('✏ Редактировать задачу', 'client_edit_task')
                ],
                [
                    Markup.button.callback('🗑 Удалить задачу', 'client_delete_task'),
                    Markup.button.callback('🔗 Смотреть процесс', 'client_view_progress')
                ]
            ]));
        }

    } catch (error) {
        console.error('Error in handleClientCallbacks:', error);
        await ctx.answerCbQuery('❌ Произошла ошибка').catch(() => { });
        await ctx.reply('❌ Произошла ошибка. Попробуйте позже.', clientMenu);
    }
}

// Показать соответствующее меню
async function showMenu(ctx) {
    try {
        await ctx.reply('Выберите действие:', clientMenu);
    } catch (error) {
        console.error('Error showing menu:', error);
    }
}

// Обработка истории задачи
async function handleTaskHistory(ctx, taskId) {
    try {
        const task = await Task.findById(taskId);
        if (!task) {
            await ctx.reply('❌ Задача не найдена.');
            return;
        }

        let historyMessage = '📋 История задачи:\n\n';

        // Добавляем основную информацию о задаче
        historyMessage += `Задача: ${task.description}\n`;
        historyMessage += `Статус: ${task.status}\n`;
        historyMessage += `Контакт: ${task.contact}\n\n`;

        // Добавляем историю изменений
        historyMessage += '📝 История изменений:\n';
        for (const record of task.history) {
            historyMessage += `${formatDate(record.timestamp)} - ${formatAction(record.action)} (${record.user})\n`;
        }

        // Проверяем наличие ТЗ
        const tz = await TechnicalTask.findOne({ taskId: task._id });
        if (tz) {
            historyMessage += '\n📄 Техническое задание:\n';
            historyMessage += `Описание: ${tz.description}\n`;
            historyMessage += `Оплата: ${tz.payment} тг.\n`;
            historyMessage += `Разработчик: ${tz.developer}\n`;
            historyMessage += `Исполнитель: ${tz.worker || 'не назначен'}\n\n`;

            historyMessage += '📝 История ТЗ:\n';
            for (const record of tz.history) {
                historyMessage += `${formatDate(record.timestamp)} - ${formatAction(record.action)} (${record.user})\n`;
            }
        }

        await ctx.reply(historyMessage, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[
                Markup.button.callback('◀️ Назад', 'back_to_menu')
            ]])
        });
    } catch (error) {
        console.error('Error in handleTaskHistory:', error);
        await ctx.reply('❌ Произошла ошибка при получении истории задачи.');
    }
}

// Обработка истории ТЗ
async function handleTZHistory(ctx, tzId) {
    try {
        const tz = await TechnicalTask.findById(tzId);
        if (!tz) {
            await ctx.reply('❌ ТЗ не найдено.');
            return;
        }

        const task = await Task.findById(tz.taskId);
        if (!task) {
            await ctx.reply('❌ Связанная задача не найдена.');
            return;
        }

        let historyMessage = '📋 История технического задания:\n\n';

        // Добавляем основную информацию о ТЗ
        historyMessage += `Задача: ${task.description}\n`;
        historyMessage += `ТЗ: ${tz.description}\n`;
        historyMessage += `Оплата: ${tz.payment} тг.\n`;
        historyMessage += `Разработчик: ${tz.developer}\n`;
        historyMessage += `Исполнитель: ${tz.worker || 'не назначен'}\n`;
        historyMessage += `Статус: ${tz.status}\n\n`;

        // Добавляем историю изменений
        historyMessage += '📝 История изменений:\n';
        for (const record of tz.history) {
            historyMessage += `${formatDate(record.timestamp)} - ${formatAction(record.action)} (${record.user})\n`;
        }

        await ctx.reply(historyMessage, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[
                Markup.button.callback('◀️ Назад', 'back_to_menu')
            ]])
        });
    } catch (error) {
        console.error('Error in handleTZHistory:', error);
        await ctx.reply('❌ Произошла ошибка при получении истории ТЗ.');
    }
}

module.exports = {
    handleClientCallbacks,
    handleTaskHistory,
    handleTZHistory
}; 