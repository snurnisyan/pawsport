# Pawsport

Pawsport - сервис для ведения цифрового паспорта питомца.

Сайт: https://pawsport.ru

Проект состоит из двух приложений:

- `backend` - API, хранение данных, авторизация, файлы, PDF-экспорт и фоновые процессы.
- `frontend` - пользовательский интерфейс на Next.js.

## Что умеет сервис

- Регистрация, вход, выход, подтверждение email и сброс пароля.
- Создание, просмотр, редактирование и удаление питомцев.
- Хранение основной информации о питомце: имя, вид, порода, дата рождения, пол, вес, микрочип, заметки, теги, контакты ветеринара.
- Фото питомца.
- События по питомцу: вакцинация, обработка, визит, операция, анализы и другое.
- Повторяющиеся события и напоминания.
- Загрузка файлов к питомцу и к событию.
- Календарь событий по всем питомцам.
- PDF-экспорт паспорта питомца.

## Архитектура

### Backend

Стек:

- Node.js
- TypeScript
- Express
- MongoDB и Mongoose
- JWT
- bcryptjs
- S3-compatible storage
- Gotenberg
- Nodemailer
- Zod
- OpenAPI

Backend расположен в `backend`.

Основные части:

- `src/app.ts` - настройка Express, CORS, helmet, rate limit, JSON body limit и подключение роутов.
- `src/server.ts` - запуск API, подключение MongoDB, регистрация фоновых обработчиков и планировщиков.
- `src/routes` - HTTP API.
- `src/controllers` - обработчики запросов.
- `src/services` - бизнес-логика.
- `src/models` - Mongoose-модели.
- `src/jobs` - очередь и обработчики фоновых задач.
- `src/scheduler` - периодические процессы.
- `src/storage` - работа с S3.
- `src/docs` - OpenAPI-описание.

API закрывает основные сущности: пользователи, питомцы, события, файлы, календарь, напоминания и экспорты.

### Frontend

Стек:

- Next.js
- React
- TypeScript
- Chakra UI
- TanStack Query
- Zustand
- openapi-fetch
- react-hook-form

Frontend расположен в `frontend`.

Основные части:

- `pages` - страницы приложения.
- `components` - UI и доменные компоненты.
- `lib` - API-клиенты, сессия, преобразование данных.
- `store` - клиентское состояние.
- `theme` - тема Chakra UI.
- `types/api.ts` - типы API, сгенерированные из OpenAPI backend.

Frontend работает с API через `openapi-fetch`. По умолчанию запросы идут на `/api`, в окружении можно задать `NEXT_PUBLIC_API_BASE_URL`.

## Backend: решения

### Авторизация и безопасность

Пользователь входит по email и паролю. Пароль хранится как bcrypt-хэш.

После регистрации или входа backend выпускает JWT. Токен кладется в cookie `pawsport.access_token` с настройками:

- `httpOnly`
- `sameSite=lax`
- `secure=true` в production
- `path=/`
- срок жизни берется из `JWT_EXPIRES_IN`

API также умеет принимать токен из заголовка `Authorization: Bearer <token>`. Middleware проверяет JWT через `JWT_SECRET`, читает `sub` из payload и кладет пользователя в `req.user`.

Дополнительные меры:

- `helmet` для базовых HTTP security headers.
- `cors` с разрешенными origin из `CORS_ORIGIN`.
- `express-rate-limit`: 1000 успешных запросов за 15 минут.
- Ограничение JSON body до 1 MB.
- Файлы принимаются только через multipart и только типов `application/pdf`, `image/png`, `image/jpeg`.
- Максимальный размер файла - 20 MB.
- Ошибки фоновых задач очищаются от токенов, паролей, secret и ссылок перед записью в логи.

### Данные

Основное хранилище - MongoDB.

Основные коллекции:

- `users` - аккаунты, email, флаги подтверждения, токены подтверждения и сброса пароля.
- `pets` - карточки питомцев.
- `events` - события питомцев.
- `files` - метаданные загруженных файлов.
- `reminders` - email-напоминания.
- `exports` - пользовательские запросы на экспорт.
- `export_artifacts` - переиспользуемые PDF-артефакты.
- `background_jobs` - фоновые задачи.

Файлы и готовые PDF лежат в S3-compatible storage. В MongoDB хранится метаданные и ключ объекта.

### PDF-экспорт

PDF-экспорт сделан как асинхронный процесс.

Поток:

1. Пользователь выбирает период, разделы и типы событий на вкладке экспорта.
2. Backend создает запись `Export`.
3. Backend строит fingerprint данных экспорта.
4. Если готовый PDF с таким fingerprint уже есть и не истек, он переиспользуется.
5. Если готового артефакта нет, создается задача `pet-export`.
6. Обработчик собирает отчет, рендерит HTML через Handlebars-шаблон `backend/templates/pet-export/index.html.hbs`.
7. HTML отправляется в Gotenberg, который рендерит PDF через Chromium.
8. PDF сохраняется в S3.
9. Записи `Export` и `ExportArtifact` переводятся в `ready`.
10. Если пользователь выбрал отправку на email, ставится задача `export-email`.

Gotenberg запускается отдельным сервисом. В production он подключен как `http://gotenberg:3000`, локально в `docker-compose.dev.yml` он доступен на `http://localhost:3001`.

Для экспорта есть retention: артефакты живут ограниченное время, по умолчанию 7 дней. Истекшие PDF удаляются фоновой очисткой.

### Background jobs

Фоновые задачи хранятся в MongoDB в коллекции `background_jobs`.

Очередь поддерживает:

- статусы `queued`, `processing`, `completed`, `failed`, `cancelled`;
- `runAt`;
- `maxAttempts`;
- retry с backoff и jitter;
- lock через `lockedBy`, `lockedAt`, `lockExpiresAt`;
- возврат зависших задач в очередь после истечения lock;
- `idempotencyKey`, чтобы не создавать дубли для одного действия.

Обработчики регистрируются при старте backend:

- `pet-export` - генерация PDF.
- `export-email` - отправка готового PDF на email.
- `export-artifact-cleanup` - удаление истекших PDF-артефактов из S3 и MongoDB.
- `temporary-event-file-cleanup` - удаление временных файлов, если они не были привязаны к событию.

Runner включается переменной `BACKGROUND_JOB_RUNNER_ENABLED=true`.

### Напоминания

Напоминания лежат в коллекции `reminders`.

Scheduler включается переменной `REMINDER_SCHEDULER_ENABLED=true`. Он периодически забирает pending-напоминания, ставит lock, проверяет владельца, питомца, событие и подтверждение email, затем отправляет письмо через SMTP.

Поддерживается канал `email`.

### API-документация

OpenAPI-схема собирается из backend-кода. Swagger можно включить через `SWAGGER_ENABLED=true`.

Команда генерации схемы:

```bash
yarn --cwd backend openapi
```

Frontend-типы генерируются из OpenAPI:

```bash
yarn --cwd frontend gen:api
```

## Frontend: функционал

### Авторизация

Есть страницы:

- регистрация;
- вход;
- подтверждение email;
- запрос сброса пароля;
- установка нового пароля.

После загрузки приложения frontend восстанавливает сессию запросом `/users/me`. JWT хранится в httpOnly cookie, поэтому клиентский код не читает токен напрямую.

### Питомцы

На странице `Мои питомцы` пользователь видит список питомцев и может создать нового.

В карточке питомца есть вкладки:

- `Общая информация`
- `События`
- `Файлы`
- `Экспорт`

В общей информации можно редактировать данные питомца и удалить питомца.

### События

На вкладке событий можно:

- создавать события;
- редактировать события;
- удалять события;
- фильтровать по поиску, типам и диапазону дат;
- прикреплять файлы к событию;
- задавать повторение и напоминание.

Поддержанные типы событий:

- вакцинация;
- обработка;
- визит;
- операция;
- анализы;
- другое.

### Файлы

На вкладке файлов можно:

- загружать PDF, PNG и JPEG;
- смотреть список файлов питомца;
- фильтровать по названию и дате;
- скачивать файлы;
- удалять файлы.

Файлы хранятся в S3, frontend получает ссылки через backend.

### Календарь

Страница календаря показывает события по всем питомцам за выбранный год.

Можно:

- переключать год;
- фильтровать по питомцам;
- фильтровать по типам событий;
- открывать события за конкретный день;
- создавать, редактировать и удалять события из календаря.

### Экспорт

На вкладке экспорта можно выбрать:

- период;
- типы событий;
- способ получения PDF: скачать после готовности или отправить на email.

Frontend создает экспорт через API, показывает прогресс и дает скачать готовый файл, когда backend переведет экспорт в `ready`.

## Локальный запуск

Установить зависимости:

```bash
yarn --cwd backend
yarn --cwd frontend
```

Поднять Gotenberg для локального PDF-экспорта:

```bash
docker compose -f docker-compose.dev.yml up -d gotenberg
```

Создать backend env:

```bash
cp backend/.env.local.example backend/.env.local
```

Запустить backend:

```bash
yarn --cwd backend dev
```

Запустить frontend:

```bash
yarn --cwd frontend dev
```

Локальные адреса:

- frontend: http://localhost:3000
- backend: http://localhost:4000
- healthcheck: http://localhost:4000/health

Для полноценной работы локально нужны MongoDB, SMTP и S3-compatible storage. Их параметры задаются в `backend/.env.local`.

## Проверки

Backend:

```bash
yarn --cwd backend typecheck
yarn --cwd backend lint
yarn --cwd backend test
```

Frontend:

```bash
yarn --cwd frontend lint
yarn --cwd frontend test
yarn --cwd frontend build
```

Интеграционный тест PDF с Gotenberg:

```bash
yarn --cwd backend test:gotenberg
```

## Деплой

Production compose-файл: `docker-compose.yc.yaml`.

В нем поднимаются:

- `nginx` - TLS, redirect HTTP to HTTPS, proxy для `/api` в backend и всего остального во frontend.
- `backend` - API на порту 4000.
- `frontend` - Next.js на порту 3000.
- `gotenberg` - рендер PDF.

Backend и frontend публикуются как Docker-образы в Yandex Container Registry. Nginx обслуживает домен `pawsport.ru`.
