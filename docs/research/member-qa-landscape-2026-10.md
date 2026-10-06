# 成员在线问答产品与技术方案调研

调研日期：2026-10-05（Asia/Shanghai）。范围是截至当天可核查的产品和技术文档，不覆盖 2026 年 10 月尚未发生的发布。

## 研究问题与判断

**成员私有资料副本、在线检索回答、权限控制与工作 Agent 接入，都已经存在成熟或正在交付的产品。这个项目值得验证的价值，是熟悉的群组成员能否在当前工作中，更方便地取得另一位成员愿意提供的信息。** 单独提供知识库问答、MCP 或 `@` 交互，已经不足以说明产品差异；把这些行为组合起来，仍然需要确认用户是否更愿意采用。

本次研究中的 A 方向是：群组服务保存成员选定的授权资料副本，在线响应器代表指定成员提供问答；原始材料不因同步就成为全组可浏览的公共知识。当前用户已经选择指定目录同步、工作 Agent 输入 `@` 后选择群组成员，以及用户主动调用求助 Skill 后授予本次会话自动求助权限。研究建议不自动修改这些决定，也不自动决定实现框架。

资料处理权限与回答分享权限是这里最重要的区分。A 可以没有直接阅读 B 原始笔记的权限，但可以调用 B 授权的问答服务，获得符合 B 分享规则的回答。这与“用 A 的身份搜索所有 A 原本能阅读的企业文档”不同；不过，共享账户、Agent 自有连接和按受众配置的个人问答产品已经提供相近能力，需要认真比较。

本研究以官方文档、官方代码仓库和维护者问题记录为来源，按三种证据说明结论：

- **文档能力与限制：** 厂商或项目明确说明的功能、约束和部署要求。
- **问题记录：** 官方仓库中可定位的报告和维护者讨论，不能据此推断所有用户都有相同问题。
- **研究判断：** 根据已核查能力推导的取舍与本项目机会，仍需用户试用或工程验证。

本次没有购买或试用产品，没有安装、部署或运行它们，也没有测量检索质量、泄露概率、时延和费用。没有在公开资料中找到某项能力，表示这次调查没有建立其存在证据，不表示市场上没有产品实现它。

## 现有方案的技术路线

**现有方案的差异主要来自数据访问方式、执行身份和授权对象。** “云端问答”并不必然意味着把全部资料向所有用户开放；“实时 MCP”也不必然意味着资料在回答者的个人电脑上执行。

| 技术路线 | 处理流程 | 典型方案 | 对本项目的意义 |
| --- | --- | --- | --- |
| 资料同步后建立权限感知索引 | 抓取正文、元数据与权限，建立检索索引；回答时过滤授权资料 | Glean、Microsoft synced connectors、Onyx | 接近 A 的数据基础，重点是同步状态、成员身份和权限一致性 |
| 共享或个人问答 Agent | 所有者配置资料、连接、回答规则和受众；调用者使用该服务 | Delphi、ChatGPT Workspace Agents | 更接近“询问某人的获准问答服务”，需要明确服务的身份和输出权限 |
| 请求时查询在线源系统 | 通过 MCP/API 和 OAuth 实时查询应用；结果进入模型上下文 | Microsoft federated connectors、Glean tools、ChatGPT 非同步连接 | 可减少预先复制与索引；依赖源服务在线和可用权限，不等同于本地响应 |
| 可复用的问答与上下文组件 | 平台提供知识库、空间或容器，处理资料或会话，再通过 API/MCP 提供检索或回答 | Dify、AnythingLLM、supermemory、teamcontext.ai | 包含自建平台与托管服务，可以减少基础开发；群组业务与“仅获准回答”权限仍需核查 |

同步副本与请求时查询可以同时出现在一个产品中。例如 Glean 明确区分建立索引的抓取与请求发生时运行的工具；Microsoft 也同时提供 synced 与 federated connectors。这是已经存在的技术组合，而非本项目必须一次实现的完整架构。[Glean：索引与实时工具](https://docs.glean.com/connectors/configure-actions-in-datasource/config-actions-mcp-from-datasource)、[Microsoft：connector 类型](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/overview)

## 企业知识与 Agent 平台

### Glean

**Glean 同时提供企业知识检索、在线回答、人物发现和工作 Agent 接入，是最重要的相邻产品之一。** 它的连接器抓取内容、活动信息、身份与访问权限，并利用这些信息决定检索结果的可见范围；不只是建立一个没有成员权限的向量库。没有原生连接器时可以使用 Indexing API，但需要自己维护数据接入。[Glean Search FAQ](https://docs.glean.com/administration/search/faq)

Glean 的标准 AI Answers 使用提问者已有权查看的内容。官方也已经说明可以输入 `@` 选择文档或人物，因此“按人提问”交互本身已有替代；这次调查没有建立“选中人物后改用该人物全部私有资料权限回答”的证据。[Glean AI Answers](https://docs.glean.com/user-guide/assistant/ai-answers)、[Start using Glean](https://docs.glean.com/user-guide/basics/a-beginner-s-guide-to-chat)

Glean 的 MCP 可被 Cursor、Claude、ChatGPT、Codex 等宿主使用，提供搜索、聊天、文档读取、人物查找和 Agent 调用。管理员需要启用服务；用户通过 SSO/OAuth 连接。官方还提供面向 Cursor、Claude Code 和 Codex 的插件及动态 Skill/工具发现，因此“留在已有工作 Agent 中使用团队知识”也已经是现有产品能力。[Glean MCP 使用文档](https://docs.glean.com/user-guide/mcp/usage)

Glean 将 Agent 暴露为 MCP 工具时有接口限制：含 Wait for user input/HITL 的 Agent 不能按该路径提供，宿主 timeout 后后台可能继续执行却无法把结果返回。2026-09-29 发布说明另外提供 durable runs、运行 ID 与查询、批准恢复/取消能力；不能从 MCP 限制推导整个平台没有异步恢复。[Agents as MCP tools](https://docs.glean.com/administration/platform/mcp/agents-as-tools)、[2026-09-29 发布说明](https://docs.glean.com/release-notes/releases/2026-09-29-september-release)

Glean 的引用提供获准来源的预览和原文链接，部分来源支持定位到段落、幻灯片或页码；这些链接不会授予新的访问权限。资料访问被撤回后，历史回答中的引用可能仍然保留。由此可见，当前检索权限与历史回答保留是不同生命周期。[Glean Citations](https://docs.glean.com/user-guide/assistant/glean-chat/glean-chat-citations/glean-citations)

**Glean 官方确认的主要困难是资料新鲜度、连接器运行条件和回答质量。** 其排查文档将缺失文档归因于源权限、连接器、索引时机等不同环节；近期文档给出的新内容传播示例是常见应用约 15 分钟，受 API 限制的应用可到一小时。它没有发布统一回答时延目标，推理模式和检索范围会影响等待时间。[Glean 回答质量排查](https://docs.glean.com/user-guide/assistant/answer-quality)

源文档删除通常通过 API/webhook 在分钟至小时内传播；没有删除事件或事件遗漏时等待下一次完整抓取，连接器的完整抓取间隔为 6 小时至 28 天。删除整个 connector instance 后停止搜索的“最多约 5 分钟”是另一项操作，不能当作源文档删除的统一保证；管理员可以临时隐藏内容。[Glean Crawl FAQ](https://docs.glean.com/connectors/crawling-faq)

本研究判断：Glean 为已有组织应用、身份系统和管理员支持的团队提供广泛能力。本项目若面向熟人小组和本地工作目录，可能减少组织接入与配置步骤，但“更轻量、更好用”尚未通过用户比较验证。公开文档没有证明 Glean 将本项目的会话 Skill 授权、每成员分享规则和仅回答权限完整组合为同一默认流程。

### Microsoft 365 Copilot、Copilot Search 与 connectors

**Microsoft 已明确交付多种资料接入方式，不能把它概括成只有公司公共知识库。** Tenant synced connectors 由管理员设置，内容及 ACL 进入 Microsoft Graph；self-serve synced connectors 由管理员控制可用性、用户使用自己的身份授权，形成用户范围索引；federated connectors 通过 MCP 在请求时读取源系统。[Microsoft connectors overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/overview)

Self-serve sync 目前在文档中标为有限客户 preview，按用户隔离索引，约有 90 天的回溯范围；断开或管理员关闭后删除对应索引并停止同步。这是成员自己授权同步的相近技术，但它不是让其他成员自动访问该人的私有索引。[Self-serve sync 管理](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/manage-personal-sync-connectors)

Federated MCP 读取使用经过认证的请求者身份和源权限，不将资料预先索引到 Graph。这里的“数据留在源系统”是检索和存储方式，查询结果仍被 Copilot 用来生成回答。自定义集成涉及 Microsoft 365 租户、管理员角色、身份配置和产品许可；不是给小组附加一个无配置的 MCP 地址。[Federated connectors](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/federated-connectors-overview)、[部署前提](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/prerequisites)

Microsoft 对 Windows 网络共享也有 File Share connector：读取共享目录，按 Share/NTFS ACL 及 AD 身份限制搜索范围。它需要相应源账户和连接器组件，这与直接同步每位 macOS 用户的工作目录仍是不同接入任务。[File Share connector](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/fileshare-connector)

**Microsoft 官方确认的权限痛点是配置错误和更新传播。** Synced connector 的 ACL 变化可能最多约 24 小时才反映到 Search/Copilot，权限在 full crawl 而非 incremental crawl 更新；文档要求必要时重新触发 full crawl。这个限制适用于所引用的外部索引流程，不能推广到所有 SharePoint 或实时 MCP 访问。[索引与权限排查](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/indexed-content)

管理员若选择 Everyone，就可能扩大敏感内容可见性；目前 connector 创建后的访问模式不能直接变更，官方指示删除后重建连接。该产品能够执行 ACL，不代表初始 ACL 和可见性配置总是符合用户意图。[管理 connector 访问权限](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/manage-access-permissions)

截至本次核查，overview 同时有“写入将在 2026 年 10 月初开始提供”和 read-only 描述，federated 详细文档还把 write/update/delete 标为 Coming soon。本报告只将已经明确的读取与检索能力用于比较，不认定写入已经在所有客户可用。[Connector overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/overview)、[Federated connectors](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/federated-connectors-overview)

本研究判断：已有 Microsoft 365 管理基础的团队应该优先把 Copilot 作为替代方案比较。对于没有统一组织租户的小组，管理员与源系统身份准备可能增加开始使用的成本；成本需要实际接入验证，不能仅凭文档推断其用户会拒绝采用。

### ChatGPT 的公司知识、自定义 MCP 与 Workspace Agents

**ChatGPT 已支持预先同步资料和请求时调用连接服务，也有可以共享的工作 Agent。** 官方 Plugin controls 区分 synced 索引与 non-synced 的临时处理，并要求分别检查插件可用性、连接账户授权及源系统权限；启用插件不会直接取得某个账户的数据。[ChatGPT Plugin controls](https://learn.chatgpt.com/docs/enterprise/apps-and-connectors)

Company Knowledge 当前帮助页将其描述为 plugin，可通过 `@Company Knowledge` 或工具菜单调用，使用获准的个人 OAuth 或管理员管理的来源。它是在工作对话中调用企业知识能力的直接替代，`@Company Knowledge` 的对象是知识插件。[Company Knowledge 帮助](https://help.openai.com/en/articles/12628342/)

自定义远程 MCP 可连接私有数据源。要兼容 company knowledge，需要标准 `search`/`fetch` 输入及返回结构，并提供可供用户打开的来源 URL；官方示例的 `fetch` 返回文档内容。这提供了工作 Agent 接入技术，但若服务只允许分享回答或片段，直接照用完整文档 fetch 示例就不符合产品权限。[Company knowledge compatibility](https://developers.openai.com/plugins/build/mcp-server#company-knowledge-compatibility)、[MCP 集成文档](https://developers.openai.com/api/docs/mcp)

Workspace Agents 的官方示例支持两种连接身份：End-user account 使用每位调用者的源权限；Agent-owned account 使用 Agent 配置的服务账户权限。后者可以使调用者获得其本人账户无法直接读取的内容，因此不能说现有方案一律只在请求者 ACL 内回答。Agents 可共享，并在 ChatGPT 输入中通过标记调用；当前文档将该功能称为 Business、Enterprise、Edu 的 research preview。[Workspace Agent 官方示例](https://developers.openai.com/cookbook/articles/chatgpt-agents-sales-meeting-prep)

公司管理的 workspace connections 也可以供获准的 Team Tasks 或 `@ChatGPT` 场景使用。管理员配置谁可以发现、使用和管理连接；连接账户的源权限决定数据范围。官方明确说明用户可以读到摘要却打不开来源，来源链接不会授予原文权限。这已经接近“通过服务得到信息，但不必获得原始资料访问权”的模式。[Workspace connections](https://learn.chatgpt.com/docs/enterprise/shared-connections)

Workspace Agent API trigger 是异步接口：接受并排队开始工作，不在请求返回中提供完成的回答。需要配置输出目的地并另行验证执行完成，不能把它描述为同步的 `ask_member` 问答 API。[Workspace Agent API trigger](https://developers.openai.com/cookbook/examples/chatgpt/workspace_agents/workspace-agents-api-trigger)

当前 Workspace Agents 帮助页还描述群组共享与 Codex Workspace Agents plugin，是比单独调用外部检索源更接近的已有服务入口。当前帮助页与 cookbook 的 preview 措辞不能用于推断全部租户已经 GA；本次没有验证某个账号的获配状态。[Workspace Agents 帮助](https://help.openai.com/en/articles/20001143/)

**ChatGPT 官方确认的困难是权限层级、撤回和多种副本的保留规则。** 同步源内容或权限变化需要传播时间；断开连接不会自动删除已经写入对话、生成文件或其他记录的信息。共享连接可以扩大读写范围，因而要另行限制连接账户、受众与动作权限。本报告未找到逐条生成回答的成员分享批准与在途撤回保证，不能据此判断产品一定不能配置实现。[ChatGPT Work Overview](https://learn.chatgpt.com/docs/enterprise/chatgpt-work-overview)、[Workspace connections](https://learn.chatgpt.com/docs/enterprise/shared-connections)

本研究判断：若首批用户已经使用兼容的 ChatGPT 工作空间，可先比较“成员为自己的资料配置共享 Agent”的操作成本。原生 Tagging 的对象是 Agent，业务上是否等于某位自然人，仍要由团队配置；本次没有建立跨所有工作 Agent 宿主、输入 `@` 就显示同一群组成员的原生支持证据。

## 按成员问答与团队上下文服务

### Delphi

**Delphi 是本次最接近“某个人的在线资料回答服务”的直接对照，A 方向应当首先与它比较。** 每个 Digital Mind 保存自己的 Knowledge，可提供文件、URL、问答与笔记；支持连接 Drive、Notion、Granola、Obsidian 等源并更新资料。内容可附作者、背景和 Citation URL，该链接可以隐藏或指向购买页，因此问答不要求公开整份原文。[Delphi Knowledge](https://help.delphi.ai/articles/16041852-add-knowledge-train-mind)

Delphi 在 2025-08-19 已公布 Access Groups：同一个人的 Mind 可以按不同受众限定资料、消息与语音额度，并配置回答 overrides。这已经包含“同一成员向不同人提供不同信息与服务额度”的机制，不能把它当作尚未被产品化的概念。[Delphi Access Groups](https://www.delphi.ai/blog/access-groups-give-the-right-people-the-right-version-of-your-digital-mind)

Private Mind 不进入公开发现，但仍可经集成、嵌入或受邀 audience 访问。Creator 和 Collaborator 可以维护同一 Mind，协作权限与数量依套餐。这里的“多人管理一个 Mind”与“群组里每个人拥有自己的问答服务”是不同产品组织方式。[Delphi Settings](https://help.delphi.ai/articles/16042964-settings)、[Delphi Preferences](https://help.delphi.ai/articles/17222184-preferences)

Delphi 的 REST API 支持会话与流式回答，key 范围是一项 clone，API 访问限于 Immortal 套餐。其搜索接口支持语义查询、关键词、来源过滤和访问层级，返回来源片段及创建与更新时间；这些时间字段不等于独立的来源版本标识。若采用它作为服务端组件，密钥和原始检索接口仍要由群组业务服务管理。[Delphi API](https://docs.delphi.ai/api-immortal-only)、[Delphi Search](https://docs.delphi.ai/api-immortal-only/search)

**Delphi 官方确认的痛点是资料同步与资料删除并非一项操作。** 删除 synced feed 不会删除此前导入的内容，需要另外从 Knowledge 删除。公开网页源也受登录墙、crawler 阻挡和支持格式限制。这些是官方说明的限制；本研究没有查到删除与在途生成回答、会话缓存如何联动的公开契约。[Delphi Knowledge FAQ](https://help.delphi.ai/articles/16041852-add-knowledge-train-mind)

本研究判断：Delphi 已经证明按个人、受众与资料范围提供在线问答是一种真实产品方案。本项目可能的区别是熟人群组、当前工作 Agent 的成员选择和会话内自动求助，但这次查到的资料没有证明用户愿意为了这些区别更换产品。隐藏引用有助于原文不公开，也可能降低回答的可核对性，不能把隐藏来源自动视为优点。

### teamcontext.ai

**teamcontext.ai 直接解决“工作 Agent 如何获得队友近期工作上下文”，值得作为工作入口的替代方案比较。** CLI 配置会话 hooks、stdio MCP、项目 Agent 指令和 Git post-commit hook，将信息送到云 API；其流程描述包括 prompt、完整 turn 元数据和 conversation log，并在会话结束时形成摘要。[teamcontext.ai Getting Started](https://teamcontext.ai/docs/)

MCP 工具可查询团队状态、按作者查看近期活动、文件历史、会话 turns 和决策理由，也提供创建、领取和完成交接的工具。Dashboard 文档描述完整 transcript replay、来源链接和基于会话与决策生成知识文章。这与静态上传资料问答相比，更注重 coding-agent 工作过程的采集和交接。[MCP tools](https://teamcontext.ai/docs/mcp-tools/)、[Dashboard](https://teamcontext.ai/docs/dashboard/)

其安全文档描述团队范围的 PostgreSQL RLS、角色与保留规则，2026-10-05 的隐私政策说明会话资料与摘要在组织成员之间共享。因此标准数据单位是团队捕获的上下文；本次查到的接口没有描述“允许询问某人，却不允许直接读取该人的会话正文”的同等业务约定。[Security](https://teamcontext.ai/security/)、[Privacy Policy](https://teamcontext.ai/privacy-policy/)

**teamcontext.ai 的公开资料存在需要核对的采集范围措辞。** Security 的 metadata/summaries 描述与 setup/dashboard 的完整会话日志、transcript replay 描述不同。试用前要确认实际配置、上传字段、默认可见范围和删除路径；本报告没有据此认定发生了未授权采集，也没有把产品宣传当作测量结果。

本研究判断：自动采集可以减少知识维护，但需要成员安装和维护宿主 hooks，并同意相应数据分享。本项目的“仅同步成员选择的目录”可能更容易表达资料范围；是否比自动采集更省力，需要用户试用。相似名字的 [hzhou9/TeamContext](https://github.com/hzhou9/TeamContext) 是另一项 Git 与 Markdown 项目，不能混用它们的能力或问题记录。

### supermemory

**supermemory 已提供带身份、空间选择和工作 Agent 接入的共享上下文能力，MCP 本身不是本项目的独有实现。** 当前 remote MCP 使用 OAuth 选择空间，提供搜索、profile、保存/忘记、列举和读取文档等工具。支持 MCP Apps 的客户端还可显示空间选择、可编辑保存表单和文件上传；空间选择并不等于宿主输入框中的 `@成员` 列表。[supermemory MCP](https://supermemory.ai/docs/supermemory-mcp/mcp)

Container tag 划分不同用户、项目或 Agent 的向量命名空间；成员和 scoped API key 可限制 tag 与读写权限。撤回 key 会停止后续认证，但不删除容器和其中的内容。因此数据分区、访问授权和内容删除是三个独立机制。[Container tags](https://supermemory.ai/docs/concepts/container-tags)、[Authentication](https://supermemory.ai/docs/authentication)

摄取包括提取、分块、embedding 和索引；状态 done 表示 source chunks 已可检索，默认的记忆推导仍可能继续。修改原文触发重新处理，元数据更新不等同重新建立索引；删除 document 与 soft forget memory 的保留语义也不同。[处理流程](https://supermemory.ai/docs/concepts/how-it-works)、[Document operations](https://supermemory.ai/docs/ingestion/document-operations)、[Forget memory](https://supermemory.ai/docs/api-reference/content-management/forget-a-memory)

**supermemory 的轻量本地版与多人管理版不能混为同一方案。** 当前文档说明 local binary 是单机、单 key、没有 connectors，服务端源代码不在公开仓库；成员角色、scoped key 和持续同步属于 managed Enterprise 路径。部署位置与产品版本会改变可用权限能力。[Local vs Enterprise](https://supermemory.ai/docs/self-hosting/local-vs-enterprise)

本研究判断：它可承担检索与记忆基础设施，但让队友拥有 B 空间的 read 权限，可能同时开放 `get_document`。如果只允许调用 B 的获准问答服务，仍需中介业务接口管理内部检索，不向调用者提供直接读取 B 原文的凭据。本次未建立完整逐回答成员确认和在途撤回协议的证据。

## 自建问答平台

### Onyx

**Onyx 是可自建的企业搜索与问答系统，权限感知检索值得借鉴，但产品版本会影响权限能力。** Connector 同步文档、元数据与源权限，在线处理包含分块、embedding、关键词与向量检索、重排和生成；文档说明 PostgreSQL 保存身份、历史与权限，检索索引保存正文/向量/ACL，另有原文对象存储。[Onyx Data flows](https://docs.onyx.app/security/architecture/data_flows)、[Storage](https://docs.onyx.app/security/architecture/data_storage)

源 ACL 镜像、逐文档和用户/群组权限属于 Enterprise 范围；Community 有登录或 SSO，不代表已经有同样的资料 ACL。它的 MCP 原生支持 Streamable HTTP，以 PAT/API key 认证，搜索工具返回片段、分数和来源链接。[Access controls](https://docs.onyx.app/security/architecture/access_controls)、[Onyx MCP](https://docs.onyx.app/deployment/configuration/mcp_server)

Standard 资源文档给出的最低要求为 4 vCPU、10 GB 内存，Lite 为 2 vCPU、2 GB；不能由资源较少推断 Lite 包含 Standard 所有能力。2026-10-02 的 v4.8.4 可定位，固定版本 compose 使用 MinIO，现行文档提到 SeaweedFS，因此本报告统一称对象存储，避免把不同时间的依赖组合成一个已核实配置。[Resourcing](https://docs.onyx.app/deployment/getting_started/resourcing)、[v4.8.4](https://github.com/onyx-dot-app/onyx/releases/tag/v4.8.4)、[固定版本 compose](https://github.com/onyx-dot-app/onyx/blob/v4.8.4/deployment/docker_compose/docker-compose.yml)

本研究判断：Onyx 更适合作为已有企业知识源的自建对照。标准文档 ACL 主要决定谁能访问内容，不直接表达“谁能调用成员问答、允许得到哪些转换后的答案”。本项目需要确认 Enterprise 权限、业务中介和运维投入是否值得，不能因其开源就假定全部权限免费、部署轻量。

### Dify

**Dify 是知识问答应用和 Workflow 构建平台，最直接的复用价值是减少检索与生成流程开发。** Knowledge Retrieval 返回命中片段、标题与元数据，支持向量、全文、混合检索和可选 rerank，Chatflow 默认可附引用。[Knowledge Retrieval](https://docs.dify.ai/en/self-host/use-dify/nodes/knowledge-retrieval)、[Indexing methods](https://docs.dify.ai/en/self-host/use-dify/knowledge/create-knowledge/setting-indexing-methods)

知识库管理权限与最终问答用户权限需要区分。库访问的文档说明包括查看、修改、删除和禁用知识内容；Normal 工作空间成员主要使用已发布应用，Enterprise 增加自定义角色等控制。已发布 Web App 默认公开，额外认证/成员限制有版本要求。[Knowledge 管理](https://docs.dify.ai/en/self-host/use-dify/knowledge/manage-knowledge/introduction)、[Workspace members](https://docs.dify.ai/en/self-host/use-dify/workspace/team-members-management)、[Web App settings](https://docs.dify.ai/en/self-host/use-dify/publish/webapp/web-app-settings)

Dify 已能将应用发布为 MCP，URL 携带凭据，重建 URL 使旧凭据失效；这提供应用访问，不能直接作为每次调用的自然人成员身份与资料分享授权。2026-09-10 发布的 1.17.1 可定位；官方 Docker 路径的最低配置为 2 CPU、4 GiB，仍包含多项核心与依赖服务。[Publish MCP](https://docs.dify.ai/en/self-host/use-dify/publish/publish-mcp)、[1.17.1](https://github.com/langgenius/dify/releases/tag/1.17.1)、[Docker quick start](https://docs.dify.ai/en/self-host/deploy/quick-start/docker-compose)

**Dify 有可定位的删除一致性问题记录，但不能推断成稳定版通病。** 2026-09-21 的 issue #42641 针对 main commit `22aff66cc0` 报告多模态文档删除后附件向量遗留，以及共享附件仍被其他文档引用时 blob 清理；核查时 issue 为 Open 并关联 PR。报告未复现，也未证明 1.17.1 受同一问题影响。[Dify #42641](https://github.com/langgenius/dify/issues/42641)

本研究判断：Dify 可承担内部回答流程，本项目仍需在外层提供群组身份、请求状态、每成员资料域、分享规则和返回前检查。文档 disable/delete 的存在，不足以证明授权撤回后所有在途回答、检索缓存和派生附件已经同步失效。

### AnythingLLM

**AnythingLLM 更接近小规模工作空间问答，但多人服务和本地桌面使用是不同部署模式。** Docker 支持多人，Admin 可管理全部，Manager 可访问全部 workspace，Default 主要在获准 workspace 聊天；资料嵌入后可被该 workspace 的线程和用户使用。[Security and access](https://docs.anythingllm.com/features/security-and-access)、[Document chat](https://docs.anythingllm.com/chatting-with-documents/introduction)

其当前 MCP 文档主要描述 AnythingLLM 作为客户端使用外部工具，不能写成现成的原生 MCP 服务端。REST API 可用于构建中介，但 developer API key 属系统级权限；若本项目采用，需要服务端保管 key 并执行成员权限。2026-10-01 的 v1.17.0 有对应安全说明和认证 middleware。[MCP overview](https://docs.anythingllm.com/mcp-compatibility/overview)、[API](https://docs.anythingllm.com/features/api)、[v1.17.0 SECURITY](https://github.com/Mintplex-Labs/anything-llm/blob/v1.17.0/SECURITY.md)

**AnythingLLM 的官方 live sync 限制与本项目的指定目录同步直接相关。** 该功能仍标为 beta，不能监控整个目录；Docker 中经浏览器上传的本机文件不会自动更新。通用 watched-file 流程默认 stale 为七天、每小时检查；Desktop 本机文件则在应用打开时每十分钟检查，不能混为同一刷新策略。[Live document sync](https://docs.anythingllm.com/beta-preview/active-features/live-document-sync)

本机文件移动或删除后会显示 Not Found 并停止监控，但已保存内容和 embeddings 保持不变。这是“停止同步”与“撤回已摄取内容”的明确差别，采用该组件时需要另外定义本项目的删除行为。[Live document sync：本机文件](https://docs.anythingllm.com/beta-preview/active-features/live-document-sync)

细分 RBAC 是维护者提出且仍开放的需求，另有用户请求限制 Manager 范围。本研究将它们作为固定角色模型的已知改进请求，不作为泄露事件或所有用户的共同投诉。[AnythingLLM #1787](https://github.com/Mintplex-Labs/anything-llm/issues/1787)、[#5857](https://github.com/Mintplex-Labs/anything-llm/issues/5857)

本研究判断：每成员建立一个 workspace 可以快速形成按人问答原型，但“不能浏览原文、只能获得按请求批准的信息”仍需中介服务。较小的运行资源也不表示已完成目录同步、成员级 API 身份和回答分享规则。

### RAGFlow

**RAGFlow 的主要价值是复杂文档解析，适合 PDF 与表格资料较多时作为技术对照。** 本次核查的 v1.0.0-rc1 是 2026-09-29 的预发布文档，包含 DeepDoc/OCR、版式处理、分块、检索重排和引用；不能把这些描述全部外推到另一稳定版本。起始资源建议为 4 核、16 GB 内存和 50 GB 存储，Go image 的 ARM64 也有支持限制。[v1.0.0-rc1 文档](https://ragflow.io/docs/v1.0.0-rc1/)

开源资料共享范围主要是 Only me/Team；原生 MCP 可按请求认证并过滤用户可访问 datasets，返回资料 chunks 与元数据。另一种 self-host listener 默认使用统一 key/身份，不能把这种共享 key 配置当作每成员隔离。[Sharing scope](https://ragflow.io/docs/v1.0.0-rc1/guides/team/sharing_scope_configuration/open_source_edition_sharing_scope_configuration)、[MCP server](https://ragflow.io/docs/v1.0.0-rc1/use_ragflow_as_mcp_server)、[MCP tools](https://ragflow.io/docs/v1.0.0-rc1/mcp_tools)

本研究判断：如果首批资料主要是 Markdown/纯文本，解析平台的部署与配置可能超出这次验证所需。采用其检索接口也仍要处理调用者身份与成员回答权限，不能由资料域筛选直接推断已有输出分享控制。

## 资料问答的轻量替代

### Google NotebookLM / 当前官方文档中的 Gemini Notebook

**NotebookLM 这一类资料问答产品适合作为低成本价值验证替代，但它的共享权限与本项目的“仅提供获准回答”不同。** 2026-10-05 查到的官方帮助页标题为 Gemini Notebook，本报告不推断改名的历史时间。它以单个 notebook 的来源集合回答，不能在同一次查询中同时读取多个 notebook；私有共享中的 Viewer 可以读取获分享的来源和笔记。[创建与共享 notebook](https://support.google.com/gemininotebook/answer/16206563?hl=en)

Chat View 隐藏来源和 artifacts 以简化界面，却没有完全撤销 Viewer 的底层访问权，官方明确说用户仍可能通过其他导航路径访问。这是与“不把原文提供给其他成员”直接相关的已知限制，不能把隐藏界面当作资料权限。[公开与 Chat View 分享](https://support.google.com/gemininotebook/answer/16322204?hl=en)

来源更新并非统一行为：当前 Drive 来源自动同步，每几分钟更新，打开 notebook 也会刷新；源文件被删除或权限失去后不再用于回答。YouTube 来源则只导入字幕文本，视频删除或私有化后的来源删除可到 30 天。这里不能沿用旧版“Drive 只能手动 resync”的说明。[来源接入与更新](https://support.google.com/gemininotebook/answer/16215270?hl=en)

本研究判断：若用户愿意提供完整源资料访问，共享 notebook 可以快速验证“队友资料能否帮助当前任务”。如果核心需求是不给原文访问而按请求提供不同内容，公开文档中的 Chat View 不能直接满足这个权限承诺。每成员一个 notebook 也尚未解决工作 Agent 自动选择成员和统一查询的问题。

## 比较结果与已知痛点

**最接近的替代因使用场景而异：Delphi 更接近个人问答服务，Glean 更接近已有工作 Agent 的企业知识入口，teamcontext.ai 更接近队友当前工作上下文。** 开源问答平台则主要降低内部检索与生成的实施成本。以下是已查文档的能力比较，“未建立证据”不是全市场不存在的结论。

| 产品/方案 | 资料与身份组织 | 已核查工作入口 | 与“可询问 B、不可直接读取 B 全部原文”的关系 | 本项目仍需比较或实现 |
| --- | --- | --- | --- | --- |
| [Delphi](https://www.delphi.ai/blog/access-groups-give-the-right-people-the-right-version-of-your-digital-mind) | 个人 Mind＋受众资料/额度/回答规则 | 产品页面、embed、REST 流式会话 | 最接近；原文不必公开，具体输出与检索权限需验证 | 群组成员目录、宿主 `@`、会话自动求助 |
| [Glean](https://docs.glean.com/user-guide/mcp/usage) | 企业内容＋源 ACL＋身份/活动 | 自有 Chat `@`、工作 Agent MCP/插件 | 标准回答采用请求者源权限；Agent 调用是另一路径 | 成员服务授权、确认流程与接口时限 |
| [Microsoft Copilot](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/overview) | 组织或用户索引＋源 ACL；实时连接 | M365 Copilot/Search、连接器 | 标准源权限读取；用户私有索引不自动变成他人问答服务 | 成员服务层、组织接入、权限刷新 |
| [ChatGPT](https://help.openai.com/en/articles/20001143/) | 个人连接或共享/Agent 自有连接 | Company Knowledge、共享 Agent、Codex plugin、异步 API | 可用比请求者更广的账户权限；仍需限制受众及输出 | 服务人与自然人对应、调用结果协议、宿主体验 |
| [teamcontext.ai](https://teamcontext.ai/docs/mcp-tools/) | 团队捕获的会话/决策/活动 | coding-agent hooks＋MCP | 标准接口可搜索 turns；按作者过滤不同于仅回答权限 | 资料采集范围、逐成员分享、维护成本 |
| [supermemory](https://supermemory.ai/docs/supermemory-mcp/mcp) | 带权限的 space/container | OAuth MCP、MCP Apps 空间选择 | 同空间 read 可以包含正文读取，需受控中介 | 成员问答服务、派生记忆生命周期 |
| [Onyx](https://docs.onyx.app/security/architecture/access_controls) | 企业索引＋Enterprise 文档 ACL | 原生搜索/问答＋MCP | 标准文档访问权限不直接表达转换后回答权限 | 版本权限范围、成员服务与部署 |
| [Dify](https://docs.dify.ai/en/self-host/use-dify/publish/publish-mcp) | 知识库、应用与工作空间角色 | Web App、API、应用 MCP | 应用可将答案提供给消费者；成员规则需应用设计 | 身份、知识域、提供回答前授权 |
| [AnythingLLM](https://docs.anythingllm.com/features/security-and-access) | workspace＋固定多人角色 | 自有聊天、REST；MCP 为客户端 | workspace 聊天权限可快速原型，不能直接推导细粒度分享 | 同步、API 中介与逐成员权限 |
| [RAGFlow](https://ragflow.io/docs/v1.0.0-rc1/mcp_tools) | dataset＋用户/团队范围 | 原生问答、MCP、API | 检索返回 chunks，需要另外控制允许输出 | 解析投入、部署身份、成员服务 |
| [NotebookLM / Gemini Notebook](https://support.google.com/gemininotebook/answer/16322204?hl=en) | notebook 内来源集合与共享 | 自有 Chat、共享 Chat View | Chat View 隐藏界面不撤销原文访问 | 真正输出权限、跨成员查找、工作 Agent 入口 |

**文档已经说明的困难集中在资料生命周期、权限粒度和执行接口。** 下表不统计痛点的发生率，也不把工程问题等同于用户有付费需求。

| 困难 | 证据类型与已知事实 | 对本项目的直接含义 |
| --- | --- | --- |
| 源删除尚未传播到索引 | 官方限制：[Glean](https://docs.glean.com/connectors/crawling-faq) 源删除依赖事件与 full crawl，时间按 connector 不同 | 显示同步时间；服务确认撤回后如何阻止旧内容，需要独立契约 |
| 源 ACL 与索引权限不同时更新 | 官方限制：[Microsoft 外部 indexed connector](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/indexed-content) 的 ACL 在 full crawl 更新，可能到 24 小时 | 内容同步、身份同步和授权变化分开处理，不能只观察上传成功 |
| 同步连接删除仍保留已摄取资料 | 官方限制：[Delphi](https://help.delphi.ai/articles/16041852-add-knowledge-train-mind) 删除 feed 不删除 Knowledge；[AnythingLLM](https://docs.anythingllm.com/beta-preview/active-features/live-document-sync) 本机删除停止 watch 但保留内容/embedding | 必须分别定义停止同步、禁用回答、删除索引和删除副本 |
| 隐藏来源界面仍有底层访问权 | 官方限制：[Google Chat View](https://support.google.com/gemininotebook/answer/16322204?hl=en) 不完全撤销来源访问 | 客户端不能得到可绕过问答权限的原文接口或凭据 |
| 共享身份权限大于请求者权限 | 文档能力与治理要求：[ChatGPT Agent-owned/shared connections](https://help.openai.com/en/articles/20001143/) 使用连接账户权限 | 允许调用某服务与可查看该服务全部来源，必须分开授权 |
| 即时工具调用无法承载临时人工确认 | 官方接口限制：[Glean](https://docs.glean.com/administration/platform/mcp/agents-as-tools) 部分 HITL Agent 不能作为 MCP 工具；不同 API 有异步恢复 | 答案立即可读和需要确认时的等待，采用明确状态及结果协议 |
| 数据库删除、向量与附件清理不一致 | 特定 commit 的问题报告：[Dify #42641](https://github.com/langgenius/dify/issues/42641)，未复现 | 检查禁用/删除后的实际可检索范围与共享附件引用 |
| 多人权限或连接器不在最轻版本 | 官方产品范围：[Onyx Enterprise ACL](https://docs.onyx.app/security/architecture/access_controls)、[supermemory managed 团队功能](https://supermemory.ai/docs/self-hosting/local-vs-enterprise)；[Dify 不同版本应用认证](https://docs.dify.ai/en/self-host/use-dify/publish/webapp/web-app-settings) | 对照实际可部署版本与许可证，不能只比较首页功能列表 |
| 更快的模式可能减少检索或引用 | 官方质量说明：[Glean fast mode](https://docs.glean.com/user-guide/assistant/best-practices) 可能不对每个问题搜索公司资料，深推理时延更长 | 对成员问答要求检索依据，不能以快速输出文字作为正确回答验收 |

各行对本项目的含义是本研究判断，需要用真实问题比较检索范围、回答正确性与等待成本。

**公开资料尚未建立的能力，集中在当前项目的组合业务约定。** 本次没有核查到一项现成方案完整说明：同一群组的每位成员独立授权资料；任意选定工作 Agent 输入 `@` 获得同一成员列表；主动 Skill 调用的授权只对当前会话有效；生成中的回答受到最新分享规则约束；所有撤回与历史副本按同一契约处理。各部分已有实现，这组流程是否值得专门开发仍然是待验证问题。

## 对当前 MVP 的建议

**建议维持 A，先把现有检索能力用于实现一条成员问答流程，再选择一项有实测证据的工程问题深入完成。** 这次调研支持“技术上有实现路线”，也确认竞争者比“共享知识库”这一概括更接近本项目；它没有证明本项目已经获得需求差异或 PMF。

### 产品比较应先使用实际工作问题

首先比较两种资料需求：问题的答案是否已经在全组有权阅读的材料中，还是需要某位成员提供尚未全组公开的材料。如果绝大多数问题属于前者，共享知识问答可能已经足够；如果后者频繁出现，成员对不同请求选择可提供内容的能力才有明确使用理由。这是用户研究问题，不由采用集中式或分布式架构决定。

建议使用同一批真实工作问题比较三条流程：现在人工询问队友的流程、最接近的现有产品、Along MVP。现有产品的选择按资料和账号条件确定：个人问答先看 Delphi；已有企业连接器和工作 Agent 看 Glean/ChatGPT；已经愿意共享完整资料的用户可用 notebook 作为简单基线。此处提出比较方法，本次没有运行比较。

观察内容应包括：得到的答案是否帮助当前任务、求助者还需几次追问、资料所属成员花多少时间维护或确认、成员关闭电脑后是否仍可回答、等待时间、模型消耗及之后是否重复使用。不要用“成功返回一段文字”代替这些结果，也不要将方案的技术复杂度当成产品价值。

### 业务接口应保留两个成员身份

每次请求至少区分请求方 A 与资料所属成员 B。服务器认证 A，确认 A 可以请求 B 的问答服务；内部检索仅访问 B 当前获准的资料，按 B 的回答与分享规则处理，再向 A 提供获准答案。A 的原文读取权限与服务内部资料处理权限单独定义；B 的设置也不应让服务获得任意电脑访问权。

可以复用成熟检索/模型组件，但不把 B 资料库的直接检索 key 交给 A 的工作 Agent。现有平台的 `fetch`、`get_document` 或 chunks API 很适合内部检索，直接对消费者开放会改变“只获得获准信息”的行为。返回给 A 的来源应是获准片段、来源标识、版本/时间和可访问链接，而不是一个无法打开的本机路径。

这里的输出权限必须控制回答正文、引用、标题及元数据。隐藏来源面板只能改变界面；模型拥有片段后也可能在回答中复述。规则和模型检查可以帮助执行策略，但本次没有测量其正确性，也不将一次模型通过视为信息永不泄露的保证。

### 首个深入工程问题可以选资料撤回

建议把“服务已经确认成员撤回授权后，旧资料能否继续进入新的最终回答”作为一个明确的工程验证问题。先确定生效点，再验证检索、生成、确认和提供回答之间的状态关系。现有文档的删除/禁用接口没有自动建立这个契约，本项目也尚未实现或测量它。

建议采用以下具有不同因果路径的验证场景：

1. B 撤回资料时，模型已经得到片段但尚未完成；候选回答必须如何结束或重建。
2. 回答等待 B 确认时，资料范围变化；批准操作基于哪个版本，是否仍可提供。
3. 队列重试或重复调用发生时，旧请求不得重新使用已撤回资料。
4. 原文被删除但向量/缓存清理尚未完成时，业务鉴权是否仍能阻止提供答案。

记录可复现的错误、修改后行为及额外时延/消耗，才能形成工程证据。历史回答或用户已经复制的内容采用另外的保留规则；不要承诺可以从接收者所有副本删除既有信息。这里建议验证较小的服务约定，没有建议一次建设完整撤回平台。

### 工作 Agent 成员选择需要独立验证宿主能力

**远程 MCP 可以提供成员查询与求助工具，但不能自动控制所有宿主的输入框。** 已有 Glean 人物标签、ChatGPT Agent Tagging 和 supermemory 空间选择分别发生在不同界面；它们不证明任意宿主都接受一个服务动态注册自然人成员 `@` 候选。当前 MVP 应先选择一个实际宿主，核查其成员选择扩展点，并完成一次可观察交互，再承诺支持范围。

求助 Skill 用于说明用户主动开启会话自动求助后的工作流程。服务仍要确认会话授权、身份、分享范围和资源额度；“Skill 被安装、被读取或模型知道这条指令”不能独立证明用户主动授权。授权怎样关联真实会话和怎样撤销，继续作为设计澄清事项。

### 本次不需要增加的能力

本研究没有提出把完整企业 connectors、复杂记忆图、自动全会话捕获或多套响应路径设为首个 MVP 前提。先采用成员选定目录和一套在线处理路径，用实际问题判断是否需要语义检索、复杂格式解析或更多源连接；首批资料主要是文本时，不能由竞品的 PDF/OCR 能力反推本项目也必须具备。

仍需继续澄清的决定包括：首个支持的工作 Agent；发起方与提供方的分享检查；成员临时确认的入口；同步与撤回的生效规则；请求超时、追问和资源耗尽结果；引用展示范围。此处是研究形成的问题清单，不自动替用户确定答案。

## 来源版本与时间记录

所有引用于 2026-10-05 检索或打开。未标发布日期的持续更新页面视为当天公开文档快照，不把检索时间当作功能首次发布日。Preview、research preview、Coming soon 保留原有可用性级别；没有核查账户或租户实际获配功能。

| 关键来源 | 文档自身的日期或版本 | 本研究采用内容 |
| --- | --- | --- |
| [Glean MCP](https://docs.glean.com/user-guide/mcp/usage) | 更新于 2026-09-11 | 工作 Agent 宿主、工具与 OAuth |
| [Glean AI Answers](https://docs.glean.com/user-guide/assistant/ai-answers) | 更新于 2026-08-27 | 标准回答的源权限 |
| [Glean Search FAQ](https://docs.glean.com/administration/search/faq) | 更新于 2026-09-29 | 内容、身份、活动及 Indexing API |
| [Glean Citations](https://docs.glean.com/user-guide/assistant/glean-chat/glean-chat-citations/glean-citations) | 更新于 2026-09-29 | 引用、原文访问与历史保留 |
| [Glean 回答质量](https://docs.glean.com/user-guide/assistant/answer-quality) | 更新于 2026-09-30 | `@` 人物/文档、质量与时延说明 |
| [Glean best practices](https://docs.glean.com/user-guide/assistant/best-practices) | 更新于 2026-09-21 | Fast mode 的公司知识检索限制 |
| [Glean Crawl FAQ](https://docs.glean.com/connectors/crawling-faq) | 更新于 2026-09-30 | 删除事件、完整抓取、临时隐藏 |
| [Glean Agent runs 发布说明](https://docs.glean.com/release-notes/releases/2026-09-29-september-release) | 发布于 2026-09-29 | durable runs 与异步恢复，不同于 MCP 约束 |
| [Microsoft connector overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/overview) | 更新于 2026-09-22 | 三种接入与写入发布说明 |
| [Microsoft federated](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/federated-connectors-overview) | 更新于 2026-09-30 | 实时 MCP、请求者身份、Coming soon |
| [Microsoft indexed content](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/indexed-content) | 更新于 2026-09-25 | ACL 传播与 full crawl |
| [Microsoft access permissions](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/manage-access-permissions) | 更新于 2026-03-19 | Everyone 与重建连接 |
| [ChatGPT Plugin controls](https://learn.chatgpt.com/docs/enterprise/apps-and-connectors) | 当天文档快照，未确定首次发布日期 | 同步、连接、角色和源权限 |
| [Company Knowledge](https://help.openai.com/en/articles/12628342/)、[Workspace Agents 帮助](https://help.openai.com/en/articles/20001143/) | 当天文档快照，实际 rollout 未验证 | 知识插件与当前工作 Agent 入口 |
| [Workspace Agents 示例](https://developers.openai.com/cookbook/articles/chatgpt-agents-sales-meeting-prep) | 当天文档快照，research preview | End-user 与 Agent-owned 身份 |
| [Workspace connections](https://learn.chatgpt.com/docs/enterprise/shared-connections) | 当天文档快照 | 摘要访问与原文访问分离 |
| [Workspace Agent trigger](https://developers.openai.com/cookbook/examples/chatgpt/workspace_agents/workspace-agents-api-trigger) | 当天文档快照 | 异步触发，非完成回答 |
| [Delphi Access Groups](https://www.delphi.ai/blog/access-groups-give-the-right-people-the-right-version-of-your-digital-mind) | 发布于 2025-08-19 | 按受众资料、额度与回答设置 |
| [Delphi Knowledge](https://help.delphi.ai/articles/16041852-add-knowledge-train-mind)、[Settings](https://help.delphi.ai/articles/16042964-settings) | 更新于 2026-09-18 | 导入/连接、citation 与 feed 删除 |
| [Delphi Preferences](https://help.delphi.ai/articles/17222184-preferences) | 更新于 2026-09-28 | Private Mind 与访问设置 |
| [Delphi API](https://docs.delphi.ai/api-immortal-only) | 当天文档快照，未确定首次发布日期 | clone key、会话/流式与套餐范围 |
| [teamcontext.ai Docs](https://teamcontext.ai/docs/)、[隐私政策](https://teamcontext.ai/privacy-policy/) | Docs 未标发布日期；政策标 2026-10-05 | hooks、MCP、会话共享与需核对的采集范围 |
| [supermemory MCP](https://supermemory.ai/docs/supermemory-mcp/mcp)、[权限](https://supermemory.ai/docs/authentication) | 当天文档快照，未确定首次发布日期 | OAuth、空间、key 与派生数据生命周期 |
| [Onyx v4.8.4](https://github.com/onyx-dot-app/onyx/releases/tag/v4.8.4) 与上述当前 docs | 版本发布于 2026-10-02 | 版本与文档依赖差异，不混写对象存储 |
| [Dify 1.17.1](https://github.com/langgenius/dify/releases/tag/1.17.1) 与上述当前 docs | 版本发布于 2026-09-10 | 应用构建、权限与部署 |
| [Dify #42641](https://github.com/langgenius/dify/issues/42641) | 创建于 2026-09-21，核查时 Open；指定 main commit | 特定版本多模态删除问题报告，未复现 |
| [AnythingLLM v1.17.0](https://github.com/Mintplex-Labs/anything-llm/releases/tag/v1.17.0) 与上述当前 docs | 版本发布于 2026-10-01 | 多人角色、API 权限与 beta sync |
| [AnythingLLM #1787](https://github.com/Mintplex-Labs/anything-llm/issues/1787)、[#5857](https://github.com/Mintplex-Labs/anything-llm/issues/5857) | 分别创建于 2024-06-28、2026-06-17，核查时 Open | 维护者与用户请求更细角色权限 |
| [RAGFlow v1.0.0-rc1 文档](https://ragflow.io/docs/v1.0.0-rc1/) | 2026-09-29 的预发布文档 | 解析、部署、认证模式和 MCP 检索 |
| [Google notebook 创建](https://support.google.com/gemininotebook/answer/16206563?hl=en)、[Chat View](https://support.google.com/gemininotebook/answer/16322204?hl=en)、[sources](https://support.google.com/gemininotebook/answer/16215270?hl=en) | 当天文档快照，未确定首次发布日期 | 来源集合、共享、更新与删除 |
