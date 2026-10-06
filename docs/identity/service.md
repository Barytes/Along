# S01 身份认证服务

> 本文保留已有身份服务的实现与验收记录。其规格来源属于此前产品阶段；当前产品定义见 [兴趣小组场景与产品定义](../product-design/product-definition.md)，新的产品流程需另行实现和验收。

实现来源为 [父规格 #2](https://github.com/Barytes/oh-share-it/issues/2)、本地 S01 ticket、[当时的领域词汇](../archive/2026-10-06-product-direction/CONTEXT.md)，以及 ADR-0001、0002、0003、0006 和 0012。S01 没有前置依赖。身份认证与客户端授权由 S01 负责，群组成员资格与业务角色由 S02 负责。

测试边界采用 S01 已确定的公开 HTTP 路径：真实临时 SQLite 数据库、浏览器登录与授权表单、OAuth 客户端的授权码交换、受保护身份查询、退出、撤销和服务重启。账户准备使用管理员本机初始化命令。测试不调用认证组件内部方法、不通过数据库查询推断身份接口行为。

认证协议由 oidc-provider 9.12.2 实现，使用 Authorization Code 和 S256 PKCE、显式资源地址、配置内的客户端与权限范围。参考 [官方配置文档](https://github.com/panva/node-oidc-provider/blob/v9.12.2/docs/README.md) 和 [官方浏览器交互示例](https://github.com/panva/node-oidc-provider/blob/v9.12.2/example/routes/express.js)。

## 运行组件

| 组件 | 固定版本 | 职责 |
| --- | --- | --- |
| oidc-provider | 9.12.2 | OAuth/OIDC 协议、S256 PKCE、授权码、令牌、会话与撤销 |
| Express | 5.2.1 | 浏览器登录、授权表单与受保护身份接口 |
| better-sqlite3 | 13.0.3 | 账户、授权状态及密钥的本机持久化 |
| jose | 6.2.12 | 初次启动生成持久的 RSA 签名密钥 |
| Zod | 4.6.5 | 启动配置与账户输入检查 |
| TypeScript / tsx | 7.0.2 / 4.23.15 | 类型检查、构建及测试运行 |

Node.js 版本范围见 package.json；本次本机使用 Node.js 22.22.2。依赖完整版本与校验值由 package-lock.json 固定。运行时账户密码使用 Node.js crypto.scrypt，参数为 N=32768、r=8、p=3，每个账户使用独立随机盐；数据库仅保存哈希。

## 本机启动

从仓库根目录准备配置：

```sh
npm ci
mkdir -p .runtime
cp src/identity/config.example.json .runtime/identity.json
```

管理员在 .runtime/accounts.json 写入自己选定的登录名和密码，格式为 JSON 数组，每个元素包含 username 与 password。管理账户与成员账户的输入结构相同；密码至少 12 个字符。以下结构中的密码字段需要替换为各自不同的密码：

```json
[
  { "username": "admin", "password": "<choose-a-unique-admin-password>" },
  { "username": "alice", "password": "<choose-a-unique-alice-password>" },
  { "username": "bob", "password": "<choose-a-unique-bob-password>" }
]
```

账户初始化由有权访问部署数据库的管理员在服务器本机执行，不暴露远程创建账户接口：

```sh
chmod 600 .runtime/accounts.json
npm run identity:accounts -- --config .runtime/identity.json --accounts .runtime/accounts.json
rm .runtime/accounts.json
npm run identity:start -- --config .runtime/identity.json
```

初始化输出账户标识、登录名和 created 标志，不输出密码。重复准备相同登录名保留账户标识和原密码，不执行密码重置。群组服务根据准备好的账户标识确定管理员与成员角色。身份服务初次启动后输出 status=ready 与 issuer，SIGINT/SIGTERM 正常关闭 HTTP 服务和数据库。

发布构建后的启动路径如下；构建产物不包含测试代码。

```sh
npm run build
node dist/identity/provision.js --config .runtime/identity.json --accounts .runtime/accounts.json
node dist/identity/main.js --config .runtime/identity.json
```

## 配置契约

| 配置字段 | 含义 |
| --- | --- |
| issuer | 本部署的公开认证服务 origin，不携带路径、账户信息、查询或片段 |
| host / port | 本进程监听地址与端口 |
| databasePath | SQLite 路径；相对路径以启动时的工作目录解析 |
| allowLoopbackHttp | 默认为 false；只有明确开启且服务绑定回环地址时允许本机 HTTP |
| trustProxy | 默认为 false；受信任反向代理终止 HTTPS 时开启 |
| identityResource | 身份查询所要求的精确资源地址 |
| resources | 本部署允许的资源地址及各资源支持的权限范围 |
| clients | 静态登记的 clientId、显示名称、精确 redirectUris、可用资源及权限范围 |
| accessTokenTtl | 访问令牌与 ID Token 有效秒数，默认 900 |
| sessionTtl / grantTtl | 浏览器会话与客户端授权有效秒数，默认均为 28800 |

群组部署使用 HTTPS。管理员将 issuer、identityResource 及 resources 改为部署的 HTTPS 地址，关闭 allowLoopbackHttp，并在回环 HTTP 监听器前配置 HTTPS 反向代理；代理需要覆盖 Host 与 X-Forwarded-Proto，配置 trustProxy=true。数据库文件和签名密钥保持持久。此配置路径尚需在目标部署环境验收。

资源必须属于本部署，并按完整字符串匹配；客户端只能请求配置内的资源和权限。回调地址必须为 HTTPS，原生客户端本机回调可以使用回环 HTTP。服务只支持预先登记的公共客户端、授权码和 S256 PKCE，不启用动态注册、刷新令牌、PAR 或 UserInfo 入口。S06 接入 MCP 时配置实际客户端和 MCP 资源地址。

## HTTP 契约

| 接口 | 输入与输出 |
| --- | --- |
| GET /.well-known/oauth-authorization-server | OAuth 发现信息：issuer、授权、令牌、撤销及支持的协议能力 |
| GET /.well-known/openid-configuration | OIDC 发现信息；供需要 openid 的客户端使用 |
| GET /jwks | 公开验证密钥，不提供私钥 |
| GET /auth | client_id、redirect_uri、response_type=code、scope、resource、code_challenge、code_challenge_method=S256、state |
| GET /interaction/:uid | 与浏览器交互 cookie 对应的登录或授权页面 |
| POST /interaction/:uid/login | username、password、页面提供的 csrf；成功继续授权，错误登录返回 401 invalid_credentials |
| POST /interaction/:uid/confirm | 页面提供的 csrf；保存授权并返回授权码跳转 |
| POST /interaction/:uid/deny | 页面提供的 csrf；返回 access_denied，不签发授权码 |
| POST /token | 表单中的 grant_type=authorization_code、client_id、redirect_uri、code、code_verifier、resource；返回 Bearer access_token、expires_in、scope，openid 流程另有 id_token |
| GET /api/identity | Authorization: Bearer access_token；返回 account_id 与 username |
| POST /token/revocation | 表单中的 client_id、token、可选 token_type_hint；撤销自身客户端授权，成功返回 200 空正文 |
| GET /session/end | 浏览器退出确认页，随后提交页面内含 xsrf 的表单，结束登录并撤销该会话授权 |

授权与令牌请求必须携带资源地址。例如本机身份接口使用 resource=http://127.0.0.1:8787/api 与 scope=openid identity:read。客户端生成随机 state 与 PKCE verifier，保存它们，校验回调 state，再向令牌接口提交 verifier。只有浏览器登录并确认授权后才能取得代码。

身份接口只接受身份资源的 Bearer 访问令牌与 identity:read 权限。无凭证、错误凭证、过期、撤销或错误资源返回 401 invalid_token，权限不足返回 403 insufficient_scope，并附 WWW-Authenticate。查询参数中的 account_id、username 不参与认证。ID Token 只用于 OAuth/OIDC 客户端，不作为本服务访问凭证。

无效客户端、未登记回调、缺失 PKCE 或资源、未知资源以及范围外权限被拒绝。OAuth 组件可以向已经验证的回调地址返回 error 和 state；无法信任回调地址时直接返回错误响应。超出配置的权限返回 400 invalid_scope，未登记回调为 invalid_redirect_uri。浏览器交互缺失 csrf 返回 403 invalid_csrf，交互标识错误返回 400 invalid_interaction，cookie 或交互过期返回 400 interaction_expired。

POST /request 与 GET /me 不作为本阶段公开能力，返回 404，发现文档不声明这些入口。令牌请求缺失 resource 返回 400 invalid_target，不转为其他身份读取凭证。

## 凭证与持久状态

账户标识是随机 UUID，登录名对应的账户在重复初始化及重启后保持同一标识。SQLite 保存账户、签名密钥、cookie 签名密钥、浏览器会话、授权与令牌的必要状态；文件权限设为 0600，新建存储目录权限为 0700。数据库保存的 issuer 必须与启动配置一致，避免把同一认证存储用于不同部署。

访问令牌为不透明随机令牌，每次查询通过认证组件与持久状态校验有效期、客户端、资源、授权和权限，同时按当前启动配置检查客户端仍获准访问该资源及权限。授权码有效期为 60 秒，交互有效期为 600 秒。有效凭证在重启后继续有效，过期、退出、撤销或被当前配置收回访问范围的凭证不因重启恢复。撤销一个客户端令牌同时撤销其授权及同一授权的其他令牌；再次授权需要成员确认。退出结束当前浏览器会话并撤销该会话关联授权。

后续服务在同一进程中使用 startIdentityService 返回的 authenticateBearer(authorization, resource, requiredScopes)，取得 accountId、username、clientId、resource 与 scopes。resource 和 requiredScopes 由受保护接口选定，调用者业务参数不能替代它们。S02 另外判断群组资格与业务角色；S01 返回有效账户身份不意味着该账户已加入群组。

## 独立验收

```sh
npm run typecheck
npm run test:identity
npm test
npm run build
git diff --check
```

自动验收使用真实临时 SQLite、实际 HTTP 监听器、带浏览器 cookie 与表单的认证客户端，以及单独启动的服务进程。测试覆盖登录授权与身份、错误登录、错误服务、权限不足、参数伪造、过期、撤销、退出、拒绝授权、PKCE、授权码重放、账户与会话重启、交互校验及独立入口关闭。测试结束清理临时目录；重启测试通过重新建立 HTTP 连接请求同一部署。

当前验收以认证服务公开接口为准。真实宿主 MCP/OAuth 接入由 S06 与 T01 验收；群组角色、资料读取和真实工作问题分别由后续 tickets 验收。目标环境 HTTPS、其他操作系统与持续运行运维尚需各自验证。

本次执行结果见 [S01 验收记录](verification.md)、[完整测试输出](test-results.txt) 和 [浏览器验收截图](browser-acceptance.jpg)。
