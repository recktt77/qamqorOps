const { Markup } = require('telegraf');

module.exports = Markup.keyboard([
  ['📋 Список задач', '📄 Создать ТЗ'],
  ['🚧 Задачи в процессе', '✅ Закрытые задачи']
]).resize();
