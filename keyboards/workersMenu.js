const { Markup } = require('telegraf');

module.exports = Markup.keyboard([
  ['📂 Доступные ТЗ'],
  ['❌ Отказаться от работы', '✔ Завершить работу']
]).resize();
