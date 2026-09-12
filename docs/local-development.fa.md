# راهنمای توسعه محلی ClaimFlow AI

[English version](local-development.md)

این راهنما به بهزاد و هر عضو جدید تیم کمک می‌کند پروژه را از صفر روی سیستم خود اجرا کند. دستورهای اصلی برای Windows 11 و PowerShell نوشته شده‌اند.

## چه چیزهایی روی سیستم محلی اجرا می‌شوند؟

ClaimFlow AI یک npm workspace است و دو برنامه دارد:

- `apps/web`: فرانت‌اند React و Vite روی `http://localhost:5173`
- `apps/api`: بک‌اند Node.js و Fastify روی `http://localhost:8080`

Vite درخواست‌های مرورگر را که با `/api` شروع می‌شوند به بک‌اند می‌فرستد. تنظیمات پیش‌فرض پروژه از فایل محلی، دیتابیس داخل حافظه و پاسخ AI ساختگی استفاده می‌کند. بنابراین برای توسعه محلی فعلی به Google Cloud، دستور `gcloud`، Firebase، Firestore، Gemini، Document AI، Service Account یا credential مشترک نیاز ندارید.

## نرم‌افزارها و نسخه‌های لازم

| نرم‌افزار | نسخه تیم | کاربرد |
|---|---:|---|
| Git | آخرین نسخه پایدار | clone، pull، branch، commit و push |
| Node.js | نسخه 22.x یا جدیدتر | اجرای بک‌اند و ابزارهای توسعه؛ CI از Node.js 22 استفاده می‌کند |
| npm | نسخه 11.9.0 | نصب و اجرای workspace؛ در `package.json` ثابت شده است |
| TypeScript | نسخه 6.0.3 | به‌صورت محلی و خودکار با npm نصب می‌شود |

بهتر است دقیقاً Node.js 22 را نصب کنید تا محیط شما شبیه GitHub Actions باشد. TypeScript را global نصب نکنید؛ دستور `npm ci` نسخه درست را داخل پروژه نصب می‌کند. این پروژه فقط از npm و `package-lock.json` استفاده می‌کند، نه Yarn یا pnpm.

Git را از <https://git-scm.com/download/win> و Node.js 22 را از <https://nodejs.org/en/download> نصب کنید. نصب‌کننده Node.js همراه npm است؛ بعد از نصب، npm را با نسخه ثابت پروژه هماهنگ کنید.

بررسی نسخه‌ها در PowerShell:

```powershell
git --version
node --version
npm --version
```

اگر نسخه npm برابر 11.9.0 نیست:

```powershell
npm install --global npm@11.9.0
```

بعد از نصب یا به‌روزرسانی Node.js/npm، پنجره PowerShell را ببندید و دوباره باز کنید تا برنامه‌های جدید در `PATH` در دسترس باشند.

## نصب و اجرای اولین‌بار روی Windows

PowerShell را در هر پوشه‌ای که خودتان برای پروژه‌های توسعه انتخاب کرده‌اید باز
کنید. در File Explorer می‌توانید پوشه را باز کنید، روی فضای خالی راست‌کلیک کنید و
**Open in Terminal** را بزنید. این دستورها هیچ drive، نام کاربری یا پوشه شخصی خاصی
را فرض نمی‌کنند.

```powershell
git clone https://github.com/amin076/claimflow-agent.git
Set-Location claimflow-agent
git switch main
git pull origin main
npm ci
Copy-Item .env.example .env
npm run dev
```

از `npm ci` استفاده می‌کنیم تا dependencyها دقیقاً مطابق `package-lock.json` نصب شوند. فایل `.env` را commit نکنید.

پس از اجرای موفق، آدرس `http://localhost:5173` را باز کنید و روی **Create demo case** بزنید. باید پرونده `CF-2026-001`، فیلدهای استخراج‌شده، درصد اطمینان، evidence و دو مورد نیازمند بررسی نمایش داده شوند.

برای متوقف‌کردن dev serverها در همان ترمینال `Ctrl+C` بزنید.

## اجرای هم‌زمان فرانت‌اند و بک‌اند

از پوشه اصلی repository اجرا کنید:

```powershell
npm run dev
```

| بخش | آدرس |
|---|---|
| فرانت‌اند | `http://localhost:5173` |
| بک‌اند | `http://localhost:8080` |
| بررسی سلامت بک‌اند | `http://localhost:8080/health` |
| API پرونده آزمایشی | `http://localhost:8080/api/cases/demo` |

## اجرای جداگانه فرانت‌اند و بک‌اند

این روش برای دیدن logها و عیب‌یابی بهتر است.

PowerShell اول را داخل repository کلون‌شده `claimflow-agent` باز کنید — بک‌اند:

```powershell
npm run dev:api
```

PowerShell دوم را داخل همان repository باز کنید — فرانت‌اند:

```powershell
npm run dev:web
```

PowerShell سوم — تست بک‌اند:

```powershell
Invoke-RestMethod http://localhost:8080/health
Invoke-RestMethod http://localhost:8080/api/cases/demo
```

در پاسخ health باید `status: ok` و `service: claimflow-api` دیده شود.

## تنظیمات محیط محلی

فایل `.env.example` را می‌توان با خیال راحت کپی کرد. حالت‌های توسعه فعلی آن عبارت‌اند از:

```dotenv
STORAGE_MODE=local
DATABASE_MODE=memory
AI_MODE=mock
HOST=0.0.0.0
PORT=8080
WEB_ORIGIN=http://localhost:5173
NODE_ENV=development
```

متغیرهای نام پروژه و location گوگل برای deployment آینده آماده شده‌اند؛ ولی حالت local/mock به سرویس‌های Google Cloud متصل نمی‌شود.

فایل `.env`، Application Default Credentials، فایل JSON مربوط به Service Account، API key و مدارک واقعی مشتری را هرگز commit نکنید. credential یک توسعه‌دهنده نباید برای عضو دیگری ارسال یا کپی شود. در فاز Cloud، هر نفر با هویت Google خودش و فقط IAM roleهای لازم وارد پروژه می‌شود.

## روال روزانه Git

قبل از شروع یک کار جدید، PowerShell را داخل repository کلون‌شده باز کنید:

```powershell
git switch main
git pull origin main
npm ci
git switch -c feature/short-description
npm run dev
```

اجرای مجدد `npm ci` مشکلی ندارد و dependencyها را با lockfile هماهنگ می‌کند. اگر branch از قبل ساخته شده است:

```powershell
git switch feature/short-description
git merge main
```

تغییرات را روی feature branch انجام دهید، commitهای کوچک و مشخص بسازید، branch را push کنید و Pull Request باز کنید. مستقیماً روی `main` توسعه ندهید.

## بررسی کیفیت قبل از Pull Request

از پوشه اصلی پروژه اجرا کنید:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

همه دستورها باید موفق باشند. GitHub Actions نیز همین بررسی‌ها را انجام می‌دهد و PR فقط بعد از سبزشدن CI و review عضو دیگر تیم merge می‌شود.

## هر بخش را کجا تغییر دهیم؟

| نوع کار | محل فایل‌ها |
|---|---|
| صفحه‌ها و componentهای React | `apps/web/src` |
| routeها و منطق بک‌اند Fastify | `apps/api/src` |
| schemaها و typeهای مشترک | `packages/domain/src` |
| تنظیمات محیط مشترک | `packages/config/src` |
| داده‌های آزمایشی غیرحساس | `sample-data/cases` |
| مستندات محصول و مهندسی | `docs` |

تغییر schemaهای `packages/domain` می‌تواند هم فرانت‌اند و هم بک‌اند را تحت تأثیر قرار دهد؛ پس بعد از آن تمام quality checkها را اجرا کنید.

## رفع خطاهای متداول

### خطای `API returned 502`

این خطا معمولاً یعنی فرانت‌اند اجرا شده ولی به بک‌اند روی port 8080 دسترسی ندارد. در PowerShell جداگانه بک‌اند را اجرا کنید:

```powershell
npm run dev:api
```

سپس endpoint سلامت را با `Invoke-RestMethod` تست و صفحه مرورگر را reload کنید. اگر health جواب نداد، خطای واقعی startup را در ترمینال بک‌اند بخوانید.

### port شماره 8080 یا 5173 اشغال است

ابتدا port و process را بررسی کنید:

```powershell
Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
Get-Process -Id <PID>
```

ترمینالی را که dev server قدیمی در آن اجراست ببندید. فقط اگر مطمئن شدید PID متعلق به process قدیمی Node.js است، همان process را متوقف کنید:

```powershell
Stop-Process -Id <PID>
```

### خطای فایل گمشده یا خراب هنگام `npm ci`

ممکن است نصب قبلی نیمه‌کاره مانده باشد. از پوشه اصلی پروژه:

```powershell
Remove-Item -Recurse -Force node_modules
npm cache verify
npm ci
```

برای دورزدن خطا `package-lock.json` را حذف یا دوباره تولید نکنید. اگر مشکل باقی ماند، متن کامل خطا و مسیر npm log را در issue تیم قرار دهید.

### نسخه Node.js، npm یا TypeScript اشتباه است

```powershell
node --version
npm --version
npm exec tsc -- --version
```

خروجی مورد انتظار Node.js 22.x یا جدیدتر، npm 11.9.0 و TypeScript 6.0.3 است. پس از نصب یا تغییر نسخه، PowerShell را ببندید و دوباره باز کنید تا `PATH` تازه شود.

### تغییرات محلی مانع `git pull` شده‌اند

بدون بررسی هیچ فایلی را حذف نکنید:

```powershell
git status
git diff
```

تغییرات معتبر را روی feature branch خود commit کنید. اگر فایل‌ها برای شما ناشناخته‌اند، قبل از stash یا حذف با تیم هماهنگ کنید.

## چه زمانی Google Cloud لازم می‌شود؟

هنگام اضافه‌کردن Firestore، Cloud Storage، Gemini/Vertex AI، Document AI یا deployment روی Cloud Run، تنظیمات Cloud آغاز می‌شوند. آن زمان اعضای تأییدشده Google Cloud CLI را نصب می‌کنند، هرکدام با Google account خودشان وارد می‌شوند، پروژه تیم را انتخاب می‌کنند و فقط IAM role موردنیاز وظیفه‌شان را می‌گیرند. توسعه محلی فازهای 1 و 2 همچنان بدون credential ابری اجرا می‌شود.
