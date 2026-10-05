# oh-share-it

oh-share-it 让群组成员在自己的工作 Agent 中选择另一位成员，并依据该成员主动分享的资料回答当前问题。当前产品范围由 [Spec #2](https://github.com/Barytes/oh-share-it/issues/2) 定义。

S01 实现独立的账户登录与 OAuth 身份认证服务。运行配置、账户准备、公开接口、凭证有效规则与验收方法见 [身份服务说明](docs/identity/service.md)。群组资格、共享资料、目录同步、MCP 业务工具及宿主成员选择由后续 tickets 实现。

开发需要 Node.js 22.22 或更高的受支持 LTS 版本。安装与检查命令：

```sh
npm ci
npm run typecheck
npm run test:identity
npm run build
```
