const { Markup } = require('telegraf');

module.exports = Markup.keyboard([
  ['📝 Заказать задачу'],
  ['✏ Редактировать задачу', '🗑 Удалить задачу'],
  ['🔗 Смотреть процесс разработки']
]).resize();
