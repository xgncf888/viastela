# 安卓 APK 验收用例

- 负责人：Chloe · 账号平台测试
- 基线：main `be7fd04`；`eas.json` 的 `preview` 配置（`distribution: internal`，`channel: preview`）
- 现状：还没有 Google Play 开发者账号，安卓靠装 APK 测试。打包、签名和上传都由 Ryan 和 Grok Ultra 走官方渠道，我只验收
- 机型：至少一台 Android 14 或以上的真机，外加一个 Android 10（API 29）的模拟器，用来看低版本
- 测试账号只用一次性的邮箱，不写真实资产数字

## 0. Ethan 定的验收标准（10/29，全部要过）

| 编号 | 检查 | 预期 |
| --- | --- | --- |
| A-00a | CI 打包前的断言 | owner、slug（`viastela`）和 package（`com.viastela.app`）任何一项不对，CI 直接失败，不开始打包 |
| A-00b | 签名证书和 `public/.well-known/assetlinks.json` | `assetlinks.json` 里的 SHA-256 指纹和 `apksigner verify --print-certs` 打出来的一致；包名是 `com.viastela.app`；线上 `https://viastela.vercel.app/.well-known/assetlinks.json` 返回 200，`Content-Type` 是 `application/json`，没有跳转 |
| A-00c | 仓库里没有签名材料 | 搜 `*.jks`、`*.keystore`、`EXPO_TOKEN` 的值、`credentials.json`：零命中；`EXPO_TOKEN` 只在 GitHub Secrets 里，由 Yifeng 配 |
| A-00d | `version.json` 和 sha256 | 网站上的 `version.json` 写着最新的 versionCode、下载地址和 sha256；下载下来的 APK 用 `sha256sum` 算出来的值和它一致；versionCode 比上一个包大 |
| A-00e | App 内检查新版本 | 装旧包、网站上是新版本：提示有新版本；版本相同不提示；`version.json` 拿不到或格式不对时不提示也不崩 |
| A-00f | https 登录回调打开 APK | 点 https 回调链接直接打开 APK，不弹浏览器选择框（`adb shell pm get-app-links com.viastela.app` 显示 verified）；回调白名单里只有精确地址，没有通配符 |
| A-00g | Yifeng 的安卓手机真机走通 | 邮箱 OTP 登录、记一条体重、删号，三步都通过；由 Yifeng 本人操作，我按这份清单核对截图和结果 |

A-00f 涉及的回调白名单属于登录改动：四人全审，再加 Yifeng 点头；由 Yifeng 或 Grok Ultra 配置。

## 1. 安装包本身

| 编号 | 检查 | 预期 |
| --- | --- | --- |
| A-01 | `aapt dump badging` 看包名和版本 | `package: name='com.viastela.app'`，`versionName='1.0.0'`，`versionCode` 每次打包都递增 |
| A-02 | 签名 | `apksigner verify --print-certs` 能通过，证书是 EAS 托管的那份，不是 debug 证书；前后两次打包证书指纹一致，覆盖安装不报签名冲突 |
| A-03 | 权限清单 | 只有用得到的权限（网络、通知 `POST_NOTIFICATIONS`）。出现相机、定位、通讯录、读写外部存储就判不通过 |
| A-04 | 密钥扫描 | 解包后在 `assets/`、`index.android.bundle` 里搜 `sb_secret_`、`service_role`、`eyJ` 开头的 JWT：只允许出现 anon key（公开的），`service_role` 和 `sb_secret_` 零命中 |
| A-05 | 调试开关 | `android:debuggable` 不是 true，bundle 不连 Metro |
| A-06 | 体积 | 记下 APK 大小，作为基线，不设门槛 |

## 2. 安装和启动

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| A-10 | 全新安装后打开 | 桌面名称是 Viastela，图标是自适应图标（圆形、方形遮罩都不切边），主题图标模式下显示单色图标 |
| A-11 | 冷启动 | 启动页是纸色背景加居中图标，没有白屏闪一下；3 秒内进入登录页 |
| A-12 | 深色模式 | 跟随系统，启动页和登录页文字都看得清 |
| A-13 | 覆盖安装新版本 | 不用重新登录，本地数据还在 |
| A-14 | 卸载后重装 | 要重新登录；登录后云端数据都在 |

## 3. 登录

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| A-20 | 邮箱验证码登录 | 收到「星途登录验证码：xxxxxx」，输入后进入今日页 |
| A-21 | 验证码输入框 | 弹出数字键盘；支持从短信或邮件通知一键粘贴 6 位码 |
| A-22 | 60 秒内重发 | 按钮倒计时，不能连点 |
| A-23 | 退到后台 5 分钟再回来 | 验证码页状态还在，倒计时按实际时间走 |
| A-24 | Google、GitHub 登录 | 现在是阻塞状态：要等原生 OAuth（`tasks/native-oauth.md`，回调 `viastela://auth/callback`）做完再测。做完后：登录完成回到 App；取消时停在登录页，不生成新用户 |
| A-25 | 杀掉进程再打开 | 保持登录，直接进今日页 |

## 4. 系统交互

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| A-30 | 系统返回键和返回手势 | 在根页面按返回键退出 App，不会回到登录页；在子页面返回上一级 |
| A-31 | 深链 `adb shell am start -a android.intent.action.VIEW -d viastela://` | 能拉起 App；别的 App 不能抢这个 scheme（只有一个应用响应） |
| A-32 | 字体放大到最大 | 关键按钮（登录、删除账号、记录）不被截断，能点到 |
| A-33 | 横屏 | 锁定竖屏 |
| A-34 | 弱网和断网 | 有明确的失败提示，不卡死；恢复后能重试 |
| A-35 | 提醒设置页 | 只有一句说明（v1 的提醒只在网页和 PWA 上有），没有开关；APK 启动和使用过程中都不弹通知权限请求 |

## 5. 核心路径冒烟

- A-40：今日页、趋势、我的三个标签都能打开，`+ 记录` 能记一条体重、一条训练、一条学习，刷新后还在（详细用例归 Nina）
- A-41：资产页能打开；取价失败时显示「更新失败 · 行情更新于 HH:mm · 重试」
- A-42：隐私页能从我的页面打开，更新日期正确
- A-43：删号流程按 `docs/qa/delete-account-acceptance.md` 第 1 和第 2 节在 APK 上走一遍

## 6. 更新通道

- A-50：preview 包只接收 `preview` 通道的 OTA 更新；推一个只改文案的更新，重开两次 App 后能看到
- A-51：`runtimeVersion` 用 fingerprint：改了原生依赖以后，旧包不会收到新的 JS 更新

## 结论怎么给

每次打包按 SHA 和 `versionCode` 记一条结果：第 0 节全部通过、其余用例没有失败才算通过；A-24 这类标了阻塞的单独列出，不算失败。
