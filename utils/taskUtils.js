const Task = require('../models/task');
const TechnicalTask = require('../models/technicalTask');

// Форматирование задачи для вывода
function formatTask(task) {
    if (!task) return 'Задача не найдена';

    const statusEmoji = {
        'new': '🆕',
        'in_progress': '🚧',
        'completed': '✅',
        'deleted': '🗑'
    };

    const status = {
        'new': 'Новая',
        'in_progress': 'В работе',
        'completed': 'Завершена',
        'deleted': 'Удалена'
    };

    return `${statusEmoji[task.status] || '❓'} Задача: ${task.description}
📊 Статус: ${status[task.status] || 'Неизвестен'}
📞 Контакт: ${task.contact}
${task.developer ? `👨‍💻 Разработчик: ${task.developer}` : ''}`;
}

// Получение задач клиента
async function getClientTasks(clientId, status = null) {
    try {
        if (!clientId) throw new Error('Client ID is required');

        let query = { clientId };
        if (status) {
            if (Array.isArray(status)) {
                query.status = { $in: status };
            } else {
                query.status = status;
            }
        }
        return await Task.find(query).sort({ _id: -1 });
    } catch (error) {
        console.error('Error getting client tasks:', error);
        throw new Error(`Failed to get client tasks: ${error.message}`);
    }
}

// Получение активных задач клиента
async function getActiveTasks(clientId) {
    try {
        if (!clientId) throw new Error('Client ID is required');
        return await getClientTasks(clientId, ['new', 'in_progress']);
    } catch (error) {
        console.error('Error getting active tasks:', error);
        throw new Error(`Failed to get active tasks: ${error.message}`);
    }
}

// Обновление задачи
async function updateTask(taskId, updates, username) {
    try {
        if (!taskId) throw new Error('Task ID is required');
        if (!updates || Object.keys(updates).length === 0) throw new Error('Updates are required');
        if (!username) throw new Error('Username is required');

        const task = await Task.findById(taskId);
        if (!task) throw new Error('Task not found');

        // Проверяем допустимые поля для обновления
        const allowedUpdates = ['description', 'contact', 'status', 'developer'];
        const isValidOperation = Object.keys(updates).every(update => allowedUpdates.includes(update));
        if (!isValidOperation) throw new Error('Invalid updates');

        // Обновляем поля задачи
        Object.keys(updates).forEach(key => {
            task[key] = updates[key];
        });

        // Добавляем запись в историю
        task.history.push({
            action: 'updated',
            timestamp: new Date(),
            user: username,
            changes: updates
        });

        await task.save();
        return task;
    } catch (error) {
        console.error('Error updating task:', error);
        throw new Error(`Failed to update task: ${error.message}`);
    }
}

// Удаление задачи
async function deleteTask(taskId, username) {
    try {
        if (!taskId) throw new Error('Task ID is required');
        if (!username) throw new Error('Username is required');

        const task = await Task.findById(taskId);
        if (!task) throw new Error('Task not found');

        // Проверяем, не удалена ли уже задача
        if (task.status === 'deleted') {
            throw new Error('Task is already deleted');
        }

        // Добавляем запись в историю перед удалением
        task.history.push({
            action: 'deleted',
            timestamp: new Date(),
            user: username
        });

        task.status = 'deleted';
        await task.save();
        return true;
    } catch (error) {
        console.error('Error deleting task:', error);
        throw new Error(`Failed to delete task: ${error.message}`);
    }
}

// Создание технического задания
async function createTechnicalTask(taskId, description, payment, developer) {
    try {
        if (!taskId) throw new Error('Task ID is required');
        if (!description) throw new Error('Description is required');
        if (!payment || isNaN(payment) || payment <= 0) throw new Error('Valid payment amount is required');
        if (!developer) throw new Error('Developer is required');

        const task = await Task.findById(taskId);
        if (!task) throw new Error('Task not found');

        // Проверяем, нет ли уже ТЗ для этой задачи
        const existingTZ = await TechnicalTask.findOne({ taskId });
        if (existingTZ) throw new Error('Technical task already exists for this task');

        const technicalTask = new TechnicalTask({
            taskId,
            description,
            payment,
            status: 'new',
            developer,
            history: [{
                action: 'created',
                timestamp: new Date(),
                user: developer
            }]
        });

        await technicalTask.save();

        // Обновляем статус основной задачи
        task.status = 'in_progress';
        task.developer = developer;
        task.history.push({
            action: 'technical_task_created',
            timestamp: new Date(),
            user: developer
        });
        await task.save();

        return technicalTask;
    } catch (error) {
        console.error('Error creating technical task:', error);
        throw new Error(`Failed to create technical task: ${error.message}`);
    }
}

// Форматирование истории задачи
function formatTaskHistory(history) {
    if (!history || !Array.isArray(history)) return 'История отсутствует';

    const actionEmoji = {
        'created': '📝 Создание',
        'updated': '✏️ Изменение',
        'deleted': '🗑 Удаление',
        'technical_task_created': '📋 Создание ТЗ',
        'completed': '✅ Завершение'
    };

    return history.map((record, index) => {
        let text = `${index + 1}. ${actionEmoji[record.action] || '❓ ' + record.action}\n`;
        text += `👤 ${record.user}\n`;
        text += `🕒 ${new Date(record.timestamp).toLocaleString()}\n`;
        if (record.changes) {
            if (record.changes.description) {
                text += `📝 Новое описание: ${record.changes.description}\n`;
            }
            if (record.changes.status) {
                text += `📊 Новый статус: ${record.changes.status}\n`;
            }
            if (record.changes.contact) {
                text += `📞 Новый контакт: ${record.changes.contact}\n`;
            }
        }
        return text;
    }).join('\n');
}

module.exports = {
    formatTask,
    getClientTasks,
    getActiveTasks,
    updateTask,
    deleteTask,
    createTechnicalTask,
    formatTaskHistory
}; 