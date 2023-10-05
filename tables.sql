-- имя, район, адрес где разместить
-- имя - name, адрес - description, район - родительская группа
-- gateway - шлюз роутера
-- может быть имеет смысл комментарии засунуть в отдельную таблицу? хотя наверное одно примечание я бы оставил в основной таблице
-- должна быть еще умозрительная группа, типа: кокшетау 25 объектов и что то вроде
-- и еще у нас будут разные регионы и разные сервера
-- object_id например 12081, наверное может быть больше чем 5 символов, но вряд ли слишком большим
-- скорее всего object_id будет определяющим
CREATE TABLE IF NOT EXISTS `groups` (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  parent_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  time_created DATETIME DEFAULT CURRENT_TIMESTAMP,
  time_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  prtg_id VARCHAR(256) NOT NULL DEFAULT '',
  data_hash VARCHAR(256) NOT NULL DEFAULT '',
  object_id VARCHAR(32) NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(128) NOT NULL DEFAULT '',
  coords CHAR(32) NOT NULL DEFAULT '',
  gateway CHAR(16) NOT NULL DEFAULT '',
  netmask CHAR(16) NOT NULL DEFAULT '',
  host_min CHAR(16) NOT NULL DEFAULT '',
  host_max CHAR(16) NOT NULL DEFAULT '',
  comment TEXT NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS `group_comments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  `parent_id` BIGINT UNSIGNED NOT NULL,
  `index` INT NOT NULL DEFAULT 0,
  `data` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`parent_id`) REFERENCES `groups`(`id`)
);

-- ip_address ipv6?, может быть указано local в значении что нет доступа из нашей внутренней сети
-- coords наследует значение из родителя
-- vendor поддерживаем по скрипту Dahua, Hikvision, Trassir, надо проверять по toLowerCase, но могут быть и другие
-- наверное нужно задать ртсп ссылку для каждого устройства, логин пароль еще
-- предположительно нужно использовать 
-- channel_id в нотации 101 - первый канал, первый допканал, лучше пусть просто будет инт, доп каналов обычно максимум 2
-- было бы неплохо еще понять когда было устройство доступно в последний раз
-- проверяем например каждые два часа, если что то случилось пусть обращаются в пртг
-- type - это удобный для человека тип устройства что то вроде: рег, камера, кнопка и проч
-- надо ли удалять записи если они пропадают в таблице? наверное имеет смысл, нет нужно явно помечать строки к удалению
-- по приоритету берутся данные из mysql, если у нас пустое поле в столбце id то предполагаем что это новое устройство
-- еще в будущем нужно будет указывать сервер в который камеры добавляем скорее всего
-- а также нужно четко означить области, тип акмолинская и проч (области поди папки)
-- возможно еще имеет смысл добавить id из егсв и пртг
CREATE TABLE IF NOT EXISTS `devices` (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  group_id BIGINT UNSIGNED NOT NULL,
  parent_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  time_created DATETIME DEFAULT CURRENT_TIMESTAMP,
  time_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  egsv_id VARCHAR(256) NOT NULL DEFAULT '',
  prtg_id VARCHAR(256) NOT NULL DEFAULT '',
  data_hash VARCHAR(256) NOT NULL DEFAULT '',
  ip_address CHAR(16) NOT NULL DEFAULT '',
  name VARCHAR(128) NOT NULL DEFAULT '',
  port CHAR(16) NOT NULL DEFAULT '',
  protocol CHAR(16) NOT NULL DEFAULT '',
  coords CHAR(32) NOT NULL DEFAULT '',
  type VARCHAR(128) NOT NULL DEFAULT '',
  vendor VARCHAR(128) NOT NULL DEFAULT '',
  class VARCHAR(64) NOT NULL DEFAULT '',
  model VARCHAR(256) NOT NULL DEFAULT '',
  admin_login VARCHAR(256) NOT NULL DEFAULT '',
  admin_password VARCHAR(256) NOT NULL DEFAULT '',
  user_login VARCHAR(256) NOT NULL DEFAULT '',
  user_password VARCHAR(256) NOT NULL DEFAULT '',
  channel_id INT UNSIGNED NOT NULL DEFAULT 0,
  rtsp_link TEXT NOT NULL,
  sub_link TEXT NOT NULL,
  egsv_server VARCHAR(256) NOT NULL DEFAULT '',
  old_device BOOLEAN NOT NULL DEFAULT false,
  has_rtsp BOOLEAN NOT NULL DEFAULT true,
  has_self_cert BOOLEAN NOT NULL DEFAULT false,
  archive TEXT NOT NULL,
  comment TEXT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (group_id) REFERENCES `groups`(id)
);

CREATE TABLE IF NOT EXISTS `device_comments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  `parent_id` BIGINT UNSIGNED NOT NULL,
  `index` INT NOT NULL DEFAULT 0,
  `data` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`parent_id`) REFERENCES `devices`(`id`)
);

-- ожидаем что будет возвращать хотя бы http коды ошибок
CREATE TABLE IF NOT EXISTS `devices_health_check` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  `parent_id` BIGINT UNSIGNED NOT NULL,
  `time_updated` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`parent_id`) REFERENCES `devices`(`id`)
);

CREATE TABLE IF NOT EXISTS `group_devices` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  `group_id` BIGINT UNSIGNED NOT NULL,
  `device_id` BIGINT UNSIGNED NOT NULL,
  `time_created` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`),
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`)
);

CREATE TABLE IF NOT EXISTS `contacts` (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  group_id BIGINT UNSIGNED NOT NULL,
  time_created DATETIME DEFAULT CURRENT_TIMESTAMP,
  time_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  data_hash VARCHAR(256) NOT NULL DEFAULT '',
  name VARCHAR(512) NOT NULL DEFAULT '',
  phone1 VARCHAR(16) NOT NULL DEFAULT '',
  phone2 VARCHAR(16) NOT NULL DEFAULT '',
  comment TEXT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (group_id) REFERENCES `groups`(id)
);

CREATE TABLE IF NOT EXISTS `contact_comments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  `parent_id` BIGINT UNSIGNED NOT NULL,
  `index` INT NOT NULL DEFAULT 0,
  `data` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`parent_id`) REFERENCES `contacts`(`id`)
);