# 2026-10-06 产品方向归档

本次归档保存兴趣小组场景确立前的产品文档，以保留此前的设计过程。当前产品定义见 [兴趣小组场景与产品定义](../../product-design/product-definition.md)，当前领域词汇见 [CONTEXT.md](../../../CONTEXT.md)。

## 归档内容

| 文档 | 归档原因 |
| --- | --- |
| [完整 PRD](docs/product-design/prd.md) | 主要围绕工作任务求助、固定熟人群组、管理员管理与团队知识复用，缺少以个人主页和人际连接为中心的体验。 |
| [最小 MVP](docs/product-design/minimal-mvp.md) | 优先验证提问方 Agent 读取同步资料完成任务，尚未包含成员主页、了解彼此和由了解形成合作的流程。 |
| [原领域词汇](CONTEXT.md) | 包含自行部署、模型配额、监督和响应器等此前设计概念，群组定义要求成员相互认识。 |
| [初期场景调查](docs/customer-investigation/initial-discovery.md) | 场景选择围绕跨人工作上下文、科研和组织协作，其验证任务不对应当前兴趣小组的连接目标。 |
| [此前痛点记录](docs/customer-investigation/pain-points.md) | 主要来自创业、分析师、团队知识库与课题组，保留为此前调查记录。 |
| [团队上下文问题](docs/random-thoughts/team-context-problem.md) | 将产品问题定义为当前任务的上下文搜索、传递和使用，不能作为当前场景的核心问题定义。 |
| [Agent 网络效应思考](docs/random-thoughts/agent-network-effect.md) | 价值判断集中于关键模型调用的上下文与任务质量，需要按人与人之间的连接重新讨论。 |
| [Agent 团队实践场景研究](docs/research/agent-team-practice-scenarios.md) | 优先推荐科研或已有小项目，以可追溯信息获取和人工成本为主要验证目标。 |

## 归档方式

归档保存的是归档时工作区中的文件，包含已有未提交修改。原始目录关系在本目录内保留，Markdown 链接按目标文件的新位置调整，正文保留；[原始内容哈希](source-hashes.json)记录调整链接前各文件的 SHA-256。

架构设计、ADR 和技术选型继续保留在原目录作为参考；实现代码和身份服务记录继续保留。GitHub 上的既有规格与 tickets 属于此前实施计划，新的产品定义没有将它们转换成新场景的实施规格。
